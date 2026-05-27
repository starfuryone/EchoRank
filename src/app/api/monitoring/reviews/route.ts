import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import type { MonitoringPlatform, RiskLevel, Prisma } from "@/generated/prisma";

const VALID_PLATFORMS: MonitoringPlatform[] = [
  "GOOGLE", "FACEBOOK", "TRUSTPILOT", "YELP", "REDDIT", "TWITTER",
  "TIKTOK", "YOUTUBE", "APP_STORE", "CUSTOM",
];

const VALID_RISK_LEVELS: RiskLevel[] = ["LOW", "MODERATE", "HIGH", "CRITICAL"];

export async function GET(request: NextRequest) {
  try {
    const membership = await requireTenant();
    const tenantId = membership.tenantId;

    const searchParams = request.nextUrl.searchParams;
    const platform = searchParams.get("platform") as MonitoringPlatform | null;
    const riskLevel = searchParams.get("riskLevel") as RiskLevel | null;
    const since = searchParams.get("since");
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "50", 10))
    );
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

    const where: Prisma.ExternalReviewWhereInput = { tenantId };

    if (platform && VALID_PLATFORMS.includes(platform)) {
      where.platform = platform;
    }

    if (riskLevel && VALID_RISK_LEVELS.includes(riskLevel)) {
      where.riskLevel = riskLevel;
    }

    if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        where.publishedAt = { gte: sinceDate };
      }
    }

    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      prisma.externalReview.findMany({
        where,
        include: {
          source: {
            select: { id: true, name: true, platform: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
      }),
      prisma.externalReview.count({ where }),
    ]);

    return NextResponse.json({
      data: reviews,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message.includes("Not authenticated")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
