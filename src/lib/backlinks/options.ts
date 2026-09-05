// src/lib/backlinks/options.ts
//
// Row limits, cache window and per-plan caps. Kept out of service.ts so the
// DB-less config tests can import them without pulling in the Prisma client —
// the same split as serp/, site-explorer/ and rank-tracker/options.ts.

import type { PlanType } from "@/generated/prisma";
import { planConfig, type BacklinksCapability } from "@/lib/plan-config";

export type { BacklinksCapability };

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
 * ── THE CACHE WINDOW WIDENED FROM 24 HOURS TO 7 DAYS ────────────────────────
 *
 * It was a day, on the reasoning that "a link profile does not visibly move
 * inside a day". That reasoning holds much further out than a day, and the
 * price of finding out is high: this API bills per request AND per row, and a
 * lookup runs around $0.37. A week-old link profile is the same answer for
 * nothing.
 *
 * THE USER-VISIBLE COST is that "Re-run available in 21h" becomes "in 6 days".
 * That is a real regression for anyone watching a link-building campaign day to
 * day, and it is the reason this is called out rather than quietly changed —
 * FLAGGED. The mitigations are that the bucket is anchored rather than rolling
 * (so it rolls on a schedule, not from whenever they last clicked) and that the
 * cache is shared across tenants, so the first workspace to ask each week pays
 * for everyone.
 */
export const BACKLINKS_CACHE_DAYS = 7;

/** Kept for the "re-run available in" countdown and for existing importers. */
export const BACKLINKS_CACHE_TTL_MS = BACKLINKS_CACHE_DAYS * 24 * 60 * 60 * 1000;

/**
 * What one lookup costs, for the hint shown before the click.
 *
 * OBSERVED, NOT A PRICE TABLE, and it is used for exactly one thing: telling a
 * customer roughly what they are about to spend. Nothing meters from it —
 * every billed row records the provider's own `cost` field (see
 * dataforseo/metering.ts), and this number never enters that path. Its only
 * failure mode is a hint that reads slightly stale.
 */
export const BACKLINKS_OBSERVED_COST_USD = 0.368;

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
  AI_VISIBILITY: 5,
  /**
   * STARTER WAS 0, AND IS NOW 5. The two-tier split puts STARTER on Basic, and
   * a tier whose allowance is zero cannot use the tier it is assigned to — the
   * locked card would still be the whole experience. Five lookups is under $2
   * of monthly COGS at the observed per-lookup cost, on a $79 plan, and Basic
   * buys fewer endpoint families than the old five-call analysis did.
   *
   * FLAGGED: a packaging decision, reversible by setting this back to 0 and
   * moving STARTER's capability out of Basic in plan-config.ts. Both, or the
   * locked card comes back without the copy that explains it.
   */
  STARTER: 5,
  GROWTH: 25,
  AGENCY: 100,
  ENTERPRISE: 500,
};

/** What this tier's Backlinks tool does. The only thing routes and components
 *  should ask — never a plan name. */
export function backlinksCapability(plan: PlanType): BacklinksCapability {
  return planConfig(plan).backlinks;
}

export function backlinksAnalysisLimit(plan: PlanType): number {
  return BACKLINKS_ANALYSES_PER_MONTH[plan] ?? 0;
}

/**
 * Can this tier run a lookup at all?
 *
 * TRUE ON EVERY SELLABLE TIER since STARTER joined Basic. The branch and its
 * locked-card copy stay, because this remains a real question: a future tier,
 * or a tier whose allowance is cut back to 0, gets the card without a component
 * change. Same reasoning as rank-tracker/options.ts's planCanTrack().
 */
export function planCanAnalyzeBacklinks(plan: PlanType): boolean {
  return backlinksAnalysisLimit(plan) > 0;
}
