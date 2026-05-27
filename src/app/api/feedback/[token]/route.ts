import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { routeFeedback } from "@/lib/feedback-router";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const rl = rateLimit(`feedback-view:${ip}`, 30, 60_000);
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
    const rl = rateLimit(`feedback-submit:${ip}`, 10, 60_000);
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
    const { rating, comment } = body;

    if (rating === undefined || rating === null) {
      return NextResponse.json(
        { error: "Rating is required" },
        { status: 400 }
      );
    }

    const ratingNum = typeof rating === "string" ? parseInt(rating, 10) : rating;
    if (typeof ratingNum !== "number" || !Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return NextResponse.json(
        { error: "Rating must be an integer between 1 and 5" },
        { status: 400 }
      );
    }

    if (comment !== undefined && typeof comment !== "string") {
      return NextResponse.json(
        { error: "Comment must be a string" },
        { status: 400 }
      );
    }

    const updatedFeedback = await prisma.feedback.update({
      where: { id: feedback.id },
      data: {
        rating: ratingNum,
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
    console.error("Error submitting feedback:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
