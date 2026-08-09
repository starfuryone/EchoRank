// src/lib/site-audit/options.ts
//
// Crawl caps and audit allowances. Kept out of service.ts so the DB-less
// config tests can import them without pulling in the Prisma client — the same
// split as the other tools' options modules.

import type { PlanType } from "@/generated/prisma";

/**
 * Pages crawled per audit, by plan.
 *
 * OnPage bills PER PAGE CRAWLED, so this is the direct cost lever: doubling it
 * doubles the bill for every audit on that plan. It is clamped server-side at
 * start time, never taken from the request.
 */
export const CRAWL_PAGES_PER_PLAN: Record<PlanType, number> = {
  /** @deprecated Retired tier; pinned to STARTER's value for legacy rows. */
  AI_VISIBILITY: 25,
  STARTER: 25,
  GROWTH: 100,
  AGENCY: 500,
  ENTERPRISE: 1000,
};

/** Audits per calendar month, by plan. */
export const AUDITS_PER_MONTH: Record<PlanType, number> = {
  /** @deprecated Retired tier; pinned to STARTER's value for legacy rows. */
  AI_VISIBILITY: 2,
  STARTER: 2,
  GROWTH: 10,
  AGENCY: 50,
  ENTERPRISE: 200,
};

/**
 * Re-auditing the same domain inside this window replays the stored crawl.
 *
 * A crawl costs real money and takes minutes; a site's technical health does
 * not change between two clicks. 24 h matches the other tools.
 */
export const SITE_AUDIT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Per-page rows stored and shown in the "top problem pages" table. */
export const MAX_PAGE_ROWS = 100;

/**
 * Give up on a crawl after this long.
 *
 * Crawls are minutes, not seconds, and a large site behind a slow origin can
 * legitimately run a long time — but a row stuck past this is stuck, and
 * leaving it "crawling" forever hides the failure from the user.
 */
export const CRAWL_TIMEOUT_MS = 60 * 60_000;

export function crawlPageLimit(plan: PlanType): number {
  return CRAWL_PAGES_PER_PLAN[plan] ?? CRAWL_PAGES_PER_PLAN.STARTER;
}

export function auditLimit(plan: PlanType): number {
  return AUDITS_PER_MONTH[plan] ?? AUDITS_PER_MONTH.STARTER;
}
