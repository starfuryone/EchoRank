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
  /** The estimate: tokens per page per prompt (6,000 chars of text ≈ 1.5k input, plus the answer). */
  tokensPerCall: 2_000,
} as const;

/** N pages × prompts × ~2k tokens. */
export function aiTokenEstimate(ai: Pick<AiConfig, "prompts" | "top"> | null): number {
  return ai ? ai.top.pages * ai.prompts.length * AI_LIMITS.tokensPerCall : 0;
}
