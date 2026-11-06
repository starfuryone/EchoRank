// src/ai/anthropic-request.ts
//
// The rules for a Claude request in ONE place, so each call site does not have
// to know which model generation it is talking to.
//
// HOUSE CALLS vs TRACKING ANSWERS. Two different jobs, two different rules:
//
//   - A house call (analysis, classification, drafting, the assistant) is our
//     own work. It runs on HOUSE_CLAUDE_MODEL with thinking off: these are short,
//     well-specified tasks, and thinking would only spend max_tokens and money.
//   - A tracking answer is what we OBSERVE: what a Claude model says to an
//     ordinary person. It runs with the model's own defaults, because a
//     setting we chose would change what we measure.
//
// WHAT EVERY REQUEST HONOURS, house or tracking:
//   - no `temperature`, `top_p` or `top_k`. From the 4.6 generation on, a
//     non-default value is a 400;
//   - no assistant prefill (a final assistant turn). Also a 400 on those models;
//   - the reply is read by block TYPE. A model that thinks puts thinking blocks
//     before the text.
//
// Dependency-free on purpose: server modules, scripts and tests all import it.

/** The model for every Claude call that is not a tracking answer. */
export const HOUSE_CLAUDE_MODEL = "claude-haiku-5-5";

/**
 * Claude models from the 4.6 generation on: adaptive thinking (on by default
 * for most), `effort`, and a 400 for sampling parameters and prefill.
 * The older generations think only when asked and take no `effort`.
 */
export function claudeIsAdaptive(model: string): boolean {
  return (
    !/^claude-(haiku-4|sonnet-4-5|opus-4-5|opus-4-1|opus-4-0|sonnet-4-0|3)/.test(model) &&
    !/^claude-(sonnet|opus)-4$/.test(model)
  );
}

/**
 * The 5 family's tokenizer counts the same text as about 30% more tokens than
 * Haiku 4.5's did. A cap sized for an answer of a given length has to grow by
 * the same factor, or the same answer is cut short.
 */
export const NEW_TOKENIZER_FACTOR = 1.3;

export function claudeHasNewTokenizer(model: string): boolean {
  return /^claude-(haiku|sonnet|opus|fable)-5/.test(model);
}

/** A max_tokens cap sized in Haiku 4.5 tokens, restated for `model`'s tokenizer. */
export function claudeMaxTokens(model: string, cap: number): number {
  return claudeHasNewTokenizer(model) ? Math.ceil(cap * NEW_TOKENIZER_FACTOR) : cap;
}

/**
 * Models that reject `thinking: {type: "disabled"}`. Sonnet 5.5 turns thinking
 * off with {type: "between_tools"} instead, which still thinks between tool
 * calls; for a house call we leave its default rather than half-disable it.
 */
function cannotDisableThinking(model: string): boolean {
  return /^claude-sonnet-5-5/.test(model);
}

export interface ClaudeControls {
  max_tokens: number;
  thinking?: { type: "disabled" };
}

/**
 * The request fields that differ by model, for a HOUSE call: the cap restated
 * for the tokenizer, and thinking turned off on a model that thinks by default
 * (thinking counts against max_tokens, so a cap sized for the answer would be
 * spent before the answer starts). Never a temperature.
 */
export function houseClaudeControls(model: string, cap: number): ClaudeControls {
  const controls: ClaudeControls = { max_tokens: claudeMaxTokens(model, cap) };
  if (claudeIsAdaptive(model) && !cannotDisableThinking(model)) {
    controls.thinking = { type: "disabled" };
  }
  return controls;
}

/**
 * Throws when `messages` ends on an assistant turn — a prefill, which models
 * from the 4.6 generation reject with a 400. Every Claude caller in this repo
 * runs its messages through here before sending, so one cannot come back.
 */
export function assertNoPrefill(messages: ReadonlyArray<{ role: string }>): void {
  const last = messages[messages.length - 1];
  if (last && last.role === "assistant") {
    throw new Error("Claude request ends on an assistant turn (a prefill); end it on a user turn");
  }
}

// ─── Prices ─────────────────────────────────────────────────────────────────

/**
 * Published Anthropic list prices, USD per 1M tokens (platform.claude.com
 * pricing page, read 2026-11-06). Cache reads bill at a tenth of input.
 *
 * Haiku 5.5 has TWO rate cards, chosen by the prompt's length: up to 100K
 * prompt tokens one rate, above it a higher one, applied to the whole request.
 */
export interface ClaudePrice {
  inputPerMTok: number;
  outputPerMTok: number;
  cachedInputPerMTok: number;
  /** The rate card for prompts longer than `aboveTokens`, when the model has one. */
  longPrompt?: {
    aboveTokens: number;
    inputPerMTok: number;
    outputPerMTok: number;
    cachedInputPerMTok: number;
  };
}

export const CLAUDE_PRICES: Readonly<Record<string, ClaudePrice>> = {
  "claude-haiku-5-5": {
    inputPerMTok: 0.1,
    outputPerMTok: 0.5,
    cachedInputPerMTok: 0.01,
    longPrompt: { aboveTokens: 100_000, inputPerMTok: 0.5, outputPerMTok: 2.5, cachedInputPerMTok: 0.05 },
  },
  "claude-haiku-4-5": { inputPerMTok: 1, outputPerMTok: 5, cachedInputPerMTok: 0.1 },
  // $2/$10: the announced rise to $3/$15 was cancelled.
  "claude-sonnet-5": { inputPerMTok: 2, outputPerMTok: 10, cachedInputPerMTok: 0.2 },
  "claude-sonnet-5-5": { inputPerMTok: 2, outputPerMTok: 10, cachedInputPerMTok: 0.2 },
  "claude-opus-5": { inputPerMTok: 5, outputPerMTok: 25, cachedInputPerMTok: 0.5 },
  "claude-opus-5-5": { inputPerMTok: 4, outputPerMTok: 20, cachedInputPerMTok: 0.4 },
};

/** The price for `model`, accepting a dated snapshot id (`-YYYYMMDD`). Null when unknown. */
export function claudePrice(model: string): ClaudePrice | null {
  return CLAUDE_PRICES[model] ?? CLAUDE_PRICES[model.replace(/-\d{8}$/, "")] ?? null;
}

export interface ClaudeUsage {
  inputTokens: number;
  outputTokens: number;
  /** Prompt tokens served from the cache; counted in the prompt's length too. */
  cachedInputTokens?: number;
}

/** The rate card that applies to one call's prompt length. */
export function rateCardFor(
  price: ClaudePrice,
  promptTokens: number,
): Omit<ClaudePrice, "longPrompt"> {
  return price.longPrompt && promptTokens > price.longPrompt.aboveTokens ? price.longPrompt : price;
}

/** USD for one call at list price, or null when `model` has no published price here. */
export function claudeCostUsd(model: string, usage: ClaudeUsage): number | null {
  const price = claudePrice(model);
  if (!price) return null;
  const cached = usage.cachedInputTokens ?? 0;
  const card = rateCardFor(price, usage.inputTokens + cached);
  return (
    (usage.inputTokens / 1e6) * card.inputPerMTok +
    (usage.outputTokens / 1e6) * card.outputPerMTok +
    (cached / 1e6) * card.cachedInputPerMTok
  );
}
