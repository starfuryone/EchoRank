// src/lib/site-crawler/ai-shared.ts
//
// Crawl with AI (Phase 4e): the prompt presets, providers and limits, and
// the token estimate the start card shows. Dependency-free: the crawl form
// (a Client Component) imports it. The calls are in ai-prompts.ts.

export const AI_PRESETS = ["intent", "summary", "title", "grammar", "custom"] as const;
export type AiPreset = (typeof AI_PRESETS)[number];

/** claude runs on the house key and the Marketing Studio token budget; the others on the tenant's own key. */
export const AI_PROVIDERS = ["claude", "openai", "gemini"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export interface AiPrompt {
  preset: AiPreset;
  /** custom: the instruction. */
  text: string | null;
}

export interface AiConfig {
  provider: AiProvider;
  prompts: AiPrompt[];
  /** The top N pages by inlinks, optionally inside one segment. N at most the plan's crawlAiPages. */
  top: { pages: number; segment: number | null };
}

export const AI_LIMITS = {
  prompts: 3,
  customChars: 500,
  /** Visible text sent per page. */
  textChars: 6_000,
  /** Stored output per prompt and page. */
  outputBytes: 1_024,
  /**
   * The estimate before discounts: tokens per page per prompt for a full-length
   * page. 6,000 characters of text come to about 2k input tokens on Claude
   * Haiku 5.5's tokenizer (about 30% more tokens than Haiku 4.5's for the
   * same text), plus the ~200-token prefix and the answer with brief
   * low-effort thinking. Pages with less text cost less, so this leans high.
   */
  tokensPerCall: 2_400,
} as const;

/**
 * What the providers' pricing pages charge relative to base input (ratios,
 * not prices): cache reads 0.1x, Anthropic's 5-minute cache writes 1.25x,
 * the batch APIs 0.5x on input and output alike.
 */
export const AI_DISCOUNTS = { cacheRead: 0.1, cacheWrite: 1.25, batch: 0.5 } as const;

/** Whether this provider's prompts go through a batch (Claude, OpenAI) when crawl.aiBatch is on; Gemini never. */
export function aiBatchApplies(provider: AiProvider | undefined, batchOn: boolean): boolean {
  return batchOn && (provider === "claude" || provider === "openai");
}

/**
 * The tokens one call is charged, after the cache and batch discounts, in
 * base-input-token units (input and output counted alike, as the meter always
 * has). This is what the Marketing Studio meter records and the run shows.
 */
export function chargedTokens(
  u: { inputTokens: number; outputTokens: number; cacheReadTokens?: number; cacheWriteTokens?: number },
  batched: boolean,
): number {
  const input = u.inputTokens + (u.cacheWriteTokens ?? 0) * AI_DISCOUNTS.cacheWrite + (u.cacheReadTokens ?? 0) * AI_DISCOUNTS.cacheRead;
  return Math.round((input + u.outputTokens) * (batched ? AI_DISCOUNTS.batch : 1));
}

/** One call's estimate, charged: tokensPerCall, halved in a batch. (The prefix is under every cache minimum: no cache discount.) */
export function aiCallEstimate(batched: boolean): number {
  return Math.round(AI_LIMITS.tokensPerCall * (batched ? AI_DISCOUNTS.batch : 1));
}

/** N pages × prompts × the charged estimate per call (halved when the prompts go through a batch). */
export function aiTokenEstimate(ai: (Pick<AiConfig, "prompts" | "top"> & { provider?: AiProvider }) | null, opts: { batch?: boolean } = {}): number {
  return ai ? ai.top.pages * ai.prompts.length * aiCallEstimate(aiBatchApplies(ai.provider, opts.batch ?? false)) : 0;
}
