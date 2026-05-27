import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { createAuditLog } from "@/lib/audit";

export async function GET() {
  try {
    const membership = await requireTenant();
    const tenantId = membership.tenantId;

    const reviewLinks = await prisma.reviewLink.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ reviewLinks });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Not authenticated or no tenant access"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error listing review links:", error);
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
    const { platform, url, label, location, isDefault } = body;

    if (
      !platform ||
      typeof platform !== "string" ||
      platform.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "Platform is required" },
        { status: 400 }
      );
    }

    if (!url || typeof url !== "string" || url.trim().length === 0) {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    if (isDefault) {
      await prisma.reviewLink.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const reviewLink = await prisma.reviewLink.create({
      data: {
        tenantId,
        platform: platform.trim(),
        url: url.trim(),
        label: label?.trim() || null,
        location: location?.trim() || null,
        isDefault: isDefault || false,
      },
    });

    await createAuditLog({
      tenantId,
      userId: membership.userId,
      action: "CREATE",
      entity: "ReviewLink",
      entityId: reviewLink.id,
      details: { platform: reviewLink.platform, url: reviewLink.url },
    });

    return NextResponse.json(reviewLink, { status: 201 });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Not authenticated or no tenant access"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error creating review link:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
