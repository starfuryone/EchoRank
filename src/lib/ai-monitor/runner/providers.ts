// src/lib/ai-monitor/runner/providers.ts
//
// Which engines the runner is allowed to spend money at, and how it asks them.
//
// FAIL CLOSED ON PRICE. An engine with no rate entry does not run. Not "runs
// and meters at zero", not "runs and logs a warning" — refuses. Metering at
// zero is the worst of the three: the calls happen, the monthly cap never sees
// them, and the first sign is the vendor's invoice. pricing.ts already flags
// unpriced calls on the way out; this is the gate on the way in, and it is what
// makes the cap an actual ceiling rather than a best effort.
//
// THAT GATE BINDS EVEN WHEN A KEY IS SET AND AN ADAPTER EXISTS. Availability
// (engines.ts) and affordability (this file) are separate questions, and a
// tenant would rather have four engines that bill correctly than six where two
// appear free until the month closes.
//
// ADAPTERS: CLAUDE, CHATGPT, GEMINI. Only CLAUDE has built-in rates, because
// pricing.ts ships Anthropic's published prices and nothing else. ChatGPT and
// Gemini have adapters (./http-engines.ts) but stay refused with `no_rates`
// until the operator sets BOTH AI_RATES_<P> and AI_SEARCH_FEE_<P> — they are
// search-billed, and a token rate alone would under-meter them by more than
// half. Deliberately an operator action taken against the vendor's current
// price list, so a deploy never switches new spend on by itself. `refusals()`
// exists so that is visible in the dashboard rather than looking like an outage.

import type { AnthropicProvider } from "@/ai/providers/anthropic";
import type { EngineSpec } from "../engines";
import { engineAvailability } from "../engines";
import { TRACKING_MAX_TOKENS } from "@/ai/anthropic-request";
import {
  SEARCH_BILLED_PROVIDERS,
  TOKEN_FREE_PROVIDERS,
  rateEnvName,
  ratesFor,
  searchFeeEnvName,
  searchFeeFor,
} from "../pricing";

export type RefusalReason =
  | "missing_key"
  | "missing_config"
  | "unknown_engine"
  | "no_rates"
  | "no_adapter";

export interface EngineRefusal {
  provider: string;
  reason: RefusalReason;
  detail: string;
}

/**
 * Providers the runner can actually call today.
 *
 * A provider is runnable only when an adapter exists for it. The catalogue
 * names eight engines because the dashboard, the seeding and the capability
 * flags all need them; that is a different question from whether this process
 * can send one a request.
 */
export const ADAPTER_PROVIDERS: ReadonlySet<string> = new Set<string>(["CLAUDE", "CHATGPT", "GEMINI"]);

/**
 * Is this engine priced? Token-free providers carry their cost another way;
 * search-billed ones need their per-search fee as well as token rates.
 */
export function isPriced(engine: EngineSpec, env: NodeJS.ProcessEnv = process.env): boolean {
  if (TOKEN_FREE_PROVIDERS.has(engine.provider)) return true;
  if (ratesFor(engine.provider, engine.modelName, env) === null) return false;
  if (SEARCH_BILLED_PROVIDERS.has(engine.provider)) {
    return searchFeeFor(engine.provider, env) !== null;
  }
  return true;
}

/** The env lines an unpriced engine is missing, named for the refusal detail. */
function missingPriceEnv(engine: EngineSpec, env: NodeJS.ProcessEnv): string[] {
  const missing: string[] = [];
  if (ratesFor(engine.provider, engine.modelName, env) === null) missing.push(rateEnvName(engine.provider));
  if (SEARCH_BILLED_PROVIDERS.has(engine.provider) && searchFeeFor(engine.provider, env) === null) {
    missing.push(searchFeeEnvName(engine.provider));
  }
  return missing;
}

/** Why this engine cannot run, or null when it can. */
export function refusalFor(
  engine: EngineSpec,
  env: NodeJS.ProcessEnv = process.env,
): EngineRefusal | null {
  const availability = engineAvailability(engine.provider, env);
  if (!availability.available) {
    return {
      provider: engine.provider,
      reason: availability.reason ?? "unknown_engine",
      detail: `missing env: ${availability.missing.join(", ") || "unknown"}`,
    };
  }
  if (!ADAPTER_PROVIDERS.has(engine.provider)) {
    return {
      provider: engine.provider,
      reason: "no_adapter",
      detail: "no adapter is implemented for this provider yet",
    };
  }
  if (!isPriced(engine, env)) {
    return {
      provider: engine.provider,
      reason: "no_rates",
      detail: `set ${missingPriceEnv(engine, env).join(" and ")} before enabling this engine`,
    };
  }
  return null;
}

/** The engines a checkup may spend at, from the ones its tier allows. */
export function runnableEngines(
  engines: readonly EngineSpec[],
  env: NodeJS.ProcessEnv = process.env,
): EngineSpec[] {
  return engines.filter((engine) => refusalFor(engine, env) === null);
}

/** Everything that was excluded, and why — for the dashboard and the logs. */
export function refusals(
  engines: readonly EngineSpec[],
  env: NodeJS.ProcessEnv = process.env,
): EngineRefusal[] {
  return engines
    .map((engine) => refusalFor(engine, env))
    .filter((refusal): refusal is EngineRefusal => refusal !== null);
}

export interface AskRequest {
  provider: string;
  model: string;
  promptText: string;
}

export interface AskResult {
  answer: string;
  inputTokens: number;
  outputTokens: number;
  /** The model actually served, which is what the ledger prices. */
  model: string;
  latencyMs: number;
  /** Billed web searches (search-grounded engines only). */
  searchCalls?: number;
  /** Sources the engine returned structurally, when it does. */
  sources?: { url: string }[] | null;
}

/**
 * The system prompt a monitored question is asked under.
 *
 * NEUTRAL ON PURPOSE. The point is to observe what the engine says to an
 * ordinary person, so nothing here may nudge it toward naming, ranking or
 * praising anyone — a prompt that asks for "the top tools" would manufacture
 * the ranked list the score then measures, and every brand would look ranked.
 */
export const ASK_SYSTEM_PROMPT =
  "You are answering a question from a member of the public. Answer as you " +
  "normally would, in your own words and at your usual length.";

/**
 * Enough for a full recommendation answer without paying for an essay, for the
 * HTTP engines (ChatGPT, Gemini). Claude's tracking answer uses the shared
 * TRACKING_MAX_TOKENS instead, the cap every Claude tracking surface sends.
 */
export const ASK_MAX_TOKENS = 1_200;

export interface AskDeps {
  anthropic?: AnthropicProvider;
  now?: () => number;
  /** For the HTTP adapters (ChatGPT, Gemini). */
  fetch?: typeof fetch;
  env?: NodeJS.ProcessEnv;
}

/**
 * Ask one engine one question.
 *
 * Throws for an unroutable provider rather than returning an empty answer: the
 * runner's plan is built from runnableEngines(), so reaching here with
 * something else is a bug in the plan, and a silent "" would be scored as a
 * genuine answer in which the brand did not appear.
 */
export async function askEngine(request: AskRequest, deps: AskDeps = {}): Promise<AskResult> {
  const clock = deps.now ?? (() => Date.now());
  const startedAt = clock();

  if (request.provider === "CHATGPT" || request.provider === "GEMINI") {
    // Imported lazily, like the Anthropic SDK below: http-engines is
    // server-only, and this module's pure gates are read by the setup wizard.
    const { askHttpEngine } = await import("./http-engines");
    const result = await askHttpEngine(
      {
        provider: request.provider,
        model: request.model,
        systemPrompt: ASK_SYSTEM_PROMPT,
        promptText: request.promptText,
        maxOutputTokens: ASK_MAX_TOKENS,
      },
      { fetch: deps.fetch, env: deps.env },
    );
    return {
      answer: result.answer,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      model: result.model,
      latencyMs: clock() - startedAt,
      searchCalls: result.searchCalls,
      sources: result.sources,
    };
  }

  if (request.provider !== "CLAUDE") {
    throw new Error(`no adapter for provider ${request.provider}`);
  }

  const { AnthropicProvider: Anthropic } = await import("@/ai/providers/anthropic");
  const provider = deps.anthropic ?? new Anthropic();

  const result = await provider.infer({
    systemPrompt: ASK_SYSTEM_PROMPT,
    userPrompt: request.promptText,
    // The shared Claude tracking cap; no web search tool is offered.
    maxTokens: TRACKING_MAX_TOKENS,
    // The engine's own defaults: no temperature (claude-sonnet-5 returns a 400
    // for it — found by a dogfood run), no thinking setting, the cap as given.
    // The point of this call is to observe what the engine says to an
    // ordinary person, not what it says under settings we chose.
    mode: "observe",
    // Pinned per call. AnthropicProvider falls back to ANTHROPIC_MODEL, and an
    // env change moving the monitor onto a different model would change both
    // the bill and every score it produces.
    modelId: request.model,
  });

  return {
    answer: result.content,
    inputTokens: result.promptTokens,
    outputTokens: result.completionTokens,
    model: result.modelId,
    latencyMs: clock() - startedAt,
  };
}
