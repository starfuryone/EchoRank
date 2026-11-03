// src/lib/site-crawler/service.ts
//
// Start / cancel / read, so the route handlers stay thin and the guard order
// is written down once instead of once per endpoint.
//
// GUARD ORDER, and why: plan lock → URL validation → quota → create → enqueue.
// The lock comes first because a locked tier should hear "not on your plan"
// rather than "that URL is invalid" — the second is true but answers a
// question they did not ask. Quota comes after URL validation so a tenant with
// one crawl left does not spend it on a typo.

import type { PlanType } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { addJob } from "@/infrastructure/queue/registry";
import { getRedisConnection } from "@/infrastructure/redis/connection";
import { crawlKeys, REDIS_KEY_TTL_SECONDS } from "./constants";
import { getCrawlQuota } from "./quota";
import { validateRootUrl } from "./url";
import type { RenderMode } from "./types";
import { CrawlLockedError, CrawlQuotaExceededError, InvalidCrawlConfigError, InvalidCrawlUrlError } from "./http";
import { checkCrawlConfig, readStoredConfig, viewCrawlConfig, type CrawlConfigInput, type CrawlConfigView } from "./crawl-config";
import { sealCrawlConfig } from "./crawl-config-secrets";
import { newVerifyToken } from "./site-verify";

export interface CrawlJobDto {
  id: string;
  rootUrl: string;
  status: string;
  urlCap: number;
  pagesCrawled: number;
  issueCount: number;
  stoppedReason: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  renderMode: RenderMode;
  renderCap: number;
  pagesRendered: number;
  /** Phase 4a. */
  mode: "spider" | "list";
  /** Secrets as { set: true }; null = the defaults. */
  config: CrawlConfigView | null;
  pinned: boolean;
  /** Set once retention deleted the crawl's pages: summary only from then on. */
  dataPurgedAt: string | null;
}

export function toCrawlDto(row: {
  id: string;
  rootUrl: string;
  status: string;
  urlCap: number;
  pagesCrawled: number;
  issueCount: number;
  stoppedReason: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  renderMode?: string;
  renderCap?: number;
  pagesRendered?: number;
  mode?: string;
  config?: unknown;
  pinned?: boolean;
  dataPurgedAt?: Date | null;
}): CrawlJobDto {
  return {
    id: row.id,
    rootUrl: row.rootUrl,
    status: row.status,
    urlCap: row.urlCap,
    pagesCrawled: row.pagesCrawled,
    issueCount: row.issueCount,
    stoppedReason: row.stoppedReason,
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    renderMode: row.renderMode === "thin" || row.renderMode === "all" ? row.renderMode : "none",
    renderCap: row.renderCap ?? 0,
    pagesRendered: row.pagesRendered ?? 0,
    mode: row.mode === "list" ? "list" : "spider",
    config: viewCrawlConfig(readStoredConfig(row.config)),
    pinned: row.pinned ?? false,
    dataPurgedAt: row.dataPurgedAt?.toISOString() ?? null,
  };
}

export interface StartCrawlOptions {
  /** Phase 4a configuration; omitted = the defaults. */
  config?: CrawlConfigInput;
  /** Also store this configuration as the default for the root's host. */
  saveAsDefault?: boolean;
}

/** Validate, enforce quota, create the row, enqueue the job. */
export async function startCrawl(
  tenantId: string,
  plan: PlanType,
  rawUrl: string,
  renderMode: RenderMode = "none",
  opts: StartCrawlOptions = {},
): Promise<CrawlJobDto> {
  const quota = await getCrawlQuota(tenantId, plan);
  if (quota.locked) throw new CrawlLockedError(plan);

  const validated = validateRootUrl(rawUrl);
  if (!validated.ok || !validated.url) {
    throw new InvalidCrawlUrlError(validated.reason ?? "not_a_url");
  }

  // Phase 4a configuration, checked before quota like the URL: a typo in a
  // pattern should not spend a crawl. Verified-only options are refused on
  // an unverified host; a custom robots.txt runs in test mode there.
  const host = new URL(validated.url).hostname;
  const site = opts.config || opts.saveAsDefault
    ? await prisma.crawlSiteDefault.findUnique({
        where: { tenantId_host: { tenantId, host } },
        select: { verifiedAt: true, config: true },
      })
    : null;
  let stored = null;
  if (opts.config) {
    const checked = checkCrawlConfig(opts.config, { urlCap: quota.urlCap, verified: Boolean(site?.verifiedAt) });
    if (checked.problems.length) throw new InvalidCrawlConfigError(checked.problems);
    stored = sealCrawlConfig(checked.config, readStoredConfig(site?.config));
  }

  if (!quota.allowed) {
    throw new CrawlQuotaExceededError(quota.monthlyLimit ?? 0, plan);
  }

  if (stored && opts.saveAsDefault) {
    await prisma.crawlSiteDefault.upsert({
      where: { tenantId_host: { tenantId, host } },
      create: { tenantId, host, verifyToken: newVerifyToken(), config: stored as object },
      update: { config: stored as object },
    });
  }

  const job = await prisma.crawlJob.create({
    data: {
      tenantId,
      rootUrl: validated.url,
      ...(stored
        ? { config: { ...stored, customRobotsMode: site?.verifiedAt ? "replace" : "test" } as object }
        : {}),
      // Copied from the plan at creation: the crawl keeps reporting the ceiling
      // it ran under even if the tenant changes tier tomorrow. A configured
      // max URLs lowers it, never raises it.
      urlCap: Math.min(quota.urlCap, stored?.maxUrls ?? quota.urlCap),
      // Same rule for the render ceiling. A tier without one crawls raw only,
      // whatever was asked for.
      renderMode: quota.renderCap > 0 ? renderMode : "none",
      renderCap: quota.renderCap,
      status: "QUEUED",
    },
  });

  await addJob("site-crawl", "crawl", { crawlJobId: job.id, tenantId });

  return toCrawlDto(job);
}

/**
 * Flag a crawl for cancellation.
 *
 * A RUNNING crawl is stopped cooperatively: the worker checks this Redis key
 * once per batch, so cancellation takes effect within a batch rather than
 * instantly. A QUEUED crawl is marked CANCELLED here directly, because no
 * worker has picked it up to notice the flag.
 */
export async function cancelCrawl(tenantId: string, crawlJobId: string): Promise<boolean> {
  const job = await prisma.crawlJob.findFirst({
    where: { id: crawlJobId, tenantId },
    select: { id: true, status: true },
  });
  if (!job) return false;

  if (job.status === "COMPLETED" || job.status === "FAILED" || job.status === "CANCELLED") {
    return true; // already terminal — nothing to do, and not an error
  }

  const redis = getRedisConnection();
  const keys = crawlKeys(crawlJobId);
  await redis.set(keys.cancel, "1", "EX", REDIS_KEY_TTL_SECONDS);

  if (job.status === "QUEUED") {
    await prisma.crawlJob.update({
      where: { id: crawlJobId },
      data: { status: "CANCELLED", stoppedReason: "cancelled", finishedAt: new Date() },
    });
  }

  return true;
}
