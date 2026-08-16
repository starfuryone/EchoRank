// src/lib/assistant/pro/agent.ts
//
// One turn of the Pro assistant: the tool loop, and the budget that ends it.
//
// THE ORDER IS STILL CACHE → HEURISTIC → MODEL, the same discipline the public
// assistant follows, applied one level up:
//
//   HEURISTIC FIRST, AND IT IS NOT A MODEL CALL. `needsAccountData()` below is
//   a regex over the customer's own message. A greeting, a "what does GEO
//   mean", a pricing question — none of those need a tenant's crawl data, and
//   routing them to the reasoning model with twelve tool schemas attached would
//   pay for an investigation nobody asked for. Those go to the fast model with
//   no tools at all, which is both cheaper and structurally safer.
//
//   CACHE INSIDE THE TOOLS. Every tool is tenant-cached and per-turn memoized
//   (tools.ts), so a loop that asks for the same rollup twice pays once.
//
//   MODEL LAST, AND BOUNDED. Two budgets: tool calls per turn, and output
//   tokens per call. Both are env-configurable and both are enforced here
//   rather than requested in the prompt.
//
// ── WHAT HAPPENS WHEN THE TOOL BUDGET RUNS OUT ──────────────────────────────
// Not an error, and not a silent truncation. The pending tool calls are
// answered with an explicit "budget spent" tool_result — the API requires every
// tool_use block to have a matching tool_result, and skipping that is how an
// over-budget turn becomes a 400 on the next request — a note is appended, and
// one final call is made with `tool_choice: "none"`. The customer gets an
// answer built from what was gathered, and the answer says what was not
// checked. `budgetExceeded` comes back on the result so the route can count it.
//
// ── HISTORY IS REPLAYED AS TEXT, NEVER AS TOOL BLOCKS ───────────────────────
// Stored messages carry role and content; tool payloads are deliberately not
// persisted (see the schema comment on AssistantMessage.toolSummary). So a
// replayed conversation is plain text turns, and the current turn's tool blocks
// live only inside this function. That is a feature: it means yesterday's
// crawler page text is not re-injected into today's context, and it means the
// replay can never contain an orphaned tool_use whose result was pruned.

import { proAssistantLimits, fastModel, reasoningModel } from "../config";
import { TurnCache } from "../cache";
import {
  blockText,
  callAssistantModelRaw,
  type ChatTurn,
  type ContentBlock,
} from "../model";
import { budgetExhaustedNote, proSystemBlocks } from "./prompt";
import { renderResult, toolEvidence } from "./evidence";
import { runTool, toolDefinitions, type ToolContext } from "./tools";
import type { DashLocale } from "@/lib/i18n/dashboard";

/** Prior turns replayed to the model. Full history stays in Postgres. */
export const MAX_HISTORY_MESSAGES = 10;
/** Longest customer message accepted. Anything longer is a paste, not a question. */
export const MAX_MESSAGE_CHARS = 4000;

/**
 * Words that mean "this is about MY account", so a tool call is worth its cost.
 *
 * DELIBERATELY GENEROUS. A false positive costs one cheap tool call against a
 * cached rollup; a false negative is an assistant confidently answering a
 * question about the customer's own data from nothing. The asymmetry says to
 * lean towards checking, so possessives and every product noun are in.
 */
const ACCOUNT_WORDS =
  /\b(my|our|we|us|i'm|i am|mine|this account|the account|my site|our site|dashboard|score|audit|crawl|rank(ing|s)?|keyword|prompt|competitor|citation|mention|visibility|traffic|clicks|impressions|position|search console|gsc|domain|website|changed|change|improve|drop|fell|rose|why|trend|week|month|compare|worse|better)\b/i;

/** Questions that are about the product, not the account. */
const PRODUCT_ONLY =
  /^\s*(hi|hello|hey|thanks|thank you|what is|what's|what are|who are|how does echorank|explain|define|difference between)\b/i;

/**
 * Does answering this need the customer's own data?
 *
 * Pure and synchronous — no model call to decide whether to make a model call.
 */
export function needsAccountData(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  // "What is llms.txt?" is a definition; "why did my score change?" is not,
  // even though both start with a question word. Account words win ties.
  if (ACCOUNT_WORDS.test(text)) return true;
  if (PRODUCT_ONLY.test(text)) return false;
  // Anything else is ambiguous. Checking is the cheaper mistake.
  return true;
}

export interface StoredTurn {
  role: "user" | "assistant";
  content: string;
}

/** One line of "what did it look at", stored on the assistant message. */
export interface ToolSummaryEntry {
  tool: string;
  ok: boolean;
  cached: boolean;
}

export interface ProTurnResult {
  answer: string;
  toolSummary: ToolSummaryEntry[];
  /** True when the turn hit the per-turn tool cap and answered from what it had. */
  budgetExceeded: boolean;
  cost: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    toolCalls: number;
    /** Tool calls answered from cache — the ones that cost nothing. */
    cachedToolCalls: number;
    /** True when the router decided no tools were needed and none were sent. */
    toolsSkipped: boolean;
  };
}

/**
 * Trim replayed history and make it start on a user turn.
 *
 * The Messages API requires the first message to be `user`; a history whose
 * window happens to open on an assistant reply is a 400, and that depends on
 * where the customer's tenth-from-last message fell.
 */
export function trimHistory(history: StoredTurn[]): ChatTurn[] {
  const recent = history.slice(-MAX_HISTORY_MESSAGES);
  const firstUser = recent.findIndex((turn) => turn.role === "user");
  const usable = firstUser <= 0 ? recent : recent.slice(firstUser);
  return usable.map((turn) => ({ role: turn.role, content: turn.content }));
}

export interface ProTurnInput {
  message: string;
  history: StoredTurn[];
  locale: DashLocale;
  ctx: Omit<ToolContext, "turn">;
}

export async function runProTurn(input: ProTurnInput): Promise<ProTurnResult> {
  const limits = proAssistantLimits();
  const turn = new TurnCache();
  const ctx: ToolContext = { ...input.ctx, turn };
  const system = proSystemBlocks(input.locale, input.ctx.tenantName);

  const messages: ChatTurn[] = [
    ...trimHistory(input.history),
    { role: "user", content: input.message.trim() },
  ];

  const summary: ToolSummaryEntry[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let toolCalls = 0;
  let cachedToolCalls = 0;
  let budgetExceeded = false;

  // ── The cheap path: no account data needed, no tools, one call ──
  if (!needsAccountData(input.message)) {
    const result = await callAssistantModelRaw({
      model: fastModel(),
      system,
      messages,
      maxTokens: limits.maxOutputTokens,
    });
    return {
      answer: blockText(result.blocks) || fallbackAnswer(),
      toolSummary: [],
      budgetExceeded: false,
      cost: {
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        cacheReadTokens: result.cacheReadTokens,
        toolCalls: 0,
        cachedToolCalls: 0,
        toolsSkipped: true,
      },
    };
  }

  // ── The investigation path: reasoning model, tools, bounded loop ──
  const tools = toolDefinitions();
  const model = reasoningModel();

  // One iteration per model call. The cap is derived from the tool budget
  // rather than set separately: the loop cannot outlive the budget that ends
  // it, and a second independent number is a second thing to get wrong.
  const maxIterations = limits.maxToolCalls + 2;

  let answer = "";

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const outOfBudget = toolCalls >= limits.maxToolCalls;

    const result = await callAssistantModelRaw({
      model,
      system,
      messages,
      maxTokens: limits.maxOutputTokens,
      tools,
      // Tools stay DECLARED even when forbidden — see the note on toolChoice
      // in model.ts. Dropping them would invalidate the tool_use blocks
      // already in this conversation.
      toolChoice: outOfBudget ? "none" : "auto",
    });

    inputTokens += result.inputTokens;
    outputTokens += result.outputTokens;
    cacheReadTokens += result.cacheReadTokens;

    const text = blockText(result.blocks);
    if (text) answer = text;

    const requested = result.blocks.filter(
      (block): block is Extract<ContentBlock, { type: "tool_use" }> =>
        block.type === "tool_use",
    );

    if (result.stopReason !== "tool_use" || requested.length === 0) break;

    // The assistant turn is echoed back VERBATIM, tool_use blocks included.
    // The next request has to contain them or the tool_result blocks below
    // reference nothing.
    messages.push({ role: "assistant", content: result.blocks });

    const results: ContentBlock[] = [];

    for (const call of requested) {
      // Checked per CALL, not per iteration: one assistant turn can request
      // four tools at once, and a per-iteration check would let a single turn
      // blow through the cap in one go.
      if (toolCalls >= limits.maxToolCalls) {
        budgetExceeded = true;
        results.push({
          type: "tool_result",
          tool_use_id: call.id,
          is_error: true,
          content: toolEvidence(
            call.name,
            renderResult({
              error: `Not run: this turn's budget of ${limits.maxToolCalls} tool calls is spent.`,
            }),
            false,
          ),
        });
        continue;
      }

      toolCalls += 1;
      const outcome = await runTool(call.name, call.input, ctx);
      if (outcome.cached) cachedToolCalls += 1;
      summary.push({ tool: call.name, ok: outcome.ok, cached: outcome.cached });

      results.push({
        type: "tool_result",
        tool_use_id: call.id,
        // `is_error` is set for a tool that could not answer, so the model
        // treats it as a gap to report rather than as data to describe.
        ...(outcome.ok ? {} : { is_error: true }),
        // EVERY result is quarantined, including our own error strings — one
        // wrapper, no exceptions, so there is no path where a tool's output
        // reaches the model unmarked.
        content: toolEvidence(call.name, renderResult(outcome.value), outcome.ok),
      });
    }

    // All results in ONE user message. Splitting them across several messages
    // trains the model to stop making parallel calls, which makes every later
    // turn slower for no benefit.
    messages.push({ role: "user", content: results });

    if (budgetExceeded) {
      messages.push({ role: "user", content: budgetExhaustedNote(limits.maxToolCalls) });
    }
  }

  return {
    answer: answer || fallbackAnswer(),
    toolSummary: summary,
    budgetExceeded,
    cost: {
      model,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      toolCalls,
      cachedToolCalls,
      toolsSkipped: false,
    },
  };
}

/**
 * What the customer sees when the loop produced no text at all.
 *
 * Reachable only if the model spent every iteration calling tools and never
 * wrote a word, which the `tool_choice: "none"` final call is designed to
 * prevent. It exists because "the answer is the empty string" must never be
 * what gets rendered and saved as a conversation turn.
 */
function fallbackAnswer(): string {
  return "I could not put an answer together for that one. Try asking it a different way, or narrow it to a single question.";
}
