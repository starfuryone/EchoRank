import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { createAuditLog } from "@/lib/audit";
import type { CampaignStatus, MessageChannel } from "@/generated/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const membership = await requireTenant();
    const tenantId = membership.tenantId;
    const { id } = await params;

    const campaign = await prisma.campaign.findFirst({
      where: { id, tenantId },
      include: {
        feedback: {
          select: {
            id: true,
            rating: true,
            status: true,
            submittedAt: true,
          },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    const totalFeedback = campaign.feedback.length;
    const submittedFeedback = campaign.feedback.filter(
      (f) => f.status === "SUBMITTED"
    );
    const ratings = submittedFeedback
      .map((f) => f.rating)
      .filter((r): r is number => r !== null);

    const stats = {
      totalSent: totalFeedback,
      totalResponses: submittedFeedback.length,
      responseRate:
        totalFeedback > 0
          ? Math.round((submittedFeedback.length / totalFeedback) * 100)
          : 0,
      averageRating:
        ratings.length > 0
          ? Math.round(
              (ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 10
            ) / 10
          : null,
      positiveFeedback: ratings.filter((r) => r >= 4).length,
      negativeFeedback: ratings.filter((r) => r <= 3).length,
    };

    const { feedback: _feedback, ...campaignData } = campaign;

    return NextResponse.json({ ...campaignData, stats });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Not authenticated or no tenant access"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching campaign:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const membership = await requireTenant();
    const tenantId = membership.tenantId;
    const { id } = await params;

    const existing = await prisma.campaign.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, description, status, channel, location, scheduledAt } = body;

    if (
      name !== undefined &&
      (typeof name !== "string" || name.trim().length === 0)
    ) {
      return NextResponse.json(
        { error: "Name cannot be empty" },
        { status: 400 }
      );
    }

    const validStatuses: CampaignStatus[] = [
      "DRAFT",
      "ACTIVE",
      "PAUSED",
      "COMPLETED",
    ];
    if (status !== undefined && !validStatuses.includes(status)) {
      return NextResponse.json(
        {
          error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const validChannels: MessageChannel[] = ["EMAIL", "SMS"];
    if (channel !== undefined && !validChannels.includes(channel)) {
      return NextResponse.json(
        {
          error: `Invalid channel. Must be one of: ${validChannels.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined)
      updateData.description = description?.trim() || null;
    if (status !== undefined) {
      updateData.status = status;
      if (status === "ACTIVE" && !existing.startedAt) {
        updateData.startedAt = new Date();
      }
      if (status === "COMPLETED") {
        updateData.completedAt = new Date();
      }
    }
    if (channel !== undefined) updateData.channel = channel;
    if (location !== undefined) updateData.location = location?.trim() || null;
    if (scheduledAt !== undefined)
      updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;

    const campaign = await prisma.campaign.update({
      where: { id, tenantId },
      data: updateData,
    });

    await createAuditLog({
      tenantId,
      userId: membership.userId,
      action: "UPDATE",
      entity: "Campaign",
      entityId: campaign.id,
      details: updateData,
    });

    return NextResponse.json(campaign);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Not authenticated or no tenant access"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error updating campaign:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
