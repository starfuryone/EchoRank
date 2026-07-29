// src/lib/ga/options.ts
//
// Ranges, limits and the report cache window. Kept free of the Prisma client
// and of lib/ga/client.ts (which is server-only) so the client component and
// the DB-less config tests can both import it.

export const GA_RANGES = [7, 28, 90] as const;
export type GaRange = (typeof GA_RANGES)[number];

export const DEFAULT_RANGE: GaRange = 28;

export function isGaRange(value: unknown): value is GaRange {
  return typeof value === "number" && (GA_RANGES as readonly number[]).includes(value);
}

/**
 * Report loads per tenant per hour.
 *
 * GA4's Data API is free but has per-property token quotas that a refresh loop
 * would burn through, leaving the tenant unable to load anything for an hour.
 * The 1 h cache absorbs normal use; this only stops pathological refreshing.
 */
export const REPORTS_PER_HOUR = 10;
export const REPORT_WINDOW_MS = 60 * 60 * 1000;

/**
 * How long a built report stays in Redis.
 *
 * GA4 itself is not real-time for most dimensions, and the panels are
 * day-grained, so an hour-old answer is the same answer — for five fewer API
 * calls and an instant page.
 */
export const REPORT_CACHE_TTL_SECONDS = 60 * 60;

/** Rows per table panel. */
export const TOP_PAGES_LIMIT = 20;
export const TOP_REFERRERS_LIMIT = 20;
export const CHANNELS_LIMIT = 12;

/** YYYY-MM-DD, `daysAgo` before `now` (UTC). GA4 accepts this or NdaysAgo. */
export function dayString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface DateWindow {
  startDate: string;
  endDate: string;
}

/**
 * The current window and the one immediately before it, for % change.
 *
 * `endDate` is YESTERDAY, not today: GA4's current day is partial, and
 * including it makes every metric look like it collapsed. The comparison
 * window is the same length ending the day before `startDate`, so the two are
 * like-for-like.
 */
export function windowsFor(range: GaRange, now = new Date()): {
  current: DateWindow;
  previous: DateWindow;
} {
  const DAY = 86_400_000;
  const end = new Date(now.getTime() - DAY);
  const start = new Date(end.getTime() - (range - 1) * DAY);
  const prevEnd = new Date(start.getTime() - DAY);
  const prevStart = new Date(prevEnd.getTime() - (range - 1) * DAY);
  return {
    current: { startDate: dayString(start), endDate: dayString(end) },
    previous: { startDate: dayString(prevStart), endDate: dayString(prevEnd) },
  };
}

/** Percent change, or null when the baseline is zero (not "infinite growth"). */
export function percentChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}
