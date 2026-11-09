// src/lib/page-archive/config.ts — page snapshots (ECHORANK-DATA-ARCHIVE.md 1b).
//
// Every page we fetch for a client (Site Crawler pages, AI Lens, AI readiness
// audits) is copied to the crawl archive's PRIVATE bucket, on its own key
// (SPACES_ARCHIVE_*), never PURCHASE_ARCHIVE_* — see src/lib/spaces/client.ts:
//
//   tenants/<tenantId>/pages/<source>/<runId>/<urlHash>.html.gz
//   tenants/<tenantId>/pages/<source>/<runId>/<urlHash>.rendered.html.gz   (when rendered)
//   tenants/<tenantId>/pages/<source>/<runId>/<urlHash>.meta.json
//   tenants/<tenantId>/pages/<source>/<runId>/manifest.json                (last; none = incomplete)
//   tenants/<tenantId>/pages/crawl/<crawlId>/tables/…                      (crawl tables, CRAWL-ARCHIVE format)
//
// On when the crawl archive's Spaces key is configured, unless
// PAGE_ARCHIVE_ENABLED=false. Not kept: the free public crawler's pages (not a
// client), and the HTML of crawls that log in to the customer's site (owner's
// decision 2026-11-09: metadata only — those pages are private content).

import "server-only";

import { join } from "node:path";
import { archiveConfig } from "@/lib/spaces/client";
import { spoolDir } from "@/lib/purchase-archive/config";

export function pageArchiveEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if ((env.PAGE_ARCHIVE_ENABLED ?? "").trim().toLowerCase() === "false") return false;
  return archiveConfig(env) !== null;
}

/** Uploads in flight per run (PAGE_ARCHIVE_CONCURRENCY, default 8, 1–32). */
export function pageArchiveConcurrency(env: NodeJS.ProcessEnv = process.env): number {
  const n = Math.floor(Number(env.PAGE_ARCHIVE_CONCURRENCY ?? 8));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 32) : 8;
}

/** A body over this is not stored; its meta is (the sidecar applies the same cap). */
export const MAX_PAGE_BYTES = 5_000_000;

/**
 * Pages waiting for an upload slot before new ones go to the local spool
 * instead. Bounds what one run holds in memory whatever Spaces is doing, so a
 * slow bucket can neither slow the crawl nor grow the heap.
 */
export const MAX_PENDING = 32;

/** Page objects spool beside the purchase spool, in their own directory. */
export function pageSpoolDir(env: NodeJS.ProcessEnv = process.env): string {
  return join(spoolDir(env), "pages");
}
