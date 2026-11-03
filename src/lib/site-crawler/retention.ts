// src/lib/site-crawler/retention.ts
//
// Crawl retention (Phase 4a). Every crawl keeps its crawl_jobs row and summary
// forever: the history list. Full data — crawl_pages, crawl_issues,
// crawl_links (and, from 4b on, extractions and metrics, which hang off the
// pages) — is kept for:
//   - the plan's crawlsKept most recent COMPLETED crawls of each tenant;
//   - pinned crawls (≤ CRAWL_PIN_MAX per tenant);
//   - failed and cancelled crawls for RETENTION_UNFINISHED_DAYS, so a partial
//     result can still be read the week it happened.
// Everything else is deleted by the nightly job, RETENTION_BATCH_ROWS rows per
// statement so no single DELETE holds a lock over a 25,000-page crawl, and the
// row is stamped dataPurgedAt. QUEUED and RUNNING crawls are never touched.
//
// Also swept: crawl_site_defaults rows that were never verified and have not
// been touched for SITE_DEFAULTS_STALE_DAYS.

import "server-only";
import type { PlanType } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { planConfig } from "@/lib/plan-config";
import { logger } from "@/infrastructure/observability/logger";
import { RETENTION_BATCH_ROWS, RETENTION_UNFINISHED_DAYS, SITE_DEFAULTS_STALE_DAYS } from "./constants";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RetentionCandidate {
  id: string;
  status: string;
  pinned: boolean;
  finishedAt: Date | null;
  createdAt: Date;
}

/**
 * Which of one tenant's crawls lose their full data. Pure: `crawls` are the
 * tenant's terminal, not-yet-purged crawls in any order.
 */
export function crawlsToPurge(crawls: RetentionCandidate[], kept: number, now: Date): string[] {
  const completed = crawls
    .filter((c) => c.status === "COMPLETED")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const keep = new Set(completed.slice(0, Math.max(0, kept)).map((c) => c.id));
  const unfinishedCutoff = now.getTime() - RETENTION_UNFINISHED_DAYS * DAY_MS;
  return crawls
    .filter((c) => {
      if (c.pinned || keep.has(c.id)) return false;
      if (c.status === "COMPLETED") return true;
      if (c.status === "FAILED" || c.status === "CANCELLED") {
        return (c.finishedAt ?? c.createdAt).getTime() < unfinishedCutoff;
      }
      return false; // QUEUED / RUNNING
    })
    .map((c) => c.id);
}

/** Delete one crawl's full data in bounded batches, then stamp it. Returns rows deleted. */
export async function purgeCrawlData(jobId: string, batch = RETENTION_BATCH_ROWS): Promise<number> {
  let total = 0;
  // Children first, each in batches, so the page deletes cascade over nothing.
  for (const table of ["crawl_issues", "crawl_links", "crawl_pages"] as const) {
    for (;;) {
      const n =
        table === "crawl_issues"
          ? await prisma.$executeRaw`DELETE FROM "crawl_issues" WHERE "id" IN (SELECT "id" FROM "crawl_issues" WHERE "crawlJobId" = ${jobId} LIMIT ${batch})`
          : table === "crawl_links"
            ? await prisma.$executeRaw`DELETE FROM "crawl_links" WHERE "id" IN (SELECT "id" FROM "crawl_links" WHERE "crawlJobId" = ${jobId} LIMIT ${batch})`
            : await prisma.$executeRaw`DELETE FROM "crawl_pages" WHERE "id" IN (SELECT "id" FROM "crawl_pages" WHERE "crawlJobId" = ${jobId} LIMIT ${batch})`;
      total += n;
      if (n < batch) break;
    }
  }
  await prisma.crawlJob.update({ where: { id: jobId }, data: { dataPurgedAt: new Date() } });
  return total;
}

export interface RetentionResult {
  crawlsPurged: number;
  rowsDeleted: number;
  siteDefaultsDeleted: number;
}

/** The nightly run. Idempotent; a crash midway resumes on the next night. */
export async function runCrawlRetention(now: Date = new Date()): Promise<RetentionResult> {
  const tenants = await prisma.crawlJob.groupBy({
    by: ["tenantId"],
    where: { dataPurgedAt: null, status: { in: ["COMPLETED", "FAILED", "CANCELLED"] } },
  });
  let crawlsPurged = 0;
  let rowsDeleted = 0;
  for (const { tenantId } of tenants) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { planType: true } });
    if (!tenant) continue;
    const crawls = await prisma.crawlJob.findMany({
      where: { tenantId, dataPurgedAt: null, status: { in: ["COMPLETED", "FAILED", "CANCELLED"] } },
      select: { id: true, status: true, pinned: true, finishedAt: true, createdAt: true },
    });
    for (const id of crawlsToPurge(crawls, planConfig(tenant.planType as PlanType).crawlsKept, now)) {
      rowsDeleted += await purgeCrawlData(id);
      crawlsPurged++;
    }
  }
  const { count: siteDefaultsDeleted } = await prisma.crawlSiteDefault.deleteMany({
    where: { verifiedAt: null, updatedAt: { lt: new Date(now.getTime() - SITE_DEFAULTS_STALE_DAYS * DAY_MS) } },
  });
  logger.info({ crawlsPurged, rowsDeleted, siteDefaultsDeleted }, "site-crawl retention done");
  return { crawlsPurged, rowsDeleted, siteDefaultsDeleted };
}
