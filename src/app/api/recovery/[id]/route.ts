import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { createAuditLog } from "@/lib/audit";
import type { TicketStatus, TicketPriority } from "@/generated/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const membership = await requireTenant();
    const tenantId = membership.tenantId;
    const { id } = await params;

    const existing = await prisma.recoveryTicket.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Recovery ticket not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { status, priority, assignedTo, notes } = body;

    const validStatuses: TicketStatus[] = [
      "OPEN",
      "IN_PROGRESS",
      "RESOLVED",
      "CLOSED",
    ];
    if (status !== undefined && !validStatuses.includes(status)) {
      return NextResponse.json(
        {
          error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const validPriorities: TicketPriority[] = [
      "LOW",
      "MEDIUM",
      "HIGH",
      "URGENT",
    ];
    if (priority !== undefined && !validPriorities.includes(priority)) {
      return NextResponse.json(
        {
          error: `Invalid priority. Must be one of: ${validPriorities.join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (
      assignedTo !== undefined &&
      assignedTo !== null &&
      typeof assignedTo !== "string"
    ) {
      return NextResponse.json(
        { error: "assignedTo must be a string or null" },
        { status: 400 }
      );
    }

    if (notes !== undefined && notes !== null && typeof notes !== "string") {
      return NextResponse.json(
        { error: "notes must be a string or null" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) {
      updateData.status = status;
      if (status === "RESOLVED") {
        updateData.resolvedAt = new Date();
      }
    }
    if (priority !== undefined) updateData.priority = priority;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo || null;
    if (notes !== undefined) updateData.notes = notes || null;

    const ticket = await prisma.recoveryTicket.update({
      where: { id },
      data: updateData,
    });

    if (status === "RESOLVED") {
      await prisma.customer.update({
        where: { id: existing.customerId },
        data: { status: "RECOVERED" },
      });
    }

    await createAuditLog({
      tenantId,
      userId: membership.userId,
      action: "UPDATE",
      entity: "RecoveryTicket",
      entityId: ticket.id,
      details: updateData,
    });

    return NextResponse.json(ticket);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Not authenticated or no tenant access"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error updating recovery ticket:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
