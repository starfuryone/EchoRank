import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import {
  requireFeature,
  enforcementErrorResponse,
} from "@/lib/plan-enforcement";
import { createAuditLog } from "@/lib/audit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const membership = await requireTenant();
    const tenantId = membership.tenantId;
    const { id } = await params;

    await requireFeature("reputation_monitoring");

    const source = await prisma.monitoringSource.findFirst({
      where: { id, tenantId },
      include: {
        _count: { select: { reviews: true } },
      },
    });

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    // Get recent reviews for this source
    const recentReviews = await prisma.externalReview.findMany({
      where: { sourceId: id, tenantId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
      data: {
        ...source,
        recentReviews,
      },
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const membership = await requireTenant();
    const tenantId = membership.tenantId;
    const { id } = await params;

    await requireFeature("reputation_monitoring");

    const source = await prisma.monitoringSource.findFirst({
      where: { id, tenantId },
    });

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined && typeof body.name === "string") {
      updateData.name = body.name;
    }

    if (body.url !== undefined) {
      updateData.url = body.url || null;
    }

    if (body.checkInterval !== undefined) {
      updateData.checkInterval = Math.max(300, Math.min(86400, Number(body.checkInterval)));
    }

    if (body.isActive !== undefined) {
      updateData.isActive = Boolean(body.isActive);
    }

    if (body.credentials !== undefined && typeof body.credentials === "object") {
      updateData.credentials = body.credentials;
    }

    const updated = await prisma.monitoringSource.update({
      where: { id, tenantId },
      data: updateData,
    });

    await createAuditLog({
      tenantId,
      userId: membership.userId,
      action: "UPDATE",
      entity: "MonitoringSource",
      entityId: id,
      details: { updatedFields: Object.keys(updateData) },
    });

    return NextResponse.json({ data: updated });
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const membership = await requireTenant();
    const tenantId = membership.tenantId;
    const { id } = await params;

    await requireFeature("reputation_monitoring");

    const source = await prisma.monitoringSource.findFirst({
      where: { id, tenantId },
    });

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    // Soft-deactivate rather than hard delete
    await prisma.monitoringSource.update({
      where: { id, tenantId },
      data: { isActive: false },
    });

    await createAuditLog({
      tenantId,
      userId: membership.userId,
      action: "DEACTIVATE",
      entity: "MonitoringSource",
      entityId: id,
      details: { platform: source.platform, name: source.name },
    });

    return NextResponse.json({ success: true });
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
