// src/lib/ai-monitor/pricing.ts
//
// Token -> USD for every AI provider the visibility monitor can call.
//
// PURE ON PURPOSE. No Prisma, no env reads at module scope, no I/O — so the
// arithmetic that decides whether a tenant has hit its monthly cap is testable
// without a database, and so a client component can import a provider id
// without dragging the server bundle along.
//
// COST IS DERIVED AT WRITE TIME, NOT AT READ TIME. Every AiProviderCall row
// stores the USD it cost, computed from the token counts the provider returned
// and the rates in force at that moment. Recomputing spend from a price table
// at read time would silently rewrite history the first time a vendor changed
// its prices — the September bill would move because October got cheaper.
//
// RATES ARE ENV-OVERRIDABLE, and that is the load-bearing part. A provider
// becomes AVAILABLE when its API key is set (see the adapters), with no deploy
// needed. If its price lived only in this file, flipping a provider on that way
// would meter it at zero: the calls would happen, the cap would not see them,
// and the first sign of trouble would be the vendor's invoice. Setting
// AI_RATES_<PROVIDER> alongside the key closes that hole without a code change.

/**
 * Providers the monitor knows how to call. Stored verbatim in
 * AiProviderCall.provider and Checkup.providers.
 */
export const AI_PROVIDERS = [
  "CLAUDE",
  "CHATGPT",
  "GOOGLE_AI_OVERVIEWS",
  "GEMINI",
  "GROK",
  "MISTRAL",
  "LLAMA",
] as const;

export type AiProvider = (typeof AI_PROVIDERS)[number];

export function isAiProvider(value: string): value is AiProvider {
  return (AI_PROVIDERS as readonly string[]).includes(value);
}

/** What a call was for. Kept coarse — this is for cost attribution, not tracing. */
export type CallPurpose = "answer" | "analysis" | "inference";

export interface TokenRates {
  /** USD per 1,000,000 input tokens. */
  inputPerMTok: number;
  /** USD per 1,000,000 output tokens. */
  outputPerMTok: number;
  /** USD per 1,000,000 input tokens served from cache. */
  cachedInputPerMTok: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
}

/**
 * Providers that are not billed per token at all.
 *
 * Google AI Overviews arrives through DataForSEO's SERP endpoint, so its cost
 * is a DataForSEO cost and is already metered as a SeoApiCall row. Its
 * AiProviderCall row carries that same figure so one checkup's total is
 * complete, but there are no tokens to price and "unpriced" is not a bug here.
 */
export const TOKEN_FREE_PROVIDERS: ReadonlySet<AiProvider> = new Set<AiProvider>([
  "GOOGLE_AI_OVERVIEWS",
]);

/**
 * Published rates, per 1M tokens.
 *
 * ONLY RATES WE CAN CITE LIVE HERE. Anthropic's are first-party published
 * figures (Haiku 4.5 $1/$5, Sonnet 5 $3/$15, Opus 5 $5/$25; cache reads bill at
 * ~0.1x input). Every other vendor is deliberately absent rather than guessed —
 * a wrong rate does not fail, it quietly mis-bills, and a cap enforced against
 * a made-up number is worse than no cap because it looks like it works. Supply
 * those through AI_RATES_<PROVIDER> when the key is added.
 *
 * Keyed "PROVIDER:model", with "PROVIDER:*" as a per-provider fallback.
 */
export const DEFAULT_RATES: Readonly<Record<string, TokenRates>> = {
  "CLAUDE:claude-haiku-4-5": { inputPerMTok: 1.0, outputPerMTok: 5.0, cachedInputPerMTok: 0.1 },
  "CLAUDE:claude-sonnet-5": { inputPerMTok: 3.0, outputPerMTok: 15.0, cachedInputPerMTok: 0.3 },
  "CLAUDE:claude-opus-5": { inputPerMTok: 5.0, outputPerMTok: 25.0, cachedInputPerMTok: 0.5 },
};

/** Env var carrying a provider's rates: "input,output,cachedInput" per MTok. */
export function rateEnvName(provider: AiProvider): string {
  return `AI_RATES_${provider}`;
}

/**
 * Parse an AI_RATES_<PROVIDER> value.
 *
 * "1,5,0.1" -> full rates. "1,5" -> cached input defaults to a tenth of input,
 * which is the ratio every vendor that offers caching currently uses; it is a
 * default, not an assumption we hide, and the three-value form overrides it.
 * Anything unparseable returns null and is treated as "not configured" rather
 * than as zero — a malformed rate must not silently make calls look free.
 */
export function parseRates(raw: string | undefined): TokenRates | null {
  if (!raw) return null;
  const parts = raw.split(",").map((p) => Number(p.trim()));
  if (parts.length < 2 || parts.length > 3) return null;
  if (!parts.every((n) => Number.isFinite(n) && n >= 0)) return null;

  const [inputPerMTok, outputPerMTok, cached] = parts;
  return {
    inputPerMTok,
    outputPerMTok,
    // Divide rather than multiply by 0.1: 3 * 0.1 is 0.30000000000000004 in
    // binary floating point, and a rate carrying that artifact leaks into every
    // cost derived from it.
    cachedInputPerMTok: cached ?? inputPerMTok / 10,
  };
}

/**
 * Rates in force for a provider/model, or null when we have none.
 *
 * Env wins over the built-in table so a vendor price change can be applied
 * without a deploy — this box serves production from the working tree, and a
 * price correction should not need a rebuild.
 */
export function ratesFor(
  provider: AiProvider,
  model: string,
  env: NodeJS.ProcessEnv = process.env,
): TokenRates | null {
  return (
    parseRates(env[rateEnvName(provider)]) ??
    DEFAULT_RATES[`${provider}:${model}`] ??
    DEFAULT_RATES[`${provider}:*`] ??
    null
  );
}

/** AiProviderCall.costUsd is Decimal(10,6); round to match, so the row is exact. */
export function roundUsd(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

export interface PricedCall {
  costUsd: number;
  /**
   * False when no rates were found. The caller records the row anyway — losing
   * the call entirely would be worse — but flags it, because an unpriced
   * provider under-counts against the monthly cap.
   */
  priced: boolean;
}

/**
 * USD for one call's token usage.
 *
 * Cached input is billed at its own rate and is NOT also counted as input:
 * providers report the cached portion separately from the fresh portion, so
 * adding both would double-charge the cheap half.
 */
export function costUsdFor(
  provider: AiProvider,
  model: string,
  usage: TokenUsage,
  env: NodeJS.ProcessEnv = process.env,
): PricedCall {
  if (TOKEN_FREE_PROVIDERS.has(provider)) {
    // Not token-billed; the caller supplies the upstream cost directly.
    return { costUsd: 0, priced: true };
  }

  const rates = ratesFor(provider, model, env);
  if (!rates) return { costUsd: 0, priced: false };

  const usd =
    (usage.inputTokens / 1e6) * rates.inputPerMTok +
    (usage.outputTokens / 1e6) * rates.outputPerMTok +
    (usage.cachedInputTokens / 1e6) * rates.cachedInputPerMTok;

  return { costUsd: roundUsd(usd), priced: true };
}

/**
 * Providers that would meter at zero if switched on right now.
 *
 * The dashboard and the report both want this: "you set GEMINI_API_KEY but no
 * GEMINI rates, so its spend is invisible to your cap".
 */
export function unpricedProviders(
  providers: readonly AiProvider[],
  modelOf: (provider: AiProvider) => string,
  env: NodeJS.ProcessEnv = process.env,
): AiProvider[] {
  return providers.filter(
    (p) => !TOKEN_FREE_PROVIDERS.has(p) && ratesFor(p, modelOf(p), env) === null,
  );
}
