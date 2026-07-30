// src/lib/seo-quota.ts
//
// The pooled monthly search quota for DataForSEO-backed tools, counted in
// POSTGRES.
//
// WHY POSTGRES AND NOT A MAP OR REDIS. This box restarts on every deploy, and
// several times a day. An in-process Map hands every tenant a fresh allowance on
// each restart — that is exactly what src/app/api/av/audit/route.ts still does
// and why it is the standing counter-example in CLAUDE.md. Redis would survive a
// restart but not a flush, and it would be a second source of truth for
// something the SeoApiCall table already records exactly. The rows are already
// there; counting them is free of drift by construction.
//
// WHAT COUNTS. A row counts toward the quota only once a usable result exists —
// `resultAt IS NOT NULL`. That is deliberately NOT the same as `ok`:
//
//   ok       = DataForSEO accepted and BILLED the call (drives the USD cap)
//   resultAt = the tenant actually got something to look at (drives this quota)
//
// For live endpoints the two are stamped together. For the standard queue they
// are minutes apart, and a task can be billed at task_post and then expire
// without ever returning results. Charging a tenant a search for an answer they
// never received is the same mistake the free-audit limiter made when it counted
// attempts instead of completions.
//
// WHERE THIS SITS. It is a ceiling OVER the per-tool allowances, not a
// replacement. Three independent gates run, any of which can deny:
//
//   1. the per-tool monthly cap  (Redis, e.g. backlinks/quota.ts)
//   2. this pooled search quota  (Postgres, here)
//   3. the per-tenant USD cap    (inside seoMeteredCall)
//
// It therefore cannot grant access a per-tool cap withholds: STARTER's Backlinks
// allowance is 0 and stays 0 no matter how large this pool is.

import type { PlanType } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { PLAN_CONFIGS } from "@/lib/plan-config";
import type { CreditFeature } from "@/lib/dataforseo/client";

/**
 * The features inside the pool.
 *
 * `site_audit` is out: it is billed per crawled page, so one "search" can be a
 * hundred times another and a count would be a meaningless unit.
 * `content_research` is out: Content Explorer carries its own, tighter monthly
 * cap (10/50/200) and pooling it would let a tenant spend that allowance twice.
 * `rank_tracking` is out: it is bounded by the tracked-keyword cap below, which
 * limits state rather than calls — its spend is daily and automatic, so a
 * per-search pool would drain from a user action nobody took.
 */
export const SEO_SEARCH_FEATURES = [
  "domain_overview",
  "keyword_research",
  "backlinks",
  "local_seo",
] as const satisfies readonly CreditFeature[];

export type SeoSearchFeature = (typeof SEO_SEARCH_FEATURES)[number];

export function isSeoSearchFeature(feature: string): feature is SeoSearchFeature {
  return (SEO_SEARCH_FEATURES as readonly string[]).includes(feature);
}

// ─── Calendar month, UTC ────────────────────────────────────────────────────

/** First instant of the current UTC calendar month. */
export function monthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * First instant of the next UTC calendar month — the `resetsAt` a denied caller
 * is told to wait for. Month+1 with a day of 1 rolls the year over correctly, so
 * December needs no special case.
 */
export function monthReset(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

// ─── Limits ─────────────────────────────────────────────────────────────────

/** null = unlimited. Read from plan-config; never duplicated. */
export function seoSearchLimit(plan: PlanType): number | null {
  return PLAN_CONFIGS[plan].seoSearchesPerMonth;
}

/** null = unlimited. Read from plan-config; never duplicated. */
export function trackedKeywordLimit(plan: PlanType): number | null {
  return PLAN_CONFIGS[plan].trackedKeywords;
}

// ─── Usage ──────────────────────────────────────────────────────────────────

/**
 * Successful pooled searches this calendar month.
 *
 * COUNT over an index-covered range, not a scan: the (tenantId, resultAt) index
 * bounds it to one tenant's current month.
 */
export async function seoSearchesUsed(
  tenantId: string,
  now = new Date(),
): Promise<number> {
  return prisma.seoApiCall.count({
    where: {
      tenantId,
      feature: { in: [...SEO_SEARCH_FEATURES] },
      resultAt: { gte: monthStart(now) },
    },
  });
}

export interface SeoQuotaUsage {
  used: number;
  /** null = unlimited. */
  limit: number | null;
  /** null when unlimited. */
  remaining: number | null;
  resetsAt: string;
  unlimited: boolean;
  exceeded: boolean;
}

/** The block every tool page renders. Safe to call for any plan. */
export async function seoQuotaUsage(
  tenantId: string,
  plan: PlanType,
  now = new Date(),
): Promise<SeoQuotaUsage> {
  const limit = seoSearchLimit(plan);
  const used = await seoSearchesUsed(tenantId, now);
  const unlimited = limit === null;
  return {
    used,
    limit,
    remaining: unlimited ? null : Math.max(0, (limit as number) - used),
    resetsAt: monthReset(now).toISOString(),
    unlimited,
    exceeded: !unlimited && used >= (limit as number),
  };
}

// ─── The typed denial ───────────────────────────────────────────────────────

/**
 * Thrown by requireSeoQuota. Carries everything the 429 body and the UI banner
 * need, so no route has to reassemble it.
 */
export class SeoQuotaExceededError extends Error {
  readonly statusCode = 429;
  readonly code = "quota_exceeded";
  constructor(
    readonly limit: number,
    readonly used: number,
    readonly resetsAt: string,
    readonly upgradeUrl = "/billing",
  ) {
    super(
      limit === 0
        ? "This plan does not include SEO searches."
        : `Monthly SEO search quota reached (${used} of ${limit}).`,
    );
    this.name = "SeoQuotaExceededError";
  }

  /** The exact JSON body the spec asks for. */
  toBody() {
    return {
      error: this.code,
      limit: this.limit,
      used: this.used,
      resetsAt: this.resetsAt,
      upgradeUrl: this.upgradeUrl,
    };
  }
}

/**
 * Gate one DataForSEO search. Call BEFORE task_post or the live call — never
 * after, and never optimistically increment: there is nothing to increment,
 * because usage is derived from rows that only exist once a result does.
 *
 * Returns how many searches remain (Infinity for unlimited plans) so a caller
 * can log or surface it.
 */
export async function requireSeoQuota(
  tenantId: string,
  plan: PlanType,
  feature: SeoSearchFeature,
  now = new Date(),
): Promise<number> {
  const limit = seoSearchLimit(plan);
  if (limit === null) return Number.POSITIVE_INFINITY; // unlimited tier

  // Zero-allowance tiers are denied without touching the database: there is no
  // count that could make a 0 limit pass.
  if (limit <= 0) {
    throw new SeoQuotaExceededError(0, 0, monthReset(now).toISOString());
  }

  // `feature` is in the signature so a caller cannot gate on the pool for a tool
  // the pool does not cover; the count itself spans every pooled feature.
  void feature;

  const used = await seoSearchesUsed(tenantId, now);
  if (used >= limit) {
    throw new SeoQuotaExceededError(limit, used, monthReset(now).toISOString());
  }
  return limit - used;
}

// ─── Tracked keywords ───────────────────────────────────────────────────────

export class TrackedKeywordLimitError extends Error {
  readonly statusCode = 429;
  readonly code = "quota_exceeded";
  constructor(
    readonly limit: number,
    readonly used: number,
    readonly resetsAt: string,
    readonly upgradeUrl = "/billing",
  ) {
    super(
      limit === 0
        ? "This plan does not include rank tracking."
        : `Tracked keyword limit reached (${used} of ${limit}).`,
    );
    this.name = "TrackedKeywordLimitError";
  }

  toBody() {
    return {
      error: this.code,
      limit: this.limit,
      used: this.used,
      resetsAt: this.resetsAt,
      upgradeUrl: this.upgradeUrl,
    };
  }
}

/**
 * Gate adding `adding` more tracked keywords.
 *
 * Enforced at ADD TIME rather than at check time. A tracked keyword spends money
 * every day by itself, so the moment to say no is when it is created — refusing
 * later means the tenant already has keywords the plan will not pay to check,
 * which is a worse conversation than refusing the add.
 *
 * `resetsAt` is still the month boundary for body-shape consistency with the
 * search quota, but note this cap is on CURRENT STATE: deleting keywords frees
 * room immediately and does not wait for the reset.
 */
export function requireTrackedKeywordRoom(
  plan: PlanType,
  currentCount: number,
  adding: number,
  now = new Date(),
): number {
  const limit = trackedKeywordLimit(plan);
  if (limit === null) return Number.POSITIVE_INFINITY;
  if (currentCount + adding > limit) {
    throw new TrackedKeywordLimitError(
      limit,
      currentCount,
      monthReset(now).toISOString(),
    );
  }
  return limit - (currentCount + adding);
}
