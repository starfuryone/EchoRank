import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import {
  requireFeature,
  enforcementErrorResponse,
} from "@/lib/plan-enforcement";
import { createAuditLog } from "@/lib/audit";
import type { MonitoringPlatform, Prisma } from "@/generated/prisma";

const VALID_PLATFORMS: MonitoringPlatform[] = [
  "GOOGLE", "FACEBOOK", "TRUSTPILOT", "YELP", "REDDIT", "TWITTER",
  "TIKTOK", "YOUTUBE", "APP_STORE", "CUSTOM",
];

export async function GET(request: NextRequest) {
  try {
    const membership = await requireTenant();
    const tenantId = membership.tenantId;

    await requireFeature("reputation_monitoring");

    const searchParams = request.nextUrl.searchParams;
    const platform = searchParams.get("platform") as MonitoringPlatform | null;
    const activeOnly = searchParams.get("active") !== "false";

    const where: Prisma.MonitoringSourceWhereInput = { tenantId };

    if (platform && VALID_PLATFORMS.includes(platform)) {
      where.platform = platform;
    }

    if (activeOnly) {
      where.isActive = true;
    }

    const sources = await prisma.monitoringSource.findMany({
      where,
      include: {
        _count: {
          select: { reviews: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      data: sources,
      total: sources.length,
    });
  } catch (error) {
    const enforcement = enforcementErrorResponse(error);
    if (enforcement) return enforcement;
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message.includes("Not authenticated")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const membership = await requireTenant();
    const tenantId = membership.tenantId;

    await requireFeature("reputation_monitoring");

    const body = await request.json();
    const { platform, externalId, name, url, checkInterval } = body;

    // Validation
    if (!platform || !VALID_PLATFORMS.includes(platform)) {
      return NextResponse.json(
        { error: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(", ")}` },
        { status: 400 }
      );
    }

    if (!externalId || typeof externalId !== "string") {
      return NextResponse.json(
        { error: "externalId is required" },
        { status: 400 }
      );
    }

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    const interval = checkInterval
      ? Math.max(300, Math.min(86400, Number(checkInterval)))
      : 3600;

    // Check for duplicate source
    const existing = await prisma.monitoringSource.findFirst({
      where: { tenantId, platform, externalId },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A monitoring source with this platform and external ID already exists" },
        { status: 409 }
      );
    }

    const source = await prisma.monitoringSource.create({
      data: {
        tenantId,
        platform: platform as MonitoringPlatform,
        externalId,
        name,
        url: url || null,
        credentials: {},
        checkInterval: interval,
        isActive: true,
      },
    });

    await createAuditLog({
      tenantId,
      userId: membership.userId,
      action: "CREATE",
      entity: "MonitoringSource",
      entityId: source.id,
      details: { platform, externalId, name },
    });

    return NextResponse.json({ data: source }, { status: 201 });
  } catch (error) {
    const enforcement = enforcementErrorResponse(error);
    if (enforcement) return enforcement;
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message.includes("Not authenticated")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
