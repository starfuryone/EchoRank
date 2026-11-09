// src/lib/page-archive/retention.ts — retention for the archive bucket's
// non-crawl objects (owner's decision 2026-11-09):
//
//   tenants/<t>/pages/ai-lens/…  and  tenants/<t>/pages/audit/…   PAGE_ARCHIVE_AUDIT_DAYS (default 365)
//   tenants/<t>/reports/…                                         REPORT_ARCHIVE_DAYS     (default 730)
//
// Crawl page snapshots are NOT here: they follow the plan's crawl retention
// (site-crawler/retention.ts purgeRetainedOut). Everything is also deleted
// with the workspace (privacy/deletion.ts).
//
// Age is the object's LastModified: every object of a run, and every report,
// is written once when it is created and never rewritten. Run by the
// purchase-archive worker's nightly retention job (03:40 UTC). Counts logged.

import "server-only";

import type { ObjectStore } from "@/lib/spaces/client";

export const DEFAULT_AUDIT_PAGE_DAYS = 365;
export const DEFAULT_REPORT_DAYS = 730;

function days(v: string | undefined, fallback: number): number {
  const n = Math.floor(Number(v ?? fallback));
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

export function auditPageDays(env: NodeJS.ProcessEnv = process.env): number {
  return days(env.PAGE_ARCHIVE_AUDIT_DAYS, DEFAULT_AUDIT_PAGE_DAYS);
}

export function reportDays(env: NodeJS.ProcessEnv = process.env): number {
  return days(env.REPORT_ARCHIVE_DAYS, DEFAULT_REPORT_DAYS);
}

/** The sub-prefixes of a tenant this purge owns, with their window in days. */
export function retentionTargets(env: NodeJS.ProcessEnv = process.env): Array<{ path: string; days: number }> {
  const a = auditPageDays(env);
  return [
    { path: "pages/ai-lens/", days: a },
    { path: "pages/audit/", days: a },
    { path: "reports/", days: reportDays(env) },
  ];
}

const BATCH = 1_000;

export async function purgeArchiveRetention(deps: {
  store: ObjectStore;
  now?: Date;
  env?: NodeJS.ProcessEnv;
}): Promise<{ tenants: number; deleted: Record<string, number> }> {
  const now = (deps.now ?? new Date()).getTime();
  const targets = retentionTargets(deps.env);
  const deleted: Record<string, number> = Object.fromEntries(targets.map((t) => [t.path, 0]));
  const tenants = await deps.store.listPrefixes("tenants/");
  for (const tp of tenants) {
    for (const t of targets) {
      const cutoff = now - t.days * 86_400_000;
      let batch: string[] = [];
      for await (const o of deps.store.list(`${tp}${t.path}`)) {
        // No LastModified (should not happen): kept, never guessed old.
        if (!o.lastModified || o.lastModified.getTime() >= cutoff) continue;
        batch.push(o.key);
        if (batch.length >= BATCH) {
          deleted[t.path] += await deps.store.deleteKeys(batch);
          batch = [];
        }
      }
      if (batch.length) deleted[t.path] += await deps.store.deleteKeys(batch);
    }
  }
  return { tenants: tenants.length, deleted };
}
