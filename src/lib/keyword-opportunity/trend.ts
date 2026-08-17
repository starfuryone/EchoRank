// src/lib/keyword-opportunity/trend.ts
//
// The demand trend, derived from the provider's monthly search history.
//
// ── OUR ARITHMETIC, NOT THEIR FIGURE ────────────────────────────────────────
//
// DataForSEO Labs returns `keyword_info.monthly_searches` — up to twelve
// {year, month, search_volume} points — and no trend number. The percentage
// the UI shows is computed here, which is why COMPONENT_SOURCES marks the trend
// component "echorank" while volume and CPC are marked "provider": a customer
// disputing the trend is disputing us, and the methodology note says so.
//
// ── THREE MONTHS AGAINST THREE, NOT LAST AGAINST FIRST ──────────────────────
//
// A single-month endpoint comparison is mostly noise. Search volume for a
// commercial keyword swings on a bad December or one week of somebody's ad
// campaign, and a metric that reports +40% because one month happened to be
// quiet a year ago is a metric that sends people to rewrite a page for no
// reason. Comparing the mean of the three most recent months to the mean of the
// three oldest smooths that without pretending to be a regression — and a
// regression would be worse here, not better: twelve monthly points fit a line
// with enormous variance, and the slope's units ("searches per month per
// month") are not something to put a percent sign on.
//
// ── NO GOOGLE TRENDS, NO ADS API, NO CLICKSTREAM ────────────────────────────
//
// The only input is the history already inside the discovery response. There is
// no second call, and there must not be one: every extra provider is another
// data-licensing question and another number that can disagree with the volume
// sitting beside it in the same row.

/** One point of the provider's history. */
export interface MonthlySearch {
  year: number;
  month: number;
  search_volume?: number | null;
}

/**
 * Months at each end of the window that are averaged.
 *
 * Three, not one and not six. One is noise; six leaves no gap between the two
 * halves of a twelve-point series, so the comparison stops being "then versus
 * now" and becomes "the year against itself".
 */
export const TREND_WINDOW_MONTHS = 3;

/**
 * Points required before a trend is reported at all.
 *
 * Below this the two windows would overlap or be built from one or two
 * readings, and the honest answer is that we do not know. Zero — a flat trend —
 * is what an unknown trend scores, which puts the keyword at trendScore 33
 * rather than rewarding or punishing it for data we do not have.
 */
export const TREND_MIN_POINTS = 6;

/** Newest last, one point per (year, month), malformed points dropped. */
export function sortedHistory(history: readonly MonthlySearch[]): MonthlySearch[] {
  return [...(history ?? [])]
    .filter(
      (point) =>
        point != null &&
        Number.isFinite(point.year) &&
        Number.isFinite(point.month) &&
        Number.isFinite(point.search_volume ?? Number.NaN),
    )
    .sort((a, b) => a.year - b.year || a.month - b.month);
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Percent change across the last twelve months of history.
 *
 * REFUSES TO DIVIDE BY A ZERO BASELINE and returns 0 instead of Infinity — the
 * same call the web-analytics percent change makes, and for the same reason: a
 * keyword that went from nobody searching it to twelve people searching it is
 * not up by an infinite percentage, it is a keyword nobody searches.
 *
 * The return is a raw percentage, unclamped. Clamping to [-50, +100] belongs to
 * trendScore() in ./score.ts, which is where the scale is decided — storing a
 * pre-clamped figure would mean the UI could never show that demand tripled.
 */
export function trendPercentFrom(history: readonly MonthlySearch[]): number {
  const points = sortedHistory(history).slice(-12);
  if (points.length < TREND_MIN_POINTS) return 0;

  const volumes = points.map((point) => Number(point.search_volume ?? 0));
  const recent = mean(volumes.slice(-TREND_WINDOW_MONTHS));
  const baseline = mean(volumes.slice(0, TREND_WINDOW_MONTHS));

  if (baseline <= 0) return 0;

  return Math.round(((recent - baseline) / baseline) * 1000) / 10;
}
