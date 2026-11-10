// src/lib/site-crawler/tenant-caps.ts
//
// Phase 3d-A: a tenant's site crawler caps = its plan's, unless staff set an
// override in /admin/crawl-overrides (tenants.crawl*Override, null = plan):
//
//   urlCap       URLs per crawl         startCrawl (via getCrawlQuota)
//   crawlsKept   crawls kept with data  nightly retention, the History line
//   concurrency  simultaneous crawls    the worker's fair share, below
//
// FAIR SHARE. The box runs crawlSlotsConfigured() crawls at once (capacity.ts:
// CRAWL_PROCESSES × CRAWL_CONCURRENCY_PER_PROCESS in echorank360-crawlers, or
// CRAWL_MAX_CONCURRENT inside echorank360-workers). A tenant may hold at most
// its plan's crawlConcurrency of them (override first), so one workspace's
// batch cannot take every slot while another waits. A crawl whose tenant is at
// its limit goes back to the queue for FAIR_SHARE_RETRY_MS and stays QUEUED.
// An override above the box's slot count is allowed (it means "never held
// back") but cannot run more crawls than the box has.
//
// THE CLAIM IS ATOMIC (claimCrawlSlot). With 48 slots across four processes,
// two crawls of one workspace are routinely picked up in the same second; a
// count-then-start would let both through. The count and the flip to RUNNING
// happen in one transaction under a per-tenant advisory lock, so the limit
// holds across processes, and a workspace's queued crawls start oldest first.

import "server-only";
import type { PlanType } from "@/generated/prisma";
import { planConfig } from "@/lib/plan-config";
import { prisma } from "@/lib/prisma";
import { crawlConcurrencyPerProcess } from "./capacity";

/** How long a QUEUED crawl keeps its place ahead of its workspace's later ones. */
export const QUEUE_ORDER_WINDOW_MS = 2 * 60 * 60 * 1000;

/** A tenant row the claim could not read (or a plan without the field) runs one at a time. */
export const TENANT_CRAWL_CONCURRENCY_DEFAULT = 1;

/** Crawls THIS process runs at once (the BullMQ worker's concurrency); see capacity.ts. */
export function crawlMaxConcurrent(): number {
  return crawlConcurrencyPerProcess();
}
export const FAIR_SHARE_RETRY_MS = 30_000;

/** A workspace's simultaneous-crawl limit: the free crawler's 1, else the override, else the plan's. */
export function tenantCrawlLimit(t: { source?: string | null; planType?: PlanType | null; crawlConcurrencyOverride?: number | null } | null): number {
  if (t?.source === "free") return 1;
  if (t?.crawlConcurrencyOverride != null) return t.crawlConcurrencyOverride;
  return t?.planType ? planConfig(t.planType).crawlConcurrency : TENANT_CRAWL_CONCURRENCY_DEFAULT;
}

/** What /admin accepts for each override (inclusive). */
export const OVERRIDE_BOUNDS = {
  crawlConcurrencyOverride: [1, 10],
  crawlsKeptOverride: [1, 10_000],
  crawlUrlCapOverride: [1, 100_000],
  /** The monthly page allowance (page-allowance.ts): an Enterprise contract's figure. */
  crawlPagesPerMonthOverride: [1, 10_000_000],
} as const;
export type OverrideField = keyof typeof OVERRIDE_BOUNDS;
export const OVERRIDE_FIELDS = Object.keys(OVERRIDE_BOUNDS) as OverrideField[];

export type CrawlOverrides = Record<OverrideField, number | null>;
export const NO_OVERRIDES: CrawlOverrides = {
  crawlConcurrencyOverride: null,
  crawlsKeptOverride: null,
  crawlUrlCapOverride: null,
  crawlPagesPerMonthOverride: null,
};

export function effectiveCaps(
  plan: PlanType,
  o: CrawlOverrides = NO_OVERRIDES,
): { urlCap: number; crawlsKept: number; concurrency: number; pagesPerMonth: number | null } {
  const c = planConfig(plan);
  return {
    urlCap: o.crawlUrlCapOverride ?? c.crawlUrlCap,
    crawlsKept: o.crawlsKeptOverride ?? c.crawlsKept,
    concurrency: o.crawlConcurrencyOverride ?? c.crawlConcurrency,
    pagesPerMonth: o.crawlPagesPerMonthOverride ?? c.crawlPagesPerMonth,
  };
}

export async function tenantOverrides(tenantId: string): Promise<CrawlOverrides> {
  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { crawlConcurrencyOverride: true, crawlsKeptOverride: true, crawlUrlCapOverride: true, crawlPagesPerMonthOverride: true },
  });
  return t ?? NO_OVERRIDES;
}

/** Whether this tenant may start another crawl now (fewer RUNNING than its concurrency). A read, not a claim. */
export async function tenantHasCrawlSlot(tenantId: string, crawlJobId: string): Promise<boolean> {
  const [t, running] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { crawlConcurrencyOverride: true, source: true, planType: true } }),
    prisma.crawlJob.count({ where: { tenantId, status: "RUNNING", id: { not: crawlJobId } } }),
  ]);
  return running < tenantCrawlLimit(t);
}

/**
 * The outcome of a claim:
 *   run      the crawl is RUNNING now; `resumed` when it already was (a restart picked it up again)
 *   wait     the workspace is at its limit, or an older crawl of it is still queued
 *   skip     the crawl is no longer QUEUED or RUNNING (cancelled while queued, already finished)
 */
export type CrawlClaim = { kind: "run"; resumed: boolean } | { kind: "wait" } | { kind: "skip"; status: string | null };

/**
 * Atomically take one of the tenant's crawl slots for this crawl.
 *
 * One transaction under pg_advisory_xact_lock(tenant): read the crawl and the
 * tenant's limit, count the tenant's other RUNNING crawls and its OLDER QUEUED
 * ones, refuse unless running + older < limit (so they start in order), and
 * flip this one to RUNNING. A crawl that is already RUNNING is a resume and keeps its
 * slot: it was counted before its process went away. A QUEUED row older than
 * QUEUE_ORDER_WINDOW_MS no longer holds its place in line, so a row whose
 * queue job was lost cannot block its workspace.
 */
export async function claimCrawlSlot(tenantId: string, crawlJobId: string, now: Date = new Date()): Promise<CrawlClaim> {
  const staleBefore = new Date(now.getTime() - QUEUE_ORDER_WINDOW_MS);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`crawl-slot:${tenantId}`}, 0))`;
    const job = await tx.crawlJob.findFirst({ where: { id: crawlJobId, tenantId }, select: { status: true, createdAt: true } });
    if (!job || (job.status !== "QUEUED" && job.status !== "RUNNING")) return { kind: "skip", status: job?.status ?? null } as const;
    if (job.status === "RUNNING") return { kind: "run", resumed: true } as const;
    const [t, running, olderQueued] = await Promise.all([
      tx.tenant.findUnique({ where: { id: tenantId }, select: { crawlConcurrencyOverride: true, source: true, planType: true } }),
      tx.crawlJob.count({ where: { tenantId, status: "RUNNING", id: { not: crawlJobId } } }),
      tx.crawlJob.count({
        where: {
          tenantId,
          status: "QUEUED",
          id: { not: crawlJobId },
          createdAt: { gte: staleBefore },
          OR: [{ createdAt: { lt: job.createdAt } }, { createdAt: job.createdAt, id: { lt: crawlJobId } }],
        },
      }),
    ]);
    // In order: the workspace's older queued crawls keep a slot each, so a
    // younger one runs only when there is room for all of them too. (A strict
    // "no older one queued" would refuse it while the older one's claim is
    // still in flight in another process, and idle a free slot for 30 s.)
    if (running + olderQueued >= tenantCrawlLimit(t)) return { kind: "wait" } as const;
    await tx.crawlJob.update({ where: { id: crawlJobId }, data: { status: "RUNNING", startedAt: now } });
    return { kind: "run", resumed: false } as const;
  });
}

/** An override value from a form: "" or absent = null (the plan's), else an integer within its bounds. */
export function parseOverride(field: OverrideField, raw: string | null | undefined): { ok: true; value: number | null } | { ok: false } {
  const v = (raw ?? "").trim();
  if (v === "") return { ok: true, value: null };
  const n = Number(v.replace(/[,\s']/g, ""));
  const [min, max] = OVERRIDE_BOUNDS[field];
  return Number.isInteger(n) && n >= min && n <= max ? { ok: true, value: n } : { ok: false };
}
