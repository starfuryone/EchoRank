// src/lib/site-crawler/tenant-caps.ts
//
// Phase 3d-A: a tenant's site crawler caps = its plan's, unless staff set an
// override in /admin/crawl-overrides (tenants.crawl*Override, null = plan):
//
//   urlCap       URLs per crawl         startCrawl (via getCrawlQuota)
//   crawlsKept   crawls kept with data  nightly retention, the History line
//   concurrency  simultaneous crawls    the worker's fair share, below
//
// FAIR SHARE. The box runs crawlMaxConcurrent() crawls at once (env
// CRAWL_MAX_CONCURRENT, default 6). A tenant may
// hold at most `concurrency` of them (default 1), so one workspace's batch
// cannot take every slot while another waits. A crawl whose tenant is at its
// limit goes back to the queue for FAIR_SHARE_RETRY_MS and stays QUEUED. An
// override above the box's slot count is allowed (it means "never held back")
// but cannot run more crawls than the box has.

import "server-only";
import type { PlanType } from "@/generated/prisma";
import { planConfig } from "@/lib/plan-config";
import { prisma } from "@/lib/prisma";
import { CRAWL_MAX_CONCURRENT_BOUNDS, CRAWL_MAX_CONCURRENT_DEFAULT } from "./constants";

export const TENANT_CRAWL_CONCURRENCY_DEFAULT = 1;

/** Crawls the box runs at once: CRAWL_MAX_CONCURRENT (an integer in bounds), else the default. */
export function crawlMaxConcurrent(raw: string | undefined = process.env.CRAWL_MAX_CONCURRENT): number {
  const n = Number((raw ?? "").trim());
  const [min, max] = CRAWL_MAX_CONCURRENT_BOUNDS;
  if (!raw?.trim() || !Number.isInteger(n)) return CRAWL_MAX_CONCURRENT_DEFAULT;
  return Math.min(max, Math.max(min, n));
}
export const FAIR_SHARE_RETRY_MS = 30_000;

/** What /admin accepts for each override (inclusive). */
export const OVERRIDE_BOUNDS = {
  crawlConcurrencyOverride: [1, 10],
  crawlsKeptOverride: [1, 10_000],
  crawlUrlCapOverride: [1, 100_000],
} as const;
export type OverrideField = keyof typeof OVERRIDE_BOUNDS;
export const OVERRIDE_FIELDS = Object.keys(OVERRIDE_BOUNDS) as OverrideField[];

export type CrawlOverrides = Record<OverrideField, number | null>;
export const NO_OVERRIDES: CrawlOverrides = { crawlConcurrencyOverride: null, crawlsKeptOverride: null, crawlUrlCapOverride: null };

export function effectiveCaps(plan: PlanType, o: CrawlOverrides = NO_OVERRIDES): { urlCap: number; crawlsKept: number; concurrency: number } {
  const c = planConfig(plan);
  return {
    urlCap: o.crawlUrlCapOverride ?? c.crawlUrlCap,
    crawlsKept: o.crawlsKeptOverride ?? c.crawlsKept,
    concurrency: o.crawlConcurrencyOverride ?? TENANT_CRAWL_CONCURRENCY_DEFAULT,
  };
}

export async function tenantOverrides(tenantId: string): Promise<CrawlOverrides> {
  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { crawlConcurrencyOverride: true, crawlsKeptOverride: true, crawlUrlCapOverride: true },
  });
  return t ?? NO_OVERRIDES;
}

/** Whether this tenant may start another crawl now (fewer RUNNING than its concurrency). */
export async function tenantHasCrawlSlot(tenantId: string, crawlJobId: string): Promise<boolean> {
  const [o, running] = await Promise.all([
    tenantOverrides(tenantId),
    prisma.crawlJob.count({ where: { tenantId, status: "RUNNING", id: { not: crawlJobId } } }),
  ]);
  return running < (o.crawlConcurrencyOverride ?? TENANT_CRAWL_CONCURRENCY_DEFAULT);
}

/** An override value from a form: "" or absent = null (the plan's), else an integer within its bounds. */
export function parseOverride(field: OverrideField, raw: string | null | undefined): { ok: true; value: number | null } | { ok: false } {
  const v = (raw ?? "").trim();
  if (v === "") return { ok: true, value: null };
  const n = Number(v.replace(/[,\s']/g, ""));
  const [min, max] = OVERRIDE_BOUNDS[field];
  return Number.isInteger(n) && n >= min && n <= max ? { ok: true, value: n } : { ok: false };
}
