// The crawl archive's worker (CRAWL-ARCHIVE.md): queue "crawl-archive",
// CONCURRENCY 1 — one archive or restore at a time, box-wide, so a sweep and a
// restore never race over the same crawl and the recovery step in sweep.ts
// can treat anything mid-move as left by a crash.
//
// Two jobs:
//   sweep    repeatable, cron ARCHIVE_SWEEP_CRON (05:17 UTC, after the
//            04:00–04:35 backups). A cron PATTERN, never `every`: the repeat
//            key stores `every` as a string, which broke the prune's
//            dedupe before (blog-agent.worker.ts has the history).
//   restore  one per request, from POST /api/seo/v1/crawl/[id]/restore, id
//            restoreJobId(crawlId) so a double click is one job. Prioritized
//            ahead of a waiting sweep.
//
// Spaces not configured → every job returns at once. The archive part of the
// sweep runs only with CRAWL_ARCHIVE_ENABLED=true, and only logs while
// CRAWL_ARCHIVE_DRY_RUN is anything but "false".
//
// A sweep with a failed crawl, or a failed restore, throws — the job fails
// for good (one attempt) and the queue-failure alert emails support@.

import { Worker, type Job } from "bullmq";
import { getQueue } from "@/infrastructure/queue/registry";
import { getSubscriberConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import type { CrawlArchiveJob } from "@/infrastructure/queue/jobs/schemas";
import { logger } from "@/infrastructure/observability/logger";
import { withSpan } from "@/infrastructure/observability/telemetry";
import { archiveStore } from "@/lib/spaces/client";
import { ARCHIVE_SWEEP_CRON, archiveDryRun, archiveEnabled } from "@/lib/site-crawler/archive/constants";
import { runArchiveSweep } from "@/lib/site-crawler/archive/sweep";
import { restoreCrawl } from "@/lib/site-crawler/archive/engine";

import { CRAWL_ARCHIVE_QUEUE, SWEEP_JOB, restoreJobId } from "@/lib/site-crawler/archive/queue";

export { CRAWL_ARCHIVE_QUEUE, RESTORE_JOB, SWEEP_JOB, enqueueRestore, restoreJobId } from "@/lib/site-crawler/archive/queue";

/** Whether a registered repeatable is the sweep we want (`every` arrives from Redis as a string). */
export function sweepScheduleIsCurrent(entry: { name?: string; pattern?: string | null; every?: number | string | null }): boolean {
  const hasInterval = entry.every !== undefined && entry.every !== null && Number(entry.every) > 0;
  return entry.name === SWEEP_JOB && entry.pattern === ARCHIVE_SWEEP_CRON && !hasInterval;
}

type QueueLike = Pick<ReturnType<typeof getQueue>, "getJob">;

async function restorePending(queue: QueueLike, crawlId: string): Promise<boolean> {
  const job = await queue.getJob(restoreJobId(crawlId));
  if (!job) return false;
  const state = await job.getState();
  return state === "waiting" || state === "delayed" || state === "prioritized" || state === "waiting-children";
}

export async function processCrawlArchiveJob(job: Job<CrawlArchiveJob>): Promise<unknown> {
  const store = archiveStore();
  if (job.data.kind === "restore") {
    if (!store) return { skipped: "not_configured" };
    const { crawlJobId } = job.data;
    const out = await withSpan("crawl-archive.restore", () => restoreCrawl(crawlJobId, store));
    logger.info({ jobId: job.id, crawlJobId, ...out }, "crawl restore done");
    return out;
  }
  const queue = getQueue(CRAWL_ARCHIVE_QUEUE);
  const result = await withSpan("crawl-archive.sweep", () =>
    runArchiveSweep({ store, enabled: archiveEnabled(), dryRun: archiveDryRun(), restorePending: (id) => restorePending(queue, id) }),
  );
  if (result.failed.length) {
    throw new Error(`crawl-archive sweep: ${result.failed.length} crawl(s) failed to archive (${result.failed.map((f) => f.crawlId).join(", ")}); each is back to HOT`);
  }
  return result;
}

let worker: Worker<CrawlArchiveJob> | null = null;

export function startCrawlArchiveWorker(): Worker<CrawlArchiveJob> {
  if (worker) return worker;

  worker = new Worker<CrawlArchiveJob>(CRAWL_ARCHIVE_QUEUE, processCrawlArchiveJob, {
    connection: getSubscriberConnection(),
    prefix: REDIS_CONFIG.queues.prefix,
    concurrency: 1,
    // A sweep of 50 crawls or a 25,000-page restore runs for many minutes
    // between lock renewals' worth of awaits; give the stalled check headroom.
    stalledInterval: 5 * 60_000,
    maxStalledCount: 1,
  });

  void (async () => {
    const queue = getQueue(CRAWL_ARCHIVE_QUEUE);
    try {
      for (const entry of await queue.getRepeatableJobs()) {
        if (sweepScheduleIsCurrent(entry)) continue;
        await queue.removeRepeatableByKey(entry.key);
        logger.warn({ queue: CRAWL_ARCHIVE_QUEUE, name: entry.name, stalePattern: entry.pattern, staleEvery: entry.every }, "removed stale crawl-archive schedule");
      }
      await queue.add(SWEEP_JOB, { kind: "sweep" }, { repeat: { pattern: ARCHIVE_SWEEP_CRON, tz: "UTC" }, priority: 10 });
    } catch (err) {
      logger.error({ err, queue: CRAWL_ARCHIVE_QUEUE }, "failed to schedule the crawl-archive sweep");
    }
  })();

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, name: job?.name, err, queue: CRAWL_ARCHIVE_QUEUE }, "crawl-archive job failed");
  });
  worker.on("error", (err) => {
    logger.error({ err, queue: CRAWL_ARCHIVE_QUEUE }, "crawl-archive worker error");
  });

  logger.info({ queue: CRAWL_ARCHIVE_QUEUE }, "crawl-archive worker started");
  return worker;
}
