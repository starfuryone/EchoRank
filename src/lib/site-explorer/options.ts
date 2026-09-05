// src/lib/site-explorer/options.ts
//
// Request defaults and the per-plan analysis allowance. Kept out of service.ts
// so the DB-less config tests (src/lib/__tests__/seo-tools.test.ts) can import
// them without pulling in the Prisma client — same split as serp/options.ts.

import type { PlanType } from "@/generated/prisma";

/** Canada — the same default as /api/seo/v1/keywords/overview and SERP Checker. */
export const DEFAULT_LOCATION_CODE = 2124;
export const DEFAULT_LANGUAGE_CODE = "en";

/**
 * Rows requested per section. DataForSEO bills ranked_keywords per row.
 *
 * ── WHY 1000 AND NOT 100 ───────────────────────────────────────────────────
 * It was 100, which is a fine table and a useless dataset: with filtering and
 * paging on the Keywords tab, a customer narrowing to "position 11-20 with
 * volume over 500" over 100 rows is narrowing a sample, not their site. One
 * wide fetch makes every subsequent filter, sort and page FREE — no allowance,
 * no provider call, no wait — which is the trade this tool wants and the
 * opposite of the one Backlinks makes (see site-explorer/pagination.ts for
 * why the two differ).
 *
 * The cost is real and bounded: this endpoint bills per row, so the fetch is
 * roughly ten times what it was. It is paid once per domain per WEEK — the
 * cache window widened in the same change — and shared across tenants, so in
 * practice the first workspace to ask about a domain each week pays it for
 * everyone.
 */
export const RANKED_KEYWORDS_LIMIT = 1000;
export const COMPETITORS_LIMIT = 20;

/** Pages requested for the Pages tab. Same per-row billing. */
export const RELEVANT_PAGES_LIMIT = 500;

/**
 * ── THE WINDOW WIDENED FROM 24 HOURS TO 7 DAYS ─────────────────────────────
 *
 * The old comment already said the right thing — "domain-level SEO metrics
 * move on a weekly cadence at best" — and then cached for a day. Seven days is
 * that sentence taken seriously, and it is what pays for the ten-times-wider
 * keyword fetch above.
 *
 * The user-visible cost is the same one the Backlinks tool takes: "Re-run
 * available in 21h" becomes "in 6 days". FLAGGED alongside that one.
 */
export const SITE_EXPLORER_CACHE_DAYS = 7;

export const SITE_EXPLORER_CACHE_TTL_MS =
  SITE_EXPLORER_CACHE_DAYS * 24 * 60 * 60 * 1000;

/**
 * Analyses per calendar month, by plan.
 *
 * STARTER / GROWTH / AGENCY are the specified product limits. ENTERPRISE is
 * not on the classic-SEO pricing sheet and gets a generous ceiling. Retune
 * here; nothing else reads these.
 *
 * These are COUNT limits. One analysis is four billed calls, so the USD cap in
 * dataforseo/metering.ts still applies underneath and can bite first.
 */
export const SITE_EXPLORER_ANALYSES_PER_MONTH: Record<PlanType, number> = {
  /** @deprecated Retired tier; pinned to STARTER's value for legacy rows. */
  AI_VISIBILITY: 5,
  STARTER: 5,
  GROWTH: 50,
  AGENCY: 200,
  ENTERPRISE: 1000,
};
