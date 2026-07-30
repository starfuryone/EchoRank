// src/lib/rank-tracker/options.ts
//
// Plan caps and request defaults for the Rank Tracker. Kept out of service.ts
// so the DB-less config tests (src/lib/__tests__/seo-tools.test.ts) can import
// them without pulling in the Prisma client — same split as serp/options.ts
// and site-explorer/options.ts.

import type { PlanType } from "@/generated/prisma";
import { PLAN_CONFIGS } from "@/lib/plan-config";

export const RANK_FREQUENCIES = ["daily", "weekly"] as const;
export type RankFrequency = (typeof RANK_FREQUENCIES)[number];

export const RANK_DEVICES = ["desktop", "mobile"] as const;
export type RankDevice = (typeof RANK_DEVICES)[number];

/** The Rank Tracker offers the same markets as the SERP Checker form. */
export {
  SERP_LOCATION_CODES as RANK_LOCATION_CODES,
  SERP_LANGUAGE_CODES as RANK_LANGUAGE_CODES,
  DEFAULT_LOCATION_CODE,
  DEFAULT_LANGUAGE_CODE,
  DEFAULT_DEVICE,
} from "@/lib/serp/options";

/**
 * TRACKED KEYWORDS per tenant, by plan — a cap on current state (how many
 * RankKeyword rows exist), not a monthly allowance. Counted from the database,
 * which is the only figure that falls again when a tenant deletes keywords.
 *
 * STARTER is 0 by product decision: the tool is a GROWTH-and-up feature, so
 * STARTER sees a locked card with an upgrade path rather than an empty form.
 * AI_VISIBILITY (the AI-only tier) is likewise 0.
 */
/// DERIVED, NOT DECLARED. The numbers live in plan-config.ts alongside every
/// other per-tier limit so there is exactly one place to change a plan. This
/// export stays because a dozen call sites already read it, but it is now a view
/// over that config rather than a second copy that can drift from it.
///
/// plan-config models "unlimited" as null; this map is `number` for its existing
/// callers, so null collapses to Number.MAX_SAFE_INTEGER — no current tier is
/// unlimited, and a comparison against it behaves the same either way.
export const RANK_TRACKED_KEYWORDS: Record<PlanType, number> = Object.fromEntries(
  (Object.keys(PLAN_CONFIGS) as PlanType[]).map((plan) => [
    plan,
    PLAN_CONFIGS[plan].trackedKeywords ?? Number.MAX_SAFE_INTEGER,
  ]),
) as Record<PlanType, number>;

/**
 * Frequencies each plan may choose. GROWTH is weekly-only; daily is the
 * AGENCY-and-up differentiator (and 7x the spend).
 */
export const RANK_ALLOWED_FREQUENCIES: Record<PlanType, readonly RankFrequency[]> = {
  AI_VISIBILITY: [],
  STARTER: [],
  GROWTH: ["weekly"],
  AGENCY: ["daily", "weekly"],
  ENTERPRISE: ["daily", "weekly"],
};

/**
 * KEYWORD CHECKS per calendar month, by plan — the Redis month-keyed counter
 * that actually bounds spend. Distinct from the tracked-keyword cap above:
 * that one limits how many keywords exist, this one limits how many times they
 * are checked, so "Run now" cannot be clicked in a loop to bypass the schedule.
 *
 * Sized as the plan's scheduled load plus headroom for manual runs:
 *   GROWTH   50 kw weekly  ≈ 220/mo scheduled -> 400
 *   AGENCY  250 kw daily   ≈ 7750/mo scheduled -> 9000
 * At $0.006/check that is $2.40 and $54.00 of ceiling respectively.
 */
export const RANK_CHECKS_PER_MONTH: Record<PlanType, number> = {
  AI_VISIBILITY: 0,
  STARTER: 0,
  GROWTH: 400,
  AGENCY: 9000,
  ENTERPRISE: 40000,
};

/**
 * Standard-queue price per keyword check.
 *
 * DataForSEO bills the standard queue per result PAGE: $0.0006 buys depth 10,
 * so the depth 100 this tool uses is $0.006. Depth is a product decision, not
 * a tuning knob — at depth 10 every keyword ranking below position 10 reports
 * as "not ranked", which for a rank tracker is most of them. See RANK_DEPTH in
 * service.ts.
 */
export const COST_PER_KEYWORD_USD = 0.006;

/** Longest keyword list a single create/edit request may submit. */
export const MAX_KEYWORDS_PER_REQUEST = 1000;

/** Hour (UTC) the daily scheduler tick fires. 06:00 UTC = overnight in NA. */
export const SCHEDULE_HOUR_UTC = 6;

export function trackedKeywordLimit(plan: PlanType): number {
  return RANK_TRACKED_KEYWORDS[plan] ?? 0;
}

export function checksPerMonthLimit(plan: PlanType): number {
  return RANK_CHECKS_PER_MONTH[plan] ?? 0;
}

/** False for STARTER / AI_VISIBILITY — they get the locked upsell card. */
export function planCanTrack(plan: PlanType): boolean {
  return trackedKeywordLimit(plan) > 0;
}

export function allowedFrequencies(plan: PlanType): readonly RankFrequency[] {
  return RANK_ALLOWED_FREQUENCIES[plan] ?? [];
}

export function planAllowsFrequency(plan: PlanType, frequency: RankFrequency): boolean {
  return allowedFrequencies(plan).includes(frequency);
}
