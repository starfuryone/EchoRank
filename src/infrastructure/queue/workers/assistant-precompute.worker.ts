/**
 * Pro AI Assistant precompute worker (Phase 7).
 *
 * Two jobs on one queue, the same sweep/rollup shape citation-aggregation and
 * sov-aggregation use: a repeatable tick finds the tenants worth summarising
 * and enqueues one job each, so a tenant with a very large prompt-run history
 * cannot hold up everybody else's night.
 *
 * ── WHY 07:15 UTC ──────────────────────────────────────────────────────────
 * After every ingestion this summary reads from, not before:
 *
 *   prompt runs          ai-checkup.worker, sweeps through the night
 *   visibility audits    visibility-monitoring.worker, 15-minute due sweep
 *   competitor snapshots signals.worker, daily at 06:30 UTC
 *
 * Running at 03:00 would summarise yesterday's competitor rows every single
 * night and nobody would notice, because the numbers would look plausible.
 * Forty-five minutes behind the competitor sweep is enough slack for it to
 * finish and cheap to give.
 *
 * ── THE REPEATABLE-JOB TRAP, HANDLED ───────────────────────────────────────
 * BullMQ dedupes a repeat config that is IDENTICAL across restarts, but its
 * repeat key INCLUDES the schedule. Changing the schedule therefore does not
 * replace the old entry, it ADDS a second one, and the queue quietly ticks on
 * both — which is exactly how serp-check.worker.ts ended up sweeping on a 60 s
 * and a 30 s schedule at the same time until someone deleted the stale key by
 * hand. Pruning first makes the schedule a normal thing to edit.
 *
 * `every` comes back from Redis as a STRING, so it is compared as a NUMBER.
 * `entry.every !== INTERVAL_MS` is true for "3600000" and would delete the
 * schedule it was meant to keep. This queue is on a cron `pattern` rather than
 * an interval, but both shapes are pruned: a future edit that swaps one for the
 * other is precisely when the stale entry would otherwise survive.
 *
 * ── NOTHING HERE IS BOUGHT ─────────────────────────────────────────────────
 * Pure reads over rows this product already stores, plus one Redis SET. No
 * model call, no sidecar call, no DataForSEO task. A missed night costs one
 * stale summary, which carries its own `computedAt` and is labelled as such
 * where it is read.
 */

import { Worker, type Job } from "bullmq";
import { getSubscriberConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import { getQueue, addJob } from "@/infrastructure/queue/registry";
import { logger } from "@/infrastructure/observability/logger";
import { prisma } from "@/lib/prisma";
import type { AssistantPrecomputeJob } from "@/infrastructure/queue/jobs/schemas";
import { computeIntelligence, writeIntelligence } from "@/lib/assistant/pro/precompute";

const QUEUE_NAME = "assistant-precompute" as const;
const SWEEP_JOB_NAME = "sweep";
const TENANT_JOB_NAME = "tenant";

/** Nightly, behind the checkups, the audit sweep and the competitor sweep. */
const SWEEP_CRON = "15 7 * * *";

/**
 * Tenants summarised at once in this process.
 *
 * Low because each summary holds three result sets in memory at the same time
 * and the ceiling that matters is the connection pool, not CPU.
 */
const CONCURRENCY = 2;

/** How far back a tenant must have activity to be worth summarising. */
const ACTIVE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Tenants with something to summarise.
 *
 * SCOPED TO RECENT ACTIVITY rather than "every tenant": a summary of an account
 * that has run nothing for a year is three queries producing a row of zeroes,
 * and the assistant already has a correct answer for the absent case ("no
 * weekly summary has been computed for this account yet"). Distinct on
 * prompt_runs because that is the table the summary is mostly about.
 */
export async function activeTenantIds(now: Date = new Date()): Promise<string[]> {
  const since = new Date(now.getTime() - ACTIVE_WINDOW_MS);
  const rows = await prisma.promptRun.findMany({
    where: { createdAt: { gte: since } },
    distinct: ["tenantId"],
    select: { tenantId: true },
  });
  return rows.map((row) => row.tenantId);
}

/** Enqueue one summary per active tenant. */
export async function sweep(): Promise<number> {
  const tenantIds = await activeTenantIds();

  for (const tenantId of tenantIds) {
    await addJob<AssistantPrecomputeJob>(
      QUEUE_NAME,
      TENANT_JOB_NAME,
      { tenantId },
      // Keyed on the tenant and the day: two summaries for one tenant on one
      // night must never run concurrently (they would race on the same Redis
      // key and one would win arbitrarily), and a jobId that already exists is
      // dropped by BullMQ — which is exactly the mutual exclusion this needs.
      { jobId: `assistant-intel:${tenantId}:${new Date().toISOString().slice(0, 10)}` },
    );
  }

  logger.info({ queue: QUEUE_NAME, enqueued: tenantIds.length }, "assistant precompute sweep");
  return tenantIds.length;
}

/** Compute and store one tenant's weekly summary. */
export async function precomputeOne(tenantId: string): Promise<void> {
  if (!tenantId) throw new Error("assistant precompute needs a tenantId");

  const summary = await computeIntelligence(tenantId);
  await writeIntelligence(tenantId, summary);

  logger.info(
    {
      queue: QUEUE_NAME,
      tenantId,
      runsThisWeek: summary.visibility.thisWeek.runs,
      delta: summary.visibility.delta,
      winners: summary.winners.length,
      losers: summary.losers.length,
    },
    "assistant precompute complete",
  );
}

export async function processAssistantPrecomputeJob(
  job: Job<AssistantPrecomputeJob>,
): Promise<void> {
  if (job.data.sweep) {
    await sweep();
    return;
  }
  await precomputeOne(job.data.tenantId ?? "");
}

// ─── Worker Factory ───────────────────────────────────────────────────────────

let worker: Worker<AssistantPrecomputeJob> | null = null;

export function startAssistantPrecomputeWorker(): Worker<AssistantPrecomputeJob> {
  if (worker) return worker;

  worker = new Worker<AssistantPrecomputeJob>(QUEUE_NAME, processAssistantPrecomputeJob, {
    connection: getSubscriberConnection(),
    prefix: REDIS_CONFIG.queues.prefix,
    concurrency: CONCURRENCY,
  });

  void (async () => {
    const queue = getQueue(QUEUE_NAME);
    try {
      // Prune first — see the header. Both repeat shapes are checked so that
      // swapping cron for interval (or back) is a one-step deploy.
      for (const entry of await queue.getRepeatableJobs()) {
        if (entry.name !== SWEEP_JOB_NAME) continue;
        // The schedule we want today is a cron pattern and no interval.
        // `every` is typed as a number but arrives from Redis as a STRING, so
        // it is coerced before comparison — `entry.every !== 0` is true for
        // "0" and would delete a schedule that is already correct.
        const hasInterval = entry.every !== undefined && Number(entry.every) > 0;
        if (entry.pattern === SWEEP_CRON && !hasInterval) continue;
        await queue.removeRepeatableByKey(entry.key);
        logger.warn(
          {
            queue: QUEUE_NAME,
            stalePattern: entry.pattern,
            staleEvery: entry.every,
            pattern: SWEEP_CRON,
          },
          "removed stale assistant-precompute schedule",
        );
      }

      await queue.add(
        SWEEP_JOB_NAME,
        { sweep: true },
        {
          repeat: { pattern: SWEEP_CRON, tz: "UTC" },
          removeOnComplete: true,
          removeOnFail: { count: 50 },
        },
      );
    } catch (err) {
      logger.error({ err, queue: QUEUE_NAME }, "Failed to schedule assistant precompute sweep");
    }
  })();

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

export async function stopAssistantPrecomputeWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}
