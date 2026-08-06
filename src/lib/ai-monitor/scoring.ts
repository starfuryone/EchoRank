// src/lib/ai-monitor/scoring.ts
//
// The three numbers the AI Visibility Monitor reports.
//
//   1. mentionVisibilityScore  — one response, 0-100
//   2. checkupVisibilityScore  — one checkup, rolled up from (1)
//   3. repeatabilityScore      — how stable the answers were across repetitions
//
// PURE. No Prisma, no clock, no env. Every input is passed in, so the weights
// can be exercised directly and the tests can prove that changing any one of
// them changes a score (see tests/ai-monitor-scoring.test.ts). A weight nobody
// can observe is a weight nobody can trust.
//
// NOT THE SAME NUMBER AS `mentionRate`. src/lib/visibility-summary.ts already
// reports a mention rate: the percentage of runs where the brand appeared at
// all. That stays exactly as it is. This score answers a different question —
// *how well* the brand appeared, weighing rank, recommendation, sentiment and
// citation. A brand named last, grudgingly, in every answer scores 100% mention
// rate and a poor visibility score, and both statements are true.

import type { DeterministicAnalysis } from "./analysis/deterministic";

/**
 * Component weights, summing to 100.
 *
 * WHY POSITION DOMINATES. Being named is table stakes once you are in the
 * answer at all; the difference between first and fifth in a recommendation
 * list is the difference between being chosen and being a footnote. Ranking it
 * below recommendation would mean a model that lists you fifth but calls you
 * "solid" outscores one that leads with you, which is not how a reader behaves.
 *
 * WHY CITATION IS WORTH AS MUCH AS SENTIMENT. A cited domain is the only
 * component the brand can act on directly and the only one that sends traffic.
 */
export const WEIGHTS = {
  position: 35,
  recommendation: 25,
  sentiment: 15,
  citation: 15,
  prominence: 10,
} as const;

/**
 * Per-place decay for list position.
 *
 * factor = 1 / (1 + decay * (position - 1)) — 1st = 1.00, 2nd = 0.74,
 * 3rd = 0.59, 5th = 0.42. Hyperbolic rather than linear because the drop from
 * 1st to 2nd matters far more than the drop from 8th to 9th, and rather than
 * exponential because that would score anything past 4th as indistinguishable
 * from absent, losing the signal when a brand climbs from 9th to 6th.
 */
export const POSITION_DECAY = 0.35;

/**
 * Credit for a mention that is not in any list.
 *
 * Prose mentions are real visibility — being described in the body of an answer
 * is not nothing — but they are not a ranked recommendation. Scoring them 0
 * would make an unranked brand look absent; scoring them 1 would make ranking
 * worthless.
 */
export const UNRANKED_POSITION_FACTOR = 0.6;

/** Sentiment multipliers on the sentiment component. */
export const SENTIMENT_FACTORS: Record<string, number> = {
  positive: 1,
  neutral: 0.5,
  negative: 0,
};

/**
 * Mentions needed to earn the full prominence component.
 *
 * Being named three times in one answer is thorough coverage; a tenth mention
 * says more about the answer's length than about the brand, so the component
 * saturates rather than rewarding verbosity.
 */
export const PROMINENCE_SATURATION = 3;

export interface ScoreInput extends Pick<
  DeterministicAnalysis,
  "brandMentioned" | "mentionCount" | "listPosition" | "citedOwnDomain"
> {
  recommended?: boolean | null;
  /** 0-1. */
  recommendationStrength?: number | null;
  sentiment?: string | null;
  /** 0-1, multiplies the whole score. Absent (no LLM pass) means full weight. */
  confidence?: number | null;
}

export interface ScoreBreakdown {
  score: number;
  components: {
    position: number;
    recommendation: number;
    sentiment: number;
    citation: number;
    prominence: number;
  };
}

function clamp01(value: number | null | undefined, fallback: number): number {
  if (value === null || value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

export function positionFactor(listPosition: number | null | undefined): number {
  if (listPosition === null || listPosition === undefined) return UNRANKED_POSITION_FACTOR;
  // Position 0 or negative is not meaningful; treat it as first rather than
  // dividing by something absurd.
  const place = Math.max(1, Math.floor(listPosition));
  return 1 / (1 + POSITION_DECAY * (place - 1));
}

export function prominenceFactor(mentionCount: number): number {
  if (mentionCount <= 0) return 0;
  return Math.min(1, mentionCount / PROMINENCE_SATURATION);
}

export function sentimentFactor(sentiment: string | null | undefined): number {
  if (!sentiment) return SENTIMENT_FACTORS.neutral;
  return SENTIMENT_FACTORS[sentiment.toLowerCase()] ?? SENTIMENT_FACTORS.neutral;
}

/**
 * Formula 1 — one response, 0-100.
 *
 * NOT MENTIONED IS A HARD ZERO, not a low score. There is no partial credit for
 * being absent: a brand the model did not name has no visibility in that
 * answer, however positive the surrounding text was about the category. Gating
 * here also keeps the LLM pass unnecessary for unmentioned responses, which is
 * most of them for a new brand and most of the potential spend.
 */
export function mentionVisibilityScore(input: ScoreInput): ScoreBreakdown {
  const zero = {
    score: 0,
    components: { position: 0, recommendation: 0, sentiment: 0, citation: 0, prominence: 0 },
  };
  if (!input.brandMentioned) return zero;

  const recommendedFactor = input.recommended
    ? clamp01(input.recommendationStrength, 1)
    : 0;

  const components = {
    position: WEIGHTS.position * positionFactor(input.listPosition),
    recommendation: WEIGHTS.recommendation * recommendedFactor,
    sentiment: WEIGHTS.sentiment * sentimentFactor(input.sentiment),
    citation: WEIGHTS.citation * (input.citedOwnDomain ? 1 : 0),
    prominence: WEIGHTS.prominence * prominenceFactor(input.mentionCount),
  };

  const raw = Object.values(components).reduce((a, b) => a + b, 0);
  // Confidence scales the whole score: a hedged reading of an ambiguous answer
  // should not carry the same weight as a clear one. Absent means the LLM pass
  // did not run, which is not the same as low confidence — it gets full weight,
  // and the deterministic components are the only ones contributing anyway.
  const score = raw * clamp01(input.confidence, 1);

  return { score: round2(score), components };
}

export interface ResponseScore {
  provider: string;
  score: number;
  /**
   * Carried explicitly rather than inferred from `score > 0`. A mentioned
   * response can legitimately score 0 (a zero-confidence LLM reading), and
   * counting that as "not mentioned" would make the mention rate disagree with
   * the deterministic pass that plainly found the name.
   */
  mentioned: boolean;
}

export interface CheckupScore {
  /** 0-100, or null when the checkup produced no usable responses. */
  overall: number | null;
  byProvider: Record<string, number>;
  /** Share of responses that mentioned the brand at all, 0-100. */
  mentionRate: number | null;
}

/**
 * Formula 2 — one checkup.
 *
 * PROVIDER-BALANCED, NOT RESPONSE-BALANCED. The overall score is the mean of
 * the per-provider means, not the mean of every response. Providers do not
 * contribute equal numbers of responses — one can fail half its calls, or a
 * tier can ask one provider more repetitions than another — and a plain mean
 * would silently let the chattiest provider set the headline number. Averaging
 * twice makes each provider count once, which is what the dashboard's
 * per-provider bars imply is happening.
 *
 * No responses at all returns null, not 0: "we could not ask" and "you are
 * invisible" are different answers, and reporting the second when the first is
 * true is how a dashboard lies quietly.
 */
export function checkupVisibilityScore(responses: readonly ResponseScore[]): CheckupScore {
  if (responses.length === 0) return { overall: null, byProvider: {}, mentionRate: null };

  const grouped = new Map<string, number[]>();
  for (const response of responses) {
    const bucket = grouped.get(response.provider) ?? [];
    bucket.push(response.score);
    grouped.set(response.provider, bucket);
  }

  const byProvider: Record<string, number> = {};
  for (const [provider, scores] of grouped) {
    byProvider[provider] = round2(mean(scores));
  }

  const overall = round2(mean(Object.values(byProvider)));
  const mentioned = responses.filter((r) => r.mentioned).length;

  return {
    overall,
    byProvider,
    mentionRate: round2((mentioned / responses.length) * 100),
  };
}

/**
 * Weights for the repeatability formula.
 *
 * Agreement outweighs stability because a provider that names the brand in one
 * repetition and not the next is the finding a customer acts on; two answers
 * that both name it but score 61 and 68 are the same answer with different
 * wording.
 */
export const REPEATABILITY_WEIGHTS = {
  mentionAgreement: 0.6,
  scoreStability: 0.4,
} as const;

/**
 * Score spread treated as total instability.
 *
 * Half the 0-100 range. A standard deviation of 50 across repetitions of the
 * same question means the answers have nothing to do with each other.
 */
export const STABILITY_REFERENCE_SPREAD = 50;

export interface RepetitionGroup {
  /** Scores for repeated asks of the same prompt at the same provider. */
  scores: number[];
  /** Whether each of those responses mentioned the brand. */
  mentioned: boolean[];
}

/**
 * Formula 3 — how much the same question, asked again, changed its answer.
 *
 * 100 = every repetition agreed. 0 = the provider is effectively flipping a
 * coin. Groups with a single repetition are SKIPPED rather than scored 100:
 * one observation is not evidence of consistency, and counting it as perfect
 * would let a tier with repetitions: 1 report flawless repeatability it never
 * measured. If no group has two, the answer is null.
 */
export function repeatabilityScore(groups: readonly RepetitionGroup[]): number | null {
  const comparable = groups.filter((g) => g.scores.length >= 2 && g.mentioned.length >= 2);
  if (comparable.length === 0) return null;

  const perGroup = comparable.map((group) => {
    // |2p - 1|: 1 when every repetition agreed either way, 0 at a 50/50 split.
    const mentionedShare = group.mentioned.filter(Boolean).length / group.mentioned.length;
    const agreement = Math.abs(2 * mentionedShare - 1);

    const stability = Math.max(
      0,
      1 - standardDeviation(group.scores) / STABILITY_REFERENCE_SPREAD,
    );

    return (
      REPEATABILITY_WEIGHTS.mentionAgreement * agreement +
      REPEATABILITY_WEIGHTS.scoreStability * stability
    );
  });

  return round2(mean(perGroup) * 100);
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function standardDeviation(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  // Population standard deviation: these are all the repetitions that ran, not
  // a sample drawn from a larger set, so there is no Bessel correction to make.
  const variance = mean(values.map((v) => (v - avg) ** 2));
  return Math.sqrt(variance);
}

/** Two decimals — the precision the dashboard renders and the Float stores. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
