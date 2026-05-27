import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { routeFeedback } from "@/lib/feedback-router";
import { validate, submitFeedbackSchema } from "@/lib/validations";

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
    console.error("Error fetching feedback:", error);
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

    const updatedFeedback = await prisma.feedback.update({
      where: { id: feedback.id },
      data: {
        rating,
        comment: comment?.trim() || null,
        status: "SUBMITTED",
        submittedAt: new Date(),
      },
    });

    await routeFeedback(updatedFeedback.id);

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
    console.error("Error submitting feedback:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
