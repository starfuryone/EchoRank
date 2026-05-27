import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { createAuditLog } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    const membership = await requireTenant();
    const tenantId = membership.tenantId;

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type");

    if (type && type !== "email" && type !== "sms") {
      return NextResponse.json(
        { error: "Invalid type. Must be 'email' or 'sms'" },
        { status: 400 }
      );
    }

    const [emailTemplates, smsTemplates] = await Promise.all([
      !type || type === "email"
        ? prisma.emailTemplate.findMany({
            where: { tenantId },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),
      !type || type === "sms"
        ? prisma.smsTemplate.findMany({
            where: { tenantId },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),
    ]);

    return NextResponse.json({
      emailTemplates,
      smsTemplates,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Not authenticated or no tenant access"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error listing templates:", error);
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
    const { name, subject, body: templateBody, type, channel } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Template name is required" },
        { status: 400 }
      );
    }

    if (
      !templateBody ||
      typeof templateBody !== "string" ||
      templateBody.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "Template body is required" },
        { status: 400 }
      );
    }

    const validTypes = ["feedback_request", "review_request", "recovery"];
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json(
        {
          error: `Invalid type. Must be one of: ${validTypes.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const templateChannel = channel || "email";

    if (templateChannel === "sms") {
      const template = await prisma.smsTemplate.create({
        data: {
          tenantId,
          name: name.trim(),
          body: templateBody.trim(),
          type,
        },
      });

      await createAuditLog({
        tenantId,
        userId: membership.userId,
        action: "CREATE",
        entity: "SmsTemplate",
        entityId: template.id,
        details: { name: template.name, type: template.type },
      });

      return NextResponse.json(template, { status: 201 });
    }

    if (
      !subject ||
      typeof subject !== "string" ||
      subject.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "Subject is required for email templates" },
        { status: 400 }
      );
    }

    const template = await prisma.emailTemplate.create({
      data: {
        tenantId,
        name: name.trim(),
        subject: subject.trim(),
        body: templateBody.trim(),
        type,
      },
    });

    await createAuditLog({
      tenantId,
      userId: membership.userId,
      action: "CREATE",
      entity: "EmailTemplate",
      entityId: template.id,
      details: { name: template.name, type: template.type },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Not authenticated or no tenant access"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error creating template:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
