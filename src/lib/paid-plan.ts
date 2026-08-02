// src/lib/paid-plan.ts
// First subscription-STATUS gate in the app (all five PlanType values are
// paid tiers; requirePlan/requireFeature only ever read tenant.planType).
//
// Paid = billing status ACTIVE, OR TRIALING **when a Subscription row exists**.
//
// The narrow trial rule is deliberate. TRIALING is also the Prisma default for
// Tenant.billingStatus, so accepting it on its own would hand tool access to
// every tenant ever created outside Stripe — including all eight current
// production tenants. A Subscription row only exists because the Stripe webhook
// wrote one, so requiring it is what distinguishes "a real Stripe trial, card
// on file" from "the column default nobody set".
//
// Everything else follows the webhook's own doctrine
// (src/app/api/webhooks/route.ts mapStripeStatus): PAST_DUE is documented
// there as "the safe, access-denying state", and unknown/incomplete/paused
// Stripe statuses are deliberately mapped to it. CANCELED is unpaid.
//
// Status source: the Subscription row when one exists (Stripe-webhook
// maintained), falling back to tenant.billingStatus — the webhook dual-writes
// both, but tenants created outside Stripe checkout (all six current
// production tenants) have NO Subscription row at all, only the tenant field.
// Gating on the row alone would lock every existing tenant out.

import type { BillingStatus } from "@/generated/prisma";

/**
 * @param hasSubscriptionRow whether a Stripe-written Subscription row exists.
 *   Defaults to false so a bare status check stays strict — TRIALING alone
 *   must never pass, which is also what the existing seo-tools test asserts.
 */
export function isPaidStatus(
  status: BillingStatus | null | undefined,
  hasSubscriptionRow: boolean = false,
): boolean {
  if (status === "ACTIVE") return true;
  return status === "TRIALING" && hasSubscriptionRow;
}

export interface BillingContext {
  status: BillingStatus | null;
  /** True when a Stripe-written Subscription row backs this status. */
  hasSubscriptionRow: boolean;
}

/** Effective billing status plus where it came from. The provenance matters:
 * TRIALING is only paid when it comes from a real Subscription row.
 * Prisma is imported lazily so the pure predicate above stays importable in
 * DB-less contexts (node --test config tests). */
export async function getBillingContext(tenantId: string): Promise<BillingContext> {
  const { prisma } = await import("@/lib/prisma");
  const sub = await prisma.subscription.findUnique({
    where: { tenantId },
    select: { status: true },
  });
  if (sub) return { status: sub.status, hasSubscriptionRow: true };
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { billingStatus: true },
  });
  return { status: tenant?.billingStatus ?? null, hasSubscriptionRow: false };
}

/** Effective billing status: Subscription row first, tenant field as fallback. */
export async function getBillingStatus(tenantId: string): Promise<BillingStatus | null> {
  return (await getBillingContext(tenantId)).status;
}

export async function hasPaidPlan(tenantId: string): Promise<boolean> {
  const { status, hasSubscriptionRow } = await getBillingContext(tenantId);
  return isPaidStatus(status, hasSubscriptionRow);
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
  const { status, hasSubscriptionRow } = await getBillingContext(membership.tenantId);
  if (!isPaidStatus(status, hasSubscriptionRow)) {
    throw new PaidPlanRequiredError(status);
  }
  return membership;
}
