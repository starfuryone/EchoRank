import { NextRequest } from "next/server";
import { createApiHandler } from "@/lib/api-handler";
import { validate, createCustomerSchema } from "@/lib/validations";
import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";

export const GET = createApiHandler(async (request: NextRequest) => {
  const membership = await requireTenant();
  const tenantId = membership.tenantId;

  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") || "20", 10)),
  );
  const search = searchParams.get("search")?.trim();

  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { tenantId, deletedAt: null };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.customer.count({ where }),
  ]);

  return {
    customers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
});

export const POST = createApiHandler(
  async (request: NextRequest) => {
    const membership = await requireTenant();
    const tenantId = membership.tenantId;

    const body = await request.json();
    const data = validate(createCustomerSchema, body);

    const customer = await prisma.customer.create({
      data: {
        tenantId,
        name: data.name.trim(),
        email: data.email?.toLowerCase().trim() || null,
        phone: data.phone?.trim() || null,
        location: data.location?.trim() || null,
        tags: data.tags || [],
      },
    });

    await createAuditLog({
      tenantId,
      userId: membership.userId,
      action: "CREATE",
      entity: "Customer",
      entityId: customer.id,
      details: { name: customer.name, email: customer.email },
    });

    return { customer };
  },
  { requireAuth: true },
);
