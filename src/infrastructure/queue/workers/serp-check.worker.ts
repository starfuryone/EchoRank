// SERP Checker completion worker.
//
// SerpCheck rows are written `queued` by POST /api/seo/v1/serp/check after a
// DataForSEO standard-queue task_post. Standard queue turnaround is typically
// 1–5 minutes, so a 60 s repeatable sweep drains them:
//
//   1. time out rows stuck past SERP_TIMEOUT_MS -> status=failed
//   2. GET tasks_ready (free)   — the ids DataForSEO has finished
//   3. GET task_get/advanced/id (free) for each id we own -> parse -> completed
//   4. direct task_get for rows still queued past DIRECT_GET_AFTER_MS
//
// Step 4 exists because tasks_ready is a *drain*: an id disappears from it
// once read. A crash between steps 2 and 3 would otherwise strand a row until
// the timeout marked it failed even though DataForSEO has the results — and
// task_get stays retrievable for 30 days regardless of the ready list.
//
// Steps 2–4 are free at DataForSEO, so this worker never meters. The only
// billed call in the whole feature is the task_post in the route.

import { Worker, type Job } from "bullmq";
import { getSubscriberConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import type { SerpCheckJob } from "@/infrastructure/queue/jobs/schemas";
import { getQueue } from "@/infrastructure/queue/registry";
import { prisma } from "@/lib/prisma";
import { getEndpoint, DataforseoError } from "@/lib/dataforseo/client";
import { SERP } from "@/lib/dataforseo/endpoints";
import { parseSerpTaskResult } from "@/lib/serp/parse";
import { logger } from "@/infrastructure/observability/logger";
import { withSpan } from "@/infrastructure/observability/telemetry";

const QUEUE_NAME = "serp-checks";
const SWEEP_JOB_NAME = "sweep";
const SWEEP_INTERVAL_MS = 60_000;

/** Don't look for a task before DataForSEO has had a chance to run it. */
const MIN_AGE_MS = 30_000;
/** Give up on a queued row after this long and surface the failure. */
const SERP_TIMEOUT_MS = 30 * 60_000;
/** Rows this old that tasks_ready never mentioned get a direct task_get. */
const DIRECT_GET_AFTER_MS = 5 * 60_000;
/** Cap the work of one tick; the next tick 60 s later picks up the rest. */
const SWEEP_BATCH = 50;

/** One entry of the tasks_ready result array. */
interface ReadyTask {
  id?: string;
}

/** DataForSEO status codes meaning "posted, just not done yet". */
const IN_QUEUE_PATTERN = /task in queue|task handed|in progress|no results/i;

async function markCompleted(rowId: string, result: unknown[]): Promise<void> {
  const parsed = parseSerpTaskResult(result);
  await prisma.serpCheck.update({
    where: { id: rowId },
    data: {
      status: "completed",
      results: parsed.results as unknown as object,
      serpFeatures: parsed.serpFeatures,
      itemCount: parsed.itemCount,
      error: null,
      completedAt: new Date(),
    },
  });
}

/** Upstream error text reaches the API (and support tickets), so the vendor
 * name is scrubbed here — user-facing surfaces say Echorank360 or nothing. */
function sanitize(message: string): string {
  return message.replace(/dataforseo/gi, "the SERP data provider").slice(0, 500);
}

async function markFailed(rowId: string, message: string): Promise<void> {
  await prisma.serpCheck.update({
    where: { id: rowId },
    data: {
      status: "failed",
      error: sanitize(message),
      completedAt: new Date(),
    },
  });
}

/**
 * Fetch one finished task and store it. Returns false (leaving the row queued
 * for a later tick) when DataForSEO says the task simply isn't done yet.
 */
async function collectTask(rowId: string, taskId: string): Promise<boolean> {
  try {
    const { data } = await getEndpoint<unknown[]>(
      `${SERP.organicTaskGet}/${taskId}`,
      // The live path carries a per-task id; fixtures key on the stable prefix.
      { fixtureKey: SERP.organicTaskGet },
    );
    await markCompleted(rowId, data);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (err instanceof DataforseoError && IN_QUEUE_PATTERN.test(message)) {
      return false; // still cooking — try again next tick
    }

    logger.error({ rowId, taskId, err, queue: QUEUE_NAME }, "SERP task_get failed");
    await markFailed(rowId, message);
    return true;
  }
}

/** Exported for the e2e script (scripts/serp-check-e2e.ts) and for ops, which
 * occasionally needs to force a drain without waiting for the next tick. */
export async function processSweep(): Promise<void> {
  const now = Date.now();

  // ── 1. Time out anything stuck. ────────────────────────────────────────
  const timedOut = await prisma.serpCheck.updateMany({
    where: {
      status: "queued",
      createdAt: { lt: new Date(now - SERP_TIMEOUT_MS) },
    },
    data: {
      status: "failed",
      error: "DataForSEO did not return results within 30 minutes.",
      completedAt: new Date(),
    },
  });
  if (timedOut.count > 0) {
    logger.warn({ count: timedOut.count, queue: QUEUE_NAME }, "SERP checks timed out");
  }

  // ── 2. Anything worth polling for? ─────────────────────────────────────
  const pending = await prisma.serpCheck.findMany({
    where: {
      status: "queued",
      dataforseoTaskId: { not: null },
      createdAt: { lte: new Date(now - MIN_AGE_MS) },
    },
    orderBy: { createdAt: "asc" },
    take: SWEEP_BATCH,
    select: { id: true, dataforseoTaskId: true, createdAt: true },
  });
  if (pending.length === 0) return;

  const byTaskId = new Map(pending.map((row) => [row.dataforseoTaskId as string, row]));

  // ── 3. Ready list -> collect ours. ─────────────────────────────────────
  const collected = new Set<string>();
  // Rows already fetched this tick, whether or not they were done — step 4
  // must not ask again for a task we just heard "in queue" about.
  const attempted = new Set<string>();
  try {
    const { data } = await getEndpoint<ReadyTask[]>(SERP.organicTasksReady);
    for (const ready of data) {
      const row = ready.id ? byTaskId.get(ready.id) : undefined;
      if (!row) continue; // another feature's task, or already handled
      attempted.add(row.id);
      if (await collectTask(row.id, ready.id as string)) collected.add(row.id);
    }
  } catch (err) {
    // A tasks_ready outage must not stall the queue — step 4 still runs, and
    // the next tick retries.
    logger.error({ err, queue: QUEUE_NAME }, "SERP tasks_ready failed");
  }

  // ── 4. Direct fetch for rows the ready list never mentioned. ───────────
  const stale = pending.filter(
    (row) =>
      !attempted.has(row.id) && row.createdAt.getTime() < now - DIRECT_GET_AFTER_MS,
  );
  for (const row of stale) {
    await collectTask(row.id, row.dataforseoTaskId as string);
  }

  logger.info(
    { pending: pending.length, collected: collected.size, retried: stale.length, queue: QUEUE_NAME },
    "SERP sweep complete",
  );
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
      logger.error({ err, queue: QUEUE_NAME }, "Failed to schedule SERP sweep");
    });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err, queue: QUEUE_NAME }, "SERP sweep failed");
  });
  worker.on("error", (err) => {
    logger.error({ err, queue: QUEUE_NAME }, "SERP worker error");
  });

  return worker;
}
