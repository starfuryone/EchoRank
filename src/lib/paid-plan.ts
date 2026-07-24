// src/lib/paid-plan.ts
// First subscription-STATUS gate in the app (all five PlanType values are
// paid tiers; requirePlan/requireFeature only ever read tenant.planType).
//
// Paid = billing status ACTIVE, and nothing else. That follows the Stripe
// webhook's own doctrine (src/app/api/webhooks/route.ts mapStripeStatus):
// PAST_DUE is documented there as "the safe, access-denying state", and
// unknown/incomplete/paused Stripe statuses are deliberately mapped to it.
// TRIALING (the schema default for new tenants) and CANCELED are unpaid.
//
// Status source: the Subscription row when one exists (Stripe-webhook
// maintained), falling back to tenant.billingStatus — the webhook dual-writes
// both, but tenants created outside Stripe checkout (all six current
// production tenants) have NO Subscription row at all, only the tenant field.
// Gating on the row alone would lock every existing tenant out.

import type { BillingStatus } from "@/generated/prisma";

export function isPaidStatus(status: BillingStatus | null | undefined): boolean {
  return status === "ACTIVE";
}

/** Effective billing status: Subscription row first, tenant field as fallback.
 * Prisma is imported lazily so the pure predicate above stays importable in
 * DB-less contexts (node --test config tests). */
export async function getBillingStatus(tenantId: string): Promise<BillingStatus | null> {
  const { prisma } = await import("@/lib/prisma");
  const sub = await prisma.subscription.findUnique({
    where: { tenantId },
    select: { status: true },
  });
  if (sub) return sub.status;
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { billingStatus: true },
  });
  return tenant?.billingStatus ?? null;
}

export async function hasPaidPlan(tenantId: string): Promise<boolean> {
  return isPaidStatus(await getBillingStatus(tenantId));
}

export class PaidPlanRequiredError extends Error {
  public readonly statusCode = 403;
  public readonly billingStatus: BillingStatus | null;

  constructor(billingStatus: BillingStatus | null) {
    super(
      `An active paid subscription is required. Current billing status: ${billingStatus ?? "none"}.`,
    );
    this.name = "PaidPlanRequiredError";
    this.billingStatus = billingStatus;
  }
}

/**
 * Guard for API handlers and server pages: authenticated membership on a
 * tenant whose effective billing status is ACTIVE. Throws
 * PaidPlanRequiredError otherwise (mapped to 403 by enforcementErrorResponse).
 * Pages that prefer a rendered upgrade state over an error should call
 * hasPaidPlan() and branch instead.
 */
export async function requirePaidPlan() {
  const { requireTenant } = await import("@/lib/tenant");
  const membership = await requireTenant();
  const status = await getBillingStatus(membership.tenantId);
  if (!isPaidStatus(status)) {
    throw new PaidPlanRequiredError(status);
  }
  return membership;
}
