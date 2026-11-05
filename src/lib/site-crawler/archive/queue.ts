// src/lib/site-crawler/archive/queue.ts — enqueueing onto the crawl-archive
// queue, without the worker (the restore route imports this; the worker
// imports it too, so the job id is defined once).

import "server-only";
import { getQueue } from "@/infrastructure/queue/registry";
import { queueJobId } from "@/infrastructure/queue/job-id";

export const CRAWL_ARCHIVE_QUEUE = "crawl-archive";
export const SWEEP_JOB = "sweep";
export const RESTORE_JOB = "restore";

/** One restore job per crawl at a time (a double click is one job). */
export function restoreJobId(crawlId: string): string {
  return queueJobId("crawl-restore", crawlId);
}

/**
 * Enqueue one restore. Priority 1: ahead of a waiting sweep (priority 10).
 * Removed on completion and on failure, so the next Restore after a failed
 * one is not swallowed by the old job's id; the failure alert reads the
 * events stream and still sees it.
 */
export async function enqueueRestore(crawlId: string): Promise<void> {
  await getQueue(CRAWL_ARCHIVE_QUEUE).add(
    RESTORE_JOB,
    { kind: "restore", crawlJobId: crawlId },
    { jobId: restoreJobId(crawlId), priority: 1, removeOnComplete: true, removeOnFail: true },
  );
}
