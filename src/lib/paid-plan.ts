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
// ── NONE NEEDS NO BRANCH HERE, AND MUST NOT GET ONE ────────────────────────
// BillingStatus.NONE ("registered, never subscribed") is denied by isPaidStatus
// already: it is not ACTIVE and not TRIALING, so it falls through to false.
// Adding a case for it would be decoration.
//
// WHAT NONE DOES NOT DO IS MAKE THE TRIALING RULE REDUNDANT. It is tempting to
// read "new tenants are NONE now" as "so TRIALING must mean a real trial" and
// simplify the condition below to a bare status check. It does not: the
// migration that introduced NONE deliberately backfilled NOTHING, so every
// tenant that predates it is still TRIALING with no Subscription row, and the
// `&& hasPlanSubscriptionRow` clause is the only thing between those rows and
// the paid product. They are denied today; loosening this grants them access as
// a side effect. The clause stays.
//
// Status source: the Subscription row when one exists (Stripe-webhook
// maintained), falling back to tenant.billingStatus — the webhook dual-writes
// both, but tenants created outside Stripe checkout (all six current
// production tenants) have NO Subscription row at all, only the tenant field.
// Gating on the row alone would lock every existing tenant out.

import type { BillingStatus } from "@/generated/prisma";

/**
 * @param hasPlanSubscriptionRow whether a Stripe-written Subscription row for a
 *   PLAN exists. A standalone WATCHER subscription must NOT count: it is a $9
 *   add-on, not a tier, and counting it would hand its holder every paid tool
 *   in the product. See ai-monitor/watcher-entitlement.ts for why the row alone
 *   cannot be trusted — tenantId is unique, so a watcher purchase writes the
 *   same single row a plan would, carrying whatever planType the tenant already
 *   had.
 *
 *   Defaults to false so a bare status check stays strict — TRIALING alone must
 *   never pass, which is also what the existing seo-tools test asserts.
 */
export function isPaidStatus(
  status: BillingStatus | null | undefined,
  hasPlanSubscriptionRow: boolean = false,
): boolean {
  if (status === "ACTIVE") return true;
  return status === "TRIALING" && hasPlanSubscriptionRow;
}

export interface BillingContext {
  status: BillingStatus | null;
  /** True when a Stripe-written Subscription row for a PLAN backs this status. */
  hasSubscriptionRow: boolean;
  /** True when the tenant's only subscription is the standalone watcher. */
  watcherOnly: boolean;
  /**
   * The tenant has never subscribed to anything — Tenant.billingStatus is NONE.
   *
   * DERIVED HERE, IN THE SAME CALL THAT DECIDES PAID, ON PURPOSE. The routing
   * gate (src/lib/billing-gate.ts) and requirePaidPlan below are required not
   * to disagree about what a tenant is; the way to guarantee that is for both
   * to read one function rather than two queries of the same column. A second
   * `tenant.billingStatus === "NONE"` lookup somewhere else is exactly the
   * drift this field exists to prevent.
   *
   * FALSE for a tenant with a PLAN subscription row, without consulting the
   * column at all: a tenant Stripe has written a plan row for has subscribed by
   * definition, whatever the tenant column happens to say.
   */
  needsPlanSelection: boolean;
}

/** Effective billing status plus where it came from. The provenance matters:
 * TRIALING is only paid when it comes from a real Subscription row.
 * Prisma is imported lazily so the pure predicate above stays importable in
 * DB-less contexts (node --test config tests). */
export async function getBillingContext(tenantId: string): Promise<BillingContext> {
  const { prisma } = await import("@/lib/prisma");
  const sub = await prisma.subscription.findUnique({
    where: { tenantId },
    select: { status: true, productKind: true },
  });
  // A WATCHER subscription is deliberately NOT a plan status. Returning it here
  // is what would let an ACTIVE $9 add-on satisfy requirePaidPlan and inherit
  // whatever the tenant's default planType grants. The tenant's own
  // billingStatus is consulted instead, exactly as for a tenant with no row.
  if (sub && sub.productKind === "PLAN") {
    return {
      status: sub.status,
      hasSubscriptionRow: true,
      watcherOnly: false,
      needsPlanSelection: false,
    };
  }
  const watcherOnly = sub?.productKind === "WATCHER";
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { billingStatus: true },
  });
  return {
    // A watcher-only tenant must not inherit a paid status from the tenant
    // column either: the webhook sets billingStatus alongside the row, so
    // trusting it here would reopen the same hole one level down.
    status: watcherOnly ? null : (tenant?.billingStatus ?? null),
    hasSubscriptionRow: false,
    watcherOnly,
    // Read from the COLUMN, not from `status` above, which a watcher-only
    // tenant blanks to null. Someone who bought the standalone watcher and
    // never a plan is still a tenant that has never chosen one, and the gate
    // should treat them as such rather than letting a $9 add-on suppress it.
    needsPlanSelection: tenant?.billingStatus === "NONE",
  };
}

/** Effective billing status: Subscription row first, tenant field as fallback. */
export async function getBillingStatus(tenantId: string): Promise<BillingStatus | null> {
  return (await getBillingContext(tenantId)).status;
}

export async function hasPaidPlan(tenantId: string): Promise<boolean> {
  const { status, hasSubscriptionRow } = await getBillingContext(tenantId);
  return isPaidStatus(status, hasSubscriptionRow);
}

/**
 * May this tenant BUY prepaid credits?
 *
 * ── WHY THIS IS NOT JUST hasPaidPlan() ──────────────────────────────────────
 *
 * The rule it implements: a tenant that has never subscribed may not buy
 * credits. A tenant whose plan lapsed or whose card failed still may — that
 * behaviour is deliberately unchanged, because a PAST_DUE customer topping up
 * is someone trying to keep using us, and refusing their money is not how you
 * want to meet them. So the gate narrows exactly one status, NONE, and leaves
 * CANCELED and PAST_DUE exactly as they were.
 *
 * hasPaidPlan() would refuse all three, which is a different and larger rule
 * than the one asked for.
 *
 * ── IT IS STILL NOT A PARALLEL CHECK ────────────────────────────────────────
 *
 * The thing that must not be duplicated is the ANSWER to "what is this tenant",
 * not the policy built on top of it. This reads `needsPlanSelection` from the
 * same getBillingContext() call that requirePaidPlan reads `status` from — one
 * query, one source, computed in one place. A second
 * `tenant.billingStatus === "NONE"` lookup written at the route would be the
 * drift worth fearing, and is exactly what this function exists to prevent.
 * Credits is where drift becomes a refund conversation.
 */
export async function canBuyCredits(tenantId: string): Promise<boolean> {
  const { needsPlanSelection } = await getBillingContext(tenantId);
  return !needsPlanSelection;
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
