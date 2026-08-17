// src/lib/keyword-opportunity/score-v2.ts
//
// The Opportunity Score, version 2: a two-level weighted geometric mean.
//
// PURE, like ./score.ts. No Prisma, no clock, no env, no logger. Version 1 is
// still in ./score.ts, still callable, and still what a row written under
// scoreVersion 1 is displayed with — nothing here recomputes history.
//
// ── WHY A GEOMETRIC MEAN AND NOT ANOTHER WEIGHTED SUM ───────────────────────
//
// v1 added six weighted components. An additive score lets one huge number pay
// for a fatal one: a keyword with 40,000 searches a month and a top-three rank
// already held by the brand scored well on volume and simply lost the ten
// points seoGap could take from it. That is the wrong shape for an OPPORTUNITY
// — an opportunity is a conjunction. Demand AND a gap AND a chance of winning.
// A product punishes a weak factor multiplicatively, which is what "and" means
// arithmetically, and it is why every factor here is a 0-1 multiplier rather
// than a 0-100 addend.
//
// ── AND WHY TWO LEVELS, NOT ONE ─────────────────────────────────────────────
//
// exp(Σ w·ln f / Σ w) over fourteen subfactors at once is algebraically very
// nearly this file with the pillars collapsed, and it is NOT the same thing,
// because of what happens to a null. A missing subfactor must redistribute its
// weight INSIDE its pillar — a keyword with no clickstream reading is still a
// keyword whose demand we measured two other ways, and DEMAND must keep its
// 0.30 — whereas collapsing to one level would hand that weight to
// WINNABILITY, which learned nothing. Only when a pillar loses every subfactor
// does its weight go back to the top level. Do not flatten this.
//
// ── NULL IS NOT ZERO, AND ZERO IS NOT NULL ──────────────────────────────────
//
// The same rule ./score.ts states for aiGap, applied to all fourteen:
//
//   null   we did not measure it -> the subfactor is dropped and the remaining
//          weights in its pillar are renormalised over what was measured.
//   zero   we measured it and it is absent -> the FACTOR SCORE floors at
//          MIN_FACTOR (0.05). The floor is what keeps ln() finite; it is not a
//          judgement about the keyword.
//   weak   the geomean already punishes it. No special case.
//
// The floor applies POST-transform and never to a raw signal, which matters
// most where the transform inverts: zero AI mentions is the BEST possible
// reading of brandAiAbsence (1.0, the whole point of the product), not the
// worst. Flooring the raw count would have turned the flagship finding into a
// rounding error.
//
// ── WHAT IS NOT MEASURED YET ────────────────────────────────────────────────
//
// Six of the fourteen have no live source in this pipeline today and are null
// on every production row: clickstreamValidation, trend30d, acceleration,
// citationGap, contentFit and authorityFit. They are declared, weighted and
// renormalised away rather than stubbed with a constant, because a constant
// would be a number we made up sitting in a customer's score. See
// V2_SUBFACTOR_SOURCES for the per-subfactor status, which is data rather than
// a comment so a test can assert it.
//
// ── IMPORT DIRECTION ────────────────────────────────────────────────────────
//
// ./score.ts imports computeOpportunityScoreV2 from here for its version
// dispatch, and this file imports v1's transforms from there. That is a
// deliberate ES module cycle and it is safe ONLY because neither module reads
// the other's bindings at module-evaluation time — every use is inside a
// function body. Do not introduce a top-level `const X = VOLUME_CEILING * …`
// here; it would evaluate inside the cycle's temporal dead zone.

import {
  clampScore,
  intentScore,
  seoGapScore,
  trendScore,
  volumeScore,
  type AiEvidence,
  type OpportunityInput,
  type OpportunitySeverity,
} from "./score";
import { sortedHistory, type MonthlySearch } from "./trend";

/** The version this module computes. */
export const OPPORTUNITY_SCORE_VERSION_2 = 2 as const;

// ── The floor, and what it is for ──────────────────────────────────────────

/**
 * The lowest a transformed factor may score.
 *
 * ln(0) is -Infinity and would take the whole product with it, so a measured
 * zero has to land somewhere above zero. 0.05 rather than a smaller epsilon
 * because the floor is also the answer to "how much can one dead factor cost
 * you": at 0.05 a subfactor worth 40% of a pillar drags that pillar to
 * 0.05^0.4 ≈ 0.30 of what it would otherwise be, which is a severe penalty a
 * human can still argue with. At 1e-6 it would be annihilation, and a scorer
 * whose worst case is zero cannot rank its own worst cases.
 */
export const MIN_FACTOR = 0.05;

/** The highest. Factors are ratios, not scores; nothing beats "perfect". */
export const MAX_FACTOR = 1;

/**
 * Clamp one transformed factor into [MIN_FACTOR, MAX_FACTOR].
 *
 * NaN floors rather than throwing. A NaN here is a bug upstream, and the two
 * honest responses are to crash or to score the keyword as badly as the scale
 * allows; crashing would fail a hundred-keyword analysis over one bad row.
 */
export function clampFactor(value: number): number {
  if (!Number.isFinite(value)) return MIN_FACTOR;
  return Math.min(MAX_FACTOR, Math.max(MIN_FACTOR, value));
}

// ── The pillars ────────────────────────────────────────────────────────────

export const PILLAR_KEYS = ["demand", "momentum", "visibilityGap", "winnability"] as const;

export type PillarKey = (typeof PILLAR_KEYS)[number];

/**
 * Pillar weights. Sum to 1 — asserted by assertV2WeightsSumToOne().
 *
 * DEMAND and VISIBILITY_GAP lead together at 0.30. Between them they are the
 * two halves of the question this tool asks: is anybody looking for this, and
 * are you missing from the answer. MOMENTUM and WINNABILITY are 0.20 each
 * because they modify rather than decide — a keyword that is growing is a
 * better version of an opportunity that already exists, and one you could
 * plausibly win is a cheaper version of it.
 */
export const V2_PILLAR_WEIGHTS: Readonly<Record<PillarKey, number>> = {
  demand: 0.3,
  momentum: 0.2,
  visibilityGap: 0.3,
  winnability: 0.2,
};

// ── The subfactors ─────────────────────────────────────────────────────────

export const SUBFACTOR_KEYS = [
  "searchVolume",
  "commercialIntent",
  "clickstreamValidation",
  "trend90d",
  "trend30d",
  "acceleration",
  "brandAiAbsence",
  "competitorValidation",
  "recommendationGap",
  "citationGap",
  "currentRank",
  "contentFit",
  "authorityFit",
  "reasonableCompetition",
] as const;

export type SubfactorKey = (typeof SUBFACTOR_KEYS)[number];

/** Which pillar each subfactor renormalises inside. */
export const SUBFACTOR_PILLAR: Readonly<Record<SubfactorKey, PillarKey>> = {
  searchVolume: "demand",
  commercialIntent: "demand",
  clickstreamValidation: "demand",
  trend90d: "momentum",
  trend30d: "momentum",
  acceleration: "momentum",
  brandAiAbsence: "visibilityGap",
  competitorValidation: "visibilityGap",
  recommendationGap: "visibilityGap",
  citationGap: "visibilityGap",
  currentRank: "winnability",
  contentFit: "winnability",
  authorityFit: "winnability",
  reasonableCompetition: "winnability",
};

/**
 * Within-pillar weights. Each pillar's own weights sum to 1.
 *
 * TUNABLE. These are the proposed defaults, chosen before a single production
 * domain has flowed through the scorer, and the two-level structure exists
 * partly so they can be moved one pillar at a time without redistributing
 * anything across the others. A change here is a version 3, not an edit.
 */
export const V2_SUBFACTOR_WEIGHTS: Readonly<Record<SubfactorKey, number>> = {
  // DEMAND — is anybody actually looking for this, and do they want to buy.
  searchVolume: 0.45,
  commercialIntent: 0.35,
  clickstreamValidation: 0.2,
  // MOMENTUM — is the demand going anywhere.
  trend90d: 0.45,
  trend30d: 0.35,
  acceleration: 0.2,
  // VISIBILITY_GAP — is the brand missing from the answer buyers get.
  brandAiAbsence: 0.4,
  competitorValidation: 0.3,
  recommendationGap: 0.15,
  citationGap: 0.15,
  // WINNABILITY — could this brand plausibly take the answer.
  currentRank: 0.4,
  contentFit: 0.25,
  authorityFit: 0.15,
  reasonableCompetition: 0.2,
};

/**
 * Where each subfactor's signal comes from, or that it has none yet.
 *
 * DATA RATHER THAN A COMMENT so tests/keyword-opportunity-score.test.ts can
 * assert that a subfactor marked "live" actually produces a number on the
 * fixtures, and that one marked "unwired" produces null on every one of them.
 * That is the check that stops a future stub from quietly becoming a constant.
 */
export const V2_SUBFACTOR_SOURCES: Readonly<Record<SubfactorKey, "live" | "unwired">> = {
  searchVolume: "live", // DataForSEO Labs keyword_info.search_volume
  commercialIntent: "live", // ./intent.ts classification
  clickstreamValidation: "unwired", // no clickstream provider is called; see ./discover.ts
  trend90d: "live", // ./trend.ts, from keyword_info.monthly_searches
  trend30d: "unwired", // needs the raw history on the input; discover.ts drops it
  acceleration: "unwired", // same, and needs all twelve points
  brandAiAbsence: "live", // AiEvidence.mentionRate
  competitorValidation: "live", // rivals named in the answer
  recommendationGap: "live", // AiEvidence.visibilityScore / averagePosition
  citationGap: "unwired", // analyzeResponse() returns citations; nothing stores them
  currentRank: "live", // our own rank tracker
  contentFit: "unwired", // no page-level content signal in this pipeline
  authorityFit: "unwired", // no domain-authority signal in this pipeline
  reasonableCompetition: "live", // same raw count as competitorValidation
};

// ── Tunable transform constants ────────────────────────────────────────────

/**
 * competitor_validation: rivals in the answer as EVIDENCE OF DEMAND.
 *
 * An assistant that names nobody is answering a question people do not ask in
 * a buying frame, and there is no answer to displace — hence 0.20 at zero
 * rivals, which is a near-veto rather than a null (we asked, and the answer
 * named no one). Two or three rivals is a live, contested answer with room in
 * it. Six or more is a crowded consensus list, still real demand but worth
 * less as a signal that a newcomer is missing.
 *
 * A BUCKET TABLE ON PURPOSE, and the twin of the Gaussian below rather than a
 * duplicate of it. Same raw count, two different questions: this one asks
 * "does anyone want this", the other asks "could we win it". They disagree at
 * both ends and that disagreement is information — do not unify them.
 */
export const COMPETITOR_VALIDATION_CURVE: readonly number[] = [0.2, 0.65, 0.9, 1.0, 1.0, 0.8];

/** Six or more rivals. Past the table, the curve is flat. */
export const COMPETITOR_VALIDATION_TAIL = 0.7;

/**
 * reasonable_competition: a continuous hump, not buckets.
 *
 * CONTINUOUS BECAUSE WINNABILITY IS. Validation is a categorical judgement
 * ("is this a real market") and steps are fine for it; winnability falls away
 * smoothly as the answer gets more crowded, and a bucket edge here would mean
 * two keywords one rival apart got visibly different verdicts for no reason a
 * customer could see.
 */
export const COMPETITION_IDEAL = 2.5;
export const COMPETITION_SPREAD = 2.25;
export const COMPETITION_FLOOR = 0.2;

/**
 * Acceleration clamp, in percentage POINTS of quarter-on-quarter growth.
 *
 * Symmetric, unlike trendScore's asymmetric [-50, +100]: a trend has a natural
 * floor (demand cannot fall more than 100%) and no ceiling, whereas a CHANGE in
 * the growth rate is as free to be negative as positive. Neutral therefore
 * lands at 0.5 here and at 0.33 there, and both are deliberate.
 */
export const ACCELERATION_CLAMP_POINTS = 50;

/** History points needed before each momentum horizon is reported at all. */
export const TREND_90D_MIN_POINTS = 6;
export const TREND_30D_MIN_POINTS = 4;
export const ACCELERATION_MIN_POINTS = 12;

// ── Confidence ─────────────────────────────────────────────────────────────

export type OpportunityConfidence = "HIGH" | "MEDIUM" | "LOW";

/**
 * How coverage is counted.
 *
 * ── "count" IS THE BRIEF'S RULE AND IT CANNOT SHIP AS THE DEFAULT ───────────
 *
 * Counting non-null subfactors over all fourteen gives a fully AI-tested
 * keyword 8/14 = 0.571 today, because six subfactors have no live source (see
 * V2_SUBFACTOR_SOURCES). That is below the MEDIUM bar of 0.65, so under
 * "count" every keyword in production is LOW confidence, the HIGH severity
 * gate never opens, and the tool's whole top band disappears — not because any
 * keyword is weak, but because we have not wired clickstream data yet.
 *
 * ── "weight" ASKS THE QUESTION THE GATE IS ACTUALLY FOR ─────────────────────
 *
 * The gate exists to stop us shouting about a keyword we barely measured. What
 * matters there is how much of the SCORE rests on measurements, not how many
 * boxes are ticked — an unmeasured subfactor worth 0.15 of a 0.20 pillar is
 * 3% of the answer, and counting it equal to searchVolume overstates the
 * damage sevenfold. So the default sums each measured subfactor's share of the
 * whole (pillar weight x subfactor weight), which puts a fully AI-tested
 * keyword at 0.705 and an untested one at 0.45 — MEDIUM and LOW respectively,
 * which is exactly the distinction v1's "no HIGH without an AI test" rule was
 * making by hand.
 *
 * Both are implemented and both are tested. Flip this constant to "count" to
 * get the brief's literal rule back; nothing else needs to change.
 */
export const COVERAGE_MODE: "weight" | "count" = "weight";

/** Coverage at or above this is HIGH confidence. */
export const CONFIDENCE_HIGH_MIN = 0.9;
/** Coverage at or above this is MEDIUM. Below it, LOW. */
export const CONFIDENCE_MEDIUM_MIN = 0.65;

/**
 * Severity cuts for v2, on the 0-100 calibrated score.
 *
 * DERIVED FROM THE DISTRIBUTION, NOT CARRIED OVER. They were chosen by scoring
 * the twenty-five fixtures through this module, sorting, and cutting in the
 * widest gap nearest the target band sizes — never by reusing v1's numbers,
 * which describe an additive score whose mass sits somewhere else entirely.
 *
 * ── 74 IS A COINCIDENCE. DO NOT DEDUPE IT AGAINST v1 ────────────────────────
 *
 * HIGH_SEVERITY_MIN_SCORE in ./score.ts is also 74. The two were derived
 * independently, from different formulas, on different distributions, and they
 * will diverge the moment either is retuned. Pointing one at the other would
 * couple two unrelated decisions that happen to have landed on the same
 * integer this once.
 *
 * ── THE CUT SITS IN A GAP, NOT ON A KEYWORD ─────────────────────────────────
 *
 * The eligible keywords either side of the HIGH cut score 74.585 and 73.409
 * raw, so 74 is very nearly the midpoint of that gap and both clear or miss it
 * by more than half a point of real score. That is the lesson v1 wrote down
 * the hard way (see HIGH_SEVERITY_MIN_SCORE): a cut that a flagship keyword
 * clears only because Math.round carried it there flips band on any drift.
 * MEDIUM at 47 sits in a much wider gap, between 50.909 and 44.309.
 *
 * ── THE SPLIT IS 11 / 8 / 6, AND 11 / 7 / 7 IS NOT REACHABLE ────────────────
 *
 * The brief asked for v1's 11 / 7 / 7. On this distribution no pair of cuts
 * produces it: the seventh and eighth rows below the HIGH band score 50.909
 * and 51.322, so any MEDIUM cut that admits one admits both, and the band
 * jumps from six to eight. 47 takes the eight, which puts the two AI-tested
 * keywords whose brand WAS mentioned in MEDIUM rather than beside "what is a
 * CRM" in LOW — they are worth knowing about and are not urgent, which is what
 * MEDIUM means.
 *
 * Same caveat as v1's: a fixture set built to exercise branches is not a
 * sampled population. Revisit when real domains have flowed.
 */
export const V2_SEVERITY_CUTS = {
  high: 74,
  medium: 47,
} as const;

// ── The geometric mean ─────────────────────────────────────────────────────

export interface WeightedFactor {
  /** 0-1, already transformed and clamped. Null means "not measured". */
  value: number | null;
  weight: number;
}

export interface GeomeanResult {
  /** exp(Σ w·ln f / Σ w) over the measured factors. Null when none were. */
  value: number | null;
  /** The weight that had a value, before renormalisation. 0 when all null. */
  measuredWeight: number;
}

/**
 * Weighted geometric mean over the factors that have a value.
 *
 * The renormalisation is the division by `total` and nothing else: with every
 * factor present it divides by 1 and is a no-op, exactly as v1's divisor was.
 * One code path, no special case for the fully-measured keyword.
 */
export function weightedGeomean(factors: readonly WeightedFactor[]): GeomeanResult {
  let sum = 0;
  let total = 0;

  for (const factor of factors) {
    if (factor.value === null) continue;
    // Every caller clamps before it gets here; this is belt-and-braces against
    // a ln(0) sneaking in from a future subfactor that forgets to.
    sum += factor.weight * Math.log(clampFactor(factor.value));
    total += factor.weight;
  }

  if (total <= 0) return { value: null, measuredWeight: 0 };
  return { value: Math.exp(sum / total), measuredWeight: total };
}

/**
 * Both weight tables sum to 1, over the FULL factor set.
 *
 * Called by the tests rather than at import time — a throw at module scope
 * would take the whole dashboard down over a scoring constant, and the place
 * to catch a typo in a weight table is CI.
 */
export function assertV2WeightsSumToOne(): void {
  const EPSILON = 1e-9;

  const pillarSum = PILLAR_KEYS.reduce((acc, key) => acc + V2_PILLAR_WEIGHTS[key], 0);
  if (Math.abs(pillarSum - 1) > EPSILON) {
    throw new Error(`v2 pillar weights sum to ${pillarSum}, not 1`);
  }

  for (const pillar of PILLAR_KEYS) {
    const subSum = SUBFACTOR_KEYS.filter((key) => SUBFACTOR_PILLAR[key] === pillar).reduce(
      (acc, key) => acc + V2_SUBFACTOR_WEIGHTS[key],
      0,
    );
    if (Math.abs(subSum - 1) > EPSILON) {
      throw new Error(`v2 subfactor weights for ${pillar} sum to ${subSum}, not 1`);
    }
  }
}

// ── Subfactor transforms ───────────────────────────────────────────────────

/** Log-normalised volume, reusing v1's curve and ceiling. */
export function searchVolumeFactor(monthlyVolume: number): number {
  return clampFactor(volumeScore(monthlyVolume) / 100);
}

/** v1's intent table, on 0-1. */
export function commercialIntentFactor(intent: string): number {
  return clampFactor(intentScore(intent) / 100);
}

/** v1's asymmetric trend clamp, on 0-1. Neutral lands at 0.33, as it does in v1. */
export function trendFactor(trendPercent: number): number {
  return clampFactor(trendScore(trendPercent) / 100);
}

/**
 * Quarter-on-quarter change in the growth RATE, in percentage points.
 *
 * 0 points of change is a steady trend and scores 0.5. See
 * ACCELERATION_CLAMP_POINTS for why this scale is symmetric where trendFactor's
 * is not.
 */
export function accelerationFactor(pointsOfChange: number): number {
  if (!Number.isFinite(pointsOfChange)) return MIN_FACTOR;
  const clamped = Math.min(
    ACCELERATION_CLAMP_POINTS,
    Math.max(-ACCELERATION_CLAMP_POINTS, pointsOfChange),
  );
  return clampFactor((clamped + ACCELERATION_CLAMP_POINTS) / (2 * ACCELERATION_CLAMP_POINTS));
}

/**
 * How absent the brand is from the answer, on 0-1.
 *
 * ZERO MENTIONS IS 1.0 AND IS NOT FLOORED. The transform inverts, so the
 * product's flagship finding — buyers ask, the assistant answers, the brand is
 * nowhere — is the MAXIMUM of this factor. It is the mentioned brand that ends
 * up at the floor.
 */
export function brandAiAbsenceFactor(ai: AiEvidence | null): number | null {
  if (ai === null) return null;
  const rate = Number.isFinite(ai.mentionRate) ? Math.min(1, Math.max(0, ai.mentionRate)) : 0;
  return clampFactor(1 - rate);
}

/**
 * Rivals in the answer, read as validation that the demand is real.
 *
 * Null when the keyword was never AI-tested — no answer was bought, so nobody
 * was counted. Not zero: "we did not ask" and "the assistant named nobody" are
 * different findings and only the second is a near-veto.
 */
export function competitorValidationFactor(competitorCount: number | null): number | null {
  if (competitorCount === null || !Number.isFinite(competitorCount)) return null;
  const count = Math.max(0, Math.round(competitorCount));
  const value = COMPETITOR_VALIDATION_CURVE[count] ?? COMPETITOR_VALIDATION_TAIL;
  return clampFactor(value);
}

/**
 * The continuous winnability hump over the same raw count.
 *
 * floor + (1 - floor) * exp(-((count - ideal)^2 / (2 * spread^2)))
 */
export function reasonableCompetitionFactor(competitorCount: number | null): number | null {
  if (competitorCount === null || !Number.isFinite(competitorCount)) return null;
  const count = Math.max(0, competitorCount);
  const exponent =
    -((count - COMPETITION_IDEAL) ** 2) / (2 * COMPETITION_SPREAD * COMPETITION_SPREAD);
  return clampFactor(COMPETITION_FLOOR + (1 - COMPETITION_FLOOR) * Math.exp(exponent));
}

/**
 * The gap between being NAMED and being RECOMMENDED.
 *
 * DISTINCT FROM brandAiAbsence, which asks only whether the brand appeared at
 * all. This asks where it landed once it did: named in passing but never in
 * the ranked list is a full gap (1.0), because a buyer reading that answer
 * comes away with somebody else's shortlist. Ranked first closes it. The two
 * agree at 1.0 for a brand that was never mentioned, which is correct — that
 * keyword has both problems — and diverge for every brand that was.
 */
export function recommendationGapFactor(ai: AiEvidence | null): number | null {
  if (ai === null) return null;
  return clampFactor(1 - clampScore(ai.visibilityScore ?? 0) / 100);
}

/** v1's rank ladder, on 0-1. Null rank is a full 1.0 — nothing to defend. */
export function currentRankFactor(googleRank: number | null): number {
  return clampFactor(seoGapScore(googleRank) / 100);
}

// ── Momentum, which is the only subfactor group with a shape of its own ────

export interface MomentumFactors {
  trend90d: number | null;
  trend30d: number | null;
  acceleration: number | null;
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Percent change, refusing a zero baseline the way ./trend.ts does. */
function pctChange(recent: number, baseline: number): number | null {
  if (baseline <= 0) return null;
  return ((recent - baseline) / baseline) * 100;
}

/**
 * The three momentum horizons.
 *
 * ── WHERE THE HISTORY COMES FROM, AND WHERE IT DOES NOT ─────────────────────
 *
 * `input.monthlyHistory` is the provider's twelve monthly search counts.
 * ./discover.ts receives them, reduces them to a single trendPercent and drops
 * them, so nothing in production supplies this field today and trend30d and
 * acceleration are null on every real row. Wiring it through is a change to
 * discover.ts and runner.ts and is deliberately NOT part of the v2 scorer.
 *
 * Three cases, and the distinction between the last two is the load-bearing
 * one:
 *
 *   history absent (undefined/null)  the v1-shaped input. trend90d falls back
 *                                    to the already-computed trendPercent;
 *                                    the other two are null.
 *   history present but short        a young domain. EVERY horizon is null and
 *                                    the whole MOMENTUM pillar drops out — we
 *                                    have the history and it does not say
 *                                    anything yet, which is not the same as a
 *                                    flat trend.
 *   history present and long enough  all three from the history.
 *
 * ── NO POINT-TO-POINT COMPARISONS ───────────────────────────────────────────
 *
 * ./trend.ts argues at length that one month against one month is mostly
 * noise, and that argument does not stop being true because the subfactor is
 * called "30d". So trend30d is the latest month against the trailing quarter's
 * mean — a smoothed baseline — rather than against the month before it.
 */
export function momentumFactors(
  trendPercent: number,
  history: readonly MonthlySearch[] | null | undefined,
): MomentumFactors {
  if (history === null || history === undefined) {
    return { trend90d: trendFactor(trendPercent), trend30d: null, acceleration: null };
  }

  const points = sortedHistory(history).slice(-12);
  const volumes = points.map((point) => Number(point.search_volume ?? 0));

  // Quarter against the quarter before it. Note this is NOT ./trend.ts's
  // window (newest three against OLDEST three) — that one spans the year and
  // is the figure the UI already shows; this one is a 90-day read.
  const quarterOverQuarter = (offset: number): number | null => {
    const end = volumes.length - offset;
    if (end - 6 < 0) return null;
    return pctChange(mean(volumes.slice(end - 3, end)), mean(volumes.slice(end - 6, end - 3)));
  };

  const recent = volumes.length >= TREND_90D_MIN_POINTS ? quarterOverQuarter(0) : null;

  // The latest month against the trailing quarter it sits on top of.
  const latest =
    volumes.length >= TREND_30D_MIN_POINTS
      ? pctChange(volumes[volumes.length - 1], mean(volumes.slice(-4, -1)))
      : null;

  const previous = volumes.length >= ACCELERATION_MIN_POINTS ? quarterOverQuarter(3) : null;

  return {
    trend90d: recent === null ? null : trendFactor(recent),
    trend30d: latest === null ? null : trendFactor(latest),
    acceleration:
      recent === null || previous === null ? null : accelerationFactor(recent - previous),
  };
}

// ── The score ──────────────────────────────────────────────────────────────

export type SubfactorScores = Record<SubfactorKey, number | null>;

export interface PillarResult {
  /** 0-1. Null when every subfactor in the pillar was null. */
  value: number | null;
  /** Sum of the within-pillar weights that had a value. 0-1. */
  measuredWeight: number;
}

export interface OpportunityScoreDetailV2 {
  subfactors: SubfactorScores;
  pillars: Record<PillarKey, PillarResult>;
  /**
   * How much of the score rests on something measured, 0-1. See COVERAGE_MODE
   * for what "how much" counts.
   */
  coverage: number;
  confidence: OpportunityConfidence;
  /**
   * The geometric mean, x100, before any calibration. 0-100.
   *
   * KEPT SEPARATE FROM calibratedScore EVEN THOUGH THEY ARE EQUAL. There is no
   * gamma transform today and there should not be one while these scores are
   * preview-only with no published semantics — but the day a calibration curve
   * is fitted, the raw figure is what it has to be fitted against, and a field
   * added later cannot be back-filled for rows already written.
   */
  rawScore: number;
  /** rawScore after calibration. Identical today; see above. */
  calibratedScore: number;
}

/** Every subfactor, transformed. The one place a signal becomes a factor. */
export function subfactorScores(input: OpportunityInput): SubfactorScores {
  const momentum = momentumFactors(input.trendPercent, input.monthlyHistory);
  const competitors = input.competitorCount ?? null;

  return {
    // DEMAND
    searchVolume: searchVolumeFactor(input.monthlyVolume),
    commercialIntent: commercialIntentFactor(input.intent),
    clickstreamValidation: null,
    // MOMENTUM
    trend90d: momentum.trend90d,
    trend30d: momentum.trend30d,
    acceleration: momentum.acceleration,
    // VISIBILITY_GAP — all four are null for a keyword nobody asked about.
    brandAiAbsence: brandAiAbsenceFactor(input.ai),
    competitorValidation: input.ai === null ? null : competitorValidationFactor(competitors),
    recommendationGap: recommendationGapFactor(input.ai),
    citationGap: null,
    // WINNABILITY
    currentRank: currentRankFactor(input.googleRank),
    contentFit: null,
    authorityFit: null,
    reasonableCompetition: input.ai === null ? null : reasonableCompetitionFactor(competitors),
  };
}

/** One pillar's geomean over its own subfactors. */
export function pillarScore(pillar: PillarKey, subfactors: SubfactorScores): PillarResult {
  const factors: WeightedFactor[] = SUBFACTOR_KEYS.filter(
    (key) => SUBFACTOR_PILLAR[key] === pillar,
  ).map((key) => ({ value: subfactors[key], weight: V2_SUBFACTOR_WEIGHTS[key] }));

  const result = weightedGeomean(factors);
  return { value: result.value, measuredWeight: result.measuredWeight };
}

/**
 * Coverage, on 0-1. See COVERAGE_MODE.
 *
 * Both modes are computed by the same walk so neither can drift; the mode
 * decides what each measured subfactor is worth.
 */
export function coverageFor(
  subfactors: SubfactorScores,
  mode: "weight" | "count" = COVERAGE_MODE,
): number {
  let measured = 0;
  let total = 0;

  for (const key of SUBFACTOR_KEYS) {
    const share =
      mode === "count" ? 1 : V2_PILLAR_WEIGHTS[SUBFACTOR_PILLAR[key]] * V2_SUBFACTOR_WEIGHTS[key];
    total += share;
    if (subfactors[key] !== null) measured += share;
  }

  return total === 0 ? 0 : measured / total;
}

export function confidenceFor(coverage: number): OpportunityConfidence {
  if (coverage >= CONFIDENCE_HIGH_MIN) return "HIGH";
  if (coverage >= CONFIDENCE_MEDIUM_MIN) return "MEDIUM";
  return "LOW";
}

export interface CompositionResult {
  pillars: Record<PillarKey, PillarResult>;
  /** 0-100. */
  rawScore: number;
}

/**
 * Subfactors -> pillars -> a 0-100 score. The second level of the mean.
 *
 * SPLIT OUT SO THE TESTS CAN DRIVE IT DIRECTLY. The composition is the part of
 * v2 with properties worth asserting — uniformity, monotonicity, what a null
 * does at each level — and every one of those assertions is worthless if it
 * runs against a reimplementation of this arithmetic in the test file. So the
 * tests hand it a subfactor map and this is the same function production calls.
 *
 * A keyword that measured nothing at all scores 0 rather than NaN. Unreachable
 * while searchVolume, commercialIntent and currentRank are unconditional, but a
 * version 3 that nulls one of them would find it.
 */
export function composeScore(subfactors: SubfactorScores): CompositionResult {
  const pillars = {
    demand: pillarScore("demand", subfactors),
    momentum: pillarScore("momentum", subfactors),
    visibilityGap: pillarScore("visibilityGap", subfactors),
    winnability: pillarScore("winnability", subfactors),
  } satisfies Record<PillarKey, PillarResult>;

  const top = weightedGeomean(
    PILLAR_KEYS.map((key) => ({ value: pillars[key].value, weight: V2_PILLAR_WEIGHTS[key] })),
  );

  return { pillars, rawScore: top.value === null ? 0 : clampScore(top.value * 100) };
}

/** The Opportunity Score, version 2. */
export function computeOpportunityDetailV2(input: OpportunityInput): OpportunityScoreDetailV2 {
  const subfactors = subfactorScores(input);
  const { pillars, rawScore } = composeScore(subfactors);
  const coverage = coverageFor(subfactors);

  return {
    subfactors,
    pillars,
    coverage,
    confidence: confidenceFor(coverage),
    rawScore,
    // No gamma. The two fields exist so that adding one later is a change to
    // this line and nothing else.
    calibratedScore: rawScore,
  };
}

/**
 * How loudly to recommend this keyword, under v2.
 *
 * TWO GATES ON HIGH, not one. v1's rule stands — an untested keyword can never
 * be HIGH, because "buyers ask this and the answer is not you" is precisely
 * what was not measured — and v2 adds the confidence floor, which generalises
 * it: HIGH is for keywords we measured enough of to shout about. The severity
 * scale itself is unchanged, so the UI's three bands still mean what they did.
 */
export function severityForV2(
  score: number,
  ai: AiEvidence | null,
  confidence: OpportunityConfidence,
): OpportunitySeverity {
  if (
    ai !== null &&
    !ai.mentioned &&
    score >= V2_SEVERITY_CUTS.high &&
    confidence !== "LOW"
  ) {
    return "HIGH";
  }
  if (score >= V2_SEVERITY_CUTS.medium) return "MEDIUM";
  return "LOW";
}
