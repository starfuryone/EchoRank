// src/lib/ai-monitor/wizard/scoring.ts
//
// How the wizard ranks the questions it suggests, before truncating to the
// tier's allowance.
//
// A THIRD SCORE, AND DELIBERATELY NOT EITHER OF THE OTHER TWO. TrackedPrompt
// already carries relevanceScore (is this question about this brand at all) and
// commercialValue (how much money sits behind it). This one answers "of the
// forty candidates the model wrote, which twenty should a new customer start
// with", which is a different question and needs relevance AND value AND how
// natural the sentence sounds. Collapsing it into either of the others would
// change a number other code already reads.
//
// NOT NAMED importanceScore. TrackedPrompt.importanceWeight already exists — a
// customer-set multiplier on a prompt's contribution to the rolled-up score —
// and two fields called importance* on one row is how someone autocompletes
// into the wrong one. This is the score that ORDERED THE SUGGESTIONS, so it is
// suggestionScore.
//
// PURE. Every input is passed in, so the weights can be exercised directly and
// a test can prove that moving one changes the ranking.

import { CATEGORY_SPECS, type PromptCategory, type PromptIntent } from "../prompts/categories";

/**
 * The four components, weighted.
 *
 * TOPICAL RELEVANCE LEADS because a beautifully phrased question about the
 * wrong subject is worthless, while a clumsy one about the right subject still
 * measures something real. CATEGORY MATCH is next: it is what stops the set
 * being twenty variations of "best X". NATURALNESS is last but present — a
 * question nobody would type gets an answer nobody would see, and the whole
 * measurement is a fiction. It is the one component a model reliably gets wrong
 * in the same direction, which is why it is weighted lightest.
 */
export const SUGGESTION_WEIGHTS = {
  topicalRelevance: 0.35,
  categoryMatch: 0.3,
  commercialIntent: 0.2,
  queryNaturalness: 0.15,
} as const;

export interface SuggestionSignals {
  /** 0-100. How much this question is about what the brand actually does. */
  topicalRelevance: number;
  /** 0-100. How well it fits the category it claims. */
  categoryMatch: number;
  /** 0-100. How much money sits behind the question. */
  commercialIntent: number;
  /** 0-100. How much it reads like something a person typed. */
  queryNaturalness: number;
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/** 0-100, one decimal of precision discarded — this is a sort key. */
export function suggestionScore(signals: SuggestionSignals): number {
  return Math.round(
    SUGGESTION_WEIGHTS.topicalRelevance * clamp(signals.topicalRelevance) +
      SUGGESTION_WEIGHTS.categoryMatch * clamp(signals.categoryMatch) +
      SUGGESTION_WEIGHTS.commercialIntent * clamp(signals.commercialIntent) +
      SUGGESTION_WEIGHTS.queryNaturalness * clamp(signals.queryNaturalness),
  );
}

/** Words that make a question read like a search box rather than a person. */
const KEYWORDESE = /\b(20\d\d|best|top|cheap|review|vs)\b/gi;

/**
 * How much this reads like something someone typed to an assistant.
 *
 * DETERMINISTIC, not another model call. The generator was already told what
 * natural looks like and given examples; asking a second model to grade the
 * first is a call per candidate, and it agrees with itself about as often as it
 * disagrees. What a regex CAN settle is the shape: a question with a verb and a
 * question mark reads like speech, a five-word noun pile with a year in it
 * reads like a keyword someone pasted from a rank tracker.
 */
export function naturalness(text: string): number {
  const trimmed = (text ?? "").trim();
  if (trimmed.length === 0) return 0;

  const words = trimmed.split(/\s+/).length;
  let score = 50;

  // Speech markers.
  if (/\?\s*$/.test(trimmed)) score += 15;
  if (/\b(i|we|my|our|me|us)\b/i.test(trimmed)) score += 15;
  if (/^(what|which|how|why|who|where|when|is|are|can|should|do|does|would)\b/i.test(trimmed)) {
    score += 10;
  }

  // Keyword markers. Counted rather than flagged: one "best" is how people
  // talk, three plus a year is a rank-tracker export.
  const keywordish = trimmed.match(KEYWORDESE)?.length ?? 0;
  score -= Math.min(30, keywordish * 10);

  // Length. Under four words is a keyword; over thirty-five is a brief.
  if (words < 4) score -= 25;
  if (words > 35) score -= 15;

  return clamp(score);
}

/**
 * Commercial intent for a candidate, from the taxonomy rather than invented.
 *
 * CATEGORY_SPECS.baseValue already ranks the funnel and is the number the
 * commercial-value scorer uses; reproducing that ranking here with different
 * figures would give a brand two different answers to "which of my questions
 * are worth money".
 */
export function commercialIntentFor(category: PromptCategory, intent: PromptIntent): number {
  const base = CATEGORY_SPECS[category].baseValue;
  // A navigational question is someone who already knows the name — the answer
  // matters far less than for the same category asked cold.
  if (intent === "navigational") return clamp(base * 0.6);
  if (intent === "research") return clamp(base * 0.85);
  return clamp(base);
}

export interface ScorableCandidate {
  text: string;
  category: PromptCategory;
  intent: PromptIntent;
  /** 0-100, from the deterministic relevance scorer. */
  topicalRelevance: number;
  /**
   * 0-100. Whether the model's own category label fits the sentence. Supplied
   * by the caller so a cheaper or better classifier can replace it without
   * touching the weights.
   */
  categoryMatch: number;
}

/** The four signals for one candidate, ready to weight. */
export function signalsFor(candidate: ScorableCandidate): SuggestionSignals {
  return {
    topicalRelevance: candidate.topicalRelevance,
    categoryMatch: candidate.categoryMatch,
    commercialIntent: commercialIntentFor(candidate.category, candidate.intent),
    queryNaturalness: naturalness(candidate.text),
  };
}

export interface RankedSuggestion<T extends ScorableCandidate = ScorableCandidate> {
  candidate: T;
  score: number;
  signals: SuggestionSignals;
}

/**
 * Score, sort descending, truncate to the tier's allowance.
 *
 * TIES BREAK ON THE ORIGINAL ORDER, which is the order the generator produced
 * and therefore the order it considered most representative. A tie broken by
 * text would sort alphabetically, which is not a preference — it is a bias
 * toward questions beginning with "a".
 */
export function rankSuggestions<T extends ScorableCandidate>(
  candidates: readonly T[],
  limit: number,
): RankedSuggestion<T>[] {
  const ranked = candidates.map((candidate, index) => {
    const signals = signalsFor(candidate);
    return { candidate, score: suggestionScore(signals), signals, index };
  });

  ranked.sort((a, b) => b.score - a.score || a.index - b.index);

  return ranked
    .slice(0, Math.max(0, Math.floor(limit)))
    .map(({ candidate, score, signals }) => ({ candidate, score, signals }));
}
