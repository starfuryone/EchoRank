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
//
// ── VERSION 2 LIVES IN ./score-v2.ts ────────────────────────────────────────
//
// It is a two-level weighted geometric mean over four pillars and fourteen
// subfactors, and it is what a new run is scored with. Everything below this
// line is version 1 and is kept CALLABLE, not merely kept: rows written under
// scoreVersion 1 are displayed with the number and the severity the customer
// was already shown, and computeOpportunityScore() dispatches on the stored
// version to do it. Nothing is migrated and nothing is recomputed.
//
// The import of ./score-v2.ts at the bottom of this file's dependency list is
// one half of a deliberate ES module cycle — see that file's header for why it
// is safe and what would break it.

import { computeOpportunityDetailV2, severityForV2, type OpportunityScoreDetailV2 } from "./score-v2";
import type { MonthlySearch } from "./trend";

/**
 * The version a NEW run is scored with. Stored on every row it produces.
 *
 * Bumping this does not touch a stored row. It changes what the next analysis
 * computes, and computeOpportunityScore() keeps the old branch reachable for
 * everything already written.
 */
export const OPPORTUNITY_SCORE_VERSION = 2 as const;

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

/**
 * The formula the top-15 cut is taken with. NOT OPPORTUNITY_SCORE_VERSION.
 *
 * ── WHY THE CUT STAYED ON v1 WHEN THE SCORE MOVED TO v2 ─────────────────────
 *
 * The cut is a SPEND decision taken before any AI evidence exists, and it is
 * judged on one question: which fifteen keywords are most worth buying an
 * answer about. Scored with `ai: null`, v1 loses one component of six and
 * renormalises over the rest. v2 loses its entire VISIBILITY_GAP pillar — 0.30
 * of the score, and the only pillar that measures the thing being allocated —
 * plus reasonableCompetition, which is half of what is left of WINNABILITY.
 * That leaves v2 ranking on demand, momentum and rank alone, which is strictly
 * less of a signal than v1 has for the same job.
 *
 * It is not a hypothetical difference: switching the cut to v2 moves three of
 * the fifteen on the demo set, including two of the three keywords the brief
 * pins. A better final formula is not automatically a better allocator, and
 * these are two different decisions that happened to share a function.
 *
 * Revisit when v2's unwired subfactors land — clickstream and content fit are
 * both pre-AI signals, and a v2 pre-AI score that has them is a different
 * proposition from this one.
 */
export const PRE_AI_CUT_SCORE_VERSION = 1;

/**
 * HIGH needs an un-mentioned brand AND a score at or above this.
 *
 * ── WHY 74 AND NOT 85 ───────────────────────────────────────────────────────
 *
 * 85 was the brief's figure and it made HIGH a two-row shortlist: on the demo
 * set it captured 2 of the 12 keywords eligible for it, and left the archetype
 * this feature exists to surface — real demand, a rank outside the top ten, and
 * an assistant that never names the brand — reading MEDIUM.
 *
 * 74 rather than 75, and the extra point is the whole reason this constant
 * carries a comment. The archetype ("best CRM for startups") scores 74.519 and
 * only reaches 75 because Math.round takes it there. A cut at exactly 75 would
 * mean the flagship case clears by 0.48 of a rounding step: any drift in
 * volume, CPC or trend flips it back to MEDIUM and the panel looks like it
 * changed its mind about a keyword nobody touched. 74 gives it real headroom.
 *
 * These are v1 constants under the scoreVersion regime, not settled truth. They
 * were chosen against a 25-keyword fixture set built to exercise branches, not
 * a sampled population — a domain that already ranks well would push the whole
 * distribution down and shrink HIGH at any cut. Revisit once real domains flow;
 * a change here is a version 2, and rows written under 1 keep the severity the
 * customer was shown.
 */
export const HIGH_SEVERITY_MIN_SCORE = 74;

/**
 * MEDIUM needs a score at or above this.
 *
 * MOVED DOWN WITH THE HIGH CUT, AND THAT PAIRING IS THE POINT. Lowering the
 * HIGH bar alone would have left MEDIUM a five-point sliver between 70 and 74 —
 * three bands on paper, two in practice. At 60 the demo set reads 11 HIGH /
 * 7 MEDIUM / 7 LOW, which is three bands a human can actually use.
 *
 * The floor governs LOW on its own: the HIGH cut only ever redistributes rows
 * between HIGH and MEDIUM, so this is the only constant that decides what a
 * customer is told not to bother with.
 */
export const MEDIUM_SEVERITY_MIN_SCORE = 60;

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

  // ── VERSION 2 ONLY, AND OPTIONAL ON PURPOSE ───────────────────────────────
  //
  // Both are ignored by v1 entirely. They are declared here rather than on a
  // separate OpportunityInputV2 so that every existing call site stays
  // type-compatible and a caller that HAS the data can simply pass it — an
  // extra property on an object literal is a compile error against a narrower
  // type, which is how a "v2 input" type would have forced a rewrite of every
  // producer for the sake of two fields.

  /**
   * Rivals named in this keyword's AI answer.
   *
   * Feeds BOTH v2 competition curves — competitorValidation (demand is real)
   * and reasonableCompetition (we could win it) — which read the same count
   * and disagree at both ends by design. Null or absent means the count was
   * never taken, which for an untested keyword is the only honest value: zero
   * would say the assistant named nobody, and nobody asked it.
   */
  competitorCount?: number | null;

  /**
   * The provider's monthly search history, for v2's momentum horizons.
   *
   * ABSENT IS NOT EMPTY. Absent (the v1-shaped input) means v2 falls back to
   * the already-derived `trendPercent` for its 90-day horizon; an empty or
   * short array means we HAVE the history and it is too thin to say anything,
   * which nulls the whole MOMENTUM pillar. ./discover.ts reduces this to
   * trendPercent and drops it today, so nothing in production supplies it.
   */
  monthlyHistory?: readonly MonthlySearch[] | null;
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
  /**
   * The six v1 components, on 0-100.
   *
   * STILL COMPUTED UNDER v2, AND NOT VESTIGIALLY. Five of the six are the raw
   * signals v2's subfactors are transformed from, they are what the detail
   * panel has always shown per keyword, and they are what ./read.ts rebuilds
   * AiEvidence out of. v2 adds `detail` beside them rather than replacing
   * them, so a stored row stays readable by code that predates the pillars.
   */
  components: OpportunityComponents;
  /** False when aiGap is null and the other five carried the score. */
  aiTested: boolean;
  scoreVersion: number;
  /** The pillar/subfactor breakdown and confidence. Null on a v1 score. */
  detail: OpportunityScoreDetailV2 | null;
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
    // The literal 1, NOT OPPORTUNITY_SCORE_VERSION. This function is version 1
    // forever; the constant is what the next run uses and it has already moved.
    scoreVersion: 1,
    detail: null,
  };
}

/**
 * The Opportunity Score, version 2.
 *
 * The arithmetic is ./score-v2.ts. This is the seam: it carries the six v1
 * components along beside the pillars — see OpportunityScore.components for
 * why — and takes its 0-100 from the calibrated figure.
 */
export function computeOpportunityScoreV2(input: OpportunityInput): OpportunityScore {
  const detail = computeOpportunityDetailV2(input);

  return {
    score: Math.round(clampScore(detail.calibratedScore)),
    components: {
      volume: volumeScore(input.monthlyVolume),
      cpc: cpcScore(input.cpcUsd),
      trend: trendScore(input.trendPercent),
      intent: intentScore(input.intent),
      seoGap: seoGapScore(input.googleRank),
      aiGap: aiGapScore(input.ai),
    },
    aiTested: input.ai !== null,
    scoreVersion: 2,
    detail,
  };
}

/**
 * Dispatch on a stored version.
 *
 * The reason history never has to be migrated — the same shape as
 * computeScore() in ai-monitor/metrics.ts. A row carries the version that
 * produced it and is re-derived with that branch, so bumping
 * OPPORTUNITY_SCORE_VERSION changes what the next analysis computes and
 * nothing a customer has already been shown.
 */
export function computeOpportunityScore(
  input: OpportunityInput,
  version: number = OPPORTUNITY_SCORE_VERSION,
): OpportunityScore {
  switch (version) {
    case 1:
      return computeOpportunityScoreV1(input);
    case 2:
      return computeOpportunityScoreV2(input);
    default:
      throw new Error(`unknown opportunity score version: ${version}`);
  }
}

/**
 * The score a keyword has before anything has been asked of an AI.
 *
 * This is what the top-15 cut is taken on, so it must not depend on the AI
 * evidence it is being used to allocate. Computed by scoring the keyword with
 * `ai: null`, which is the same renormalisation an untested keyword keeps —
 * under v2 that nulls the whole VISIBILITY_GAP pillar, and the remaining three
 * renormalise at the top level.
 *
 * VERSION-AWARE, and defaulting to PRE_AI_CUT_SCORE_VERSION rather than to the
 * version a run is scored with — see that constant for why those are two
 * different decisions.
 */
export function preAiScore(
  input: OpportunityInput,
  version: number = PRE_AI_CUT_SCORE_VERSION,
): number {
  return computeOpportunityScore({ ...input, ai: null, competitorCount: null }, version).score;
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
  version: number = PRE_AI_CUT_SCORE_VERSION,
): OpportunityInput[] {
  return [...inputs]
    .map((input) => ({ input, score: preAiScore(input, version) }))
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
  /**
   * The v2 pillar/subfactor breakdown. Null on a v1 row.
   *
   * Carries `confidence`, which is one of the two gates on HIGH under v2 and
   * is therefore something a customer can be told: "we are not calling this
   * urgent because we only measured half of it" is a different sentence from
   * "this keyword is not urgent".
   */
  detail: OpportunityScoreDetailV2 | null;
}

/**
 * Score one keyword and attach its severity.
 *
 * The severity rule is versioned along with the arithmetic. It has to be: v2's
 * cuts sit on a differently-shaped distribution, and v2 gates HIGH on
 * confidence as well as on evidence of absence.
 */
export function scoreOpportunity(
  input: OpportunityInput,
  version: number = OPPORTUNITY_SCORE_VERSION,
): ScoredOpportunity {
  const scored = computeOpportunityScore(input, version);

  const severity =
    scored.detail === null
      ? severityFor(scored.score, input.ai)
      : severityForV2(scored.score, input.ai, scored.detail.confidence);

  return {
    ...input,
    opportunityScore: scored.score,
    components: scored.components,
    aiTested: scored.aiTested,
    scoreVersion: scored.scoreVersion,
    severity,
    detail: scored.detail,
  };
}
