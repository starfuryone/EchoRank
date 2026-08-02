import { Worker, type Job } from "bullmq";
import { getSubscriberConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import type { TrialNoticeJob } from "@/infrastructure/queue/jobs/schemas";
import { sendTrialEndingEmail } from "@/lib/billing/trial-notice";
import { prisma } from "@/lib/prisma";
import { logger } from "@/infrastructure/observability/logger";

const QUEUE_NAME = "trial-notice";

/**
 * Fires 24h before a Stripe trial converts to a charge.
 *
 * The job was scheduled when checkout completed, which may have been days ago,
 * so the subscription is re-checked before sending: trials get cancelled and
 * plans get changed in between, and a warning about a charge that is no longer
 * coming is its own kind of support ticket.
 */
async function processTrialNotice(job: Job<TrialNoticeJob>): Promise<void> {
  const { tenantId, stripeSubscriptionId, trialEnd } = job.data;

  const subscription = await prisma.subscription.findUnique({
    where: { tenantId },
    select: { status: true, stripeSubscriptionId: true },
  });

  if (!subscription) {
    logger.info({ jobId: job.id, tenantId }, "Trial notice: no subscription row — skipping");
    return;
  }
  // A different subscription id means this one was replaced; the stale notice
  // is not about anything current.
  if (
    subscription.stripeSubscriptionId &&
    subscription.stripeSubscriptionId !== stripeSubscriptionId
  ) {
    logger.info(
      { jobId: job.id, tenantId, stripeSubscriptionId },
      "Trial notice: subscription superseded — skipping",
    );
    return;
  }
  if (subscription.status !== "TRIALING") {
    logger.info(
      { jobId: job.id, tenantId, status: subscription.status },
      "Trial notice: no longer trialing — skipping",
    );
    return;
  }

  await sendTrialEndingEmail({ tenantId, stripeSubscriptionId, trialEnd });
}

export function startTrialNoticeWorker(): Worker<TrialNoticeJob> {
  const worker = new Worker<TrialNoticeJob>(QUEUE_NAME, processTrialNotice, {
    connection: getSubscriberConnection(),
    prefix: REDIS_CONFIG.queues.prefix,
    concurrency: 2,
  });

  worker.on("failed", (job, err) => {
    logger.error(
      { jobId: job?.id, err, queue: QUEUE_NAME },
      "Trial-notice job failed",
    );
  });

  return worker;
}
