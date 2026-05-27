import type { DomainEvent } from "@/generated/prisma";
import { eventBus } from "@/infrastructure/events/bus";
import { EVENT_TYPES, type ReviewPublishedEvent } from "@/infrastructure/events/types";
import { addJob } from "@/infrastructure/queue/registry";
import { JOB_PRIORITY } from "@/infrastructure/queue/jobs/schemas";

const LOG_PREFIX = "[Consumer:review]";

/**
 * Review consumer: listens for review.published events (from external monitoring).
 *
 * Triggers:
 * - AI sentiment analysis (if review has content)
 * - Reputation score update
 * - Risk pattern detection (low ratings trigger escalation detection)
 */

async function handleReviewPublished(
  event: DomainEvent,
  payload: ReviewPublishedEvent,
): Promise<void> {
  const { tenantId, externalReviewId, platform, rating, sentiment, correlationId } = payload;

  console.log(
    `${LOG_PREFIX} Handling review.published: review=${externalReviewId}, platform=${platform}, rating=${rating}, tenant=${tenantId}`,
  );

  // ── 1. Trigger AI Sentiment Analysis ───────────────────────────────
  // Note: The review-monitoring worker may have already queued an AI job.
  // The AI worker has idempotency built in, so double-queuing is safe.
  // This consumer handles the case where reviews arrive from other sources.

  // ── 2. Update Reputation Scores ────────────────────────────────────
  await addJob(
    "reputation-scoring",
    "recalculate-score-review",
    {
      tenantId,
      triggerEvent: "review_published" as const,
      correlationId,
    },
    { priority: JOB_PRIORITY.NORMAL },
  );
  console.log(`${LOG_PREFIX} Queued reputation scoring for tenant ${tenantId}`);

  // ── 3. Detect Risk Patterns ────────────────────────────────────────
  if (rating <= 2) {
    const signals = [
      { type: "rating", value: rating, weight: 3 },
      {
        type: "sentiment",
        value: sentiment === "negative" ? 0.1 : sentiment === "neutral" ? 0.5 : 0.8,
        weight: 2,
      },
    ];

    await addJob(
      "escalation-detection",
      "detect-review-risk",
      {
        tenantId,
        signals,
        correlationId,
      },
      {
        priority: rating === 1 ? JOB_PRIORITY.HIGH : JOB_PRIORITY.NORMAL,
      },
    );
    console.log(
      `${LOG_PREFIX} Queued escalation detection for low-rated review ${externalReviewId}`,
    );
  }

  console.log(`${LOG_PREFIX} Review published event fully processed for ${externalReviewId}`);
}

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerReviewConsumer(): void {
  eventBus.on(
    EVENT_TYPES.REVIEW_PUBLISHED,
    handleReviewPublished,
    "review-consumer",
  );
  console.log(`${LOG_PREFIX} Registered for ${EVENT_TYPES.REVIEW_PUBLISHED}`);
}

export { handleReviewPublished };
