// src/lib/ai-monitor/metrics.ts
//
// The canonical AI Search Score, and the roll-ups that go beside it.
//
// COHORT-LEVEL, AND DELIBERATELY NOT ./scoring.ts. That module scores ONE
// response (0-100) and then averages per provider; this one computes four
// components across a SET of runs — how often we were named, how high, how
// often cited, how warmly.
//
//   ./scoring.ts    mentionVisibilityScore  -> MentionAnalysis.visibilityScore
//                   checkupVisibilityScore  -> Checkup.visibilityScore
//   this module     computeScoreV1          -> VisibilityMetric.visibilityScore
//
// THOSE ARE TWO PRODUCTS' NUMBERS, NOT TWO VERSIONS OF ONE.
// VisibilityMetric.visibilityScore IS the AI Search Score, and it is the only
// score the watcher UI shows. Checkup.visibilityScore belongs to the audit:
// never rendered on a watcher screen, never renamed to match this, and never
// averaged with or mapped onto it. They are both 0-100 and both correct, which
// is exactly why someone will eventually try to reconcile them — there is
// nothing to reconcile, and a "fix" that relates them invents a number neither
// product measured.
//
// VisibilityMetric's schema comment has pointed at this file since the table
// was added; this is that file. The COLUMN CONTRACT block further down is the
// authority on which aggregate lands in which column and on what scale.
//
// PURE. No Prisma, no clock, no env, no logger — every input is passed in. The
// zero-run case therefore returns null rather than logging: the caller writing
// the row is the one that knows it was about to write one, so it owns the
// warning (see ./metrics-store.ts).
//
// VERSIONED, AND HISTORY IS NEVER RECOMPUTED. `scoreVersion` is stored on every
// row. When the weights change, a version 2 is added beside this and new rows
// carry 2; the version 1 rows keep the number the customer was shown at the
// time. A trend line that silently restates last quarter is worse than no
// trend line, because nobody can tell it happened.

import type { Sentiment } from "./analysis/entities";

/** The version this module computes. Stored on every row it produces. */
export const SCORE_VERSION = 1 as const;

/**
 * The four components, weighted.
 *
 * MENTION LEADS because being in the answer at all is the precondition for
 * everything else, and it is the metric a customer can state without
 * explanation ("we show up in 80% of answers"). POSITION is next because being
 * named fifth and being named first are different products. CITATION carries
 * real weight despite being rarer: it is the only component that sends traffic
 * and the only one the brand can act on directly. SENTIMENT is last because it
 * moves least and is the noisiest reading of the four.
 */
export const SCORE_WEIGHTS_V1 = {
  mention: 0.4,
  position: 0.3,
  citation: 0.2,
  sentiment: 0.1,
} as const;

/**
 * Inside the citation component: mostly "how often", partly "how high".
 *
 * Being cited at all is the thing that is hard; being cited first is a bonus on
 * top. Weighting rank more heavily would let one lucky first-place citation in
 * twenty runs outscore steady citation across all twenty.
 */
export const CITATION_RATE_WEIGHT = 0.7;
export const CITATION_RANK_WEIGHT = 0.3;

/** Sentiment on the same 0-100 scale as every other component. */
export const SENTIMENT_SCORES: Readonly<Record<string, number>> = {
  POSITIVE: 100,
  NEUTRAL: 50,
  NEGATIVE: 0,
};

/** Inside competitor_score: how often they appear, and how high. */
export const COMPETITOR_FREQUENCY_WEIGHT = 0.6;
export const COMPETITOR_POSITION_WEIGHT = 0.4;

/** More than this and the panel is a directory rather than a shortlist. */
export const MAX_TOP_COMPETITORS = 10;

export interface ScoredCitation {
  domain: string;
  /** 1-based order of appearance in the answer. */
  citationPosition: number | null;
  isMonitoredDomain: boolean;
}

export interface ScoredCompetitor {
  name: string;
  /** 1-based place in the answer's ranked list, when it ranked them. */
  position: number | null;
}

/**
 * One analysed run, as ./analysis/analyze-response.ts produces it.
 *
 * Structural rather than a Prisma type: these numbers must be computable from a
 * fixture in a test with no database, and the aggregation is the part most
 * worth testing.
 */
export interface ScoredRun {
  engine: string;
  promptId: string;
  brandMentioned: boolean;
  mentionCount: number;
  /** 1-based. Null when the brand was named but not ranked, or not named. */
  brandPosition: number | null;
  sentiment: Sentiment | null;
  citations: readonly ScoredCitation[];
  competitors: readonly ScoredCompetitor[];
}

export interface ScoreComponents {
  mention: number;
  position: number;
  citation: number;
  sentiment: number;
}

export interface ScoreV1 {
  score: number;
  components: ScoreComponents;
  scoreVersion: typeof SCORE_VERSION;
  runCount: number;
}

/**
 * Every component is a 0-100 figure before it is weighted.
 *
 * NaN is the only value that becomes 0; an infinity clamps to the bound it ran
 * past. Treating Infinity as 0 would turn the most extreme possible input into
 * the mildest possible output, which is the wrong direction for a guard.
 */
export function clampComponent(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/** One decimal — what the score is stored and rendered at. */
export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Runs where the brand appeared in the answer's ranked list. */
function positionedRuns(runs: readonly ScoredRun[]): number[] {
  return runs
    .map((run) => run.brandPosition)
    .filter((position): position is number => position !== null && position >= 1);
}

/** Runs carrying at least one citation of the monitored domain. */
function citingRuns(runs: readonly ScoredRun[]): ScoredRun[] {
  return runs.filter((run) => run.citations.some((c) => c.isMonitoredDomain));
}

export function mentionComponent(runs: readonly ScoredRun[]): number {
  if (runs.length === 0) return 0;
  const mentioned = runs.filter((run) => run.brandMentioned).length;
  return clampComponent((mentioned / runs.length) * 100);
}

/**
 * Average of 100/position over the runs that ranked the brand.
 *
 * MENTIONED BUT NEVER RANKED SCORES ZERO HERE, with no flat fallback. The
 * mention component has already paid for the appearance; paying again for it
 * under "position" would mean a brand that is never ranked anywhere still
 * collects most of a positioned brand's score, and the two would stop being
 * distinguishable — which is the whole reason position is a component.
 */
export function positionComponent(runs: readonly ScoredRun[]): number {
  const positions = positionedRuns(runs);
  if (positions.length === 0) return 0;
  return clampComponent(mean(positions.map((position) => 100 / position)));
}

/**
 * Citation rate, plus a bonus for the best rank achieved.
 *
 * `best_citation_rank` is the minimum citation position across the citing runs.
 * A citing run whose position is unknown (an engine that returns sources
 * without an order) still counts toward the rate; it simply cannot contribute
 * to the rank term, and if NO citing run has a position the rank term is zero
 * rather than the whole component being discarded.
 */
export function citationComponent(runs: readonly ScoredRun[]): number {
  if (runs.length === 0) return 0;
  const citing = citingRuns(runs);
  if (citing.length === 0) return 0;

  const ranks = citing
    .flatMap((run) => run.citations.filter((c) => c.isMonitoredDomain))
    .map((c) => c.citationPosition)
    .filter((position): position is number => position !== null && position >= 1);

  const rate = (citing.length / runs.length) * 100;
  const bestRank = ranks.length > 0 ? Math.min(...ranks) : null;
  const rankTerm = bestRank === null ? 0 : 100 / bestRank;

  return clampComponent(
    CITATION_RATE_WEIGHT * clampComponent(rate) + CITATION_RANK_WEIGHT * clampComponent(rankTerm),
  );
}

/**
 * Average sentiment over the runs that mentioned the brand.
 *
 * NO MENTIONS AT ALL IS ZERO, not a neutral 50. A brand nobody talks about has
 * not earned a neutral reading — it has no reading, and handing it half the
 * component would put an invisible brand above one that is mentioned and
 * disliked, which inverts the thing being measured.
 *
 * A run the deterministic scan found but whose ranking pass returned
 * NOT_MENTIONED (or failed outright) is EXCLUDED rather than counted neutral:
 * the two passes disagreeing is an absence of evidence about tone, and
 * inventing a neutral reading for it would drag every real reading toward 50.
 */
export function sentimentComponent(runs: readonly ScoredRun[]): number {
  const scores = runs
    .filter((run) => run.brandMentioned)
    .map((run) => (run.sentiment === null ? undefined : SENTIMENT_SCORES[run.sentiment]))
    .filter((score): score is number => score !== undefined);

  if (scores.length === 0) return 0;
  return clampComponent(mean(scores));
}

/**
 * The canonical AI Search Score, version 1.
 *
 * Null for an empty run set: no runs is not a score of zero. "We could not ask"
 * and "you are invisible" are different findings, and a dashboard that renders
 * the first as the second is lying quietly.
 */
export function computeScoreV1(runs: readonly ScoredRun[]): ScoreV1 | null {
  if (runs.length === 0) return null;

  const components: ScoreComponents = {
    mention: mentionComponent(runs),
    position: positionComponent(runs),
    citation: citationComponent(runs),
    sentiment: sentimentComponent(runs),
  };

  const score = round1(
    SCORE_WEIGHTS_V1.mention * components.mention +
      SCORE_WEIGHTS_V1.position * components.position +
      SCORE_WEIGHTS_V1.citation * components.citation +
      SCORE_WEIGHTS_V1.sentiment * components.sentiment,
  );

  return { score, components, scoreVersion: SCORE_VERSION, runCount: runs.length };
}

/**
 * Dispatch on a stored version.
 *
 * One line today, and the reason history never has to be migrated: a version 2
 * is added as another branch, and rows written under 1 keep being read by the
 * code that produced them.
 */
export function computeScore(runs: readonly ScoredRun[], version: number = SCORE_VERSION) {
  switch (version) {
    case 1:
      return computeScoreV1(runs);
    default:
      throw new Error(`unknown AI search score version: ${version}`);
  }
}

export interface DomainCitations {
  domain: string;
  count: number;
  /** Mean citation position for this domain, over the citations that had one. */
  averageRank: number | null;
}

export interface TopCompetitor {
  name: string;
  /** Share of runs this competitor appeared in, 0-1. */
  frequency: number;
  /** Mean rank over the runs that ranked them. Null when none did. */
  averagePosition: number | null;
  competitorScore: number;
}

export interface AggregateMetrics {
  runCount: number;
  /** Share of runs mentioning the brand, 0-1. The customer-facing "80%". */
  mentionFrequency: number;
  totalMentions: number;
  /** Mean brand position over positioned runs. Null when none. */
  averagePosition: number | null;
  /** Share of runs that ranked the brand in the top three, 0-1. */
  top3Rate: number;
  /**
   * The brand's appearances as a share of every entity appearance, 0-100.
   * Null when nothing at all was named — by us or anyone.
   */
  shareOfVoice: number | null;
  /**
   * Mean sentiment on -1..1, the scale VisibilityMetric.sentimentScore stores.
   * Deliberately NOT the same number as the 0-100 sentiment component: that one
   * feeds a weighted score, this one is displayed. Null when no mentioned run
   * carried a reading.
   */
  meanSentiment: number | null;
  /** Citations of the monitored domain, across every run. */
  monitoredDomainCitations: number;
  citationsByDomain: DomainCitations[];
  topCompetitors: TopCompetitor[];
}

/** POSITIVE/NEUTRAL/NEGATIVE on -1..1, for the displayed sentiment figure. */
export const SENTIMENT_SIGNED: Readonly<Record<string, number>> = {
  POSITIVE: 1,
  NEUTRAL: 0,
  NEGATIVE: -1,
};

/**
 * Per-source counts and mean rank, busiest first.
 *
 * Counts CITATIONS, not runs: a domain cited twice in one answer was cited
 * twice, and the influence graph this feeds cares about volume.
 */
export function citationsByDomain(runs: readonly ScoredRun[]): DomainCitations[] {
  const buckets = new Map<string, { count: number; ranks: number[] }>();

  for (const run of runs) {
    for (const citation of run.citations) {
      const bucket = buckets.get(citation.domain) ?? { count: 0, ranks: [] };
      bucket.count += 1;
      if (citation.citationPosition !== null && citation.citationPosition >= 1) {
        bucket.ranks.push(citation.citationPosition);
      }
      buckets.set(citation.domain, bucket);
    }
  }

  return [...buckets.entries()]
    .map(([domain, { count, ranks }]) => ({
      domain,
      count,
      averageRank: ranks.length > 0 ? round1(mean(ranks)) : null,
    }))
    .sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain));
}

/**
 * The competitors worth naming, scored on the same two axes as the brand.
 *
 * FREQUENCY IS PER RUN, NOT PER APPEARANCE. A competitor named three times in
 * one answer appeared in one answer; counting the repeats would let a single
 * effusive response manufacture a rival. The position term uses their mean rank
 * over the runs that ranked them, and contributes nothing when none did — the
 * same rule the brand's own position component follows.
 */
export function topCompetitors(
  runs: readonly ScoredRun[],
  limit: number = MAX_TOP_COMPETITORS,
): TopCompetitor[] {
  if (runs.length === 0) return [];

  const buckets = new Map<string, { name: string; runs: number; positions: number[] }>();

  for (const run of runs) {
    // De-duplicated within the run, so one answer contributes one appearance
    // however many times it repeats the name.
    const seen = new Set<string>();
    for (const competitor of run.competitors) {
      const name = competitor.name.trim();
      if (name === "") continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const bucket = buckets.get(key) ?? { name, runs: 0, positions: [] };
      bucket.runs += 1;
      if (competitor.position !== null && competitor.position >= 1) {
        bucket.positions.push(competitor.position);
      }
      buckets.set(key, bucket);
    }
  }

  return [...buckets.values()]
    .map(({ name, runs: appearances, positions }) => {
      const frequency = appearances / runs.length;
      const averagePosition = positions.length > 0 ? mean(positions) : null;
      const positionTerm = averagePosition === null ? 0 : 100 / averagePosition;
      const competitorScore = round1(
        COMPETITOR_FREQUENCY_WEIGHT * clampComponent(frequency * 100) +
          COMPETITOR_POSITION_WEIGHT * clampComponent(positionTerm),
      );
      return {
        name,
        frequency,
        averagePosition: averagePosition === null ? null : round1(averagePosition),
        competitorScore,
      };
    })
    .sort((a, b) => b.competitorScore - a.competitorScore || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** Everything reported beside the score, over the same run set. */
export function aggregateMetrics(runs: readonly ScoredRun[]): AggregateMetrics | null {
  if (runs.length === 0) return null;

  const positions = positionedRuns(runs);
  const mentioned = runs.filter((run) => run.brandMentioned).length;

  const signed = runs
    .filter((run) => run.brandMentioned)
    .map((run) => (run.sentiment === null ? undefined : SENTIMENT_SIGNED[run.sentiment]))
    .filter((value): value is number => value !== undefined);

  // Appearances, counted per run on both sides so one verbose answer cannot
  // manufacture share for whoever it happened to repeat.
  const competitorAppearances = runs.reduce(
    (total, run) => total + new Set(run.competitors.map((c) => c.name.trim().toLowerCase())).size,
    0,
  );
  const allAppearances = mentioned + competitorAppearances;

  return {
    runCount: runs.length,
    mentionFrequency: mentioned / runs.length,
    totalMentions: runs.reduce((total, run) => total + run.mentionCount, 0),
    averagePosition: positions.length > 0 ? round1(mean(positions)) : null,
    top3Rate: positions.filter((position) => position <= 3).length / runs.length,
    shareOfVoice: allAppearances === 0 ? null : round1((mentioned / allAppearances) * 100),
    meanSentiment: signed.length === 0 ? null : Math.round(mean(signed) * 100) / 100,
    monitoredDomainCitations: runs.reduce(
      (total, run) => total + run.citations.filter((c) => c.isMonitoredDomain).length,
      0,
    ),
    citationsByDomain: citationsByDomain(runs),
    topCompetitors: topCompetitors(runs),
  };
}

export interface Aggregate extends AggregateMetrics {
  score: number;
  components: ScoreComponents;
  scoreVersion: number;
}

function aggregateOne(runs: readonly ScoredRun[], version: number): Aggregate | null {
  const scored = computeScore(runs, version);
  const metrics = aggregateMetrics(runs);
  if (scored === null || metrics === null) return null;
  return {
    ...metrics,
    score: scored.score,
    components: scored.components,
    scoreVersion: version,
  };
}

export interface CheckupAggregate {
  /** Over every run in the cycle. Null when there were none. */
  overall: Aggregate | null;
  /** Same formula, over each engine's subset. */
  byEngine: Record<string, Aggregate>;
  /** Same formula, over each prompt's subset. */
  byPrompt: Record<string, Aggregate>;
}

/**
 * The whole cycle: overall, per engine, per prompt.
 *
 * THE SAME FUNCTION ON EVERY SUBSET, never a re-derivation from the overall
 * numbers. A per-engine score computed by apportioning the total would be a
 * different formula wearing the same name, and the per-engine table is exactly
 * where a customer goes to check the headline.
 */
export function aggregateCheckup(
  runs: readonly ScoredRun[],
  version: number = SCORE_VERSION,
): CheckupAggregate {
  const group = <K extends keyof ScoredRun>(key: K) => {
    const groups = new Map<string, ScoredRun[]>();
    for (const run of runs) {
      const value = String(run[key]);
      const bucket = groups.get(value) ?? [];
      bucket.push(run);
      groups.set(value, bucket);
    }
    const out: Record<string, Aggregate> = {};
    for (const [value, subset] of groups) {
      const aggregate = aggregateOne(subset, version);
      if (aggregate !== null) out[value] = aggregate;
    }
    return out;
  };

  return {
    overall: aggregateOne(runs, version),
    byEngine: group("engine"),
    byPrompt: group("promptId"),
  };
}

// ───────────────────────────── COLUMN CONTRACT ─────────────────────────────
//
// What lands in each VisibilityMetric column, and ON WHICH SCALE. The table was
// created before this module existed, so several of its columns were named
// without a definition; these are the definitions. Read this rather than
// inferring a column's meaning from its name — three of them are not what a
// reader would assume, and two scales share the row.
//
//   visibilityScore      0-100  THE AI Search Score. The only score the watcher
//                               UI shows. Not related to Checkup.visibilityScore
//                               — see the header.
//   scoreVersion         int    Which formula produced visibilityScore.
//                               Historical rows are never recomputed; a version
//                               2 is written beside them.
//   recommendationScore  0-100  The POSITION component: how high the answers
//                               placed the brand in what they recommended.
//                               Nothing else on the row is a candidate for this
//                               name, and it is NOT a second overall score.
//   citationScore        0-100  The CITATION component — OR NULL on an engine
//                        or null that does not return citations at all.
//                               NULL IS NOT ZERO HERE. Zero means "could have
//                               cited you and never did", which is a finding;
//                               null means "this engine cannot be measured this
//                               way", which is not. Charts must skip nulls
//                               rather than plot them at the axis. The caller
//                               supplies the capability from
//                               AIEngine.supportsCitations — it is not derivable
//                               from the runs, because an engine that CAN cite
//                               and did not is a genuine zero.
//   sentimentScore      -1..1   The RAW SIGNED MEAN, stored as it is measured.
//                        or null POSITIVE/NEUTRAL/NEGATIVE map to +1/0/-1 here.
//                               The 0-100 form (100/50/0) exists ONLY inside
//                               computeScoreV1, where it has to share a scale
//                               with the other three components. Do not store
//                               the 0-100 form and do not convert on read: a
//                               -1..1 column rendered as a percentage puts a
//                               neutral brand at 0% and a disliked one below
//                               the axis. Null when no mentioned run carried a
//                               reading.
//   shareOfVoice         0-100  Brand appearances as a share of all entity
//                               appearances. Null when nothing was named at all.
//   averagePosition      1..n   Mean rank over the runs that ranked the brand —
//                               a PLACE, not a score, so lower is better and it
//                               is the one number here that must never be shown
//                               on a 0-100 axis. Null when none ranked it.
//   mentionRate          0-1    FRACTION. 0.8 means 80%.
//   top3Rate             0-1    FRACTION.
//   runCount             int    Runs the row was computed from. A score off two
//                               runs and one off two hundred are not the same
//                               claim; the chart dims the former.
//
// ───────────────────────────────────────────────────────────────────────────

/** One VisibilityMetric row, ready to upsert. See the COLUMN CONTRACT above. */
export interface VisibilityMetricRow {
  engine: string;
  day: Date;
  /** 0-100. */
  visibilityScore: number;
  /** 0-100, or null on an engine that cannot cite. Null is not zero. */
  citationScore: number | null;
  /** 0-100, the position component. */
  recommendationScore: number;
  /** -1..1 raw mean, NOT the 0-100 component. */
  sentimentScore: number | null;
  /** 0-100. */
  shareOfVoice: number | null;
  /** A place, 1..n — lower is better. */
  averagePosition: number | null;
  /** 0-1. */
  mentionRate: number;
  /** 0-1. */
  top3Rate: number;
  runCount: number;
  scoreVersion: number;
}

/**
 * Map an aggregate onto the VisibilityMetric columns.
 *
 * PURE AND TESTED, and the single place the COLUMN CONTRACT above is applied.
 * Doing it here rather than inline at the call site is what keeps those
 * decisions in one reviewable diff when the dashboard is built.
 */
export function toVisibilityMetricRow(
  engine: string,
  day: Date,
  aggregate: Aggregate,
  options: { supportsCitations?: boolean } = {},
): VisibilityMetricRow {
  return {
    engine,
    day,
    visibilityScore: aggregate.score,
    citationScore: options.supportsCitations === false ? null : aggregate.components.citation,
    recommendationScore: aggregate.components.position,
    sentimentScore: aggregate.meanSentiment,
    shareOfVoice: aggregate.shareOfVoice,
    averagePosition: aggregate.averagePosition,
    mentionRate: aggregate.mentionFrequency,
    top3Rate: aggregate.top3Rate,
    runCount: aggregate.runCount,
    scoreVersion: aggregate.scoreVersion,
  };
}
