import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { createAuditLog } from "@/lib/audit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const membership = await requireTenant();
    const tenantId = membership.tenantId;
    const { id } = await params;

    const channel = request.nextUrl.searchParams.get("channel") || "email";

    const body = await request.json();
    const { name, subject, body: templateBody, type } = body;

    if (
      name !== undefined &&
      (typeof name !== "string" || name.trim().length === 0)
    ) {
      return NextResponse.json(
        { error: "Name cannot be empty" },
        { status: 400 }
      );
    }

    if (
      templateBody !== undefined &&
      (typeof templateBody !== "string" || templateBody.trim().length === 0)
    ) {
      return NextResponse.json(
        { error: "Body cannot be empty" },
        { status: 400 }
      );
    }

    const validTypes = ["feedback_request", "review_request", "recovery"];
    if (type !== undefined && !validTypes.includes(type)) {
      return NextResponse.json(
        {
          error: `Invalid type. Must be one of: ${validTypes.join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (channel === "sms") {
      const existing = await prisma.smsTemplate.findFirst({
        where: { id, tenantId },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Template not found" },
          { status: 404 }
        );
      }

      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name.trim();
      if (templateBody !== undefined) updateData.body = templateBody.trim();
      if (type !== undefined) updateData.type = type;

      const template = await prisma.smsTemplate.update({
        where: { id, tenantId },
        data: updateData,
      });

      await createAuditLog({
        tenantId,
        userId: membership.userId,
        action: "UPDATE",
        entity: "SmsTemplate",
        entityId: template.id,
        details: updateData,
      });

      return NextResponse.json(template);
    }

    const existing = await prisma.emailTemplate.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    if (
      subject !== undefined &&
      (typeof subject !== "string" || subject.trim().length === 0)
    ) {
      return NextResponse.json(
        { error: "Subject cannot be empty" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (subject !== undefined) updateData.subject = subject.trim();
    if (templateBody !== undefined) updateData.body = templateBody.trim();
    if (type !== undefined) updateData.type = type;

    const template = await prisma.emailTemplate.update({
      where: { id, tenantId },
      data: updateData,
    });

    await createAuditLog({
      tenantId,
      userId: membership.userId,
      action: "UPDATE",
      entity: "EmailTemplate",
      entityId: template.id,
      details: updateData,
    });

    return NextResponse.json(template);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Not authenticated or no tenant access"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error updating template:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
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

    const channel = request.nextUrl.searchParams.get("channel") || "email";

    if (channel === "sms") {
      const existing = await prisma.smsTemplate.findFirst({
        where: { id, tenantId },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Template not found" },
          { status: 404 }
        );
      }

      await prisma.smsTemplate.delete({ where: { id, tenantId } });

      await createAuditLog({
        tenantId,
        userId: membership.userId,
        action: "DELETE",
        entity: "SmsTemplate",
        entityId: id,
        details: { name: existing.name, type: existing.type },
      });

      return NextResponse.json({ success: true });
    }

    const existing = await prisma.emailTemplate.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    await prisma.emailTemplate.delete({ where: { id, tenantId } });

    await createAuditLog({
      tenantId,
      userId: membership.userId,
      action: "DELETE",
      entity: "EmailTemplate",
      entityId: id,
      details: { name: existing.name, type: existing.type },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Not authenticated or no tenant access"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error deleting template:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
