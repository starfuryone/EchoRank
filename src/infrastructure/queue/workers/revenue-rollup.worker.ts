/**
 * AI Revenue rollup worker.
 *
 * Two jobs on one queue. A repeatable nightly SWEEP enqueues one ROLLUP per
 * tenant per open month; a rollup counts that tenant's leads for the month,
 * reads its share of voice, and writes four RevenueRollup rows — one per
 * attribution model, all under one mode.
 *
 * READS TWO TABLES, WRITES ONE. ai_visits (Prompt 1) and sov_snapshots
 * (Prompt 2) are read exactly as their own features left them; nothing in
 * src/lib/attribution/ or src/lib/sov/ is modified here.
 *
 * ── ONE MODE PER RUN, NEVER MIXED ───────────────────────────────────────────
 * The mode is decided once, by loadTouches(), and every row a single run writes
 * carries it. The four models differ in how they divide one touch set, not in
 * what the touch set is, so a run cannot produce a measured `first` row beside
 * a proxy `linear` row. And because mode is in the unique key, the night a
 * tenant flips to measured writes four NEW rows beside the proxy ones rather
 * than restating numbers somebody has already read.
 *
 * Every tenant is in proxy mode today: `measured` binds to AiConversion, which
 * attribution P2 has not shipped. That is the expected state, not a fault, and
 * nothing here logs it as one.
 *
 * ── TWO MONTHS PER SWEEP ────────────────────────────────────────────────────
 * The current month and the previous one, for the first LATE_RESTATE_DAYS of a
 * month. A visit that lands at 23:58 on the 31st is written before midnight but
 * after that night's rollup ran, and a monthly figure that can never be
 * corrected after the month ends would be permanently one visit short. Cheap
 * insurance: the upsert makes a restatement that changes nothing a no-op.
 *
 * SEPARATE QUEUE, for the reason sov-aggregation gives for being separate from
 * ai-checkup: this job spends nothing, runs in milliseconds, and must not sit
 * behind a backlog of work that takes minutes and real money.
 *
 * NIGHTLY, AFTER THE SHARE-OF-VOICE ROLLUP. The tick is at 03:40 UTC — twenty
 * minutes after sov-aggregation's 03:20 — because lostRevenueEst is computed
 * from the snapshot that job writes. Running first would price last night's
 * gap every night. A missed night is self-healing: the next sweep recomputes
 * the same month from scratch.
 */

import { Worker, type Job } from "bullmq";
import { getSubscriberConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import { getQueue, addJob } from "@/infrastructure/queue/registry";
import { logger } from "@/infrastructure/observability/logger";
import type { RevenueRollupJob } from "@/infrastructure/queue/jobs/schemas";
import {
  listTenantIds,
  monthKey,
  previousMonth,
  writeRollups,
} from "@/lib/revenue/store";

const QUEUE_NAME = "revenue-rollup" as const;
const SWEEP_JOB_NAME = "sweep";
const ROLLUP_JOB_NAME = "rollup";

/** Nightly, twenty minutes after the share-of-voice rollup it reads. */
const SWEEP_CRON = "40 3 * * *";

/**
 * How far into a month the previous one is still restated.
 *
 * Five days covers a late visit, a missed night, and a weekend of neither
 * without keeping every month open forever — a figure that can still move in
 * March is not a figure anybody can put in a February report.
 */
export const LATE_RESTATE_DAYS = 5;

/**
 * Tenants rolled up at once in this process.
 *
 * Higher than ai-checkup's 2 because nothing here waits on a provider: a rollup
 * is three queries and some arithmetic. The ceiling that matters is the
 * database connection pool, not the CPU — the same reasoning sov-aggregation
 * uses for the same number.
 */
const CONCURRENCY = 4;

/** The months a sweep on `now` should (re)compute. */
export function monthsToRoll(now: Date): string[] {
  const current = monthKey(now);
  return now.getUTCDate() <= LATE_RESTATE_DAYS ? [current, previousMonth(current)] : [current];
}

/** Enqueue one rollup per tenant per open month. */
async function sweep(now: Date): Promise<number> {
  const tenantIds = await listTenantIds();
  const months = monthsToRoll(now);

  for (const tenantId of tenantIds) {
    for (const month of months) {
      await addJob<RevenueRollupJob>(
        QUEUE_NAME,
        ROLLUP_JOB_NAME,
        { tenantId, month },
        // Keyed on the tenant-month AND the night, so a sweep that fires twice
        // (a restart, a manual tick) collapses to one rollup per tenant-month
        // per day instead of racing two writers on the same unique constraint.
        { jobId: `revenue:${tenantId}:${month}:${monthKey(now)}-${now.getUTCDate()}` },
      );
    }
  }

  const enqueued = tenantIds.length * months.length;
  logger.info({ queue: QUEUE_NAME, tenants: tenantIds.length, months, enqueued }, "revenue sweep complete");
  return enqueued;
}

/** Roll up one tenant-month. */
async function rollUpOne(job: RevenueRollupJob): Promise<void> {
  const { tenantId } = job;
  if (!tenantId) throw new Error("rollup job needs a tenantId");

  const month = job.month ?? monthKey(new Date());
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error(`rollup job month must be YYYY-MM, got ${JSON.stringify(month)}`);
  }

  const { mode, leads, written } = await writeRollups(tenantId, month);

  logger.info(
    { queue: QUEUE_NAME, tenantId, month, mode, leads, rows: written },
    "revenue rollup complete",
  );
}

async function processRevenueRollupJob(job: Job<RevenueRollupJob>): Promise<void> {
  if (job.data.sweep) {
    await sweep(new Date());
    return;
  }
  await rollUpOne(job.data);
}

// ─── Worker Factory ───────────────────────────────────────────────────────────

let worker: Worker<RevenueRollupJob> | null = null;

export function startRevenueRollupWorker(): Worker<RevenueRollupJob> {
  if (worker) return worker;

  worker = new Worker<RevenueRollupJob>(QUEUE_NAME, processRevenueRollupJob, {
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
      logger.error({ err, queue: QUEUE_NAME }, "Failed to schedule revenue sweep");
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

export async function stopRevenueRollupWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}

export { processRevenueRollupJob, sweep, rollUpOne };
