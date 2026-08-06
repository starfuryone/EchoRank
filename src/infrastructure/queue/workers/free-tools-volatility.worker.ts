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

import { Worker, type Job } from "bullmq";
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
    for (const existing of await queue.getRepeatableJobs()) {
      const stale = existing.name !== TICK_JOB_NAME || existing.every !== String(TICK_INTERVAL_MS);
      if (stale) {
        await queue.removeRepeatableByKey(existing.key);
        logger.warn({ key: existing.key, queue: QUEUE_NAME }, "removed stale repeatable schedule");
      }
    }

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
