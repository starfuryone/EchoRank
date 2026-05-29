import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { createAuditLog } from "@/lib/audit";
import { validate, updateCustomerSchema } from "@/lib/validations";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const membership = await requireTenant();
    const tenantId = membership.tenantId;
    const { id } = await params;

    const customer = await prisma.customer.findFirst({
      where: { id, tenantId },
      include: {
        feedback: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        recoveryTickets: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(customer);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Not authenticated or no tenant access"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching customer:", error);
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

    const existing = await prisma.customer.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, email, phone, location, tags, status } = validate(
      updateCustomerSchema,
      body,
    );

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (email !== undefined) updateData.email = email?.toLowerCase().trim() || null;
    if (phone !== undefined) updateData.phone = phone?.trim() || null;
    if (location !== undefined) updateData.location = location?.trim() || null;
    if (tags !== undefined) updateData.tags = tags;
    if (status !== undefined) updateData.status = status;

    const customer = await prisma.customer.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog({
      tenantId,
      userId: membership.userId,
      action: "UPDATE",
      entity: "Customer",
      entityId: customer.id,
      details: updateData,
    });

    return NextResponse.json(customer);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Not authenticated or no tenant access"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && "statusCode" in error) {
      return NextResponse.json(
        { error: error.message },
        { status: (error as { statusCode: number }).statusCode },
      );
    }
    console.error("Error updating customer:", error);
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

    const existing = await prisma.customer.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    await prisma.customer.delete({
      where: { id },
    });

    await createAuditLog({
      tenantId,
      userId: membership.userId,
      action: "DELETE",
      entity: "Customer",
      entityId: id,
      details: { name: existing.name, email: existing.email },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Not authenticated or no tenant access"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error deleting customer:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
