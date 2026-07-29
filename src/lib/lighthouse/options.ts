// src/lib/lighthouse/options.ts
//
// Audit limits and thresholds. Kept out of service.ts so the DB-less config
// tests can import them without pulling in the Prisma client — the same split
// as the other tools' options modules.

// From the leaf module, NOT pagespeed/client: that one imports node:fs via
// its fixture helpers, and this file is reachable from the client component.
export { PSI_STRATEGIES as LIGHTHOUSE_STRATEGIES } from "@/lib/pagespeed/strategies";
export type { PsiStrategy as LighthouseStrategy } from "@/lib/pagespeed/strategies";

/** Mobile first: it is Google's indexing default and the harsher of the two. */
export const DEFAULT_STRATEGY = "mobile" as const;

/**
 * Re-auditing the same (url, strategy) inside this window replays the stored
 * run.
 *
 * Six hours rather than the 24 the paid tools use: Lighthouse is free, and a
 * developer who just shipped a fix wants to see it move today. Long enough to
 * stop accidental double-runs, short enough not to be in the way.
 */
export const LIGHTHOUSE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Audits per tenant per hour, ALL PLANS.
 *
 * PSI costs nothing, so this is not a monetization lever — it protects the
 * shared quota. Keyless PSI is throttled per source IP, so one tenant looping
 * audits would degrade the tool for every other tenant on this server.
 */
export const AUDITS_PER_HOUR = 20;
export const AUDIT_WINDOW_MS = 60 * 60 * 1000;

/** Rows kept in the history list. */
export const HISTORY_LIMIT = 50;

/** Opportunities shown per audit, highest estimated saving first. */
export const MAX_OPPORTUNITIES = 8;

/**
 * Lighthouse's own score bands. 0-49 red, 50-89 amber, 90-100 green — these
 * are the published thresholds, not a design choice, so the gauges match what
 * users see in Chrome DevTools and on web.dev.
 */
export type ScoreBand = "poor" | "average" | "good";

export function scoreBand(score: number | null): ScoreBand | null {
  if (score === null || !Number.isFinite(score)) return null;
  if (score < 50) return "poor";
  if (score < 90) return "average";
  return "good";
}

/**
 * Core Web Vitals thresholds (good / needs-improvement boundaries), from
 * web.dev. Values are in the metric's own unit: ms for LCP/INP/FCP/TBT/SI/TTI,
 * unitless for CLS.
 */
export const METRIC_THRESHOLDS: Record<string, { good: number; poor: number }> = {
  LCP: { good: 2500, poor: 4000 },
  INP: { good: 200, poor: 500 },
  CLS: { good: 0.1, poor: 0.25 },
  FCP: { good: 1800, poor: 3000 },
  TBT: { good: 200, poor: 600 },
  SI: { good: 3400, poor: 5800 },
  TTI: { good: 3800, poor: 7300 },
};

/** Threshold status for a raw metric value. Null when there is no threshold. */
export function metricBand(metric: string, value: number | null): ScoreBand | null {
  const t = METRIC_THRESHOLDS[metric];
  if (!t || value === null || !Number.isFinite(value)) return null;
  if (value <= t.good) return "good";
  if (value <= t.poor) return "average";
  return "poor";
}
