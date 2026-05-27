import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { createAuditLog } from "@/lib/audit";
import type { MessageChannel } from "@/generated/prisma";

export async function GET() {
  try {
    const membership = await requireTenant();
    const tenantId = membership.tenantId;

    const campaigns = await prisma.campaign.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { feedback: true },
        },
      },
    });

    return NextResponse.json({ campaigns });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Not authenticated or no tenant access"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error listing campaigns:", error);
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
    const { name, description, channel, location } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Campaign name is required" },
        { status: 400 }
      );
    }

    const validChannels: MessageChannel[] = ["EMAIL", "SMS"];
    if (channel && !validChannels.includes(channel)) {
      return NextResponse.json(
        { error: `Invalid channel. Must be one of: ${validChannels.join(", ")}` },
        { status: 400 }
      );
    }

    const campaign = await prisma.campaign.create({
      data: {
        tenantId,
        name: name.trim(),
        description: description?.trim() || null,
        channel: channel || "EMAIL",
        location: location?.trim() || null,
      },
    });

    await createAuditLog({
      tenantId,
      userId: membership.userId,
      action: "CREATE",
      entity: "Campaign",
      entityId: campaign.id,
      details: { name: campaign.name, channel: campaign.channel },
    });

    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Not authenticated or no tenant access"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error creating campaign:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
