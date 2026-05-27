import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import type { TicketStatus, TicketPriority } from "@/generated/prisma";

export async function GET(request: NextRequest) {
  try {
    const membership = await requireTenant();
    const tenantId = membership.tenantId;

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
    );
    const status = searchParams.get("status") as TicketStatus | null;
    const priority = searchParams.get("priority") as TicketPriority | null;

    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };

    const validStatuses: TicketStatus[] = [
      "OPEN",
      "IN_PROGRESS",
      "RESOLVED",
      "CLOSED",
    ];
    if (status && validStatuses.includes(status)) {
      where.status = status;
    }

    const validPriorities: TicketPriority[] = [
      "LOW",
      "MEDIUM",
      "HIGH",
      "URGENT",
    ];
    if (priority && validPriorities.includes(priority)) {
      where.priority = priority;
    }

    const [tickets, total] = await Promise.all([
      prisma.recoveryTicket.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { priority: "desc" },
          { createdAt: "desc" },
        ],
        include: {
          customer: {
            select: { id: true, name: true, email: true, phone: true },
          },
          feedback: {
            select: { id: true, rating: true, comment: true, submittedAt: true },
          },
        },
      }),
      prisma.recoveryTicket.count({ where }),
    ]);

    return NextResponse.json({
      tickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Not authenticated or no tenant access"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error listing recovery tickets:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
