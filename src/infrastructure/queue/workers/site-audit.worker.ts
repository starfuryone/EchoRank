// Site Audit crawl poller.
//
// A repeatable 60 s tick that advances every in-flight OnPage crawl: reads
// progress while it runs, then stores the summary, issues and page rows when
// crawl_progress turns "finished".
//
// This is deliberately NOT part of the standard-queue sweep in
// serp-check.worker.ts — OnPage is a different protocol with a real
// mid-flight progress state and a two-call completion. The reasoning, and why
// the two pollers cannot collide, is documented at the top of
// src/lib/site-audit/poll.ts.
//
// Every call this worker makes (on_page/summary, on_page/pages) is free at
// DataForSEO; the crawl's per-page charge is on the task itself.

import { Worker, type Job } from "bullmq";
import { getSubscriberConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import type { SiteAuditJob } from "@/infrastructure/queue/jobs/schemas";
import { getQueue } from "@/infrastructure/queue/registry";
import { processSiteAuditSweep } from "@/lib/site-audit/poll";
import { logger } from "@/infrastructure/observability/logger";
import { withSpan } from "@/infrastructure/observability/telemetry";

const QUEUE_NAME = "site-audit";
const SWEEP_JOB_NAME = "sweep";
const SWEEP_INTERVAL_MS = 60_000;

async function processSiteAuditJob(job: Job<SiteAuditJob>): Promise<void> {
  await withSpan("site-audit.process", async () => {
    if (job.data.sweep) return processSiteAuditSweep();
    logger.warn({ jobId: job.id, queue: QUEUE_NAME }, "site-audit job without sweep flag");
  });
}

let worker: Worker<SiteAuditJob> | null = null;

export function startSiteAuditWorker(): Worker<SiteAuditJob> {
  if (worker) return worker;

  // Concurrency 1: two overlapping sweeps would poll the same crawl twice and
  // race each other's status writes.
  worker = new Worker<SiteAuditJob>(QUEUE_NAME, processSiteAuditJob, {
    connection: getSubscriberConnection(),
    prefix: REDIS_CONFIG.queues.prefix,
    concurrency: 1,
  });

  // Repeatable sweep. BullMQ dedupes the repeat config across restarts.
  getQueue(QUEUE_NAME)
    .add(
      SWEEP_JOB_NAME,
      { sweep: true },
      {
        repeat: { every: SWEEP_INTERVAL_MS },
        removeOnComplete: true,
        removeOnFail: { count: 50 },
      },
    )
    .catch((err) => {
      logger.error({ err, queue: QUEUE_NAME }, "Failed to schedule site-audit sweep");
    });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err, queue: QUEUE_NAME }, "site-audit sweep failed");
  });
  worker.on("error", (err) => {
    logger.error({ err, queue: QUEUE_NAME }, "site-audit worker error");
  });

  return worker;
}
