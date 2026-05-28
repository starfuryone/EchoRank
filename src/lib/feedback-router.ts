import { randomUUID } from "node:crypto";
import { prisma } from "./prisma";
import { addJob } from "@/infrastructure/queue/registry";
import type { FeedbackRoutingJob } from "@/infrastructure/queue/jobs/schemas";
import { logger } from "@/infrastructure/observability/logger";

const log = logger.child({ module: "feedback-router" });

/**
 * Feedback older than this with no `routedAt` is considered to have slipped
 * through (e.g. enqueue failed during a Redis blip) and is re-enqueued.
 */
const BACKFILL_MIN_AGE_MS = 5 * 60_000;

export async function routeFeedback(feedbackId: string) {
  const feedback = await prisma.feedback.findUnique({
    where: { id: feedbackId },
    include: {
      customer: true,
      tenant: {
        include: { reviewLinks: { where: { isDefault: true } } },
      },
    },
  });

  if (!feedback || !feedback.rating) return;

  await persistDomainEvent(feedback.tenantId, "feedback.submitted", "feedback", feedback.id, {
    tenantId: feedback.tenantId,
    feedbackId: feedback.id,
    customerId: feedback.customerId,
    rating: feedback.rating,
    comment: feedback.comment,
    submittedAt: new Date().toISOString(),
  });

  if (feedback.rating >= 4) {
    await handlePositiveFeedback(feedback);
  } else {
    await handleNegativeFeedback(feedback);
  }

  // Mark routing as completed so the backfill sweep can distinguish feedback
  // that was processed (even when it produced no artifact, e.g. a happy
  // customer with no configured review link) from feedback that never ran.
  await prisma.feedback.update({
    where: { id: feedback.id },
    data: { routedAt: new Date() },
  });
}

/**
 * Reconciliation sweep: re-enqueue any submitted feedback that was never
 * routed (no `routedAt`) and is older than the grace period. This recovers
 * feedback whose routing job failed to enqueue (e.g. a transient Redis
 * outage), since the submission path intentionally returns success to the
 * customer even if enqueueing fails. Returns the number re-enqueued.
 */
export async function backfillUnroutedFeedback(limit = 100): Promise<number> {
  const cutoff = new Date(Date.now() - BACKFILL_MIN_AGE_MS);

  const candidates = await prisma.feedback.findMany({
    where: {
      status: "SUBMITTED",
      routedAt: null,
      rating: { not: null },
      deletedAt: null,
      submittedAt: { lt: cutoff },
    },
    select: { id: true, tenantId: true },
    take: limit,
  });

  for (const feedback of candidates) {
    const job: FeedbackRoutingJob = {
      tenantId: feedback.tenantId,
      feedbackId: feedback.id,
      correlationId: randomUUID(),
    };
    await addJob("feedback-routing", "route-feedback", job);
  }

  if (candidates.length > 0) {
    log.warn(
      { count: candidates.length },
      "Backfilled unrouted feedback into the routing queue"
    );
  }

  return candidates.length;
}

async function handlePositiveFeedback(feedback: {
  id: string;
  tenantId: string;
  customerId: string;
  rating: number | null;
  tenant: {
    googleReviewLink: string | null;
    facebookReviewLink: string | null;
    trustpilotLink: string | null;
    reviewLinks: { platform: string; url: string }[];
  };
  customer: { email: string | null; name: string };
}) {
  const reviewLink =
    feedback.tenant.reviewLinks[0] ||
    (feedback.tenant.googleReviewLink
      ? { platform: "google", url: feedback.tenant.googleReviewLink }
      : feedback.tenant.facebookReviewLink
        ? { platform: "facebook", url: feedback.tenant.facebookReviewLink }
        : feedback.tenant.trustpilotLink
          ? { platform: "trustpilot", url: feedback.tenant.trustpilotLink }
          : null);

  // Idempotent: a retried job must not create a second review request.
  if (reviewLink) {
    const existing = await prisma.reviewRequest.findUnique({
      where: { feedbackId: feedback.id },
    });

    if (!existing) {
      await prisma.reviewRequest.create({
        data: {
          feedbackId: feedback.id,
          platform: reviewLink.platform,
          url: reviewLink.url,
        },
      });

      await persistDomainEvent(feedback.tenantId, "review.requested", "feedback", feedback.id, {
        tenantId: feedback.tenantId,
        feedbackId: feedback.id,
        customerId: feedback.customerId,
        platform: reviewLink.platform,
        url: reviewLink.url,
      });
    }
  }

  await prisma.customer.update({
    where: { id: feedback.customerId },
    data: { status: "SATISFIED" },
  });
}

async function handleNegativeFeedback(feedback: {
  id: string;
  tenantId: string;
  customerId: string;
  rating: number | null;
}) {
  const priority =
    feedback.rating === 1 ? "URGENT" : feedback.rating === 2 ? "HIGH" : "MEDIUM";

  // Idempotent: a retried job must not open a duplicate recovery ticket.
  const existingTicket = await prisma.recoveryTicket.findUnique({
    where: { feedbackId: feedback.id },
  });

  const ticket =
    existingTicket ??
    (await prisma.recoveryTicket.create({
      data: {
        tenantId: feedback.tenantId,
        customerId: feedback.customerId,
        feedbackId: feedback.id,
        priority: priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
      },
    }));

  await prisma.customer.update({
    where: { id: feedback.customerId },
    data: { status: "NEEDS_FOLLOWUP" },
  });

  if (!existingTicket) {
    await persistDomainEvent(feedback.tenantId, "ticket.opened", "recovery_ticket", ticket.id, {
      tenantId: feedback.tenantId,
      ticketId: ticket.id,
      customerId: feedback.customerId,
      feedbackId: feedback.id,
      priority,
    });
  }

  if (feedback.rating !== null && feedback.rating <= 2) {
    await persistDomainEvent(feedback.tenantId, "customer.escalated", "customer", feedback.customerId, {
      tenantId: feedback.tenantId,
      customerId: feedback.customerId,
      feedbackId: feedback.id,
      riskLevel: feedback.rating === 1 ? "HIGH" : "MODERATE",
      probability: feedback.rating === 1 ? 0.75 : 0.5,
    });
  }
}

async function persistDomainEvent(
  tenantId: string,
  eventType: string,
  aggregateType: string,
  aggregateId: string,
  payload: Record<string, unknown>
) {
  try {
    await prisma.domainEvent.create({
      data: {
        tenantId,
        eventType,
        aggregateType,
        aggregateId,
        payload: payload as Record<string, string | number | boolean | null>,
      },
    });
  } catch (error) {
    log.error(
      { eventType, aggregateType, aggregateId, err: error },
      "Failed to persist domain event"
    );
  }
}
