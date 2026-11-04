// src/lib/api-tenant-context.ts
//
// Lets a public-API route (/api/public/v1/*, Bearer-key auth) run a dashboard
// handler as the key's tenant, so the public crawl API answers with exactly
// the dashboard's shapes (the Issues, Pages, export and cancel handlers)
// instead of a second copy of each that could drift.
//
// HOW IT IS SAFE. The store is set only by runAsApiTenant(), which a public
// route calls AFTER authenticatePublicRequest() has verified the key, its
// "public" scope, the tenant's paid status and the per-key rate limit. Inside
// that call, and nowhere else, requirePaidPlan() (src/lib/paid-plan.ts)
// returns the key's tenant instead of reading the session. AsyncLocalStorage
// scopes it to that request's async chain: concurrent requests never see each
// other's tenant, and a session request never sees one at all.
//
// The membership is synthetic (no user): the crawl handlers read tenantId and
// tenant.planType only. Do not run a handler that reads the user through it.

import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import type { Role, Tenant } from "@/generated/prisma";

export interface ApiTenantMembership {
  id: string;
  tenantId: string;
  userId: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
  tenant: Tenant;
}

const store = new AsyncLocalStorage<ApiTenantMembership>();

/** The API key's tenant while a public route runs a handler; null otherwise (every session request). */
export function apiTenantMembership(): ApiTenantMembership | null {
  return store.getStore() ?? null;
}

/** Run `fn` as the key's tenant. Call only after authenticatePublicRequest() succeeded. */
export async function runAsApiTenant<T>(auth: { tenantId: string; keyId: string }, fn: () => Promise<T>): Promise<T> {
  const { prisma } = await import("@/lib/prisma");
  const tenant = await prisma.tenant.findUnique({ where: { id: auth.tenantId } });
  if (!tenant) throw new Error("API key tenant not found");
  const now = new Date();
  const membership: ApiTenantMembership = {
    id: `apikey:${auth.keyId}`,
    tenantId: tenant.id,
    userId: `apikey:${auth.keyId}`,
    role: "MEMBER",
    createdAt: now,
    updatedAt: now,
    tenant,
  };
  return store.run(membership, fn);
}
