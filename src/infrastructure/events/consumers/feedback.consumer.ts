import type { DomainEvent } from "@/generated/prisma";
import { eventBus } from "@/infrastructure/events/bus";
import { EVENT_TYPES, type FeedbackSubmittedEvent } from "@/infrastructure/events/types";
import { addJob } from "@/infrastructure/queue/registry";
import { JOB_PRIORITY } from "@/infrastructure/queue/jobs/schemas";
import { prisma } from "@/lib/prisma";

const LOG_PREFIX = "[Consumer:feedback]";

/**
 * Feedback consumer: listens for feedback.submitted events.
 *
 * Triggers:
 * - AI processing queue job (sentiment analysis)
 * - Escalation detection for low ratings (rating <= 2)
 * - Reputation scoring recalculation
 * - Records usage meter
 */

async function handleFeedbackSubmitted(
  event: DomainEvent,
  payload: FeedbackSubmittedEvent,
): Promise<void> {
  const { tenantId, feedbackId, customerId, rating, comment, correlationId } = payload;

  console.log(
    `${LOG_PREFIX} Handling feedback.submitted: feedback=${feedbackId}, rating=${rating}, tenant=${tenantId}`,
  );

  // ── 1. Trigger AI Processing ───────────────────────────────────────
  if (comment && comment.length > 0) {
    await addJob(
      "ai-processing",
      "analyze-feedback",
      {
        tenantId,
        feedbackId,
        analysisType: "full_analysis" as const,
        content: comment,
        correlationId,
      },
      { priority: JOB_PRIORITY.NORMAL },
    );
    console.log(`${LOG_PREFIX} Queued AI processing for feedback ${feedbackId}`);
  }

  // ── 2. Escalation Detection for Low Ratings ────────────────────────
  if (rating !== null && rating <= 2) {
    // Gather historical complaint count for this customer
    const previousLowRatings = await prisma.feedback.count({
      where: {
        tenantId,
        customerId,
        rating: { lte: 2 },
        status: "SUBMITTED",
        id: { not: feedbackId },
      },
    });

    const signals: Array<{ type: string; value: string | number; weight: number }> = [
      { type: "rating", value: rating, weight: 3 },
      { type: "customer_history", value: previousLowRatings, weight: 2 },
    ];

    if (comment) {
      signals.push({ type: "content_length", value: comment.length, weight: 1 });
      signals.push({ type: "urgency_words", value: comment, weight: 2 });
    }

    const priority =
      rating === 1 ? JOB_PRIORITY.CRITICAL : JOB_PRIORITY.HIGH;

    await addJob(
      "escalation-detection",
      "detect-escalation",
      {
        tenantId,
        feedbackId,
        customerId,
        signals,
        correlationId,
      },
      { priority },
    );
    console.log(
      `${LOG_PREFIX} Queued escalation detection for feedback ${feedbackId} (rating: ${rating})`,
    );
  }

  // ── 3. Trigger Reputation Scoring Recalculation ────────────────────
  await addJob(
    "reputation-scoring",
    "recalculate-score",
    {
      tenantId,
      triggerEvent: "feedback_submitted" as const,
      correlationId,
    },
    { priority: JOB_PRIORITY.LOW },
  );
  console.log(`${LOG_PREFIX} Queued reputation scoring recalculation for tenant ${tenantId}`);

  // ── 4. Record Usage Meter ──────────────────────────────────────────
  await prisma.usageMeter.create({
    data: {
      tenantId,
      meterType: "FEEDBACK_REQUEST",
      quantity: 1,
      metadata: {
        feedbackId,
        customerId,
        rating,
        correlationId,
        eventId: event.id,
      },
    },
  });

  console.log(`${LOG_PREFIX} Feedback submitted event fully processed for ${feedbackId}`);
}

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerFeedbackConsumer(): void {
  eventBus.on(
    EVENT_TYPES.FEEDBACK_SUBMITTED,
    handleFeedbackSubmitted,
    "feedback-consumer",
  );
  console.log(`${LOG_PREFIX} Registered for ${EVENT_TYPES.FEEDBACK_SUBMITTED}`);
}

export { handleFeedbackSubmitted };
