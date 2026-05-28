import { prisma } from "./prisma";
import { logger } from "@/infrastructure/observability/logger";

const log = logger.child({ module: "feedback-router" });

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
