import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  try {
    const membership = await requireTenant();
    const tenantId = membership.tenantId;

    const searchParams = request.nextUrl.searchParams;
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const dateFilter: Record<string, unknown> = {};
    if (from) {
      const fromDate = new Date(from);
      if (isNaN(fromDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid 'from' date format" },
          { status: 400 }
        );
      }
      dateFilter.gte = fromDate;
    }
    if (to) {
      const toDate = new Date(to);
      if (isNaN(toDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid 'to' date format" },
          { status: 400 }
        );
      }
      dateFilter.lte = toDate;
    }

    const feedbackWhere: Record<string, unknown> = { tenantId };
    if (Object.keys(dateFilter).length > 0) {
      feedbackWhere.createdAt = dateFilter;
    }

    const recoveryWhere: Record<string, unknown> = { tenantId };
    if (Object.keys(dateFilter).length > 0) {
      recoveryWhere.createdAt = dateFilter;
    }

    const [
      totalFeedbackSent,
      totalResponses,
      feedbackWithRatings,
      reviewRequestsSent,
      recoveryTicketsOpen,
      recoveryTicketsResolved,
      recentFeedbackRaw,
    ] = await Promise.all([
      prisma.feedback.count({ where: feedbackWhere }),
      prisma.feedback.count({
        where: { ...feedbackWhere, status: "SUBMITTED" },
      }),
      prisma.feedback.findMany({
        where: { ...feedbackWhere, status: "SUBMITTED", rating: { not: null } },
        select: { rating: true },
      }),
      prisma.reviewRequest.count({
        where: {
          feedback: feedbackWhere,
        },
      }),
      prisma.recoveryTicket.count({
        where: {
          ...recoveryWhere,
          status: { in: ["OPEN", "IN_PROGRESS"] },
        },
      }),
      prisma.recoveryTicket.count({
        where: { ...recoveryWhere, status: "RESOLVED" },
      }),
      // The dashboard's "Recent Feedback" list. Newest 8, with customer name.
      prisma.feedback.findMany({
        where: feedbackWhere,
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          rating: true,
          comment: true,
          status: true,
          createdAt: true,
          customer: { select: { name: true } },
        },
      }),
    ]);

    const ratings = feedbackWithRatings
      .map((f) => f.rating)
      .filter((r): r is number => r !== null);

    const averageRating =
      ratings.length > 0
        ? Math.round(
            (ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 10
          ) / 10
        : null;

    const positiveFeedback = ratings.filter((r) => r >= 4).length;
    const negativeFeedback = ratings.filter((r) => r <= 3).length;

    const responseRate =
      totalFeedbackSent > 0
        ? Math.round((totalResponses / totalFeedbackSent) * 100 * 10) / 10
        : 0;

    // Shape matches the dashboard page's `Analytics` interface exactly. The
    // page is the contract; renaming here (rather than there) keeps every
    // consumer of the UI stable. Extra fields (responseRate, reviewRequestsSent,
    // recoveryTicketsResolved) are harmless and available for other callers.
    return NextResponse.json({
      totalSent: totalFeedbackSent,
      totalResponses,
      avgRating: averageRating ?? 0,
      positiveCount: positiveFeedback,
      negativeCount: negativeFeedback,
      recoveryOpen: recoveryTicketsOpen,
      recentFeedback: recentFeedbackRaw.map((f) => ({
        id: f.id,
        customerName: f.customer?.name ?? "Unknown",
        rating: f.rating,
        comment: f.comment,
        status: f.status,
        createdAt: f.createdAt.toISOString(),
      })),
      // Retained for other consumers / future use:
      responseRate,
      reviewRequestsSent,
      recoveryTicketsResolved,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Not authenticated or no tenant access"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching analytics:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
