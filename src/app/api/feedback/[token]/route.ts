import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { addJob } from "@/infrastructure/queue/registry";
import type { FeedbackRoutingJob } from "@/infrastructure/queue/jobs/schemas";
import { validate, submitFeedbackSchema } from "@/lib/validations";
import { logger } from "@/infrastructure/observability/logger";

const log = logger.child({ module: "public-feedback" });

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const rl = await rateLimit(`feedback-view:${ip}`, 30, 60_000);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const { token } = await params;

    const feedback = await prisma.feedback.findUnique({
      where: { token },
      include: {
        tenant: {
          select: {
            name: true,
            logo: true,
            brandPrimaryColor: true,
            brandSecondaryColor: true,
          },
        },
      },
    });

    if (!feedback) {
      return NextResponse.json(
        { error: "Feedback request not found" },
        { status: 404 }
      );
    }

    if (feedback.expiresAt && new Date() > feedback.expiresAt) {
      if (feedback.status === "PENDING") {
        await prisma.feedback.update({
          where: { id: feedback.id },
          data: { status: "EXPIRED" },
        });
      }
      return NextResponse.json(
        { error: "This feedback request has expired" },
        { status: 410 }
      );
    }

    return NextResponse.json({
      status: feedback.status,
      tenant: feedback.tenant,
      submittedAt: feedback.submittedAt,
    });
  } catch (error) {
    log.error({ err: error }, "Error fetching feedback");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const rl = await rateLimit(`feedback-submit:${ip}`, 10, 60_000);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const { token } = await params;

    const feedback = await prisma.feedback.findUnique({
      where: { token },
    });

    if (!feedback) {
      return NextResponse.json(
        { error: "Feedback request not found" },
        { status: 404 }
      );
    }

    if (feedback.status === "SUBMITTED") {
      return NextResponse.json(
        { error: "Feedback has already been submitted" },
        { status: 409 }
      );
    }

    if (feedback.expiresAt && new Date() > feedback.expiresAt) {
      if (feedback.status === "PENDING") {
        await prisma.feedback.update({
          where: { id: feedback.id },
          data: { status: "EXPIRED" },
        });
      }
      return NextResponse.json(
        { error: "This feedback request has expired" },
        { status: 410 }
      );
    }

    const body = await request.json();
    const { rating, comment } = validate(submitFeedbackSchema, body);

    // Atomic guard against concurrent double-submission: only a row still in
    // PENDING is transitioned to SUBMITTED. If another request won the race,
    // `count` is 0 and we report the conflict instead of routing twice.
    const { count } = await prisma.feedback.updateMany({
      where: { id: feedback.id, status: "PENDING" },
      data: {
        rating,
        comment: comment?.trim() || null,
        status: "SUBMITTED",
        submittedAt: new Date(),
      },
    });

    if (count === 0) {
      return NextResponse.json(
        { error: "Feedback has already been submitted" },
        { status: 409 }
      );
    }

    // Routing (review requests / recovery tickets) runs asynchronously via the
    // queue so the customer's submission is never blocked by — or failed
    // because of — downstream routing. The job retries with backoff on failure.
    const jobData: FeedbackRoutingJob = {
      tenantId: feedback.tenantId,
      feedbackId: feedback.id,
      correlationId: randomUUID(),
    };

    try {
      await addJob("feedback-routing", "route-feedback", jobData);
    } catch (err) {
      // The feedback is safely stored; surfacing an error to the customer here
      // would be misleading. Log so routing can be retried/backfilled.
      log.error(
        { feedbackId: feedback.id, tenantId: feedback.tenantId, err },
        "Failed to enqueue feedback routing job"
      );
    }

    return NextResponse.json({
      success: true,
      message: "Thank you for your feedback!",
    });
  } catch (error) {
    if (
      error instanceof Error &&
      "statusCode" in error &&
      typeof (error as Record<string, unknown>).statusCode === "number"
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: (error as Record<string, unknown>).statusCode as number },
      );
    }
    log.error({ err: error }, "Error submitting feedback");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
