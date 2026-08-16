// src/lib/assistant/agent.ts
//
// One turn of the public assistant, in the order the work is allowed to happen:
//
//   CACHE  →  HEURISTIC  →  LLM  →  (nothing else)
//
// The model is the LAST thing consulted and the only thing that costs money per
// turn, so everything cheap runs first. A domain the assistant has already
// scanned today is answered from Redis; the findings themselves are computed in
// TypeScript (heuristics.ts) and handed to the model as evidence to explain.
//
// THE MODEL HAS NO TOOLS. Whether to scan is decided here, from the visitor's
// own message, by a regex — not by the model, and never by anything read off a
// scanned page. That is what makes the injection surface in prompt.ts small
// enough to reason about: a hostile page can make an answer wrong, it cannot
// make the assistant do anything.

import { assistantLimits, fastModel, reasoningModel } from "./config";
import { renderEvidence, type HeuristicSummary } from "./heuristics";
import { callAssistantModel, type ChatTurn } from "./model";
import { evidenceBlock, systemBlocks, type AssistantLocale } from "./prompt";
import { TurnCache } from "./cache";
import { scanDomain, type SpendDecision } from "./scan";

/** How many prior turns are replayed. Enough for context, bounded for cost. */
export const MAX_HISTORY_TURNS = 8;
/** Longest visitor message accepted. Anything longer is a paste, not a question. */
export const MAX_MESSAGE_CHARS = 1200;

/**
 * Domains the visitor may have typed.
 *
 * Deliberately conservative. It wants a real-looking hostname with a 2+ letter
 * TLD, and it will not fire on "e.g." or a decimal number. A false negative just
 * means the visitor gets a general answer and can use the scan box; a false
 * positive spends someone's one daily scan on garbage.
 */
const DOMAIN_RE =
  /\b(?:https?:\/\/)?((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24})(?:\/[^\s]*)?/i;

/**
 * Last labels that mean "this is a filename", not "this is a website".
 *
 * "What is llms.txt?" is the single most likely question on this page, and
 * without this list it parses as a request to scan the host `llms.txt` — a
 * false positive that spends the visitor's one daily scan on a file extension
 * before answering the question they actually asked.
 */
const FILE_SUFFIXES = new Set([
  "txt",
  "xml",
  "json",
  "html",
  "htm",
  "js",
  "ts",
  "css",
  "md",
  "csv",
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "svg",
  "webp",
  "zip",
  "yml",
  "yaml",
  "env",
  "log",
  "php",
  "py",
  "sh",
]);

/** Words that mean "look at this site", used only for the log/telemetry label. */
const SCAN_WORDS = /\b(scan|audit|check|analy[sz]e|look at|review|grade)\b/i;

export type TurnIntent = "scan" | "explain" | "product";

export interface DetectedTarget {
  domain: string;
  explicit: boolean;
}

/** Pull a scannable domain out of a message, or null. */
export function detectDomain(message: string): DetectedTarget | null {
  const match = DOMAIN_RE.exec(message);
  if (!match) return null;
  const host = match[1].toLowerCase();
  const labels = host.split(".");
  // "llms.txt", "sitemap.xml", "package.json" — a filename, not a host.
  if (labels.length === 2 && FILE_SUFFIXES.has(labels[1])) return null;
  // "echorank360.com" in a question about us is not a scan request.
  if (host.endsWith("echorank360.com")) return null;
  return { domain: host, explicit: SCAN_WORDS.test(message) };
}

export interface AgentInput {
  message: string;
  history: ChatTurn[];
  locale: AssistantLocale;
  /** Set when the visitor used the scan box rather than typing a domain. */
  scanTarget?: string;
  /** Called before any live sidecar fetch. Returns false to refuse the spend. */
  spendScan: () => Promise<SpendDecision>;
  /** Called before the model call. Returns false to refuse the spend. */
  spendChat: () => Promise<SpendDecision>;
}

export type AgentDenial = "rate_limited" | "invalid_domain";

export interface AgentAnswer {
  ok: true;
  answer: string;
  intent: TurnIntent;
  /** Deterministic findings, when this turn produced or reused a scan. */
  scan: (HeuristicSummary & { domain: string }) | null;
  cost: {
    /** True when the scan evidence came from cache and bought nothing. */
    scanCached: boolean;
    /** True when a live sidecar fetch happened. */
    scanFetched: boolean;
    model: string;
    outputTokens: number;
    inputTokens: number;
    cacheReadTokens: number;
    /** Distinct cache lookups this turn made. */
    lookups: number;
  };
}

export interface AgentRefusal {
  ok: false;
  reason: AgentDenial;
  /** A partial scan may still have succeeded before the chat budget refused. */
  scan: (HeuristicSummary & { domain: string }) | null;
}

export type AgentResult = AgentAnswer | AgentRefusal;

function trimHistory(history: ChatTurn[]): ChatTurn[] {
  const recent = history.slice(-MAX_HISTORY_TURNS);
  // The Messages API wants the conversation to start on a user turn.
  const firstUser = recent.findIndex((t) => t.role === "user");
  return firstUser <= 0 ? recent : recent.slice(firstUser);
}

export async function runTurn(input: AgentInput): Promise<AgentResult> {
  const turn = new TurnCache();
  const limits = assistantLimits();

  const detected = input.scanTarget
    ? { domain: input.scanTarget, explicit: true }
    : detectDomain(input.message);

  let summary: (HeuristicSummary & { domain: string }) | null = null;
  let scanCached = false;
  let scanFetched = false;

  if (detected) {
    const result = await scanDomain(turn, detected.domain, input.spendScan);
    if (result.ok) {
      summary = { ...result.summary, domain: result.domain };
      scanCached = result.cached;
      scanFetched = !result.cached;
    } else if (result.reason === "refused") {
      // Out of scans. When the visitor came in through the scan box that is the
      // whole request, so say so rather than answering a question nobody asked.
      if (input.scanTarget) return { ok: false, reason: "rate_limited", scan: null };
    } else if (result.reason === "invalid_domain" && input.scanTarget) {
      return { ok: false, reason: "invalid_domain", scan: null };
    }
    // A failed opportunistic scan falls through: the visitor still asked a
    // question, and a general answer beats an error page.
  }

  const intent: TurnIntent = summary ? "scan" : detected ? "explain" : "product";

  // The model is consulted last, and only now is a chat unit spent.
  const chatDecision = await input.spendChat();
  if (!chatDecision.ok) return { ok: false, reason: "rate_limited", scan: summary };

  const userContent = summary
    ? `${input.message.trim()}\n\n${evidenceBlock(renderEvidence(summary))}`
    : input.message.trim();

  // Synthesis over scan evidence gets the mid model; everything else — plain
  // explanation and product questions — gets the low-cost one.
  const model = summary ? reasoningModel() : fastModel();

  const result = await callAssistantModel({
    model,
    system: systemBlocks(input.locale),
    messages: [...trimHistory(input.history), { role: "user", content: userContent }],
    maxTokens: limits.maxOutputTokens,
  });

  return {
    ok: true,
    answer: result.text,
    intent,
    scan: summary,
    cost: {
      scanCached,
      scanFetched,
      model: result.model,
      outputTokens: result.outputTokens,
      inputTokens: result.inputTokens,
      cacheReadTokens: result.cacheReadTokens,
      lookups: turn.size,
    },
  };
}
