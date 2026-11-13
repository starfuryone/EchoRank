// src/lib/billing/billing-roles.ts — who may change a tenant's subscription.
//
// OWNER and ADMIN, the same pair that manages the tenant itself
// (/api/tenants, /api/team). A MEMBER sees Billing, its plan and its usage,
// but cannot cancel, resume or open the Stripe portal, which can cancel too.
//
// Dependency-free (a type import only) so the Billing card, the account page
// and the API routes all read the same rule.

import type { Role } from "@/generated/prisma";

export const BILLING_ROLES: readonly Role[] = ["OWNER", "ADMIN"] as const;

export function canManageBilling(role: Role | string | null | undefined): boolean {
  return !!role && (BILLING_ROLES as readonly string[]).includes(role);
}
