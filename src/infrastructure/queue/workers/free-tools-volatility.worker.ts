// Free-tools SERP volatility sampler.
//
// Two things on one hourly tick:
//   post    — once a day, queue the 30-keyword basket (guarded by a same-day
//             check in postDailyBasket, so extra ticks are free);
//   collect — turn whatever the serp sweep has completed into samples.
//
// They cannot be the same pass: the standard queue answers minutes after the
// post, so a once-a-day worker would post and then find nothing to collect.
// Hourly ticks mean the day's basket is picked up within the hour it resolves.
//
// THE REPEAT-KEY TRAP. BullMQ derives a repeatable job's key from its name and
// repeat options, and a key that changes leaves the OLD schedule running — two
// schedules, double the spend. `every` is a numeric constant here (a string
// would hash differently and orphan the previous one), and the worker removes
// any repeatable job for this queue whose key does not match before adding its
// own. Without that pruning a changed interval silently doubles the basket.
//
// VOLATILITY_POLL_ENABLED (default false, lib/free-tools/volatility-flag.ts).
// While it is off, start-workers.ts does not register this worker and calls
// removeFreeToolsVolatilitySchedules() instead: the same prune loop with
// nothing to keep, so a schedule left by an earlier process cannot fire after
// a restart. The sampler refuses to post on its own as well.

import { Worker, type Job, type Queue } from "bullmq";
import { getSubscriberConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import { getQueue } from "@/infrastructure/queue/registry";
import type { FreeToolsVolatilityJob } from "@/infrastructure/queue/jobs/schemas";
import { collectSamples, postDailyBasket } from "@/lib/free-tools/volatility-sampler";
import { logger } from "@/infrastructure/observability/logger";
import { withSpan } from "@/infrastructure/observability/telemetry";

const QUEUE_NAME = "free-tools-volatility";
const TICK_JOB_NAME = "tick";
/** Numeric, and a constant — see the repeat-key note above. */
const TICK_INTERVAL_MS = 60 * 60_000;

async function processTick(job: Job<FreeToolsVolatilityJob>): Promise<void> {
  await withSpan("free-tools-volatility.tick", async () => {
    const posted = await postDailyBasket();
    const collected = await collectSamples();
    logger.info(
      { jobId: job.id, posted: posted.posted, skipped: posted.skipped, reason: posted.reason, collected },
      "free-tools volatility tick",
    );
  });
}

let worker: Worker<FreeToolsVolatilityJob> | null = null;

export function startFreeToolsVolatilityWorker(): Worker<FreeToolsVolatilityJob> {
  if (worker) return worker;

  // Concurrency 1: two overlapping ticks would post the basket twice before
  // either had written a sample for the same-day guard to see.
  worker = new Worker<FreeToolsVolatilityJob>(QUEUE_NAME, processTick, {
    connection: getSubscriberConnection(),
    prefix: REDIS_CONFIG.queues.prefix,
    concurrency: 1,
  });

  void scheduleTick();

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err, queue: QUEUE_NAME }, "volatility tick failed");
  });
  worker.on("error", (err) => {
    logger.error({ err, queue: QUEUE_NAME }, "volatility worker error");
  });

  return worker;
}

/**
 * Register the hourly tick, removing any stale schedule first.
 *
 * The prune is the point: BullMQ keeps a repeatable job per key, so changing
 * the interval adds a second schedule rather than replacing the first. Both
 * would then post the basket, and the spend would double with nothing in the
 * logs to say why.
 */
async function scheduleTick(): Promise<void> {
  const queue = getQueue(QUEUE_NAME);
  try {
    await pruneRepeatables(queue, true);

    await queue.add(
      TICK_JOB_NAME,
      { tick: true },
      {
        repeat: { every: TICK_INTERVAL_MS },
        removeOnComplete: true,
        removeOnFail: { count: 50 },
      },
    );
  } catch (err) {
    logger.error({ err, queue: QUEUE_NAME }, "failed to schedule volatility tick");
  }
}

type RepeatableQueue = Pick<Queue, "getRepeatableJobs" | "removeRepeatableByKey">;

/**
 * The prune loop. `keepTick` false removes every repeatable job in the queue,
 * the current tick included; true removes all but the current tick.
 * Returns how many schedules were removed.
 */
export async function pruneRepeatables(queue: RepeatableQueue, keepTick: boolean): Promise<number> {
  let removed = 0;
  for (const existing of await queue.getRepeatableJobs()) {
    const current = existing.name === TICK_JOB_NAME && existing.every === String(TICK_INTERVAL_MS);
    if (keepTick && current) continue;
    await queue.removeRepeatableByKey(existing.key);
    removed += 1;
    logger.warn({ key: existing.key, queue: QUEUE_NAME }, keepTick ? "removed stale repeatable schedule" : "removed repeatable schedule: polling disabled");
  }
  return removed;
}

/** Boot with VOLATILITY_POLL_ENABLED off: nothing registered, every schedule removed. */
export async function removeFreeToolsVolatilitySchedules(queue: RepeatableQueue = getQueue(QUEUE_NAME)): Promise<number> {
  return pruneRepeatables(queue, false);
}
