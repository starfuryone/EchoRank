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
import { CrawlLockedError, CrawlQuotaExceededError, InvalidCrawlUrlError } from "./http";

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
  };
}

/** Validate, enforce quota, create the row, enqueue the job. */
export async function startCrawl(
  tenantId: string,
  plan: PlanType,
  rawUrl: string,
): Promise<CrawlJobDto> {
  const quota = await getCrawlQuota(tenantId, plan);
  if (quota.locked) throw new CrawlLockedError(plan);

  const validated = validateRootUrl(rawUrl);
  if (!validated.ok || !validated.url) {
    throw new InvalidCrawlUrlError(validated.reason ?? "not_a_url");
  }

  if (!quota.allowed) {
    throw new CrawlQuotaExceededError(quota.monthlyLimit ?? 0, plan);
  }

  const job = await prisma.crawlJob.create({
    data: {
      tenantId,
      rootUrl: validated.url,
      // Copied from the plan at creation: the crawl keeps reporting the ceiling
      // it ran under even if the tenant changes tier tomorrow.
      urlCap: quota.urlCap,
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
