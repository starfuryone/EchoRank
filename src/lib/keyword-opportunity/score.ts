// src/lib/keyword-opportunity/score.ts
//
// The Opportunity Score: how much a commercial keyword is worth going after,
// on 0-100.
//
// PURE. No Prisma, no clock, no env, no logger — every input is passed in. The
// same reasoning as ai-monitor/metrics.ts and credits/ledger.ts: this is the
// arithmetic a customer will argue with, so it has to be testable without a
// database and readable without a call graph. ./fixtures.ts is scored through
// these functions rather than carrying numbers of its own, which is what stops
// the demo and the product drifting apart.
//
// A NEW VERSIONED SCORE, NOT A FOURTH visibilityScore. There are already three
// unrelated 0-100 numbers in this codebase — Checkup.visibilityScore (the
// audit), MentionAnalysis.visibilityScore (one response) and
// VisibilityMetric.visibilityScore (the AI Search Score). This is a fourth
// thing measuring a fourth question, and the one way to keep that honest is the
// pattern ai-monitor/metrics.ts already set: its own module, its own version
// constant, its own dispatch, and history that is never recomputed. A version 2
// is added as another branch below; rows written under 1 keep the number the
// customer was shown.
//
// ── THE AI COMPONENT IS OPTIONAL, AND THAT IS THE LOAD-BEARING PART ─────────
//
// Only the top 15 keywords by pre-AI score are ever AI-tested (see
// AI_TESTED_KEYWORD_LIMIT). For every other keyword the aiGap component has no
// evidence behind it, and the wrong thing to do is score it 100 ("nobody
// mentioned you") or 0 ("everybody did") — we did not ask. So aiGap is NULL
// there and the remaining weights are renormalised over what was measured.
//
// This is the same rule VisibilityMetric.citationScore follows, for the same
// reason: null is not zero. "We could not ask" and "you are invisible" are
// different findings, and a scorer that renders the first as the second is
// lying quietly — here it would manufacture a 25-point gap out of a keyword we
// never tested and put it at the top of the recommendations.
//
// The renormalisation falls out of one code path rather than two: with every
// component present the weights sum to 1 and the divisor is a no-op.

/** The version this module computes. Stored on every row it produces. */
export const OPPORTUNITY_SCORE_VERSION = 1 as const;

/**
 * The six components, weighted.
 *
 * AI GAP LEADS at 0.25 because it is the only component that measures the
 * thing this tool exists to find — a keyword where the buyer asks an assistant
 * and the brand is not in the answer. VOLUME and CPC follow together at 0.20
 * each: between them they are the money, and they disagree often enough
 * (cheap-and-huge vs dear-and-narrow) that neither can carry the pair alone.
 * INTENT at 0.15 separates a buyer from a reader. SEO GAP and TREND sit at 0.10
 * because they are directional rather than decisive — a bad rank is why the
 * work is available, not why it is worth doing, and a trend is an estimate
 * derived from twelve monthly figures.
 */
export const OPPORTUNITY_WEIGHTS_V1 = {
  volume: 0.2,
  cpc: 0.2,
  trend: 0.1,
  intent: 0.15,
  seoGap: 0.1,
  aiGap: 0.25,
} as const;

/**
 * Commercial intent classes, most valuable first.
 *
 * "informational" is spelled out rather than left to the default so a caller
 * can say it deliberately, and so ./fixtures.ts can exercise the default branch
 * with a value that is not a typo. Anything unrecognised still scores
 * DEFAULT_INTENT_SCORE — an intent we cannot classify is not an intent worth
 * paying a premium for.
 */
export const KEYWORD_INTENTS = [
  "transactional",
  "commercial_investigation",
  "product_comparison",
  "solution_seeking",
  "informational",
] as const;

export type KeywordIntent = (typeof KEYWORD_INTENTS)[number];

export const INTENT_SCORES: Readonly<Record<string, number>> = {
  transactional: 100,
  commercial_investigation: 95,
  product_comparison: 90,
  solution_seeking: 80,
};

/** Every intent the table above does not name, including "informational". */
export const DEFAULT_INTENT_SCORE = 40;

/**
 * Monthly volume at which the volume component saturates.
 *
 * LOG-NORMALISED, so the curve is steep where the decisions are. The gap
 * between 200 and 2,000 searches a month is the gap between a keyword nobody
 * types and a keyword worth a landing page; the gap between 40,000 and 50,000
 * changes nothing anybody would do differently. A linear scale spends almost
 * all of its range on the second comparison and almost none on the first.
 *
 * 50,000 rather than a rounder 100,000 because this tool ranks COMMERCIAL
 * keywords for one domain. A head term above 50,000 is a brand or a category
 * word, and it is already saturated on any scale worth having.
 */
export const VOLUME_CEILING = 50_000;

/**
 * CPC at which the cost component saturates, in USD.
 *
 * LINEAR, unlike volume, and deliberately: CPC already IS the market's own
 * estimate of what a click is worth, so it arrives pre-weighted and a second
 * curve on top of it would be our opinion about somebody else's auction. $50
 * is near the ceiling of paid search outside a handful of legal and insurance
 * terms, so a B2B software keyword uses the lower two thirds of the range,
 * which is where it should be.
 */
export const CPC_CEILING_USD = 50;

/** Trend clamp, in percent. Below the floor and above the ceiling read alike. */
export const TREND_FLOOR_PERCENT = -50;
export const TREND_CEILING_PERCENT = 100;

/**
 * Keywords that get an AI test, by pre-AI score.
 *
 * FIFTEEN, and the number is a cost decision rather than a statistical one.
 * Each tested keyword is one prompt, one repetition, one provider — see the
 * doctrine in ../ai-monitor/metrics.ts for what deep testing looks like, and
 * note that this is deliberately not it. Repeated sampling across providers is
 * the Watcher's product and is priced as one; this feature buys a single
 * reading to locate the gap, and then hands the customer to the Watcher to
 * measure it properly.
 */
export const AI_TESTED_KEYWORD_LIMIT = 15;

/** HIGH needs an un-mentioned brand AND a score at or above this. */
export const HIGH_SEVERITY_MIN_SCORE = 85;
/** MEDIUM needs a score at or above this. */
export const MEDIUM_SEVERITY_MIN_SCORE = 70;

/**
 * What one AI test found for one keyword.
 *
 * Null on an OpportunityInput means the keyword was never tested — see the
 * header. Do not construct one of these with mentioned:false to represent an
 * untested keyword; that is the exact confusion the null exists to prevent.
 */
export interface AiEvidence {
  /** Whether the brand appeared in the answer at all. */
  mentioned: boolean;
  /**
   * 0-100 for a brand the answer named. Null when it was named in prose but
   * never ranked, which scores as no visibility rather than as no evidence:
   * being mentioned in passing and being recommended are different outcomes,
   * and only the second is worth points.
   */
  visibilityScore: number | null;
  /** Share of repetitions that named the brand, 0-1. One rep here, so 0 or 1. */
  mentionRate: number;
  /** 1-based place in the answer's ranked list. Null when it did not rank. */
  averagePosition: number | null;
}

export interface OpportunityInput {
  keyword: string;
  /** Provider figure, searches per month. */
  monthlyVolume: number;
  /** Provider figure, USD. */
  cpcUsd: number;
  /**
   * Provider figure, 0-1. CARRIED BUT NOT SCORED — paid competition is a fact
   * about an ad auction, and this tool is about organic and AI answers. It is
   * stored and displayed because it is useful context for a human deciding
   * whether to also buy the term, and given no weight because giving it one
   * would score a keyword on a market we are not asking the customer to enter.
   */
  competition: number;
  /** Percent change derived from the provider's monthly search history. */
  trendPercent: number;
  /**
   * Current Google position, or null.
   *
   * NULL COVERS TWO DIFFERENT FACTS and both score 100: the keyword is not
   * tracked at all, and the keyword is tracked but ranks outside the top 100.
   * They score alike because the customer's position is the same either way —
   * there is no ranking to defend — but they are not the same finding, so the
   * provenance is kept on the row rather than inferred from the null.
   */
  googleRank: number | null;
  intent: KeywordIntent;
  /** Null when the keyword was not among the AI-tested top 15. */
  ai: AiEvidence | null;
}

export interface OpportunityComponents {
  volume: number;
  cpc: number;
  trend: number;
  intent: number;
  seoGap: number;
  /** Null when the keyword was not AI-tested. Null is not zero — see header. */
  aiGap: number | null;
}

/**
 * Where a component's underlying metric came from.
 *
 * The spec calls for provenance on every component, and the honest split is
 * narrower than it first looks: only volume and CPC are figures a provider
 * hands us verbatim. Trend is OURS — DataForSEO Labs returns twelve monthly
 * search counts and the percent change is computed here, so a customer
 * disputing it is disputing our arithmetic, not theirs. Intent is our
 * classification, seoGap is our own rank tracker, aiGap is our own AI test.
 */
export type ComponentSource = "provider" | "echorank";

export const COMPONENT_SOURCES: Readonly<Record<keyof OpportunityComponents, ComponentSource>> = {
  volume: "provider",
  cpc: "provider",
  trend: "echorank",
  intent: "echorank",
  seoGap: "echorank",
  aiGap: "echorank",
};

export type OpportunitySeverity = "HIGH" | "MEDIUM" | "LOW";

export interface OpportunityScore {
  /** 0-100, rounded to an integer. */
  score: number;
  components: OpportunityComponents;
  /** False when aiGap is null and the other five carried the score. */
  aiTested: boolean;
  scoreVersion: typeof OPPORTUNITY_SCORE_VERSION;
}

/**
 * Every component is a 0-100 figure before it is weighted.
 *
 * NaN becomes 0; an infinity clamps to the bound it ran past. Lifted verbatim
 * from ai-monitor/metrics.ts clampComponent(), including the reasoning:
 * treating Infinity as 0 would turn the most extreme possible input into the
 * mildest possible output, which is the wrong direction for a guard.
 */
export function clampScore(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/**
 * Log-normalised monthly volume.
 *
 * log1p rather than log, so a volume of 0 scores 0 instead of -Infinity. A
 * keyword nobody searches is a real result from the discovery step, not a
 * malformed input.
 */
export function volumeScore(monthlyVolume: number): number {
  if (!Number.isFinite(monthlyVolume) || monthlyVolume <= 0) return 0;
  return clampScore((100 * Math.log1p(monthlyVolume)) / Math.log1p(VOLUME_CEILING));
}

/** Linear CPC against the ceiling. */
export function cpcScore(cpcUsd: number): number {
  if (!Number.isFinite(cpcUsd) || cpcUsd <= 0) return 0;
  return clampScore((100 * cpcUsd) / CPC_CEILING_USD);
}

/**
 * Clamped trend, normalised over the clamp range.
 *
 * NOTE WHERE NEUTRAL LANDS: the range is asymmetric (-50 to +100), so a flat
 * keyword scores 33, not 50. That is intended and it is the reason the range is
 * asymmetric — demand that is merely holding steady is not half of an
 * opportunity, and the component is worth 10 points precisely so that this
 * cannot dominate anything.
 */
export function trendScore(trendPercent: number): number {
  if (!Number.isFinite(trendPercent)) return 0;
  const clamped = Math.min(TREND_CEILING_PERCENT, Math.max(TREND_FLOOR_PERCENT, trendPercent));
  const span = TREND_CEILING_PERCENT - TREND_FLOOR_PERCENT;
  return clampScore(((clamped - TREND_FLOOR_PERCENT) / span) * 100);
}

/** Table lookup, with DEFAULT_INTENT_SCORE for everything it does not name. */
export function intentScore(intent: string): number {
  return INTENT_SCORES[intent] ?? DEFAULT_INTENT_SCORE;
}

/**
 * How much room there is between the current Google position and the answer.
 *
 * A LADDER, NOT A CURVE, and the steps are where behaviour changes rather than
 * where the arithmetic is tidy. Nothing below the first page is meaningfully
 * different from anything else below the first page (95 and 85), page two is
 * within reach (65), the bottom of page one is a nudge (40), and a top-three
 * rank means the SEO work is already done and the gap this tool is looking for
 * is somewhere else entirely (15).
 *
 * FIFTEEN RATHER THAN ZERO at the top. A brand ranking third still has an
 * opportunity worth scoring if an assistant never names it — that is the whole
 * premise of the product — so this component must not zero out the row.
 */
export function seoGapScore(googleRank: number | null): number {
  if (googleRank === null) return 100;
  if (googleRank > 50) return 95;
  if (googleRank > 20) return 85;
  if (googleRank > 10) return 65;
  if (googleRank > 3) return 40;
  return 15;
}

/**
 * The gap between the brand and the AI answer.
 *
 * Null in, null out: an untested keyword has no gap to report. See the header
 * for why that is not a zero and not a hundred.
 */
export function aiGapScore(ai: AiEvidence | null): number | null {
  if (ai === null) return null;
  if (!ai.mentioned) return 100;
  return clampScore(100 - (ai.visibilityScore ?? 0));
}

/**
 * The Opportunity Score, version 1.
 *
 * The divisor is the sum of the weights that had a value. With aiGap present it
 * is 1 and divides nothing; with aiGap null it is 0.75 and lifts the other five
 * back onto a 0-100 scale. One path, no special case.
 */
export function computeOpportunityScoreV1(input: OpportunityInput): OpportunityScore {
  const components: OpportunityComponents = {
    volume: volumeScore(input.monthlyVolume),
    cpc: cpcScore(input.cpcUsd),
    trend: trendScore(input.trendPercent),
    intent: intentScore(input.intent),
    seoGap: seoGapScore(input.googleRank),
    aiGap: aiGapScore(input.ai),
  };

  let weighted = 0;
  let totalWeight = 0;
  for (const key of Object.keys(OPPORTUNITY_WEIGHTS_V1) as (keyof OpportunityComponents)[]) {
    const value = components[key];
    if (value === null) continue;
    const weight = OPPORTUNITY_WEIGHTS_V1[key];
    weighted += weight * value;
    totalWeight += weight;
  }

  // Every weight being absent is unreachable while aiGap is the only nullable
  // component, but a version 2 that nulls another one would reach it, and a
  // divide-by-zero there would surface as NaN in a customer's report.
  const score = totalWeight === 0 ? 0 : weighted / totalWeight;

  return {
    score: Math.round(clampScore(score)),
    components,
    aiTested: components.aiGap !== null,
    scoreVersion: OPPORTUNITY_SCORE_VERSION,
  };
}

/**
 * Dispatch on a stored version.
 *
 * One line today, and the reason history never has to be migrated — the same
 * shape as computeScore() in ai-monitor/metrics.ts.
 */
export function computeOpportunityScore(
  input: OpportunityInput,
  version: number = OPPORTUNITY_SCORE_VERSION,
): OpportunityScore {
  switch (version) {
    case 1:
      return computeOpportunityScoreV1(input);
    default:
      throw new Error(`unknown opportunity score version: ${version}`);
  }
}

/**
 * The score a keyword has before anything has been asked of an AI.
 *
 * This is what the top-15 cut is taken on, so it must not depend on the AI
 * evidence it is being used to allocate. Computed by scoring the keyword with
 * `ai: null`, which is the same renormalisation an untested keyword keeps.
 */
export function preAiScore(input: OpportunityInput): number {
  return computeOpportunityScoreV1({ ...input, ai: null }).score;
}

/**
 * The keywords worth spending an AI call on, highest pre-AI score first.
 *
 * Ties break on the keyword text so the cut is stable across runs — an unstable
 * sort here would mean the same domain analysis tested a different fifteen each
 * time and the customer's "not tested" set moved for no reason.
 */
export function selectAiTestKeywords(
  inputs: readonly OpportunityInput[],
  limit: number = AI_TESTED_KEYWORD_LIMIT,
): OpportunityInput[] {
  return [...inputs]
    .map((input) => ({ input, score: preAiScore(input) }))
    .sort((a, b) => b.score - a.score || a.input.keyword.localeCompare(b.input.keyword))
    .slice(0, Math.max(0, limit))
    .map((entry) => entry.input);
}

/**
 * How loudly to recommend this keyword.
 *
 * HIGH REQUIRES EVIDENCE OF ABSENCE, not merely an absence of evidence. An
 * untested keyword can never be HIGH however well it scores, because the thing
 * that makes a keyword urgent — "buyers ask this and the answer is not you" —
 * is precisely what was not measured. It can still be MEDIUM on the strength of
 * the five components that were.
 */
export function severityFor(score: number, ai: AiEvidence | null): OpportunitySeverity {
  if (ai !== null && !ai.mentioned && score >= HIGH_SEVERITY_MIN_SCORE) return "HIGH";
  if (score >= MEDIUM_SEVERITY_MIN_SCORE) return "MEDIUM";
  return "LOW";
}

/** One scored keyword, ready to store or render. */
export interface ScoredOpportunity extends OpportunityInput {
  opportunityScore: number;
  components: OpportunityComponents;
  aiTested: boolean;
  scoreVersion: number;
  severity: OpportunitySeverity;
}

/** Score one keyword and attach its severity. */
export function scoreOpportunity(
  input: OpportunityInput,
  version: number = OPPORTUNITY_SCORE_VERSION,
): ScoredOpportunity {
  const scored = computeOpportunityScore(input, version);
  return {
    ...input,
    opportunityScore: scored.score,
    components: scored.components,
    aiTested: scored.aiTested,
    scoreVersion: scored.scoreVersion,
    severity: severityFor(scored.score, input.ai),
  };
}
