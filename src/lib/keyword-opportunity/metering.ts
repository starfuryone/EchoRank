// src/lib/keyword-opportunity/metering.ts
//
// DataForSEO spend for the Keyword Opportunity Finder: its own cap, its own
// denominator, and rows that stay out of everybody else's allowance.
//
// ── WHY THIS BYPASSES seoMeteredCall ────────────────────────────────────────
//
// Not to avoid metering — every call still writes a SeoApiCall row with its
// real cost. It bypasses because a domain analysis has DIFFERENT BILLING
// SEMANTICS from every other SEO tool, and dataforseo/metering.ts already
// documents that as the reason to go around it ("Exception (per spec):
// v3/appendix/user_data and serp task_get are free at DataForSEO — call
// postTask directly for those, do not meter").
//
// Two things differ here:
//
//   1. THE CAP IS THE FEATURE'S, NOT THE TENANT'S GENERAL ONE.
//      seoMeteredCall enforces monthlyCapUsd() — a flat $25 shared by every
//      DataForSEO-backed tool. A domain analysis is capped by
//      keywordOpportunityCapUsd(plan) ($2/$8/$15/$50) instead, so that a tenant
//      who runs their analyses cannot also have silently exhausted Site
//      Explorer, and vice versa.
//
//   2. THE FEATURE IS DECLARED, NOT DERIVED.
//      pathToFeature() classifies by path, and KOF calls the same Labs paths
//      other tools call: keywords_for_site would file as "keyword_research"
//      and ranked_keywords as "domain_overview". BOTH ARE IN
//      SEO_SEARCH_FEATURES, so deriving the feature would draw down the
//      tenant's pooled search allowance for an action that already costs them
//      a domain analysis — the exact double-charge the whole split exists to
//      prevent. recordCall() takes `feature` explicitly, so this module passes
//      "keyword_opportunity" and pathToFeature() is left untouched.
//
// ── ONE ACTION, ONE ALLOWANCE ───────────────────────────────────────────────
// The consequences of that feature value, stated once:
//   - OUT of the pooled search quota (seo-quota.ts) — "keyword_opportunity" is
//     not in SEO_SEARCH_FEATURES, the same mechanism that already excludes
//     site_audit, content_research and rank_tracking.
//   - OUT of the general USD cap (dataforseo/metering.ts OWN_CAP_FEATURES).
//   - IN the feature's own cap, below.
//   - IN every report of total upstream spend, because the row is real.

import "server-only";
// A CLIENT COMPONENT IMPORTING THIS IS A BUILD ERROR, BY DESIGN.
// This module reaches the database driver / the Node filesystem, and a
// value import of it from a Client Component pulls pg (dns, net, tls) or
// node:fs into the browser bundle. That took production down on
// 2026-08-18: eight Turbopack errors, a failed build, and a cleared
// .next serving nothing. `server-only` turns the same mistake into a
// compile error naming this file instead. Use `import type` for types.

import type { PlanType } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { logger } from "@/infrastructure/observability/logger";
import { postTask, type ApiResult } from "@/lib/dataforseo/client";
import { recordCall, startOfBillingMonth } from "@/lib/dataforseo/metering";
import { keywordOpportunityCapUsd } from "@/lib/plan-config";

/** The one feature value every DataForSEO call from this product carries. */
export const KOF_FEATURE = "keyword_opportunity" as const;

/**
 * Thrown when a call is refused because the tenant is at the feature's cap.
 *
 * Carries the numbers so the worker can write them onto the analysis row as a
 * stoppedReason the UI can render, rather than a bare failure. Deliberately
 * shaped like AiCapReachedError next door — a cap is not an error, it is a
 * decision not to spend, and both products report it the same way.
 */
export class KofCapReachedError extends Error {
  readonly spent: number;
  readonly cap: number;

  constructor(spent: number, cap: number) {
    super(
      `Keyword Opportunity spend cap reached: $${spent.toFixed(2)} of $${cap.toFixed(2)} this month`,
    );
    this.name = "KofCapReachedError";
    this.spent = spent;
    this.cap = cap;
  }
}

/**
 * Sum of this feature's DataForSEO spend for a tenant this calendar month.
 *
 * The mirror image of dataforseo/metering.ts spentThisMonth(): that one sums
 * everything EXCEPT the own-cap features, this one sums exactly them. Between
 * them every billed row is counted once, against one ceiling.
 *
 * Credit-funded rows are excluded for the same reason they are there: a credit
 * is the tenant having already paid, and counting it would let their own
 * prepaid purchase eat the allowance they get for free.
 */
export async function kofSpentThisMonth(
  tenantId: string,
  now: Date = new Date(),
): Promise<number> {
  const agg = await prisma.seoApiCall.aggregate({
    _sum: { costUsd: true },
    where: {
      tenantId,
      feature: KOF_FEATURE,
      creditFunded: false,
      createdAt: { gte: startOfBillingMonth(now) },
    },
  });
  return Number(agg._sum.costUsd ?? 0);
}

export interface KofCapState {
  capped: boolean;
  spent: number;
  /** Null when the tier is uncapped. No tier currently is. */
  cap: number | null;
  /** Headroom left. Infinity when uncapped. */
  remaining: number;
}

/** Where a tenant stands against this feature's cap right now. */
export async function checkKofCap(
  tenantId: string,
  plan: PlanType,
  now: Date = new Date(),
): Promise<KofCapState> {
  const cap = keywordOpportunityCapUsd(plan);
  const spent = await kofSpentThisMonth(tenantId, now);
  if (cap === null) {
    return { capped: false, spent, cap: null, remaining: Number.POSITIVE_INFINITY };
  }
  return { capped: spent >= cap, spent, cap, remaining: Math.max(0, cap - spent) };
}

/**
 * One metered DataForSEO call for a domain analysis.
 *
 * THE CAP IS CHECKED BEFORE THE REQUEST, so a tenant can overshoot by at most
 * the single call in flight. Checking after would let a fan-out all pass a
 * stale reading; checking before bounds the overshoot to one call, which at
 * Labs prices is fractions of a cent. Same reasoning as meteredAiCall.
 *
 * THE ROW IS WRITTEN ON FAILURE TOO. DataForSEO bills a task it accepted even
 * when the caller cannot use the answer, and a row with ok=false is how a
 * failure that cost money is told apart from one that never happened.
 */
export async function kofMeteredCall<T>(
  ctx: { tenantId: string; plan: PlanType },
  path: string,
  task: Record<string, unknown>,
  now: Date = new Date(),
): Promise<ApiResult<T>> {
  const state = await checkKofCap(ctx.tenantId, ctx.plan, now);
  if (state.capped) {
    throw new KofCapReachedError(state.spent, state.cap ?? 0);
  }

  try {
    const result = await postTask<T>(path, task);
    await recordCall({
      tenantId: ctx.tenantId,
      feature: KOF_FEATURE,
      path,
      costUsd: result.billing.costUsd,
      ok: true,
    });
    return result;
  } catch (err) {
    // Cost unknown on a throw — the envelope that carried it is what failed.
    // Zero is the honest figure rather than a guess, and `ok: false` is what
    // marks the row as not a usable result.
    await recordCall({
      tenantId: ctx.tenantId,
      feature: KOF_FEATURE,
      path,
      costUsd: 0,
      ok: false,
    });
    logger.warn(
      { tenantId: ctx.tenantId, path, err: err instanceof Error ? err.message : String(err) },
      "keyword-opportunity DataForSEO call failed",
    );
    throw err;
  }
}
