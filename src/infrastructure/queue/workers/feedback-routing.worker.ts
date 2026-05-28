import { Worker, type Job } from "bullmq";
import { getSubscriberConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import type { FeedbackRoutingJob } from "@/infrastructure/queue/jobs/schemas";
import { routeFeedback } from "@/lib/feedback-router";
import { logger } from "@/infrastructure/observability/logger";
import { withSpan } from "@/infrastructure/observability/telemetry";

const QUEUE_NAME = "feedback-routing";

/**
 * Feedback routing worker.
 *
 * Runs the post-submission routing logic (review requests for happy customers,
 * recovery tickets for unhappy ones) asynchronously so the customer-facing
 * submission response never depends on it succeeding. `routeFeedback` is
 * idempotent, so BullMQ retries are safe.
 */
async function processFeedbackRouting(job: Job<FeedbackRoutingJob>): Promise<void> {
  await withSpan("feedback-routing.process", async (span) => {
    const { tenantId, feedbackId, correlationId } = job.data;

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
      await routeFeedback(feedbackId);

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

let worker: Worker<FeedbackRoutingJob> | null = null;

export function startFeedbackRoutingWorker(): Worker<FeedbackRoutingJob> {
  if (worker) return worker;

  worker = new Worker<FeedbackRoutingJob>(QUEUE_NAME, processFeedbackRouting, {
    connection: getSubscriberConnection(),
    prefix: REDIS_CONFIG.queues.prefix,
    concurrency: 5,
    limiter: {
      max: 200,
      duration: 60_000,
    },
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
