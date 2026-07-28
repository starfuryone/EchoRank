// Rank Tracker scheduler + run worker.
//
// Two job shapes on one queue:
//   { schedule: true }      — the daily tick: pick due projects, post them
//   { projectId: "..." }    — a manual "Run now" from the UI
//
// Both funnel into runProject(), so the plan gates, the monthly check
// reservation and the metering are identical whether a run was scheduled or
// clicked. There is deliberately no separate manual path to drift out of sync.
//
// This worker only POSTS tasks. Collection is the shared standard-queue sweep
// in serp-check.worker.ts, which routes finished ids to RankSnapshot — see
// src/lib/dataforseo/standard-queue.ts for why that must stay a single reader.

import { Worker, type Job } from "bullmq";
import { getSubscriberConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import type { RankTrackerJob } from "@/infrastructure/queue/jobs/schemas";
import { getQueue } from "@/infrastructure/queue/registry";
import { prisma } from "@/lib/prisma";
import { runProject } from "@/lib/rank-tracker/service";
import { selectDueProjects } from "@/lib/rank-tracker/schedule";
import { SCHEDULE_HOUR_UTC } from "@/lib/rank-tracker/options";
import { logger } from "@/infrastructure/observability/logger";
import { withSpan } from "@/infrastructure/observability/telemetry";

const QUEUE_NAME = "rank-tracker";
const SCHEDULE_JOB_NAME = "daily-schedule";

/** Projects examined per tick. Well above any plausible tenant count today;
 * raising it is cheaper than paging, and the log line below makes a truncated
 * sweep visible rather than silent. */
const SCHEDULE_BATCH = 500;

/**
 * The daily tick.
 *
 * Selection is deliberately split: Postgres filters to `active` projects (a
 * cheap indexed scan), then the pure `selectDueProjects` applies the cadence
 * rule — weekly projects fire on their createdAt weekday, and nothing runs
 * twice in one UTC day. Keeping the date logic pure is what makes it testable
 * without waiting a week.
 *
 * A project that throws (over quota, upstream down) must not stop the rest, so
 * each run is isolated.
 */
export async function processSchedule(now = new Date()): Promise<void> {
  const active = await prisma.rankProject.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
    take: SCHEDULE_BATCH,
    select: { id: true, frequency: true, active: true, createdAt: true, lastRunAt: true },
  });

  if (active.length === SCHEDULE_BATCH) {
    logger.warn(
      { batch: SCHEDULE_BATCH, queue: QUEUE_NAME },
      "rank-tracker schedule hit its batch cap — some projects were not considered",
    );
  }

  const due = selectDueProjects(active, now);
  logger.info(
    { active: active.length, due: due.length, queue: QUEUE_NAME },
    "rank-tracker schedule tick",
  );

  let posted = 0;
  let skipped = 0;
  for (const project of due) {
    try {
      const result = await runProject(project.id, now);
      posted += result.posted;
    } catch (err) {
      // Over-quota and over-cap projects are expected outcomes, not incidents:
      // runProject flags them and the UI explains. Log and carry on.
      skipped++;
      logger.warn(
        { projectId: project.id, err, queue: QUEUE_NAME },
        "rank-tracker scheduled run skipped",
      );
    }
  }

  logger.info({ posted, skipped, queue: QUEUE_NAME }, "rank-tracker schedule complete");
}

async function processRankTrackerJob(job: Job<RankTrackerJob>): Promise<void> {
  await withSpan("rank-tracker.process", async () => {
    if (job.data.schedule) return processSchedule();
    if (job.data.projectId) {
      const result = await runProject(job.data.projectId);
      logger.info({ ...result, queue: QUEUE_NAME }, "rank-tracker manual run complete");
      return;
    }
    logger.warn({ jobId: job.id, queue: QUEUE_NAME }, "rank-tracker job with no work");
  });
}

// ─── Worker Factory ───────────────────────────────────────────────────────────

let worker: Worker<RankTrackerJob> | null = null;

export function startRankTrackerWorker(): Worker<RankTrackerJob> {
  if (worker) return worker;

  // Concurrency 1: two overlapping runs of the same project would double-post
  // its keywords, and the daily tick has no reason to be parallel.
  worker = new Worker<RankTrackerJob>(QUEUE_NAME, processRankTrackerJob, {
    connection: getSubscriberConnection(),
    prefix: REDIS_CONFIG.queues.prefix,
    concurrency: 1,
  });

  // Repeatable daily tick at a fixed UTC hour. BullMQ dedupes the repeat config
  // across restarts, so this is safe to call on every boot.
  getQueue(QUEUE_NAME)
    .add(
      SCHEDULE_JOB_NAME,
      { schedule: true },
      {
        repeat: { pattern: `0 ${SCHEDULE_HOUR_UTC} * * *`, tz: "UTC" },
        removeOnComplete: true,
        removeOnFail: { count: 50 },
      },
    )
    .catch((err) => {
      logger.error({ err, queue: QUEUE_NAME }, "Failed to schedule rank-tracker tick");
    });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err, queue: QUEUE_NAME }, "rank-tracker job failed");
  });
  worker.on("error", (err) => {
    logger.error({ err, queue: QUEUE_NAME }, "rank-tracker worker error");
  });

  return worker;
}
