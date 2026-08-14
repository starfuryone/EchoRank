// src/lib/sov/weighting.ts
//
// The AI Share of Voice arithmetic, and nothing else.
//
// PURE, and separate from ./store.ts for the same reason ai-monitor/metrics.ts
// is separate from ai-monitor/metrics-store.ts: this module imports no Prisma,
// so every number below is testable without a database. The nightly worker is
// then only plumbing, and a reader checking whether the shares are right never
// has to read a query to find out.
//
// NOTHING HERE MODIFIES THE WATCHER. The observations this module consumes are
// mapped out of MentionAnalysis and CompetitorMention by ./observations.ts; the
// analyzer and the scorer that produced those rows are imported from, never
// touched.

/**
 * Ranks below this get their own weight; everything deeper is worth what fifth
 * place is worth.
 *
 * "Capped at the top 5" means CLAMPED, not DISCARDED. Dropping a sixth-place
 * mention to the unpositioned weight below would pay 0.3 for sixth place and
 * 0.2 for fifth — being ranked worse would score better, and a metric that
 * rewards slipping down a list is a metric nobody can act on.
 */
export const RANK_CAP = 5;

/**
 * What a mention with no position is worth.
 *
 * Sits between third place (0.333) and fourth (0.25) ON PURPOSE. An answer that
 * names a brand in prose rather than in a numbered list has still named it, and
 * the alternatives are both worse: score it 0 and a paragraph-shaped answer
 * reports every brand at zero share, score it 1 and an offhand aside outranks a
 * hard-won first place. 0.3 is "we know you were there, we do not know where" —
 * priced like a mid-list mention, which is what it usually turns out to be.
 *
 * The consequence is deliberate and worth stating: an unpositioned mention
 * outscores a ranked fourth or fifth place. That is the spec's choice, it is
 * pinned by the weight table in tests/sov-weighting.test.ts, and it is why
 * `position` is never inferred — an engine that returns no list must not have a
 * rank invented for it.
 */
export const UNPOSITIONED_WEIGHT = 0.3;

/**
 * One entity's appearance in one answer.
 *
 * ONE PER (RUN, ENTITY). The database already guarantees it — CompetitorMention
 * is unique on (promptRunId, name) and MentionAnalysis is unique on promptRunId
 * — so a brand named six times in one answer arrives here once. That is the
 * point: share of voice measures how many answers you are in and how high, not
 * how many times a chatty model repeated you.
 */
export interface SovObservation {
  /** Provider id, already normalized by ./observations.ts. */
  engine: string;
  /** Which prompt produced the answer. Distinct prompts become promptCount. */
  promptId: string;
  /** The entity, in its original casing. Grouped case-insensitively below. */
  brand: string;
  /**
   * 1-based rank in the answer's recommendation list, or null when the answer
   * ranked nothing. Null is a real, distinct fact — see UNPOSITIONED_WEIGHT.
   */
  rank: number | null;
}

/** One entity's standing on one engine, over one window. */
export interface SovRow {
  engine: string;
  brand: string;
  mentionWeighted: number;
  promptCount: number;
  /** 0..1. Sums to 1 across the rows one engine produced. */
  share: number;
}

/**
 * What one appearance is worth.
 *
 * 1/rank for the top five, fifth place's weight for anything deeper,
 * UNPOSITIONED_WEIGHT when the answer ranked nothing.
 *
 * A rank of 0 or a negative one cannot come from the analyzer — positions are
 * 1-based — so it is treated as the absence of a position rather than divided
 * by. Silently returning Infinity for rank 0 would hand one bad row 100% of a
 * tenant's share.
 */
export function mentionWeight(rank: number | null | undefined): number {
  if (rank === null || rank === undefined) return UNPOSITIONED_WEIGHT;
  if (!Number.isFinite(rank) || rank < 1) return UNPOSITIONED_WEIGHT;
  return 1 / Math.min(Math.floor(rank), RANK_CAP);
}

/** Case-insensitive grouping key. Mirrors topCompetitors() in ai-monitor/metrics.ts. */
export function brandKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Roll a window of observations into one row per (engine, brand).
 *
 * SHARE IS NORMALIZED WITHIN AN ENGINE, never across the whole window. Engines
 * are asked different numbers of questions and answer with different verbosity,
 * so a share pooled across all of them would mostly measure which engine we
 * queried most. "You own 22% of Perplexity" is a sentence with a meaning;
 * "you own 22% of AI" is not.
 *
 * An engine whose observations all weigh nothing writes no rows rather than a
 * row of NaN — the division guard below is the only place a zero denominator
 * can arise, and returning 0-share rows would claim we measured a universe in
 * which nobody was mentioned.
 *
 * Rows come back sorted by share descending, then by name, so the caller and
 * the page agree on who the top rival is without re-sorting.
 */
export function aggregateSov(observations: readonly SovObservation[]): SovRow[] {
  // engine -> brandKey -> bucket
  const engines = new Map<
    string,
    { prompts: Set<string>; brands: Map<string, { name: string; weight: number }> }
  >();

  for (const observation of observations) {
    const name = observation.brand.trim();
    if (name === "") continue;

    let engine = engines.get(observation.engine);
    if (!engine) {
      engine = { prompts: new Set(), brands: new Map() };
      engines.set(observation.engine, engine);
    }

    // promptCount describes the SAMPLE, so every prompt that produced an
    // observation counts once for the engine — including prompts where only a
    // competitor appeared. Counting only the prompts our own brand was in would
    // make the denominator shrink exactly when we are doing badly.
    engine.prompts.add(observation.promptId);

    const key = brandKey(name);
    const bucket = engine.brands.get(key) ?? { name, weight: 0 };
    bucket.weight += mentionWeight(observation.rank);
    engine.brands.set(key, bucket);
  }

  const rows: SovRow[] = [];

  for (const [engineName, engine] of engines) {
    const total = [...engine.brands.values()].reduce((sum, b) => sum + b.weight, 0);
    if (total <= 0) continue;

    const promptCount = engine.prompts.size;
    for (const bucket of engine.brands.values()) {
      rows.push({
        engine: engineName,
        brand: bucket.name,
        mentionWeighted: bucket.weight,
        promptCount,
        share: bucket.weight / total,
      });
    }
  }

  return rows.sort(
    (a, b) =>
      a.engine.localeCompare(b.engine) ||
      b.share - a.share ||
      a.brand.localeCompare(b.brand),
  );
}

// ─── Week-over-week drop ─────────────────────────────────────────────────────

/** Percentage points of share lost before an alert is worth raising. */
export const SHARE_DROP_POINTS = 5;

export interface ShareDrop {
  engine: string;
  /** Share a week ago, in PERCENTAGE POINTS (0..100), as the alert copy reads it. */
  before: number;
  /** Share now, same units. */
  after: number;
}

/**
 * Did this brand lose more than SHARE_DROP_POINTS of share on this engine?
 *
 * TAKES AND RETURNS PERCENTAGE POINTS, while SovSnapshot.share stores a 0..1
 * fraction. The conversion happens once, at the call site in ./alerts.ts, for
 * the reason VisibilityMetric's own comment gives about mixed units on one row:
 * the threshold is quoted in points by the spec and by the customer ("share
 * dropped 5 points"), so the comparison is done in the units it is stated in,
 * and a chart multiplying the wrong one by 100 is a silent 100x.
 *
 * Strictly greater than the threshold: a drop of exactly 5.0 points does not
 * alert, so the constant reads as "more than five points" everywhere.
 */
export function isReportableDrop(beforePoints: number, afterPoints: number): boolean {
  return beforePoints - afterPoints > SHARE_DROP_POINTS;
}
