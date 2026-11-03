// Site Crawler worker.
//
// Unlike site-audit.worker.ts, this is NOT a sweep: one job is one crawl, and
// it runs for as long as that crawl takes (up to the one-hour wall clock in
// constants.ts). The queue holds crawls waiting for a slot.
//
// CONCURRENCY 2, box-wide. Each crawl runs up to 4 concurrent fetches at 2
// req/s, so two crawls is 8 sockets and 4 req/s of outbound traffic from a
// shared box — the ceiling this process can carry alongside everything else it
// runs. Raising it is a capacity decision, not a config tweak.
//
// RETENTION rides the same queue: a repeatable "retention" job every 24 h
// (src/lib/site-crawler/retention.ts). It occupies one of the two slots for
// the minutes it takes, at a time the queue is usually empty.
//
// The job carries only ids. Everything else is read from the CrawlJob row, so
// a job that sat in the queue across a deploy still crawls with the cap it was
// created with rather than one baked into the payload.

import { Worker, type Job, type Queue } from "bullmq";
import { getQueue } from "@/infrastructure/queue/registry";
import { getSubscriberConnection, createNewConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import type { SiteCrawlJob, SiteCrawlRetentionJob } from "@/infrastructure/queue/jobs/schemas";
import { runCrawl } from "@/lib/site-crawler/runner";
import { runCrawlRetention } from "@/lib/site-crawler/retention";
import { CRAWL_JOB_CONCURRENCY } from "@/lib/site-crawler/constants";
import { logger } from "@/infrastructure/observability/logger";
import { withSpan } from "@/infrastructure/observability/telemetry";
import type Redis from "ioredis";

const QUEUE_NAME = "site-crawl";
export const RETENTION_JOB_NAME = "retention";
/** Numeric, and a constant: BullMQ keys a repeatable job by its interval. */
export const RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000;

type SiteCrawlQueueJob = SiteCrawlJob | SiteCrawlRetentionJob;

/**
 * A dedicated connection for frontier operations.
 *
 * NOT the subscriber connection BullMQ is using: the crawl issues thousands of
 * SADD/LPOP commands over an hour, and sharing the connection the worker uses
 * to claim jobs would put that traffic behind the same socket that BullMQ needs
 * responsive to keep its lock.
 */
let frontierRedis: Redis | null = null;
function getFrontierRedis(): Redis {
  if (!frontierRedis) frontierRedis = createNewConnection("site-crawl-frontier");
  return frontierRedis;
}

async function processSiteCrawlJob(job: Job<SiteCrawlQueueJob>): Promise<void> {
  if (job.name === RETENTION_JOB_NAME || "retention" in job.data) {
    await withSpan("site-crawl.retention", () => runCrawlRetention());
    return;
  }
  const { crawlJobId } = job.data;
  if (!crawlJobId) {
    logger.warn({ jobId: job.id, queue: QUEUE_NAME }, "site-crawl job without crawlJobId");
    return;
  }

  await withSpan("site-crawl.process", async () => {
    // runCrawl owns its own try/finally and always writes a terminal status,
    // so a throw here means the row is already FAILED — this only surfaces it
    // to BullMQ for the failed-job log.
    const outcome = await runCrawl({ jobId: crawlJobId, redis: getFrontierRedis() });
    logger.info({ jobId: job.id, crawlJobId, ...outcome }, "site-crawl job done");
  });
}

type RepeatableQueue = Pick<Queue, "getRepeatableJobs" | "removeRepeatableByKey" | "add">;

/**
 * Register the nightly retention job, pruning stale schedules first. `every`
 * comes back from Redis as a STRING: compared as a number, or the prune
 * deletes the schedule it was meant to keep (the SERP poller's bug).
 */
export async function scheduleRetention(queue: RepeatableQueue): Promise<void> {
  for (const r of await queue.getRepeatableJobs()) {
    if (r.name === RETENTION_JOB_NAME && Number(r.every) === RETENTION_INTERVAL_MS) continue;
    await queue.removeRepeatableByKey(r.key);
    logger.warn({ queue: QUEUE_NAME, key: r.key, every: r.every }, "removed stale site-crawl repeatable schedule");
  }
  await queue.add(
    RETENTION_JOB_NAME,
    { retention: true },
    { repeat: { every: RETENTION_INTERVAL_MS }, removeOnComplete: true, removeOnFail: { count: 20 } },
  );
}

let worker: Worker<SiteCrawlQueueJob> | null = null;

export function startSiteCrawlWorker(): Worker<SiteCrawlQueueJob> {
  if (worker) return worker;

  worker = new Worker<SiteCrawlQueueJob>(QUEUE_NAME, processSiteCrawlJob, {
    connection: getSubscriberConnection(),
    prefix: REDIS_CONFIG.queues.prefix,
    concurrency: CRAWL_JOB_CONCURRENCY,
    // A crawl can legitimately run for an hour without BullMQ hearing from it
    // between batches. The default 30s lock would be renewed fine, but the
    // stalled check needs headroom for a slow batch on a slow site.
    stalledInterval: 5 * 60_000,
    maxStalledCount: 1,
  });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err, queue: QUEUE_NAME }, "site-crawl job failed");
  });
  worker.on("error", (err) => {
    logger.error({ err, queue: QUEUE_NAME }, "site-crawl worker error");
  });

  void scheduleRetention(getQueue(QUEUE_NAME)).catch((err) =>
    logger.error({ err, queue: QUEUE_NAME }, "failed to schedule site-crawl retention"),
  );

  logger.info({ queue: QUEUE_NAME, concurrency: CRAWL_JOB_CONCURRENCY }, "site-crawl worker started");
  return worker;
}
