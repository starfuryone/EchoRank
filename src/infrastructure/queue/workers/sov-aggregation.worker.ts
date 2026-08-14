/**
 * AI Share of Voice rollup worker.
 *
 * Two jobs on one queue. A repeatable nightly SWEEP finds every prompt set with
 * tracking on and enqueues one ROLLUP each; a rollup reads that set's last 28
 * days of Watcher runs, writes one SovSnapshot row per (brand, engine) for the
 * night, and raises a notification for any engine where the brand's share fell
 * more than five points week over week.
 *
 * READS THE WATCHER, WRITES ONLY ITS OWN TABLE. Nothing in src/lib/ai-monitor/
 * is modified by this feature — not the analyzer, not the scorer, not the
 * metrics rollup. The observations come out of MentionAnalysis and
 * CompetitorMention exactly as the checkup runner left them.
 *
 * SEPARATE QUEUE FROM ai-checkup, for the reason that queue's header gives for
 * being separate from visibility-monitoring: this one spends nothing, runs in
 * seconds, and must not sit behind a backlog of checkups that each take
 * minutes and real money. The dependency runs the other way — this job reads
 * what those wrote — so a slow checkup night delays the numbers by a day
 * rather than blocking the queue.
 *
 * NIGHTLY, AFTER THE CHECKUPS. The tick is at 03:20 UTC: late enough that a
 * day's checkups have landed, early enough that a customer opening the page at
 * breakfast sees last night's window. The rolling window means a missed night
 * is self-healing — the next one recomputes 28 days that overlap it almost
 * entirely, so nothing has to be backfilled by hand.
 */

import { Worker, type Job } from "bullmq";
import { getSubscriberConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import { getQueue, addJob } from "@/infrastructure/queue/registry";
import { logger } from "@/infrastructure/observability/logger";
import type { SovAggregationJob } from "@/infrastructure/queue/jobs/schemas";
import { aggregateSov } from "@/lib/sov/weighting";
import { toObservations } from "@/lib/sov/observations";
import {
  listPromptSets,
  loadWindowRuns,
  utcDay,
  windowStart,
  writeSovSnapshots,
  SOV_WINDOW_DAYS,
} from "@/lib/sov/store";
import { detectShareDrops } from "@/lib/sov/alerts";
import { notifySovShareDrop } from "@/lib/notifications/adapters";

const QUEUE_NAME = "sov-aggregation" as const;
const SWEEP_JOB_NAME = "sweep";
const ROLLUP_JOB_NAME = "rollup";

/** Nightly, after the checkup sweep has had the evening to land its runs. */
const SWEEP_CRON = "20 3 * * *";

/**
 * Prompt sets rolled up at once in this process.
 *
 * Higher than ai-checkup's 2 because nothing here waits on a provider: a rollup
 * is two queries and some arithmetic. The ceiling that matters is the database
 * connection pool, not the CPU.
 */
const CONCURRENCY = 4;

/** Enqueue one rollup per tracked prompt set. */
async function sweep(now: Date): Promise<number> {
  const day = utcDay(now);
  const sets = await listPromptSets();

  for (const set of sets) {
    await addJob<SovAggregationJob>(
      QUEUE_NAME,
      ROLLUP_JOB_NAME,
      {
        promptSetId: set.promptSetId,
        tenantId: set.tenantId,
        date: day.toISOString().slice(0, 10),
      },
      // Keyed on the night, so a sweep that fires twice (a restart, a manual
      // tick) collapses to one rollup per set per day instead of racing two
      // writers on the same unique constraint.
      { jobId: `sov:${set.promptSetId}:${day.toISOString().slice(0, 10)}` },
    );
  }

  logger.info({ queue: QUEUE_NAME, enqueued: sets.length }, "share-of-voice sweep complete");
  return sets.length;
}

/**
 * Roll up one prompt set, then check it for a week-over-week drop.
 *
 * THE DROP CHECK RUNS AFTER THE WRITE, deliberately: it compares tonight's
 * stored snapshot against the one from seven nights ago, so it has to read what
 * this job has just written. Running it first would compare last night to eight
 * nights ago and report yesterday's news every night.
 */
async function rollUpOne(job: SovAggregationJob): Promise<void> {
  const { promptSetId, tenantId } = job;
  if (!promptSetId || !tenantId) {
    throw new Error("rollup job needs both promptSetId and tenantId");
  }

  const day = job.date ? new Date(`${job.date}T00:00:00.000Z`) : utcDay();
  const from = windowStart(day, SOV_WINDOW_DAYS);

  // Re-read the set rather than trusting the job payload for the brand's name
  // and aliases: the payload was written by a sweep that may be hours old, and
  // the brand identity is what decides which observations are ours.
  const sets = await listPromptSets(tenantId);
  const set = sets.find((candidate) => candidate.promptSetId === promptSetId);
  if (!set) {
    logger.warn({ promptSetId, tenantId }, "prompt set vanished or paused before its rollup ran");
    return;
  }

  const runs = await loadWindowRuns(promptSetId, tenantId, from, day);
  const observations = toObservations(runs, set.brand);
  const rows = aggregateSov(observations);

  const written = await writeSovSnapshots(tenantId, promptSetId, day, rows);

  const drops = await detectShareDrops(tenantId, promptSetId, set.brand.name, day);
  for (const drop of drops) {
    await notifySovShareDrop({
      tenantId,
      promptSetId,
      engine: drop.engine,
      before: drop.before,
      after: drop.after,
    });
  }

  logger.info(
    {
      queue: QUEUE_NAME,
      promptSetId,
      tenantId,
      day: day.toISOString().slice(0, 10),
      runs: runs.length,
      observations: observations.length,
      rows: written,
      drops: drops.length,
    },
    "share-of-voice rollup complete",
  );
}

async function processSovAggregationJob(job: Job<SovAggregationJob>): Promise<void> {
  if (job.data.sweep) {
    await sweep(new Date());
    return;
  }
  await rollUpOne(job.data);
}

// ─── Worker Factory ───────────────────────────────────────────────────────────

let worker: Worker<SovAggregationJob> | null = null;

export function startSovAggregationWorker(): Worker<SovAggregationJob> {
  if (worker) return worker;

  worker = new Worker<SovAggregationJob>(QUEUE_NAME, processSovAggregationJob, {
    connection: getSubscriberConnection(),
    prefix: REDIS_CONFIG.queues.prefix,
    concurrency: CONCURRENCY,
  });

  // Repeatable nightly tick. BullMQ dedupes the repeat config across restarts.
  getQueue(QUEUE_NAME)
    .add(
      SWEEP_JOB_NAME,
      { sweep: true },
      {
        repeat: { pattern: SWEEP_CRON, tz: "UTC" },
        removeOnComplete: true,
        removeOnFail: { count: 50 },
      },
    )
    .catch((err) => {
      logger.error({ err, queue: QUEUE_NAME }, "Failed to schedule share-of-voice sweep");
    });

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id, queue: QUEUE_NAME }, "Job completed");
  });
  worker.on("failed", (job, err) => {
    logger.error(
      { jobId: job?.id, attempt: job?.attemptsMade, err, queue: QUEUE_NAME },
      "Job failed",
    );
  });
  worker.on("error", (err) => {
    logger.error({ err, queue: QUEUE_NAME }, "Worker error");
  });

  return worker;
}

export async function stopSovAggregationWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}

export { processSovAggregationJob, sweep, rollUpOne };
