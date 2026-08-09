// src/lib/site-crawler/quota.ts
//
// Per-tier Site Crawler limits: how big one crawl may be, and how many a tenant
// may start this month.
//
// COUNTED IN POSTGRES, for the reason seo-quota.ts spells out at length: this
// box restarts several times a day, so an in-process tally hands every tenant a
// fresh allowance on each deploy. The CrawlJob rows are already there and
// counting them cannot drift from what actually happened.
//
// WHICH RUNS CONSUME QUOTA. QUEUED, RUNNING and COMPLETED count. FAILED and
// CANCELLED do not. This is implemented by EXCLUDING those two statuses from
// the count rather than by decrementing a counter — there is no counter to
// decrement, and a query that names the statuses it charges for stays correct
// when a job changes status after the fact. The consequence worth stating: a
// tenant who cancels a crawl gets the slot back, which is the forgiving
// direction and the one that does not punish someone for stopping a crawl they
// misconfigured.

import type { PlanType } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { planConfig } from "@/lib/plan-config";

/** Statuses that consume a monthly slot. */
export const QUOTA_CONSUMING_STATUSES = ["QUEUED", "RUNNING", "COMPLETED"] as const;

export interface CrawlQuota {
  /** URLs one crawl may fetch. 0 = the tool is locked for this tier. */
  urlCap: number;
  /** Crawls per calendar month, or null for unlimited. */
  monthlyLimit: number | null;
  /** Crawls already started this month that consume quota. */
  used: number;
  /** null when unlimited. */
  remaining: number | null;
  /** False when the tier is locked or the monthly allowance is spent. */
  allowed: boolean;
  locked: boolean;
}

export function urlCapForPlan(plan: PlanType): number {
  return planConfig(plan).crawlUrlCap;
}

export function monthlyLimitForPlan(plan: PlanType): number | null {
  return planConfig(plan).crawlsPerMonth;
}

/** First instant of the current UTC calendar month. */
export function monthStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Crawls this tenant has started this month that count against the limit. */
export async function crawlsUsedThisMonth(
  tenantId: string,
  now: Date = new Date(),
): Promise<number> {
  return prisma.crawlJob.count({
    where: {
      tenantId,
      createdAt: { gte: monthStart(now) },
      status: { in: [...QUOTA_CONSUMING_STATUSES] },
    },
  });
}

/** Everything the UI and the POST route need to decide whether to start. */
export async function getCrawlQuota(
  tenantId: string,
  plan: PlanType,
  now: Date = new Date(),
): Promise<CrawlQuota> {
  const urlCap = urlCapForPlan(plan);
  const monthlyLimit = monthlyLimitForPlan(plan);
  const locked = urlCap <= 0;

  // A locked tier never runs a query it cannot act on.
  if (locked) {
    return { urlCap, monthlyLimit, used: 0, remaining: 0, allowed: false, locked: true };
  }

  const used = await crawlsUsedThisMonth(tenantId, now);
  const remaining = monthlyLimit === null ? null : Math.max(0, monthlyLimit - used);

  return {
    urlCap,
    monthlyLimit,
    used,
    remaining,
    allowed: monthlyLimit === null || used < monthlyLimit,
    locked: false,
  };
}
