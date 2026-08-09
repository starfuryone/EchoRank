// src/lib/backlinks/options.ts
//
// Row limits, cache window and per-plan caps. Kept out of service.ts so the
// DB-less config tests can import them without pulling in the Prisma client —
// the same split as serp/, site-explorer/ and rank-tracker/options.ts.

import type { PlanType } from "@/generated/prisma";

/**
 * Rows requested per section.
 *
 * The Backlinks API bills per request AND per row returned, so these four
 * numbers ARE the price of an analysis. Raising them raises every tenant's
 * bill on every run; measure before changing (see the cost report in the
 * feature commit).
 */
export const REFERRING_DOMAINS_LIMIT = 50;
export const ANCHORS_LIMIT = 30;
export const DOMAIN_PAGES_LIMIT = 20;

/** Months of history for the growth chart. */
export const HISTORY_MONTHS = 12;

/**
 * Re-analyzing the same target inside this window replays the stored row.
 *
 * DataForSEO refreshes its backlink index continuously, but a link profile
 * does not visibly move inside a day — a day-old analysis is the same answer
 * for five calls less money.
 */
export const BACKLINKS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Analyses per calendar month, by plan.
 *
 * STARTER is 0 by product decision: the tool is a GROWTH-and-up feature, so
 * STARTER sees a locked card with an upgrade path rather than an empty form.
 * ENTERPRISE is not on the classic-SEO pricing sheet and gets a generous
 * ceiling.
 *
 * These are COUNT limits. One analysis is five billed calls, so the USD cap in
 * dataforseo/metering.ts still applies underneath and can bite first.
 */
export const BACKLINKS_ANALYSES_PER_MONTH: Record<PlanType, number> = {
  /** @deprecated Retired tier; pinned to STARTER's value for legacy rows. */
  AI_VISIBILITY: 0,
  STARTER: 0,
  GROWTH: 25,
  AGENCY: 100,
  ENTERPRISE: 500,
};

export function backlinksAnalysisLimit(plan: PlanType): number {
  return BACKLINKS_ANALYSES_PER_MONTH[plan] ?? 0;
}

/** False for STARTER — it gets the locked upsell card. */
export function planCanAnalyzeBacklinks(plan: PlanType): boolean {
  return backlinksAnalysisLimit(plan) > 0;
}
