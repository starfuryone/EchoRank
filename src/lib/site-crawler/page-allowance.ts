// src/lib/site-crawler/page-allowance.ts — the site crawler's monthly page allowance:
// pages a workspace's crawls may fetch per calendar month (UTC), across every
// crawl. The plan's crawlPagesPerMonth (plan-config.ts), or a staff override
// (tenants.crawlPagesPerMonthOverride, /admin/crawl-overrides). null =
// unlimited. Resets on the 1st, 00:00 UTC.
//
// COUNTED IN POSTGRES, like crawlsPerMonth (quota.ts): the sum of
// CrawlJob.pagesCrawled over the jobs created this month. Every status
// counts, cancelled and failed included: those pages were fetched. A crawl
// that starts on the 31st and runs past midnight counts against the month it
// started in.
//
// ENFORCED THREE TIMES:
//   - startCrawl refuses a crawl when nothing is left (CrawlPageAllowanceError)
//     and lowers its URL cap to what is left;
//   - the runner re-reads the month's total before every batch and stops the
//     crawl cleanly ("monthly_allowance") when it is reached, so concurrent
//     crawls of one workspace share the pool (overshoot: one batch each);
//   - a scheduled crawl that finds the pool empty is skipped, with an email
//     (schedule-service.ts).
// The free public crawler's system tenant is exempt: it has its own limits
// (free-limits.ts: 100 pages a crawl, per-IP and per-domain windows).

import "server-only";

import type { PlanType } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { effectiveCaps, tenantOverrides } from "./tenant-caps";

/** The crawl's stoppedReason when the month's pages run out mid-crawl. */
export const MONTHLY_ALLOWANCE_REASON = "monthly_allowance";

export function allowanceMonthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** When the allowance resets: the first instant of next month, UTC. */
export function allowanceResetsAt(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

/** Pages this tenant's crawls fetched this month, optionally leaving one job out (the runner adds its own live count). */
export async function pagesUsedThisMonth(tenantId: string, now = new Date(), excludeJobId?: string): Promise<number> {
  const r = await prisma.crawlJob.aggregate({
    where: { tenantId, createdAt: { gte: allowanceMonthStart(now) }, ...(excludeJobId ? { id: { not: excludeJobId } } : {}) },
    _sum: { pagesCrawled: true },
  });
  return r._sum.pagesCrawled ?? 0;
}

export interface PageAllowance {
  /** Pages per month; null = unlimited. */
  limit: number | null;
  used: number;
  /** null when unlimited. */
  remaining: number | null;
  /** ISO, the 1st of next month 00:00 UTC. */
  resetsAt: string;
}

/** Pure: the allowance from a limit and a count. */
export function allowanceFrom(limit: number | null, used: number, now = new Date()): PageAllowance {
  return {
    limit,
    used,
    remaining: limit === null ? null : Math.max(0, limit - used),
    resetsAt: allowanceResetsAt(now).toISOString(),
  };
}

/** The tenant's limit: the staff override, else the plan's. */
export async function pagesLimitFor(tenantId: string, plan: PlanType): Promise<number | null> {
  return effectiveCaps(plan, await tenantOverrides(tenantId)).pagesPerMonth;
}

export async function pageAllowance(tenantId: string, plan: PlanType, now = new Date()): Promise<PageAllowance> {
  const [limit, used] = await Promise.all([pagesLimitFor(tenantId, plan), pagesUsedThisMonth(tenantId, now)]);
  return allowanceFrom(limit, used, now);
}

/**
 * The runner's per-batch gate. Returns how many pages the next batch may
 * fetch (Infinity when unlimited), 0 when the month is spent. `crawled` is
 * this job's own pages so far (not yet summed from its row).
 */
export async function pagesLeftForJob(
  tenantId: string,
  limit: number | null,
  jobId: string,
  crawled: number,
  now = new Date(),
): Promise<number> {
  if (limit === null) return Number.POSITIVE_INFINITY;
  const others = await pagesUsedThisMonth(tenantId, now, jobId);
  return Math.max(0, limit - others - crawled);
}
