import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import type { RiskLevel } from "@/generated/prisma";

export async function GET(request: NextRequest) {
  try {
    const membership = await requireTenant();
    const tenantId = membership.tenantId;

    const searchParams = request.nextUrl.searchParams;
    const riskLevel = searchParams.get("riskLevel") as RiskLevel | null;
    const acknowledged = searchParams.get("acknowledged");
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10)),
    );
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };

    const validRiskLevels: RiskLevel[] = ["LOW", "MODERATE", "HIGH", "CRITICAL"];
    if (riskLevel && validRiskLevels.includes(riskLevel)) {
      where.riskLevel = riskLevel;
    }

    if (acknowledged === "true") {
      where.acknowledged = true;
    } else if (acknowledged === "false") {
      where.acknowledged = false;
    }

    const [alerts, total] = await Promise.all([
      prisma.escalationAlert.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ riskLevel: "desc" }, { createdAt: "desc" }],
      }),
      prisma.escalationAlert.count({ where }),
    ]);

    return NextResponse.json({
      alerts,
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
    console.error("Error listing alerts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const membership = await requireTenant();
    const tenantId = membership.tenantId;

    const body = await request.json();
    const { alertId, action } = body;

    if (!alertId || typeof alertId !== "string") {
      return NextResponse.json(
        { error: "alertId is required" },
        { status: 400 },
      );
    }

    if (!action || !["acknowledge", "resolve"].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "acknowledge" or "resolve"' },
        { status: 400 },
      );
    }

    const alert = await prisma.escalationAlert.findFirst({
      where: { id: alertId, tenantId },
    });

    if (!alert) {
      return NextResponse.json(
        { error: "Alert not found" },
        { status: 404 },
      );
    }

    const updateData: Record<string, unknown> = {};

    if (action === "acknowledge") {
      updateData.acknowledged = true;
      updateData.acknowledgedBy = membership.userId;
      updateData.acknowledgedAt = new Date();
    } else if (action === "resolve") {
      updateData.acknowledged = true;
      updateData.acknowledgedBy = alert.acknowledgedBy ?? membership.userId;
      updateData.acknowledgedAt = alert.acknowledgedAt ?? new Date();
      updateData.resolvedAt = new Date();
    }

    const updated = await prisma.escalationAlert.update({
      where: { id: alertId },
      data: updateData,
    });

    return NextResponse.json({ alert: updated });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Not authenticated or no tenant access"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error updating alert:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
