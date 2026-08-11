// src/lib/ai-monitor/dashboard/display.ts
//
// The COLUMN CONTRACT, enforced in code.
//
// metrics.ts documents which VisibilityMetric column is on which scale; this is
// the only place the dashboard is allowed to convert one for display, and every
// screen goes through it. The contract is prose in a comment block — prose does
// not fail a build. These functions do.
//
// THE THREE THAT BITE, each with a test named after the failure:
//   sentimentScore   stored -1..1. Rendered as a percentage it puts a neutral
//                    brand at 0% and a disliked one below the axis.
//   mentionRate      stored 0-1. Rendered raw it says "0.8%" for a brand
//                    mentioned in four answers out of five.
//   averagePosition  a PLACE, lower is better. On a 0-100 axis it reads as a
//                    catastrophic score; on any bar it must be inverted.
//
// NO RE-SCORING, ANYWHERE. Nothing here recomputes a score from components, and
// nothing may: the row was written by the version of the formula that was
// current on the day, and recomputing it at render time would silently restate
// history the moment a weight changed. The dashboard's job is to render what
// was stored, or to say it cannot.

/** Score versions this build knows how to render. */
export const SUPPORTED_SCORE_VERSIONS: readonly number[] = [1];

export function isSupportedScoreVersion(version: number): boolean {
  return SUPPORTED_SCORE_VERSIONS.includes(version);
}

/**
 * A metric row, reduced to what a screen may show.
 *
 * `unsupported` is not an error state to hide — it is a rendered state. A row
 * written by a version 2 formula is a real measurement this build cannot
 * interpret, and showing its number under a version 1 label would be the exact
 * silent lie the versioning exists to prevent.
 */
export type MetricView =
  | { supported: false; scoreVersion: number; day: Date; engine: string }
  | {
      supported: true;
      scoreVersion: number;
      day: Date;
      engine: string;
      /** 0-100. "AI Search Score" on screen. */
      score: number;
      /** 0-100 for a bar; null when the engine cannot cite. */
      citationScore: number | null;
      recommendationScore: number;
      /** -1..1 as stored. Convert with sentimentLabel/sentimentPercent to show. */
      sentimentScore: number | null;
      shareOfVoice: number | null;
      /** A place. Lower is better. */
      averagePosition: number | null;
      /** 0-1 as stored. */
      mentionRate: number;
      top3Rate: number;
      runCount: number;
      partialCoverage: boolean;
      skippedRuns: number;
    };

export interface MetricRow {
  day: Date;
  engine: string;
  scoreVersion: number;
  visibilityScore: number;
  citationScore: number | null;
  recommendationScore: number;
  sentimentScore: number | null;
  shareOfVoice: number | null;
  averagePosition: number | null;
  mentionRate: number;
  top3Rate: number;
  runCount: number;
  partialCoverage: boolean;
  skippedRuns: number;
}

/** Gate a stored row on its version before anything renders it. */
export function toMetricView(row: MetricRow): MetricView {
  if (!isSupportedScoreVersion(row.scoreVersion)) {
    return {
      supported: false,
      scoreVersion: row.scoreVersion,
      day: row.day,
      engine: row.engine,
    };
  }
  return {
    supported: true,
    scoreVersion: row.scoreVersion,
    day: row.day,
    engine: row.engine,
    score: row.visibilityScore,
    citationScore: row.citationScore,
    recommendationScore: row.recommendationScore,
    sentimentScore: row.sentimentScore,
    shareOfVoice: row.shareOfVoice,
    averagePosition: row.averagePosition,
    mentionRate: row.mentionRate,
    top3Rate: row.top3Rate,
    runCount: row.runCount,
    partialCoverage: row.partialCoverage,
    skippedRuns: row.skippedRuns,
  };
}

// ── the three conversions ───────────────────────────────────────────────────

/**
 * A stored 0-1 fraction as a whole percentage.
 *
 * mentionRate and top3Rate only. NOT for visibilityScore, which is already
 * 0-100 and would come out as 8000%.
 */
export function fractionAsPercent(fraction: number, decimals = 0): string {
  const value = Math.max(0, Math.min(1, fraction)) * 100;
  return `${value.toFixed(decimals)}%`;
}

/** "mentioned in 80% of answers" — the customer-facing line. */
export function mentionFrequencyLabel(mentionRate: number): string {
  return `mentioned in ${fractionAsPercent(mentionRate)} of answers`;
}

/**
 * Stored -1..1 sentiment as a 0-100 figure for a meter.
 *
 * FOR DISPLAY ONLY. The stored column keeps its own scale, and nothing writes
 * this back. -1 becomes 0, 0 becomes 50, 1 becomes 100 — so a neutral brand
 * sits mid-track rather than at the floor, which is what a raw percentage
 * rendering gets wrong.
 */
export function sentimentPercent(sentimentScore: number): number {
  const clamped = Math.max(-1, Math.min(1, sentimentScore));
  return Math.round(((clamped + 1) / 2) * 100);
}

/** Words rather than a number, because -1..1 means nothing to a reader. */
export function sentimentLabel(sentimentScore: number | null): string {
  if (sentimentScore === null) return "No reading";
  if (sentimentScore > 0.33) return "Positive";
  if (sentimentScore < -0.33) return "Negative";
  return "Neutral";
}

/**
 * A rank, formatted so it cannot be mistaken for a score.
 *
 * "#2.9". The hash is doing real work: a bare 2.9 beside a 78 reads as a
 * catastrophically low score rather than as a strong average placing.
 */
export function positionLabel(averagePosition: number | null): string {
  if (averagePosition === null) return "—";
  return `#${averagePosition.toFixed(1)}`;
}

/**
 * A position turned into a 0-100 bar length, INVERTED.
 *
 * Position 1 is the best and must fill the bar; position 10 is worse and must
 * not. Plotting the raw number would draw the longest bar for the worst rank —
 * the single most inverted thing a chart can do. Anything past `worst` pins to
 * a short-but-visible stub rather than to zero, because a bar of length 0 is
 * indistinguishable from no data.
 */
export function positionAsBarValue(averagePosition: number | null, worst = 10): number {
  if (averagePosition === null || averagePosition < 1) return 0;
  if (averagePosition >= worst) return 5;
  return Math.round(((worst - averagePosition) / (worst - 1)) * 95) + 5;
}

// ── coverage ────────────────────────────────────────────────────────────────

export interface CoverageNote {
  partial: boolean;
  /** Rendered beside every affected metric, not once at the top of the page. */
  label: string | null;
}

/**
 * What to say about a row that did not run its whole plan.
 *
 * SHOWN ON EVERY AFFECTED METRIC. A single banner at the top of a page is read
 * once and forgotten by the time someone is looking at the fourth card; the
 * number itself has to carry the caveat, because the number is what gets
 * screenshotted into a report.
 */
export function coverageNote(view: MetricView): CoverageNote {
  if (!view.supported || !view.partialCoverage) return { partial: false, label: null };
  const planned = view.runCount + view.skippedRuns;
  return {
    partial: true,
    label: `Partial: ${view.runCount} of ${planned} answers collected`,
  };
}

// ── dates ───────────────────────────────────────────────────────────────────

/**
 * A stored UTC day, displayed in the tenant's timezone.
 *
 * FORMATTING ONLY — the bucket is not moved. The row was written for a UTC day
 * by the runner, and re-bucketing it into local days here would put two rows on
 * one date for a tenant west of UTC and none on another. What the reader gets
 * is the stored day rendered in their locale's conventions, which is a labelling
 * choice; which day a measurement belongs to is the runner's, and is already
 * decided.
 */
export function formatDay(day: Date, timezone: string, locale = "en-US"): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      // The stored value is midnight UTC. Formatting it in the tenant's zone
      // without this would roll it back a day for anywhere west of London.
      timeZone: "UTC",
    }).format(day);
  } catch {
    return day.toISOString().slice(0, 10);
  }
}

/** A timestamp — an actual instant — in the tenant's zone. */
export function formatInstant(at: Date, timezone: string, locale = "en-US"): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
    }).format(at);
  } catch {
    return at.toISOString();
  }
}
