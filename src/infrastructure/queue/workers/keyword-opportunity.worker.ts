/**
 * Keyword Opportunity Finder worker.
 *
 * Two jobs on one queue. A RUN drives one domain analysis through the five
 * steps; a repeatable SWEEP reaps analyses that started and never finished.
 *
 * ── ONE ATTEMPT, LIKE rank-tracker AND citation-opportunities ───────────────
 *
 * The job posts real money upstream: two DataForSEO Labs calls and up to
 * thirty-one Haiku calls. NONE of it is idempotent — a retry re-buys discovery
 * and re-asks every question, and the rows the first attempt wrote are still
 * there, so a second attempt would double both the bill and the keyword set.
 * The retry policy therefore lives in DEFAULT_JOB_OPTIONS as `attempts: 1`, and
 * a failed analysis is visible in the UI, consumed no allowance, and is one
 * click to re-run.
 *
 * ── THE SWEEP IS A REAPER, NOT A SCHEDULER ─────────────────────────────────
 *
 * Nothing here runs analyses on a schedule. A domain analysis happens because
 * somebody pressed a button — scheduled re-runs and retest automation ride the
 * Watcher, which is priced for repetition. All the sweep does is find RUNNING
 * rows whose worker died and mark them FAILED, so a customer is looking at an
 * error they can act on rather than a spinner that never resolves.
 *
 * Reaped rather than resumed, deliberately: the steps are not idempotent (see
 * above), so resuming would re-buy whatever the dead process had already paid
 * for. Re-running is the customer's call, and it costs them nothing to make
 * because the reaped row consumed no allowance.
 */

import { Worker, type Job } from "bullmq";
import { getSubscriberConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import { getQueue, addJob } from "@/infrastructure/queue/registry";
import { logger } from "@/infrastructure/observability/logger";
import { runAnalysis } from "@/lib/keyword-opportunity/runner";
import { markFailed, staleRunningIds } from "@/lib/keyword-opportunity/store";
import { releaseCredit } from "@/lib/keyword-opportunity/credits";
import { prisma } from "@/lib/prisma";

const QUEUE_NAME = "keyword-opportunity" as const;
const SWEEP_JOB_NAME = "sweep";
const RUN_JOB_NAME = "run-analysis";

/** Every fifteen minutes. The reaper's own resolution, not the timeout. */
const SWEEP_CRON = "*/15 * * * *";

/**
 * How long a RUNNING row may sit before it is presumed dead.
 *
 * Roughly twice the expected duration with a fifteen-minute floor, the watcher
 * pattern. A full analysis is two Labs calls plus up to thirty-one Haiku calls
 * issued one at a time — call it five minutes on a bad day, so ten — and the
 * floor is what stops a slow provider minute from reaping a healthy run. Being
 * generous here is cheap: the cost of reaping late is a spinner for a few extra
 * minutes, and the cost of reaping early is killing a run the customer paid
 * for while it is still working.
 */
export const STALE_AFTER_MS = Math.max(15 * 60_000, 2 * 5 * 60_000);

/**
 * Analyses running at once in this process.
 *
 * Two, matching ai-checkup. Each holds a long sequence of provider calls open
 * rather than any real CPU, but each also occupies a connection for the
 * duration of its writes, and the pool is the ceiling that matters on this box.
 */
const CONCURRENCY = 2;

export interface KeywordOpportunityJob {
  /** The repeatable reaper tick. */
  sweep?: boolean;
  /** A single analysis. */
  analysisId?: string;
}

/**
 * Mark abandoned runs failed and hand back any credit they held.
 *
 * Returns the number reaped so the tick can log a number rather than a fact.
 */
export async function reapStale(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - STALE_AFTER_MS);
  const ids = await staleRunningIds(cutoff);

  for (const id of ids) {
    const row = await prisma.keywordOpportunityAnalysis.findUnique({
      where: { id },
      select: { tenantId: true },
    });
    await markFailed(id, {
      error: "the analysis stopped responding and was closed by the sweep",
    });
    if (row) await releaseCredit(row.tenantId, id);
    logger.warn({ analysisId: id, queue: QUEUE_NAME }, "reaped stale domain analysis");
  }

  return ids.length;
}

export async function processKeywordOpportunityJob(
  job: Job<KeywordOpportunityJob>,
): Promise<{ reaped?: number; analysisId?: string; status?: string }> {
  if (job.data.sweep) {
    return { reaped: await reapStale() };
  }

  const analysisId = job.data.analysisId;
  if (!analysisId) throw new Error("keyword-opportunity job has neither sweep nor analysisId");

  const summary = await runAnalysis(analysisId);
  logger.info(
    {
      analysisId,
      status: summary.status,
      keywords: summary.keywordCount,
      aiTested: summary.aiTestedCount,
      dataforseoUsd: summary.dataforseoCostUsd,
      aiUsd: summary.aiCostUsd,
      stoppedReason: summary.stoppedReason,
    },
    "domain analysis finished",
  );
  return { analysisId, status: summary.status };
}

/** Enqueue one analysis. Called by the route that created the row. */
export async function enqueueAnalysis(analysisId: string): Promise<void> {
  await addJob<KeywordOpportunityJob>(QUEUE_NAME, RUN_JOB_NAME, { analysisId });
}

let worker: Worker<KeywordOpportunityJob> | null = null;

export function startKeywordOpportunityWorker(): Worker<KeywordOpportunityJob> {
  if (worker) return worker;

  worker = new Worker<KeywordOpportunityJob>(QUEUE_NAME, processKeywordOpportunityJob, {
    connection: getSubscriberConnection(),
    prefix: REDIS_CONFIG.queues.prefix,
    concurrency: CONCURRENCY,
  });

  // Repeatable reaper tick. BullMQ dedupes the repeat config across restarts.
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
      logger.error({ err, queue: QUEUE_NAME }, "Failed to schedule keyword-opportunity sweep");
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

export async function stopKeywordOpportunityWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}
