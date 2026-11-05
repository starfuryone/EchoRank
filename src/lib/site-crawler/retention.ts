// src/lib/site-crawler/retention.ts
//
// Crawl retention (Phase 4a). Every crawl keeps its crawl_jobs row and summary
// forever: the history list. Full data — crawl_pages, crawl_issues,
// crawl_links, crawl_extractions (and, from 4d on, metrics, which hang off
// the pages) — is kept for:
//   - the plan's crawlsKept most recent COMPLETED crawls of each tenant;
//   - pinned crawls (≤ CRAWL_PIN_MAX per tenant);
//   - failed and cancelled crawls for RETENTION_UNFINISHED_DAYS, so a partial
//     result can still be read the week it happened.
// Everything else is deleted by the nightly job, RETENTION_BATCH_ROWS rows per
// statement so no single DELETE holds a lock over a 25,000-page crawl, and the
// row is stamped dataPurgedAt. QUEUED and RUNNING crawls are never touched.
//
// The crawl archive (archive/) works INSIDE this rule: it only moves the rows
// of crawls retention keeps, and an archived crawl counts as kept. When this
// purges a crawl the archive moved, its Spaces objects go first
// (purgeRetainedOut).
//
// Also swept: crawl_site_defaults rows that were never verified and have not
// been touched for SITE_DEFAULTS_STALE_DAYS.
//
// The free public crawler (free-tenant.ts) is not on the crawlsKept rule: its
// crawls are deleted outright — full data, then the crawl_jobs row, whose
// free_crawls row (the result link) cascades — once older than
// FREE_CRAWL_RETENTION_DAYS. Its leads (free_crawl_leads) have no FK and stay.

import "server-only";
import { Prisma, type PlanType } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { logger } from "@/infrastructure/observability/logger";
import { RETENTION_BATCH_ROWS, SITE_DEFAULTS_STALE_DAYS } from "./constants";
import { effectiveCaps } from "./tenant-caps";
import { FREE_CRAWL_RETENTION_DAYS } from "./free-limits";
import { archiveStore, type ObjectStore } from "@/lib/spaces/client";


const DAY_MS = 24 * 60 * 60 * 1000;

// Pure, in its own module so the archive policy can use it without Prisma.
import { crawlsToPurge } from "./retention-policy";
export { crawlsToPurge, type RetentionCandidate } from "./retention-policy";

/** A crawl's full data, children before crawl_pages so the page deletes cascade over nothing. */
const PURGED_TABLES = ["crawl_issues", "crawl_extractions", "crawl_page_metrics", "crawl_links", "crawl_pages"] as const;

/**
 * Delete one crawl's child rows in bounded batches, children first, one
 * statement per batch (no transaction spans them). Shared with the archive,
 * which deletes 10,000 per statement once the copy in Spaces is verified.
 */
export async function deleteCrawlRows(jobId: string, batch = RETENTION_BATCH_ROWS): Promise<number> {
  let total = 0;
  for (const table of PURGED_TABLES) {
    // The table name is one of the literals above, never input.
    const name = Prisma.raw(`"${table}"`);
    for (;;) {
      const n = await prisma.$executeRaw`DELETE FROM ${name} WHERE "id" IN (SELECT "id" FROM ${name} WHERE "crawlJobId" = ${jobId} LIMIT ${batch})`;
      total += n;
      if (n < batch) break;
    }
  }
  return total;
}

/** Delete one crawl's full data in bounded batches, then stamp it. Returns rows deleted. */
export async function purgeCrawlData(jobId: string, batch = RETENTION_BATCH_ROWS): Promise<number> {
  const total = await deleteCrawlRows(jobId, batch);
  // Phase 4c: a comparison is only as good as both crawls' pages.
  await prisma.crawlComparison.deleteMany({ where: { OR: [{ jobAId: jobId }, { jobBId: jobId }] } });
  await prisma.crawlJob.update({ where: { id: jobId }, data: { dataPurgedAt: new Date() } });
  return total;
}

export interface RetentionResult {
  crawlsPurged: number;
  rowsDeleted: number;
  siteDefaultsDeleted: number;
  freeCrawlsDeleted: number;
}

/**
 * The free crawler's crawls older than FREE_CRAWL_RETENTION_DAYS, deleted with
 * everything hanging off them (leads are not). A RUNNING one is left for the
 * next night; a free crawl runs 10 minutes at most.
 */
export async function purgeFreeCrawls(now: Date = new Date()): Promise<number> {
  const old = await prisma.crawlJob.findMany({
    where: { tenant: { source: "free" }, createdAt: { lt: new Date(now.getTime() - FREE_CRAWL_RETENTION_DAYS * DAY_MS) }, status: { not: "RUNNING" } },
    select: { id: true },
    take: 500,
  });
  for (const { id } of old) {
    await purgeCrawlData(id);
    await prisma.crawlJob.delete({ where: { id } });
  }
  return old.length;
}

/**
 * Purge one crawl retention no longer keeps. A crawl the archive moved to
 * Spaces loses its objects first (CRAWL-ARCHIVE.md: "Delete … extended to also
 * delete their Spaces objects"); when they cannot be deleted — Spaces not
 * configured, or the call fails — the crawl is left for the next night rather
 * than stamped purged with its objects orphaned. A crawl the archive is moving
 * (ARCHIVING / RESTORING) is left for the next night too. Returns rows
 * deleted, or null when skipped.
 */
export async function purgeRetainedOut(
  crawl: { id: string; storageState?: string | null; archiveKeyPrefix?: string | null },
  store: ObjectStore | null,
): Promise<number | null> {
  if (crawl.storageState === "ARCHIVING" || crawl.storageState === "RESTORING") return null;
  if (crawl.archiveKeyPrefix) {
    if (!store) {
      logger.warn({ crawlId: crawl.id }, "retention: archived crawl not purged — Spaces archive not configured");
      return null;
    }
    const keys: string[] = [];
    for await (const o of store.list(crawl.archiveKeyPrefix)) keys.push(o.key);
    if (keys.length) await store.deleteKeys(keys);
  }
  const rows = await purgeCrawlData(crawl.id);
  if (crawl.archiveKeyPrefix || (crawl.storageState && crawl.storageState !== "HOT")) {
    await prisma.crawlJob.update({ where: { id: crawl.id }, data: { storageState: "HOT", archiveKeyPrefix: null, archiveBytes: null } });
  }
  return rows;
}

/** The nightly run. Idempotent; a crash midway resumes on the next night. */
export async function runCrawlRetention(now: Date = new Date()): Promise<RetentionResult> {
  const tenants = await prisma.crawlJob.groupBy({
    by: ["tenantId"],
    where: { dataPurgedAt: null, status: { in: ["COMPLETED", "FAILED", "CANCELLED"] } },
  });
  let crawlsPurged = 0;
  let rowsDeleted = 0;
  const store = archiveStore();
  for (const { tenantId } of tenants) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { planType: true, crawlConcurrencyOverride: true, crawlsKeptOverride: true, crawlUrlCapOverride: true, source: true },
    });
    // The free crawler's tenant has its own rule (purgeFreeCrawls, below).
    if (!tenant || tenant.source === "free") continue;
    const crawls = await prisma.crawlJob.findMany({
      where: { tenantId, dataPurgedAt: null, status: { in: ["COMPLETED", "FAILED", "CANCELLED"] } },
      select: { id: true, status: true, pinned: true, finishedAt: true, createdAt: true, storageState: true, archiveKeyPrefix: true },
    });
    const byId = new Map(crawls.map((c) => [c.id, c]));
    // Phase 3d-A: a staff override of crawls kept (tenant-caps.ts) replaces the plan's.
    for (const id of crawlsToPurge(crawls, effectiveCaps(tenant.planType as PlanType, tenant).crawlsKept, now)) {
      const n = await purgeRetainedOut(byId.get(id)!, store);
      if (n === null) continue;
      rowsDeleted += n;
      crawlsPurged++;
    }
  }
  const { count: siteDefaultsDeleted } = await prisma.crawlSiteDefault.deleteMany({
    where: { verifiedAt: null, updatedAt: { lt: new Date(now.getTime() - SITE_DEFAULTS_STALE_DAYS * DAY_MS) } },
  });
  const freeCrawlsDeleted = await purgeFreeCrawls(now);
  logger.info({ crawlsPurged, rowsDeleted, siteDefaultsDeleted, freeCrawlsDeleted }, "site-crawl retention done");
  return { crawlsPurged, rowsDeleted, siteDefaultsDeleted, freeCrawlsDeleted };
}
