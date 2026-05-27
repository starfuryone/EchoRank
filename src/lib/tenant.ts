import { auth } from "./auth";
import { prisma } from "./prisma";
import type { Role } from "@/generated/prisma";

export async function getCurrentTenant() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const membership = await prisma.tenantMember.findFirst({
    where: { userId: session.user.id },
    include: { tenant: true },
    orderBy: { createdAt: "asc" },
  });

  return membership;
}

export async function requireTenant() {
  const membership = await getCurrentTenant();
  if (!membership) {
    throw new Error("Not authenticated or no tenant access");
  }
  return membership;
}

export async function requireRole(requiredRoles: Role[]) {
  const membership = await requireTenant();
  if (!requiredRoles.includes(membership.role)) {
    throw new Error("Insufficient permissions");
  }
  return membership;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}
