import { cookies } from "next/headers";
import { auth } from "./auth";
import { prisma } from "./prisma";
import { setCurrentTenantId } from "@/infrastructure/observability/tracing";
import type { Role } from "@/generated/prisma";

/**
 * Cookie that records which tenant the user is currently acting within.
 * Users may belong to multiple tenants (organizations / locations); this is
 * how they switch between them. When unset or invalid, we fall back to the
 * user's oldest membership.
 */
export const ACTIVE_TENANT_COOKIE = "echorank_active_tenant";

export async function getCurrentTenant() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const userId = session.user.id;
  const cookieStore = await cookies();
  const activeTenantId = cookieStore.get(ACTIVE_TENANT_COOKIE)?.value;

  let membership = null;

  // Honor the explicitly selected active tenant when the user is a member of it.
  if (activeTenantId) {
    membership = await prisma.tenantMember.findFirst({
      where: { userId, tenantId: activeTenantId },
      include: { tenant: true },
    });
  }

  // Fall back to the oldest membership when no valid active tenant is selected.
  if (!membership) {
    membership = await prisma.tenantMember.findFirst({
      where: { userId },
      include: { tenant: true },
      orderBy: { createdAt: "asc" },
    });
  }

  if (membership) {
    setCurrentTenantId(membership.tenantId);
  }

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

/**
 * Returns every tenant the current user belongs to, oldest first. Used to
 * populate the tenant switcher.
 */
export async function listMemberships() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.tenantMember.findMany({
    where: { userId: session.user.id },
    include: {
      tenant: {
        select: { id: true, name: true, slug: true, logo: true, planType: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Switches the active tenant for the current user after verifying membership.
 * Must be called from a route handler or server action (it writes a cookie).
 */
export async function setActiveTenant(tenantId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated or no tenant access");
  }

  const membership = await prisma.tenantMember.findFirst({
    where: { userId: session.user.id, tenantId },
    include: { tenant: true },
  });

  if (!membership) {
    throw new Error("Not a member of the requested tenant");
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_TENANT_COOKIE, tenantId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return membership;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}
