import { Worker, type Job } from "bullmq";
import { getSubscriberConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import type { ReviewMonitoringJob } from "@/infrastructure/queue/jobs/schemas";
import { addJob } from "@/infrastructure/queue/registry";
import { eventBus } from "@/infrastructure/events/bus";
import { EVENT_TYPES } from "@/infrastructure/events/types";
import { JOB_PRIORITY } from "@/infrastructure/queue/jobs/schemas";
import { prisma } from "@/lib/prisma";

const QUEUE_NAME = "review-monitoring";
const LOG_PREFIX = `[Worker:${QUEUE_NAME}]`;

// ─── Mock Review Fetcher ──────────────────────────────────────────────────────

interface MockExternalReview {
  externalId: string;
  authorName: string;
  rating: number;
  content: string;
  publishedAt: Date;
  url: string;
}

function generateMockReviews(platform: string, externalId: string): MockExternalReview[] {
  // Simulate finding 0-3 new reviews
  const count = Math.floor(Math.random() * 4);
  const reviews: MockExternalReview[] = [];

  const authorNames = [
    "John D.",
    "Sarah M.",
    "Mike R.",
    "Emily L.",
    "David K.",
    "Lisa T.",
    "Chris W.",
    "Anna P.",
  ];
  const positiveContents = [
    "Great service! Would highly recommend to anyone.",
    "Absolutely wonderful experience. The staff was incredibly helpful.",
    "Five stars! Best experience I have ever had.",
    "Exceeded my expectations in every way. Will definitely come back.",
  ];
  const negativeContents = [
    "Terrible experience. Had to wait over an hour.",
    "Very disappointed with the service quality. Will not return.",
    "The worst customer service I have ever encountered.",
    "Completely unacceptable. I want a refund.",
  ];
  const neutralContents = [
    "Average experience. Nothing special but not bad either.",
    "It was okay. Could be better in some areas.",
    "Decent but room for improvement.",
  ];

  for (let i = 0; i < count; i++) {
    const rating = Math.floor(Math.random() * 5) + 1;
    let content: string;
    if (rating >= 4) {
      content = positiveContents[Math.floor(Math.random() * positiveContents.length)];
    } else if (rating <= 2) {
      content = negativeContents[Math.floor(Math.random() * negativeContents.length)];
    } else {
      content = neutralContents[Math.floor(Math.random() * neutralContents.length)];
    }

    reviews.push({
      externalId: `${platform}-${externalId}-${Date.now()}-${i}`,
      authorName: authorNames[Math.floor(Math.random() * authorNames.length)],
      rating,
      content,
      publishedAt: new Date(Date.now() - Math.floor(Math.random() * 86_400_000)),
      url: `https://${platform}.com/review/${externalId}/${Date.now()}-${i}`,
    });
  }

  return reviews;
}

// ─── Processor ────────────────────────────────────────────────────────────────

async function processReviewMonitoring(job: Job<ReviewMonitoringJob>): Promise<void> {
  const { tenantId, sourceId, platform, externalId, checkType, correlationId } = job.data;

  console.log(
    `${LOG_PREFIX} Processing job ${job.id} - ${checkType} for ${platform}:${externalId} (tenant ${tenantId})`,
  );

  try {
    // ── Verify source exists and is active ───────────────────────────
    const source = await prisma.monitoringSource.findFirst({
      where: {
        id: sourceId,
        tenantId,
        isActive: true,
      },
    });

    if (!source) {
      console.log(`${LOG_PREFIX} Source ${sourceId} not found or inactive, skipping.`);
      return;
    }

    // ── Fetch reviews (mock) ─────────────────────────────────────────
    const mockReviews = generateMockReviews(platform, externalId);
    console.log(`${LOG_PREFIX} Found ${mockReviews.length} potential new reviews for ${platform}:${externalId}`);

    let newReviewCount = 0;

    for (const review of mockReviews) {
      // ── Deduplication ────────────────────────────────────────────
      const deduplicationKey = `${platform}:${externalId}:${review.externalId}`;

      const existing = await prisma.externalReview.findUnique({
        where: { deduplicationKey },
      });

      if (existing) {
        console.log(`${LOG_PREFIX} Review ${review.externalId} already exists, skipping.`);
        continue;
      }

      // ── Store new review ─────────────────────────────────────────
      const storedReview = await prisma.externalReview.create({
        data: {
          tenantId,
          sourceId,
          platform: platform as "GOOGLE" | "FACEBOOK" | "TRUSTPILOT" | "YELP" | "REDDIT" | "TWITTER" | "TIKTOK" | "YOUTUBE" | "APP_STORE" | "CUSTOM",
          externalId: review.externalId,
          authorName: review.authorName,
          rating: review.rating,
          content: review.content,
          publishedAt: review.publishedAt,
          url: review.url,
          deduplicationKey,
          isProcessed: false,
        },
      });

      newReviewCount++;

      // ── Trigger AI Processing for new reviews ────────────────────
      if (review.content && review.content.length > 0) {
        await addJob(
          "ai-processing",
          "analyze-review",
          {
            tenantId,
            externalReviewId: storedReview.id,
            analysisType: "full_analysis" as const,
            content: review.content,
            correlationId,
          },
          { priority: JOB_PRIORITY.NORMAL },
        );
      }

      // ── Emit review.published event ──────────────────────────────
      const sentiment = review.rating >= 4 ? "positive" : review.rating <= 2 ? "negative" : "neutral";

      await eventBus.emit({
        tenantId,
        eventType: EVENT_TYPES.REVIEW_PUBLISHED,
        eventVersion: 1,
        aggregateType: "ExternalReview",
        aggregateId: storedReview.id,
        payload: {
          tenantId,
          correlationId,
          timestamp: new Date().toISOString(),
          version: 1,
          externalReviewId: storedReview.id,
          platform,
          rating: review.rating,
          sentiment,
        },
        correlationId,
      });
    }

    // ── Update source lastCheckedAt ──────────────────────────────────
    await prisma.monitoringSource.update({
      where: { id: sourceId },
      data: { lastCheckedAt: new Date() },
    });

    // ── Record Usage Meter ───────────────────────────────────────────
    await prisma.usageMeter.create({
      data: {
        tenantId,
        meterType: "MONITORING_CHECK",
        quantity: 1,
        metadata: {
          sourceId,
          platform,
          externalId,
          checkType,
          newReviewCount,
          correlationId,
          jobId: job.id,
        },
      },
    });

    console.log(
      `${LOG_PREFIX} Monitoring check complete: ${newReviewCount} new reviews for ${platform}:${externalId}`,
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`${LOG_PREFIX} Review monitoring failed:`, errorMsg);
    throw err;
  }
}

// ─── Worker Factory ───────────────────────────────────────────────────────────

let worker: Worker<ReviewMonitoringJob> | null = null;

export function startReviewMonitoringWorker(): Worker<ReviewMonitoringJob> {
  if (worker) return worker;

  worker = new Worker<ReviewMonitoringJob>(QUEUE_NAME, processReviewMonitoring, {
    connection: getSubscriberConnection(),
    prefix: REDIS_CONFIG.queues.prefix,
    concurrency: 5,
    limiter: {
      max: 60,
      duration: 60_000,
    },
  });

  worker.on("completed", (job) => {
    console.log(`${LOG_PREFIX} Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(
      `${LOG_PREFIX} Job ${job?.id} failed (attempt ${job?.attemptsMade}):`,
      err.message,
    );
  });

  worker.on("error", (err) => {
    console.error(`${LOG_PREFIX} Worker error:`, err.message);
  });

  console.log(`${LOG_PREFIX} Worker started`);
  return worker;
}

export async function stopReviewMonitoringWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    console.log(`${LOG_PREFIX} Worker stopped`);
  }
}

export { processReviewMonitoring };
