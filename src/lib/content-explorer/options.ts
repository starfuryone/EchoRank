// src/lib/content-explorer/options.ts
//
// Limits and thresholds for Content Explorer, in one place so the UI reads them
// from config rather than hardcoding a plan number into copy.
//
// ─── THE COST FACTS THESE NUMBERS ARE SET AGAINST ──────────────────────────
// Measured 2026-07-30 from the recorded envelopes (fixtures/dataforseo/), which
// are the only trustworthy source — Content Analysis prices differently from
// Labs and no price table in this repo covers it:
//
//   content_analysis/search/live   $0.024036 base + ~$0.0000353 per item
//                                  ($0.024036 at 0 results, $0.025800 at 50)
//   content_analysis/summary/live  $0.024036 flat
//
// So ONE SEARCH COSTS ~$0.0498, and cost is ~96% FIXED. A phrase nobody has
// ever written about costs within 4% of a phrase with 1.5 million matches.
// There is no cheap exploratory query here, which is why the caps are counts
// rather than a spend budget, why the cache window is a full day, and why
// reopening a stored search is free.
//
// The one lever the fixed cost leaves us: when search/live reports
// total_count 0, summary/live is skipped. Verified against a live zero-result
// phrase ("Echorank360", 2026-07-30) — the summary comes back all zeros with an
// empty top_domains, so the call buys nothing. That halves the cost of exactly
// the queries most likely to be typos or wishful thinking.

import type { PlanType } from "@/generated/prisma";

/** Mentions requested per search. The per-item price is ~$0.0000353, so the
 *  difference between 10 and 50 rows is under a fifth of a cent — there is no
 *  saving worth showing the tenant a shorter list for. */
export const MENTIONS_LIMIT = 50;

/** 24 h, per the spec. Long because a re-run costs full price. */
export const CONTENT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * `domain_rank` at or above this earns the high-authority badge — the
 * link-opportunity signal.
 *
 * DataForSEO's domain_rank is 0..1000. In the recorded 50-item sample the
 * distribution was min 138 / median 484 / max 700, so 600 marks roughly the top
 * decile of domains that actually turn up in mention results rather than an
 * abstract "big site" line. Set it much lower and the badge is on every row,
 * which makes it worthless as a shortlist.
 */
export const HIGH_AUTHORITY_RANK = 600;

/**
 * A high rank on a spammy domain is not an outreach target. DataForSEO's
 * spam_score is 0..100; above this the badge is withheld even at rank 900.
 */
export const MAX_SPAM_SCORE_FOR_BADGE = 30;

/** Searches per month per plan. */
const SEARCHES_PER_MONTH: Record<PlanType, number> = {
  /** @deprecated Retired tier; pinned to STARTER's value for legacy rows. */
  AI_VISIBILITY: 10,
  STARTER: 10,
  GROWTH: 50,
  AGENCY: 200,
  ENTERPRISE: 200,
};

export function contentSearchLimit(plan: PlanType): number {
  return SEARCHES_PER_MONTH[plan] ?? 0;
}

export function planCanSearchContent(plan: PlanType): boolean {
  return contentSearchLimit(plan) > 0;
}

/** Worst-case monthly spend if a tenant exhausts its allowance. */
export const COST_PER_SEARCH_USD = 0.0498;

export function worstCaseMonthlyUsd(plan: PlanType): number {
  return Number((contentSearchLimit(plan) * COST_PER_SEARCH_USD).toFixed(2));
}
