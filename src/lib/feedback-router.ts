import { prisma } from "./prisma";

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

  if (reviewLink) {
    await prisma.reviewRequest.create({
      data: {
        feedbackId: feedback.id,
        platform: reviewLink.platform,
        url: reviewLink.url,
      },
    });
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

  await prisma.recoveryTicket.create({
    data: {
      tenantId: feedback.tenantId,
      customerId: feedback.customerId,
      feedbackId: feedback.id,
      priority: priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
    },
  });

  await prisma.customer.update({
    where: { id: feedback.customerId },
    data: { status: "NEEDS_FOLLOWUP" },
  });
}
