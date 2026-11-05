// src/lib/site-crawler/archive/policy.ts
//
// Which of one tenant's crawls are hot, archived or deleted. Pure.
//
// RETENTION IS UNCHANGED AND ALWAYS WINS. Phase 4a's crawlsToPurge (per
// TENANT: the newest crawlsKept completed crawls, plus pinned ones, plus
// failed/cancelled ones for 7 days) decides what is deleted, exactly as
// before — an archived crawl counts as kept like any other, so "Last N crawls
// kept · 5 more pinned" stays true. The archive only chooses WHERE a kept
// crawl's rows live:
//
//   hot      the latest HOT_PER_SITE completed crawls of each site (lowercased
//            hostname, www its own host — as crawl_site_defaults), every
//            pinned crawl, any crawl restored in the last RESTORED_HOT_DAYS,
//            and every schedule's last run (the scheduled-run diff compares
//            against crawl_schedules.lastJobId, which a manual crawl of the
//            same site could otherwise push out of the per-site two).
//   archive  every other kept COMPLETED crawl whose rows are still in Postgres.
//   delete   crawlsToPurge, untouched; retention also deletes the crawl's
//            archive objects (retention.ts).
//
// Queued, running, failed and cancelled crawls are never archived. A crawl
// already archived that becomes hot (pinned later) is not restored by the
// sweep: restoring is the user's call.

import { crawlsToPurge, type RetentionCandidate } from "../retention-policy";
import { HOT_PER_SITE, RESTORED_HOT_DAYS } from "./constants";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PolicyCrawl extends RetentionCandidate {
  rootUrl: string;
  storageState: string;
  restoredAt: Date | null;
}

export interface TenantPlan {
  /** Retention deletes these (crawlsToPurge, unchanged). */
  purge: string[];
  /** Kept with rows in Postgres. */
  hot: string[];
  /** Kept, HOT today, and to be archived. */
  archive: string[];
}

/** The site a crawl belongs to: its root's lowercased hostname. */
export function siteOf(rootUrl: string): string {
  try {
    return new URL(rootUrl).hostname.toLowerCase();
  } catch {
    return rootUrl.toLowerCase();
  }
}

const TERMINAL = new Set(["COMPLETED", "FAILED", "CANCELLED"]);

/**
 * `crawls`: the tenant's crawls whose data is not purged, any status, any
 * storage state. `pinnedSchedules`: crawl_schedules.lastJobId of the tenant's
 * schedules (the diff baseline).
 */
export function planTenant(
  crawls: readonly PolicyCrawl[],
  kept: number,
  now: Date,
  scheduleBaselines: ReadonlySet<string> = new Set(),
): TenantPlan {
  const purge = crawlsToPurge(crawls.filter((c) => TERMINAL.has(c.status)), kept, now);
  const purged = new Set(purge);
  const completed = crawls
    .filter((c) => c.status === "COMPLETED" && !purged.has(c.id))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const hot = new Set<string>();
  const perSite = new Map<string, number>();
  for (const c of completed) {
    const site = siteOf(c.rootUrl);
    const n = perSite.get(site) ?? 0;
    if (n < HOT_PER_SITE) hot.add(c.id);
    perSite.set(site, n + 1);
  }
  const restoredSince = now.getTime() - RESTORED_HOT_DAYS * DAY_MS;
  for (const c of completed) {
    if (c.pinned || scheduleBaselines.has(c.id) || (c.restoredAt && c.restoredAt.getTime() >= restoredSince)) hot.add(c.id);
  }

  return {
    purge,
    hot: completed.filter((c) => hot.has(c.id)).map((c) => c.id),
    archive: completed.filter((c) => !hot.has(c.id) && c.storageState === "HOT").map((c) => c.id),
  };
}
