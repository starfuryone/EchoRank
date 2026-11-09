// src/lib/page-archive/crawl.ts — the Site Crawler's side of the page archive.
//
// One PageRunWriter per crawl (tenants/<tenantId>/pages/crawl/<crawlId>/), fed
// page by page from crawlOne. When the crawl ends: wait for the uploads, write
// the manifest, and — for a COMPLETED crawl — copy the crawl's tables (pages,
// issues, links, extractions, metrics) in the CRAWL-ARCHIVE NDJSON format to
// …/tables/. Postgres keeps its hot set exactly as before; this is a copy.
//
// Runs after the crawl's terminal status is written, so the customer's crawl
// is finished on screen while this completes. Nothing here throws.

import "server-only";

import { archiveStore, pagesPrefix, type ObjectStore } from "@/lib/spaces/client";
import { logger } from "@/infrastructure/observability/logger";
import { pageArchiveConcurrency, pageArchiveEnabled } from "./config";
import { PageRunWriter } from "./writer";

export interface CrawlSnapshots {
  writer: PageRunWriter;
  store: ObjectStore;
}

/** The writer for one crawl, or null (off, not configured, the free crawler, a bad id). */
export function openCrawlSnapshots(crawl: { id: string; tenantId: string; free: boolean }): CrawlSnapshots | null {
  if (crawl.free || !pageArchiveEnabled()) return null;
  const store = archiveStore();
  if (!store) return null;
  try {
    return { store, writer: new PageRunWriter({ store, tenantId: crawl.tenantId, source: "crawl", runId: crawl.id, concurrency: pageArchiveConcurrency() }) };
  } catch (err) {
    logger.warn({ crawlId: crawl.id, err: (err as Error)?.message }, "page-archive: crawl not archived");
    return null;
  }
}

export function crawlTablesPrefix(tenantId: string, crawlId: string): string {
  return `${pagesPrefix(tenantId, "crawl", crawlId)}tables/`;
}

/** Finish the pages, then (COMPLETED only) copy the tables. Never throws. */
export async function closeCrawlSnapshots(
  s: CrawlSnapshots,
  crawl: { id: string; tenantId: string; status: string },
  copyTables: (store: ObjectStore, crawl: { id: string; tenantId: string }, prefix: string) => Promise<unknown>,
): Promise<void> {
  try {
    const manifest = await s.writer.finish();
    logger.info(
      { crawlId: crawl.id, pages: s.writer.pages, uploaded: s.writer.uploaded, spooled: s.writer.spooled, dropped: s.writer.dropped, bytes: manifest?.bytes ?? null },
      "page-archive: crawl pages stored",
    );
  } catch (err) {
    logger.warn({ crawlId: crawl.id, err: (err as Error)?.message }, "page-archive: crawl pages not finished");
  }
  if (crawl.status !== "COMPLETED") return;
  try {
    await copyTables(s.store, { id: crawl.id, tenantId: crawl.tenantId }, crawlTablesPrefix(crawl.tenantId, crawl.id));
  } catch (err) {
    logger.warn({ crawlId: crawl.id, err: (err as Error)?.message }, "page-archive: crawl tables not copied");
  }
}
