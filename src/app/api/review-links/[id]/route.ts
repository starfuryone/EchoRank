import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { createAuditLog } from "@/lib/audit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const membership = await requireTenant();
    const tenantId = membership.tenantId;
    const { id } = await params;

    const existing = await prisma.reviewLink.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Review link not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { platform, url, label, location, isDefault } = body;

    if (
      platform !== undefined &&
      (typeof platform !== "string" || platform.trim().length === 0)
    ) {
      return NextResponse.json(
        { error: "Platform cannot be empty" },
        { status: 400 }
      );
    }

    if (
      url !== undefined &&
      (typeof url !== "string" || url.trim().length === 0)
    ) {
      return NextResponse.json(
        { error: "URL cannot be empty" },
        { status: 400 }
      );
    }

    if (url !== undefined) {
      try {
        new URL(url);
      } catch {
        return NextResponse.json(
          { error: "Invalid URL format" },
          { status: 400 }
        );
      }
    }

    if (isDefault === true) {
      await prisma.reviewLink.updateMany({
        where: { tenantId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updateData: Record<string, unknown> = {};
    if (platform !== undefined) updateData.platform = platform.trim();
    if (url !== undefined) updateData.url = url.trim();
    if (label !== undefined) updateData.label = label?.trim() || null;
    if (location !== undefined) updateData.location = location?.trim() || null;
    if (isDefault !== undefined) updateData.isDefault = isDefault;

    const reviewLink = await prisma.reviewLink.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog({
      tenantId,
      userId: membership.userId,
      action: "UPDATE",
      entity: "ReviewLink",
      entityId: reviewLink.id,
      details: updateData,
    });

    return NextResponse.json(reviewLink);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Not authenticated or no tenant access"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error updating review link:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const membership = await requireTenant();
    const tenantId = membership.tenantId;
    const { id } = await params;

    const existing = await prisma.reviewLink.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Review link not found" },
        { status: 404 }
      );
    }

    await prisma.reviewLink.delete({ where: { id } });

    await createAuditLog({
      tenantId,
      userId: membership.userId,
      action: "DELETE",
      entity: "ReviewLink",
      entityId: id,
      details: { platform: existing.platform, url: existing.url },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Not authenticated or no tenant access"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error deleting review link:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
