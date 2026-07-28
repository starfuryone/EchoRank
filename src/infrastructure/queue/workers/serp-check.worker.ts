// Standard-queue completion worker.
//
// Despite the file/queue name (kept as `serp-checks` because renaming a BullMQ
// queue orphans its repeatable job in Redis), this sweep now drains DataForSEO's
// standard queue for EVERY feature that uses it — SERP Checker and Rank Tracker
// today.
//
// It must stay the single reader of tasks_ready: that endpoint is a drain, so a
// second poller would silently consume ids belonging to the first. The dispatch
// logic lives in src/lib/dataforseo/standard-queue.ts; the owners are registered
// below. To add a feature, write a StandardQueueOwner and add it to OWNERS — do
// not start another sweep.
//
// Every call the sweep makes (tasks_ready, task_get) is free at DataForSEO, so
// this worker never meters. The only billed calls are the task_posts that
// created the rows.

import { Worker, type Job } from "bullmq";
import { getSubscriberConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import type { SerpCheckJob } from "@/infrastructure/queue/jobs/schemas";
import { getQueue } from "@/infrastructure/queue/registry";
import {
  sweepStandardQueue,
  type StandardQueueOwner,
} from "@/lib/dataforseo/standard-queue";
import { serpCheckOwner } from "@/lib/serp/task-owner";
import { rankSnapshotOwner } from "@/lib/rank-tracker/task-owner";
import { logger } from "@/infrastructure/observability/logger";
import { withSpan } from "@/infrastructure/observability/telemetry";

const QUEUE_NAME = "serp-checks";
const SWEEP_JOB_NAME = "sweep";
const SWEEP_INTERVAL_MS = 60_000;

/** Everything that parks rows on DataForSEO's standard queue. */
const OWNERS: readonly StandardQueueOwner[] = [serpCheckOwner, rankSnapshotOwner];

/** Exported for the e2e scripts and for ops, which occasionally needs to force
 * a drain without waiting for the next tick. */
export async function processSweep(): Promise<void> {
  await sweepStandardQueue(OWNERS);
}

async function processSerpCheckJob(job: Job<SerpCheckJob>): Promise<void> {
  await withSpan("serp-checks.process", async () => {
    if (job.data.sweep) return processSweep();
    logger.warn({ jobId: job.id, queue: QUEUE_NAME }, "SERP job without sweep flag");
  });
}

// ─── Worker Factory ───────────────────────────────────────────────────────────

let worker: Worker<SerpCheckJob> | null = null;

export function startSerpCheckWorker(): Worker<SerpCheckJob> {
  if (worker) return worker;

  // Concurrency 1: sweeps must not overlap, or two ticks race for the same
  // ready ids and one of them collects nothing.
  worker = new Worker<SerpCheckJob>(QUEUE_NAME, processSerpCheckJob, {
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
      logger.error({ err, queue: QUEUE_NAME }, "Failed to schedule standard-queue sweep");
    });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err, queue: QUEUE_NAME }, "Standard-queue sweep failed");
  });
  worker.on("error", (err) => {
    logger.error({ err, queue: QUEUE_NAME }, "Standard-queue worker error");
  });

  return worker;
}
