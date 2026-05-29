import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/tenant";
import { createAuditLog } from "@/lib/audit";
import type { Role } from "@/generated/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const membership = await requireRole(["OWNER", "ADMIN"]);
    const tenantId = membership.tenantId;
    const { id } = await params;

    const existing = await prisma.tenantMember.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Team member not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { role } = body;

    const validRoles: Role[] = ["OWNER", "ADMIN", "MEMBER"];
    if (!role || !validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(", ")}` },
        { status: 400 }
      );
    }

    if (existing.userId === membership.userId) {
      return NextResponse.json(
        { error: "You cannot change your own role" },
        { status: 400 }
      );
    }

    if (existing.role === "OWNER" && membership.role !== "OWNER") {
      return NextResponse.json(
        { error: "Only owners can change an owner's role" },
        { status: 403 }
      );
    }

    const member = await prisma.tenantMember.update({
      where: { id, tenantId },
      data: { role },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    await createAuditLog({
      tenantId,
      userId: membership.userId,
      action: "UPDATE",
      entity: "TenantMember",
      entityId: member.id,
      details: { previousRole: existing.role, newRole: role },
    });

    return NextResponse.json(member);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Not authenticated or no tenant access"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      error instanceof Error &&
      error.message === "Insufficient permissions"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Error updating team member:", error);
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
    const membership = await requireRole(["OWNER"]);
    const tenantId = membership.tenantId;
    const { id } = await params;

    const existing = await prisma.tenantMember.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Team member not found" },
        { status: 404 }
      );
    }

    if (existing.userId === membership.userId) {
      return NextResponse.json(
        { error: "You cannot remove yourself from the team" },
        { status: 400 }
      );
    }

    const memberUser = await prisma.user.findUnique({
      where: { id: existing.userId },
      select: { email: true, name: true },
    });

    await prisma.tenantMember.delete({ where: { id, tenantId } });

    await createAuditLog({
      tenantId,
      userId: membership.userId,
      action: "DELETE",
      entity: "TenantMember",
      entityId: id,
      details: {
        removedUserId: existing.userId,
        email: memberUser?.email,
        role: existing.role,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Not authenticated or no tenant access"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      error instanceof Error &&
      error.message === "Insufficient permissions"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Error removing team member:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
