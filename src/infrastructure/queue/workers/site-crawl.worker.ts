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
// The job carries only ids. Everything else is read from the CrawlJob row, so
// a job that sat in the queue across a deploy still crawls with the cap it was
// created with rather than one baked into the payload.

import { Worker, type Job } from "bullmq";
import { getSubscriberConnection, createNewConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import type { SiteCrawlJob } from "@/infrastructure/queue/jobs/schemas";
import { runCrawl } from "@/lib/site-crawler/runner";
import { CRAWL_JOB_CONCURRENCY } from "@/lib/site-crawler/constants";
import { logger } from "@/infrastructure/observability/logger";
import { withSpan } from "@/infrastructure/observability/telemetry";
import type Redis from "ioredis";

const QUEUE_NAME = "site-crawl";

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

async function processSiteCrawlJob(job: Job<SiteCrawlJob>): Promise<void> {
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

let worker: Worker<SiteCrawlJob> | null = null;

export function startSiteCrawlWorker(): Worker<SiteCrawlJob> {
  if (worker) return worker;

  worker = new Worker<SiteCrawlJob>(QUEUE_NAME, processSiteCrawlJob, {
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

  logger.info({ queue: QUEUE_NAME, concurrency: CRAWL_JOB_CONCURRENCY }, "site-crawl worker started");
  return worker;
}
