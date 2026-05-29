import { Worker, type Job } from "bullmq";
import { getSubscriberConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import { getQueue } from "@/infrastructure/queue/registry";
import type { FeedbackRoutingJob } from "@/infrastructure/queue/jobs/schemas";
import { routeFeedback, backfillUnroutedFeedback } from "@/lib/feedback-router";
import { logger } from "@/infrastructure/observability/logger";
import { withSpan } from "@/infrastructure/observability/telemetry";

const QUEUE_NAME = "feedback-routing";

/** Name of the repeatable reconciliation job and how often it runs. */
const BACKFILL_JOB_NAME = "backfill-unrouted";
const BACKFILL_INTERVAL_MS = 5 * 60_000;

/** A routing job carries a feedbackId; the sweep job carries no payload. */
type FeedbackJobData = FeedbackRoutingJob | { backfill: true };

/**
 * Feedback routing worker.
 *
 * Runs the post-submission routing logic (review requests for happy customers,
 * recovery tickets for unhappy ones) asynchronously so the customer-facing
 * submission response never depends on it succeeding. `routeFeedback` is
 * idempotent, so BullMQ retries are safe. A repeatable sweep job re-enqueues
 * any feedback whose routing was never recorded.
 */
async function processFeedbackRouting(job: Job<FeedbackJobData>): Promise<void> {
  if (job.name === BACKFILL_JOB_NAME) {
    await withSpan("feedback-routing.backfill", async () => {
      const count = await backfillUnroutedFeedback();
      logger.info(
        { jobId: job.id, count, queue: QUEUE_NAME },
        "Backfill sweep complete",
      );
    });
    return;
  }

  const { tenantId, feedbackId, correlationId } = job.data as FeedbackRoutingJob;

  await withSpan("feedback-routing.process", async (span) => {
    span.setAttributes({
      "job.id": job.id ?? "",
      "tenant.id": tenantId,
      "feedback.id": feedbackId,
    });

    logger.info(
      { jobId: job.id, tenantId, feedbackId, correlationId, queue: QUEUE_NAME },
      "Processing job",
    );

    try {
      await routeFeedback(feedbackId, correlationId);

      logger.info(
        { jobId: job.id, tenantId, feedbackId, queue: QUEUE_NAME },
        "Feedback routed successfully",
      );
    } catch (err) {
      logger.error(
        { jobId: job.id, tenantId, feedbackId, err, queue: QUEUE_NAME },
        "Feedback routing failed",
      );
      // Throw to trigger BullMQ retry with exponential backoff.
      throw err;
    }
  });
}

// ─── Worker Factory ───────────────────────────────────────────────────────────

let worker: Worker<FeedbackJobData> | null = null;

export function startFeedbackRoutingWorker(): Worker<FeedbackJobData> {
  if (worker) return worker;

  worker = new Worker<FeedbackJobData>(QUEUE_NAME, processFeedbackRouting, {
    connection: getSubscriberConnection(),
    prefix: REDIS_CONFIG.queues.prefix,
    concurrency: 5,
    limiter: {
      max: 200,
      duration: 60_000,
    },
  });

  // Schedule the reconciliation sweep. BullMQ dedupes the repeat config, so
  // restarts don't stack multiple schedules.
  getQueue(QUEUE_NAME)
    .add(
      BACKFILL_JOB_NAME,
      { backfill: true },
      {
        repeat: { every: BACKFILL_INTERVAL_MS },
        removeOnComplete: true,
        removeOnFail: { count: 50 },
      },
    )
    .catch((err) => {
      logger.error({ err, queue: QUEUE_NAME }, "Failed to schedule backfill sweep");
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

  logger.info({ queue: QUEUE_NAME }, "Worker started");
  return worker;
}

export async function stopFeedbackRoutingWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info({ queue: QUEUE_NAME }, "Worker stopped");
  }
}

export { processFeedbackRouting };
