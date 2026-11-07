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
// ADAPTERS: CLAUDE (Anthropic, built-in rates), GOOGLE_AI_OVERVIEWS (DataForSEO
// SERP, behind AI_ENGINE_GOOGLE_AI_OVERVIEWS=on), and CHATGPT / GEMINI through
// DataForSEO's LLM Scraper standard queue (./llm-scraper.ts). The last three
// are token-free: their cost is DataForSEO's billed figure (pricing.ts,
// TOKEN_FREE_PROVIDERS), so they are priced without any rate env. ChatGPT and
// Gemini went live on that path on 2026-11-07, after their tests passed and
// five real tasks were checked (ECHORANK-AI-TIER.md). The direct-API adapters
// (./http-engines.ts) are kept but off: askEngine refuses those providers.
// `refusals()` exists so an excluded engine is visible in the dashboard rather
// than looking like an outage.

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
export const ADAPTER_PROVIDERS: ReadonlySet<string> = new Set<string>([
  "CLAUDE",
  "CHATGPT",
  "GEMINI",
  "GOOGLE_AI_OVERVIEWS",
]);

/**
 * Google AI Overviews' switch. Its cost is DataForSEO's own envelope figure, so
 * there is no rate to withhold the way ChatGPT's and Gemini's are withheld; it
 * ships off behind this line instead (runner/aio-engine.ts).
 */
export const AIO_ENABLE_ENV = "AI_ENGINE_GOOGLE_AI_OVERVIEWS";

export function aioEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[AIO_ENABLE_ENV]?.trim().toLowerCase() === "on";
}

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
  if (engine.provider === "GOOGLE_AI_OVERVIEWS" && !aioEnabled(env)) {
    return {
      provider: engine.provider,
      reason: "missing_config",
      detail: `set ${AIO_ENABLE_ENV}=on to enable this engine (DataForSEO Live, $0.002 to $0.004 a check)`,
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
  /**
   * The tenant the call is for. Google AI Overviews needs it: its DataForSEO
   * call is metered against the tenant's DataForSEO cap as well.
   */
  tenantId?: string;
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
  /** USD, for an engine not billed per token (Google AI Overviews). */
  costUsd?: number;
  /** Why the answer is empty, when that is a finding rather than a fault. */
  emptyReason?: string;
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
  /** For Google AI Overviews: the metered DataForSEO call. Default: bound to request.tenantId. */
  serpCall?: import("./aio-engine").SerpCall;
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
    // Answered through DataForSEO's LLM Scraper queue, which cannot be waited
    // on here: the tracker's ports route these slots to ./llm-scraper.ts. The
    // direct-API adapters (./http-engines.ts) stay off; nothing calls them.
    throw new Error(
      `${request.provider} is answered through the LLM Scraper queue (runner/llm-scraper.ts), not askEngine`,
    );
  }

  if (request.provider === "GOOGLE_AI_OVERVIEWS") {
    // Lazy for the same reason as http-engines: aio-engine is server-only.
    const { askAiOverview, meteredSerpCall } = await import("./aio-engine");
    const call =
      deps.serpCall ??
      (request.tenantId
        ? meteredSerpCall(request.tenantId)
        : (() => {
            throw new Error("GOOGLE_AI_OVERVIEWS needs a tenantId to meter its DataForSEO call");
          })());
    const result = await askAiOverview(request.promptText, call, deps.env);
    return {
      answer: result.answer,
      inputTokens: 0,
      outputTokens: 0,
      model: request.model,
      latencyMs: clock() - startedAt,
      sources: result.sources,
      costUsd: result.costUsd,
      emptyReason: result.emptyReason,
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
