import "server-only";

// src/lib/plan-access-server.ts — the plan behind a request or a tenant, for
// the gates in src/lib/plan-access.ts that run outside a page render: the
// proxy (every signed-in /api call) and the background workers.
//
// THE PROXY READS THIS ON EVERY TENANT API CALL, so the plan is cached in
// process for 30 seconds per (user, active tenant). An upgrade or downgrade
// therefore reaches the API gate within 30 seconds; the page gate (the
// (dashboard) layout) reads the plan fresh on every render. An in-process cache
// is right here and wrong for a counter (CLAUDE.md "Data and limits"): it only
// saves a read, and a deploy that empties it costs one query.
import type { PlanType } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { planAllowsArea, type AccessArea } from "@/lib/plan-access";

const TTL_MS = 30_000;
const cache = new Map<string, { plan: PlanType | null; at: number }>();

/** For tests. */
export function clearPlanCache(): void {
  cache.clear();
}

/**
 * The plan of the tenant a signed-in user is acting as: the active-tenant
 * cookie's when they are a member of it, else their oldest membership's, the
 * same rule as getCurrentTenant() (src/lib/tenant.ts). Null without one.
 */
export async function sessionPlan(userId: string, activeTenantId?: string | null, now = Date.now()): Promise<PlanType | null> {
  const key = `${userId}:${activeTenantId ?? ""}`;
  const hit = cache.get(key);
  if (hit && now - hit.at < TTL_MS) return hit.plan;

  let membership = activeTenantId
    ? await prisma.tenantMember.findFirst({
        where: { userId, tenantId: activeTenantId },
        select: { tenant: { select: { planType: true } } },
      })
    : null;
  if (!membership) {
    membership = await prisma.tenantMember.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { tenant: { select: { planType: true } } },
    });
  }
  const plan = membership?.tenant.planType ?? null;
  cache.set(key, { plan, at: now });
  return plan;
}

/** A tenant's plan, read fresh (workers: plans change between enqueue and run). */
export async function tenantPlan(tenantId: string): Promise<PlanType | null> {
  const row = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { planType: true } });
  return row?.planType ?? null;
}

/** Does this tenant's plan, right now, include the area? False for a vanished tenant. */
export async function tenantAllowsArea(tenantId: string, area: AccessArea): Promise<boolean> {
  const plan = await tenantPlan(tenantId);
  return plan !== null && planAllowsArea(plan, area);
}
