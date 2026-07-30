// src/lib/bot-catalog.ts
// The crawler tokens Bot Analytics reports on, with org + what each feeds.
// Tokens must match what the av-visibility sidecar's /bots endpoint defaults
// to (av_service.py) — the app sends this exact list explicitly. Localized
// per-bot descriptions live in BOT_ANALYTICS_COPY.botDesc keyed by token.

export type BotCategory = "search" | "ai_training" | "ai_answers";

export interface BotInfo {
  token: string;
  org: string; // proper noun, not translated
  category: BotCategory;
}

export const BOT_CATALOG: BotInfo[] = [
  { token: "Googlebot", org: "Google", category: "search" },
  { token: "Bingbot", org: "Microsoft", category: "search" },
  { token: "Google-Extended", org: "Google", category: "ai_training" },
  { token: "GPTBot", org: "OpenAI", category: "ai_training" },
  { token: "OAI-SearchBot", org: "OpenAI", category: "ai_answers" },
  { token: "ClaudeBot", org: "Anthropic", category: "ai_training" },
  { token: "anthropic-ai", org: "Anthropic", category: "ai_training" },
  { token: "PerplexityBot", org: "Perplexity", category: "ai_answers" },
  { token: "CCBot", org: "Common Crawl", category: "ai_training" },
  { token: "Bytespider", org: "ByteDance", category: "ai_training" },
  { token: "Amazonbot", org: "Amazon", category: "ai_answers" },
  { token: "Applebot-Extended", org: "Apple", category: "ai_training" },
  { token: "meta-externalagent", org: "Meta", category: "ai_training" },
];

/**
 * Tokens that are robots.txt PREFERENCE SIGNALS, not crawlers. Nothing fetches
 * as these: Google-Extended governs whether Gemini may train on what Googlebot
 * already fetched, and Applebot-Extended does the same for Apple Intelligence
 * over Applebot's fetches. The active access check skips them, because probing
 * them would mean inventing a User-Agent nobody sends and reporting the result
 * as if it meant something. For them robots.txt is the whole truth.
 */
export const PREFERENCE_ONLY_TOKENS: readonly string[] = [
  "Google-Extended",
  "Applebot-Extended",
];

export const BOT_TOKENS = BOT_CATALOG.map((b) => b.token);
