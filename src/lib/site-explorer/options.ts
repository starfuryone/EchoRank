// src/lib/site-explorer/options.ts
//
// Request defaults and the per-plan analysis allowance. Kept out of service.ts
// so the DB-less config tests (src/lib/__tests__/seo-tools.test.ts) can import
// them without pulling in the Prisma client — same split as serp/options.ts.

import type { PlanType } from "@/generated/prisma";

/** Canada — the same default as /api/seo/v1/keywords/overview and SERP Checker. */
export const DEFAULT_LOCATION_CODE = 2124;
export const DEFAULT_LANGUAGE_CODE = "en";

/** Rows requested per section. DataForSEO bills ranked_keywords per row. */
export const RANKED_KEYWORDS_LIMIT = 100;
export const COMPETITORS_LIMIT = 20;

/**
 * Re-analyzing the same domain inside this window replays the stored row.
 * Domain-level SEO metrics move on a weekly cadence at best, so a day-old
 * analysis is not stale — it is the same answer for four calls less money.
 */
export const SITE_EXPLORER_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Analyses per calendar month, by plan.
 *
 * STARTER / GROWTH / AGENCY are the specified product limits. AI_VISIBILITY
 * (the $29 AI-only tier, priced below STARTER) and ENTERPRISE are not on the
 * classic-SEO pricing sheet — they get a conservative floor and a generous
 * ceiling respectively. Retune here; nothing else reads these.
 *
 * These are COUNT limits. One analysis is four billed calls, so the USD cap in
 * dataforseo/metering.ts still applies underneath and can bite first.
 */
export const SITE_EXPLORER_ANALYSES_PER_MONTH: Record<PlanType, number> = {
  AI_VISIBILITY: 2,
  STARTER: 5,
  GROWTH: 50,
  AGENCY: 200,
  ENTERPRISE: 1000,
};
