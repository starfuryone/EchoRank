// src/lib/site-crawler/retention-policy.ts
//
// Phase 4a's retention rule, pure (retention.ts re-exports it and does the
// deleting; the crawl archive's policy builds on it). Per TENANT: the newest
// crawlsKept COMPLETED crawls keep their full data, pinned crawls too, failed
// and cancelled ones for RETENTION_UNFINISHED_DAYS; QUEUED and RUNNING are
// never touched.

import { RETENTION_UNFINISHED_DAYS } from "./constants";

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
