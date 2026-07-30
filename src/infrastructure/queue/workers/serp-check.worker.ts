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
// 30s. The sweep's own reads are unbilled — tasks_ready costs $0 and task_get
// only echoes the charge already taken at task_post — so halving the interval
// halves the wait a SERP Checker user stares at without adding a cent. The floor
// is DataForSEO's own turnaround (minutes, not seconds), not our polling rate.
const SWEEP_INTERVAL_MS = 30_000;

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

  // Repeatable sweep.
  //
  // BullMQ dedupes a repeat config that is IDENTICAL across restarts, but its
  // repeat key includes the interval — so changing SWEEP_INTERVAL_MS does not
  // replace the old schedule, it ADDS a second one and the queue quietly sweeps
  // on both. That happened moving this from 60s to 30s: both were live until the
  // stale entry was deleted by hand. Pruning first makes the interval a normal
  // thing to edit instead of a two-step deploy.
  //
  // `every` comes back from Redis as a STRING, so compare it as a number —
  // `r.every !== SWEEP_INTERVAL_MS` is true for "30000" and deletes the schedule
  // it was meant to keep.
  void (async () => {
    const queue = getQueue(QUEUE_NAME);
    try {
      for (const r of await queue.getRepeatableJobs()) {
        if (r.name !== SWEEP_JOB_NAME) continue;
        if (Number(r.every) === SWEEP_INTERVAL_MS) continue;
        await queue.removeRepeatableByKey(r.key);
        logger.warn(
          { queue: QUEUE_NAME, staleEvery: r.every, every: SWEEP_INTERVAL_MS },
          "removed stale standard-queue sweep schedule",
        );
      }
      await queue.add(
        SWEEP_JOB_NAME,
        { sweep: true },
        {
          repeat: { every: SWEEP_INTERVAL_MS },
          removeOnComplete: true,
          removeOnFail: { count: 50 },
        },
      );
    } catch (err) {
      logger.error({ err, queue: QUEUE_NAME }, "Failed to schedule standard-queue sweep");
    }
  })();

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err, queue: QUEUE_NAME }, "Standard-queue sweep failed");
  });
  worker.on("error", (err) => {
    logger.error({ err, queue: QUEUE_NAME }, "Standard-queue worker error");
  });

  return worker;
}
