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
// SCHEDULES (Phase 4c) ride it too: one repeatable "schedule" job per enabled
// crawl_schedules row, keyed crawl-schedule-<id>. A tick only creates a crawl
// row and enqueues it, so it holds a slot for milliseconds. A crawl a
// schedule started carries scheduleId, and its completion hook (compare with
// the last run, then the exports) runs here after runCrawl.
//
// METRICS (Phase 4d) ride it too: a completed crawl that opted into PageSpeed
// or backlink metrics gets a "metrics" job, which does a few minutes of work
// and re-queues itself (delayed while the Lighthouse allowance refills) until
// done — so it never holds one of the two slots for long.
//
// The job carries only ids. Everything else is read from the CrawlJob row, so
// a job that sat in the queue across a deploy still crawls with the cap it was
// created with rather than one baked into the payload.

import { DelayedError, Worker, type Job, type Queue } from "bullmq";
import { crawlMaxConcurrent, FAIR_SHARE_RETRY_MS, tenantHasCrawlSlot } from "@/lib/site-crawler/tenant-caps";
import { addJob, getQueue } from "@/infrastructure/queue/registry";
import { METRICS_JOB_NAME, needsMetrics, runCrawlMetrics } from "@/lib/site-crawler/metrics-runner";
import { getSubscriberConnection, createNewConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import type { SiteCrawlCallbackJob, SiteCrawlJob, SiteCrawlMetricsJob, SiteCrawlRetentionJob, SiteCrawlScheduleJob } from "@/infrastructure/queue/jobs/schemas";
import { CALLBACK_JOB_NAME, deliverCrawlCallback, type CallbackDeps } from "@/lib/site-crawler/callback";
import { runCrawl } from "@/lib/site-crawler/runner";
import { runCrawlRetention } from "@/lib/site-crawler/retention";
import { prisma } from "@/lib/prisma";
import { afterScheduledCrawl, runScheduledCrawl, syncAllRepeatables } from "@/lib/site-crawler/schedule-service";
import { SCHEDULE_JOB_NAME } from "@/lib/site-crawler/schedule";
import { sendScheduledCrawlEmail } from "@/lib/site-crawler/schedule-email";
import { exportScheduledToSheets } from "@/lib/site-crawler/sheets";
import { logger } from "@/infrastructure/observability/logger";
import { withSpan } from "@/infrastructure/observability/telemetry";
import type Redis from "ioredis";

const QUEUE_NAME = "site-crawl";
export const RETENTION_JOB_NAME = "retention";
/** Numeric, and a constant: BullMQ keys a repeatable job by its interval. */
export const RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000;

type SiteCrawlQueueJob = SiteCrawlJob | SiteCrawlRetentionJob | SiteCrawlScheduleJob | SiteCrawlMetricsJob | SiteCrawlCallbackJob;

/** Phase 3d-A: the public API's completion callback; its one retry rides this queue. */
const CALLBACK_DEPS: CallbackDeps = {
  fetch: (...a) => fetch(...a),
  retry: (crawlJobId, delayMs) => addJob("site-crawl", CALLBACK_JOB_NAME, { crawlJobId, callback: true, attempt: 2 }, { delay: delayMs }),
};

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

async function processSiteCrawlJob(job: Job<SiteCrawlQueueJob>, token?: string): Promise<void> {
  if (job.name === RETENTION_JOB_NAME || "retention" in job.data) {
    await withSpan("site-crawl.retention", () => runCrawlRetention());
    return;
  }
  if (job.name === METRICS_JOB_NAME && "metrics" in job.data) {
    const { crawlJobId } = job.data;
    const tick = await withSpan("site-crawl.metrics", () => runCrawlMetrics(crawlJobId));
    if (!tick.done) await addJob("site-crawl", METRICS_JOB_NAME, { crawlJobId, metrics: true }, { delay: tick.delayMs });
    return;
  }
  if (job.name === CALLBACK_JOB_NAME && "callback" in job.data) {
    const outcome = await deliverCrawlCallback(job.data.crawlJobId, 2, CALLBACK_DEPS);
    logger.info({ jobId: job.id, crawlJobId: job.data.crawlJobId, outcome }, "site-crawl callback retry");
    return;
  }
  if (job.name === SCHEDULE_JOB_NAME && !("crawlJobId" in job.data)) {
    const { scheduleId } = job.data as SiteCrawlScheduleJob;
    const outcome = await withSpan("site-crawl.schedule", () => runScheduledCrawl(scheduleId));
    logger.info({ jobId: job.id, scheduleId, ...outcome }, "site-crawl schedule tick");
    return;
  }
  const { crawlJobId, scheduleId, tenantId } = job.data as SiteCrawlJob;
  if (!crawlJobId) {
    logger.warn({ jobId: job.id, queue: QUEUE_NAME }, "site-crawl job without crawlJobId");
    return;
  }

  // Fair share (tenant-caps.ts): a tenant already at its simultaneous-crawl
  // limit waits, so one workspace cannot hold every slot. The crawl stays
  // QUEUED and is picked up again in FAIR_SHARE_RETRY_MS.
  if (tenantId && !(await tenantHasCrawlSlot(tenantId, crawlJobId))) {
    await job.moveToDelayed(Date.now() + FAIR_SHARE_RETRY_MS, token);
    logger.info({ jobId: job.id, crawlJobId, tenantId }, "site-crawl held back: tenant at its concurrency");
    throw new DelayedError();
  }

  await withSpan("site-crawl.process", async () => {
    // runCrawl owns its own try/finally and always writes a terminal status,
    // so a throw here means the row is already FAILED — this only surfaces it
    // to BullMQ for the failed-job log.
    const outcome = await runCrawl({ jobId: crawlJobId, redis: getFrontierRedis() });
    logger.info({ jobId: job.id, crawlJobId, ...outcome }, "site-crawl job done");
    if (outcome.status === "COMPLETED") {
      const row = await prisma.crawlJob.findUnique({ where: { id: crawlJobId }, select: { config: true } });
      if (needsMetrics(row?.config)) await addJob("site-crawl", METRICS_JOB_NAME, { crawlJobId, metrics: true });
    }
    // Phase 3d-A: a public-API crawl with a callbackUrl tells its caller, whatever the outcome.
    await deliverCrawlCallback(crawlJobId, 1, CALLBACK_DEPS).catch((err) =>
      logger.error({ err, crawlJobId, queue: QUEUE_NAME }, "crawl callback failed"),
    );
    if (scheduleId) {
      // After the crawl's own terminal write; its failure never fails the crawl.
      await afterScheduledCrawl(scheduleId, crawlJobId, SCHEDULE_HOOKS).catch((err) =>
        logger.error({ err, scheduleId, crawlJobId, queue: QUEUE_NAME }, "scheduled crawl completion hook failed"),
      );
    }
  });
}

type RepeatableQueue = Pick<Queue, "getRepeatableJobs" | "removeRepeatableByKey" | "add">;

/** What a scheduled crawl does on completion besides comparing (each gated by its flag in afterScheduledCrawl). */
const SCHEDULE_HOOKS = { email: sendScheduledCrawlEmail, sheets: exportScheduledToSheets };

/**
 * Register the nightly retention job and one repeatable per enabled schedule,
 * pruning everything else first. `every` comes back from Redis as a STRING:
 * compared as a number, or the prune deletes the schedule it was meant to
 * keep (the SERP poller's bug). Schedules are matched by key and pattern.
 */
export async function scheduleRetention(
  queue: RepeatableQueue,
  schedules: { id: string; cadence: string; hourUtc: number; enabled: boolean }[] = [],
): Promise<void> {
  await syncAllRepeatables(queue, { name: RETENTION_JOB_NAME, every: RETENTION_INTERVAL_MS }, schedules);
}

let worker: Worker<SiteCrawlQueueJob> | null = null;

export function startSiteCrawlWorker(): Worker<SiteCrawlQueueJob> {
  if (worker) return worker;

  worker = new Worker<SiteCrawlQueueJob>(QUEUE_NAME, processSiteCrawlJob, {
    connection: getSubscriberConnection(),
    prefix: REDIS_CONFIG.queues.prefix,
    concurrency: crawlMaxConcurrent(),
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

  void prisma.crawlSchedule
    .findMany({ select: { id: true, cadence: true, hourUtc: true, enabled: true } })
    .then((schedules) => scheduleRetention(getQueue(QUEUE_NAME), schedules))
    .catch((err) => logger.error({ err, queue: QUEUE_NAME }, "failed to schedule site-crawl repeatables"));

  logger.info({ queue: QUEUE_NAME, concurrency: crawlMaxConcurrent() }, "site-crawl worker started");
  return worker;
}

/** For tests: the job processor (fair share, callback, dispatch). */
export const __testing = { processSiteCrawlJob };
