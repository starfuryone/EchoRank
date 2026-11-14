import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { createAuditLog } from "@/lib/audit";
import { feedbackAllowance } from "@/lib/feedback-limit";
import type { FeedbackStatus } from "@/generated/prisma";

export async function GET(request: NextRequest) {
  try {
    const membership = await requireTenant();
    const tenantId = membership.tenantId;

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
    );
    const status = searchParams.get("status") as FeedbackStatus | null;
    const rating = searchParams.get("rating");
    const customerId = searchParams.get("customerId");

    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };

    const validStatuses: FeedbackStatus[] = ["PENDING", "SUBMITTED", "EXPIRED"];
    if (status && validStatuses.includes(status)) {
      where.status = status;
    }

    if (rating) {
      const ratingNum = parseInt(rating, 10);
      if (ratingNum >= 1 && ratingNum <= 5) {
        where.rating = ratingNum;
      }
    }

    if (customerId) {
      where.customerId = customerId;
    }

    const [feedbackList, total] = await Promise.all([
      prisma.feedback.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          customer: {
            select: { id: true, name: true, email: true },
          },
          campaign: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.feedback.count({ where }),
    ]);

    return NextResponse.json({
      feedback: feedbackList,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Not authenticated or no tenant access"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error listing feedback:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const membership = await requireTenant();
    const tenantId = membership.tenantId;

    const body = await request.json();
    const { customerId, campaignId } = body;

    if (!customerId || typeof customerId !== "string") {
      return NextResponse.json(
        { error: "Customer ID is required" },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    if (campaignId) {
      const campaign = await prisma.campaign.findFirst({
        where: { id: campaignId, tenantId },
      });
      if (!campaign) {
        return NextResponse.json(
          { error: "Campaign not found" },
          { status: 404 }
        );
      }
    }

    // The plan's monthly allowance (src/lib/feedback-limit.ts): the same
    // limit and count the /billing meter and the plan hub show. Checked last,
    // after the request is known to be valid, so a bad body is a 400, not a
    // spent slot. Count-then-create, like the SEO and crawl quotas: a race
    // can overshoot by the requests in flight, never by more.
    const allowance = await feedbackAllowance(tenantId);
    if (!allowance.allowed) {
      return NextResponse.json(
        {
          error: `Monthly feedback request limit reached (${allowance.limit.toLocaleString("en-US")} on your plan).`,
          code: "FEEDBACK_LIMIT_REACHED",
          limit: allowance.limit,
          used: allowance.used,
          resetsAt: allowance.resetsAt.toISOString(),
        },
        { status: 429 }
      );
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const token = randomBytes(32).toString("base64url");

    const feedback = await prisma.feedback.create({
      data: {
        tenantId,
        customerId,
        campaignId: campaignId || null,
        status: "PENDING",
        token,
        expiresAt,
      },
    });

    await createAuditLog({
      tenantId,
      userId: membership.userId,
      action: "CREATE",
      entity: "Feedback",
      entityId: feedback.id,
      details: { customerId, token: feedback.token },
    });

    return NextResponse.json(
      {
        id: feedback.id,
        token: feedback.token,
        expiresAt: feedback.expiresAt,
        status: feedback.status,
      },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Not authenticated or no tenant access"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error creating feedback:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
