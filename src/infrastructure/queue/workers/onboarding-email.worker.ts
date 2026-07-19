import { Worker, type Job } from "bullmq";
import { getSubscriberConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import type { OnboardingEmailJob } from "@/infrastructure/queue/jobs/schemas";
import { sendOnboardingEmail } from "@/lib/onboarding-email";
import { logger } from "@/infrastructure/observability/logger";
import { withSpan } from "@/infrastructure/observability/telemetry";

const QUEUE_NAME = "onboarding-email";

/**
 * Onboarding email drip worker.
 *
 * Jobs are enqueued at signup with fixed delays (d0/d2/d5/d10) and fixed
 * jobIds (`onboarding-<tenantId>-<stage>`), so re-enqueues dedupe. Every
 * send re-checks tenant state (deleted / unsubscribed / already activated /
 * no longer trialing) inside sendOnboardingEmail — a skip completes the job,
 * only transport failures throw for retry.
 */

async function processOnboardingEmail(job: Job<OnboardingEmailJob>): Promise<void> {
  await withSpan("onboarding-email.process", async (span) => {
    const { tenantId, stage } = job.data;
    span.setAttributes({ "job.id": job.id ?? "", "tenant.id": tenantId, stage });

    const outcome = await sendOnboardingEmail(tenantId, stage);
    logger.info(
      {
        jobId: job.id,
        tenantId,
        stage,
        outcome: outcome.status,
        reason: "reason" in outcome ? outcome.reason : undefined,
        queue: QUEUE_NAME,
      },
      "Onboarding email processed",
    );
  });
}

// ─── Worker Factory ───────────────────────────────────────────────────────────

let worker: Worker<OnboardingEmailJob> | null = null;

export function startOnboardingEmailWorker(): Worker<OnboardingEmailJob> {
  if (worker) return worker;

  worker = new Worker<OnboardingEmailJob>(QUEUE_NAME, processOnboardingEmail, {
    connection: getSubscriberConnection(),
    prefix: REDIS_CONFIG.queues.prefix,
    concurrency: 2,
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

export async function stopOnboardingEmailWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info({ queue: QUEUE_NAME }, "Worker stopped");
  }
}

export { processOnboardingEmail };
