import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireTenant, requireRole } from "@/lib/tenant";
import { createAuditLog } from "@/lib/audit";
import type { Role } from "@/generated/prisma";

export async function GET() {
  try {
    const membership = await requireTenant();
    const tenantId = membership.tenantId;

    const members = await prisma.tenantMember.findMany({
      where: { tenantId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ members });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Not authenticated or no tenant access"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error listing team members:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const membership = await requireRole(["OWNER", "ADMIN"]);
    const tenantId = membership.tenantId;

    const body = await request.json();
    const { email, role } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "Valid email is required" },
        { status: 400 }
      );
    }

    const validRoles: Role[] = ["OWNER", "ADMIN", "MEMBER"];
    if (role && !validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(", ")}` },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingMember = await prisma.tenantMember.findFirst({
      where: {
        tenantId,
        user: { email: normalizedEmail },
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: "This user is already a member of this team" },
        { status: 409 }
      );
    }

    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      // Create user WITHOUT a password — they must complete registration via invite
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          passwordHash: null,
        },
      });
    }

    // Generate a signed invite token
    const inviteToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    // Store invite token in the VerificationToken table
    await prisma.verificationToken.create({
      data: {
        identifier: normalizedEmail,
        token: inviteToken,
        expires: expiresAt,
      },
    });

    const member = await prisma.tenantMember.create({
      data: {
        tenantId,
        userId: user.id,
        role: role || "MEMBER",
      },
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
      action: "CREATE",
      entity: "TenantMember",
      entityId: member.id,
      details: { email: normalizedEmail, role: role || "MEMBER" },
    });

    // In dev mode, log the invite URL for easy testing
    if (process.env.NODE_ENV !== "production") {
      const authUrl = process.env.AUTH_URL || "http://localhost:3000";
      const inviteUrl = `${authUrl}/register?invite=${inviteToken}&email=${encodeURIComponent(normalizedEmail)}`;
      console.log(`[Team] Invite URL for ${normalizedEmail}: ${inviteUrl}`);
    }

    return NextResponse.json(member, { status: 201 });
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
    console.error("Error inviting team member:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
