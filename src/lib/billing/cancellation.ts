// src/lib/billing/cancellation.ts — cancel and resume, in-app (CANCEL-FAIR-PLAY).
//
// CANCEL = cancel_at_period_end, nothing else. The customer keeps what they
// paid for (or their trial) until the period ends and is not charged again;
// Stripe ends the subscription then and customer.subscription.deleted moves
// the tenant to CANCELED. Never an immediate cancel, never a refund path here.
//
// RESUME = cancel_at_period_end false, until the period ends. After that the
// subscription is gone at Stripe and the way back is a new checkout.
//
// THE SUBSCRIPTION IS THE TENANT'S OWN, TWICE OVER. Its id comes from the
// tenant's own Subscription row (looked up by tenantId, never by an id the
// client sent), and Stripe's copy must name the tenant's own customer before
// anything is changed. A mismatch refuses with a 409 and an error log.
//
// IDEMPOTENT. Cancelling a subscription that is already cancelling, or
// resuming one that is not, changes nothing, calls Stripe for nothing past the
// first read, sends no second email and writes no second audit row: 200 with
// changed=false.
//
// NO ROW, NO 500. A tenant with no plan Subscription row gets a 409 that
// carries tenant.billingStatus, the same fallback getBillingContext (and so
// requirePaidPlan) makes, so the UI can say what state the account is in.

import "server-only";
import type Stripe from "stripe";
import type { BillingStatus, PlanType, Role } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe/client";
import { createAuditLog } from "@/lib/audit";
import { isEmailConfigured, sendMail } from "@/lib/mailer";
import { logger } from "@/infrastructure/observability/logger";
import { canManageBilling } from "./billing-roles";
import { STRIPE_FEEDBACK, type CancelInput } from "./cancel-reasons";
import { renderCancelEmail } from "./cancel-email";
import { BILLING_URL, emailLocaleOf, planDisplayName } from "./trial-ending-email";

const log = logger.child({ module: "billing-cancel" });

export interface BillingActor {
  tenantId: string;
  userId: string;
  role: Role;
  ipAddress?: string | null;
}

export interface SubscriptionState {
  status: BillingStatus;
  cancelAtPeriodEnd: boolean;
  /** ISO. When access ends if cancelling, or the next renewal if not. */
  periodEnd: string | null;
  trial: boolean;
}

export type BillingActionResult =
  | { ok: true; status: 200; changed: boolean; state: SubscriptionState }
  | {
      ok: false;
      status: 403 | 409 | 502;
      reason:
        | "role"
        | "no_subscription"
        | "ended"
        | "period_ended"
        | "subscription_mismatch"
        | "stripe_error";
      error: string;
      /** reason "role": who can, or null when the tenant has no named owner. */
      ownerName?: string | null;
      /** reason "no_subscription": the tenant's own status, the fallback. */
      billingStatus?: BillingStatus | null;
    };

/** The first OWNER's name, for "Only {owner} can cancel this subscription". */
export async function billingOwnerName(tenantId: string): Promise<string | null> {
  const owner = await prisma.tenantMember.findFirst({
    where: { tenantId, role: "OWNER" },
    orderBy: { createdAt: "asc" },
    select: { user: { select: { name: true } } },
  });
  return owner?.user.name?.trim() || null;
}

function customerIdOf(sub: Stripe.Subscription): string | null {
  const c = sub.customer;
  if (!c) return null;
  return typeof c === "string" ? c : c.id;
}

/** When the subscription's current period (or trial) ends, as a Date. */
function periodEndOf(sub: Stripe.Subscription): Date | null {
  if (sub.cancel_at) return new Date(sub.cancel_at * 1000);
  if (sub.status === "trialing" && sub.trial_end) return new Date(sub.trial_end * 1000);
  const end = sub.items?.data?.[0]?.current_period_end;
  return end ? new Date(end * 1000) : null;
}

function isCancelling(sub: Stripe.Subscription): boolean {
  return sub.cancel_at_period_end || sub.cancel_at !== null;
}

type Loaded =
  | {
      ok: true;
      row: {
        id: string;
        stripeSubscriptionId: string;
        status: BillingStatus;
        cancelAtPeriodEnd: boolean;
        currentPeriodEnd: Date | null;
        planType: PlanType;
      };
      customerId: string | null;
    }
  | { ok: false; result: BillingActionResult };

async function loadOwnPlanSubscription(actor: BillingActor): Promise<Loaded> {
  if (!canManageBilling(actor.role)) {
    return {
      ok: false,
      result: {
        ok: false,
        status: 403,
        reason: "role",
        error: "Only the account owner or an admin can change this subscription.",
        ownerName: await billingOwnerName(actor.tenantId),
      },
    };
  }

  const [row, tenant] = await Promise.all([
    prisma.subscription.findUnique({
      where: { tenantId: actor.tenantId },
      select: {
        id: true,
        productKind: true,
        planType: true,
        status: true,
        cancelAtPeriodEnd: true,
        currentPeriodEnd: true,
        stripeSubscriptionId: true,
      },
    }),
    prisma.tenant.findUnique({
      where: { id: actor.tenantId },
      select: { billingStatus: true, stripeCustomerId: true },
    }),
  ]);

  if (!row || row.productKind !== "PLAN" || !row.stripeSubscriptionId) {
    return {
      ok: false,
      result: {
        ok: false,
        status: 409,
        reason: "no_subscription",
        error: "This account has no plan subscription to change.",
        billingStatus: tenant?.billingStatus ?? null,
      },
    };
  }
  if (row.status === "CANCELED") {
    return {
      ok: false,
      result: { ok: false, status: 409, reason: "ended", error: "This subscription has already ended." },
    };
  }
  return {
    ok: true,
    row: { ...row, stripeSubscriptionId: row.stripeSubscriptionId },
    customerId: tenant?.stripeCustomerId ?? null,
  };
}

function stateOf(row: { status: BillingStatus }, cancelAtPeriodEnd: boolean, periodEnd: Date | null): SubscriptionState {
  return {
    status: row.status,
    cancelAtPeriodEnd,
    periodEnd: periodEnd ? periodEnd.toISOString() : null,
    trial: row.status === "TRIALING",
  };
}

/** Read Stripe's copy and check it is this tenant's. */
async function retrieveOwn(
  actor: BillingActor,
  subscriptionId: string,
  customerId: string | null,
): Promise<{ ok: true; sub: Stripe.Subscription } | { ok: false; result: BillingActionResult }> {
  let sub: Stripe.Subscription;
  try {
    sub = await getStripe().subscriptions.retrieve(subscriptionId);
  } catch (err) {
    log.error({ tenantId: actor.tenantId, subscriptionId, err: err instanceof Error ? err.message : String(err) }, "Stripe subscription read failed");
    return { ok: false, result: { ok: false, status: 502, reason: "stripe_error", error: "Could not reach the payment provider. Please try again." } };
  }
  if (!customerId || customerIdOf(sub) !== customerId) {
    log.error({ tenantId: actor.tenantId, subscriptionId }, "Subscription row names a subscription of another customer: refusing");
    return { ok: false, result: { ok: false, status: 409, reason: "subscription_mismatch", error: "This subscription could not be matched to your account." } };
  }
  if (sub.status === "canceled" || sub.status === "incomplete_expired") {
    return { ok: false, result: { ok: false, status: 409, reason: "ended", error: "This subscription has already ended." } };
  }
  return { ok: true, sub };
}

async function syncRow(actor: BillingActor, subscriptionId: string, cancelAtPeriodEnd: boolean, periodEnd: Date | null) {
  await prisma.subscription.updateMany({
    where: { tenantId: actor.tenantId, stripeSubscriptionId: subscriptionId },
    data: { cancelAtPeriodEnd, ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}) },
  });
}

/** The confirmation email. Never throws: a mail failure never undoes a cancel. */
async function sendCancelConfirmation(actor: BillingActor, planType: PlanType, trial: boolean, accessUntil: Date) {
  if (!isEmailConfigured()) {
    log.info({ tenantId: actor.tenantId }, "Cancel confirmation email skipped: SMTP is not configured");
    return;
  }
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: actor.tenantId },
      select: {
        defaultLanguage: true,
        timezone: true,
        members: {
          where: { role: "OWNER" },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { user: { select: { email: true } } },
        },
      },
    });
    const to = tenant?.members[0]?.user.email;
    if (!tenant || !to) {
      log.warn({ tenantId: actor.tenantId }, "Cancel confirmation email: no OWNER email");
      return;
    }
    const { subject, html, text } = renderCancelEmail({
      planName: planDisplayName(planType),
      trial,
      accessUntil,
      timezone: tenant.timezone,
      billingUrl: BILLING_URL,
      locale: emailLocaleOf(tenant.defaultLanguage),
    });
    const sent = await sendMail({ to: [to], subject, html, text });
    log.info({ tenantId: actor.tenantId, sent }, "Cancel confirmation email");
  } catch (err) {
    log.warn({ tenantId: actor.tenantId, err: err instanceof Error ? err.message : String(err) }, "Cancel confirmation email failed");
  }
}

export async function cancelPlanSubscription(actor: BillingActor, input: CancelInput): Promise<BillingActionResult> {
  const loaded = await loadOwnPlanSubscription(actor);
  if (!loaded.ok) return loaded.result;
  const { row, customerId } = loaded;

  if (row.cancelAtPeriodEnd) {
    return { ok: true, status: 200, changed: false, state: stateOf(row, true, row.currentPeriodEnd) };
  }

  const own = await retrieveOwn(actor, row.stripeSubscriptionId, customerId);
  if (!own.ok) return own.result;

  let sub = own.sub;
  let changed = false;
  if (!isCancelling(sub)) {
    const params: Stripe.SubscriptionUpdateParams = { cancel_at_period_end: true };
    if (input.reason || input.note) {
      params.cancellation_details = {
        ...(input.reason ? { feedback: STRIPE_FEEDBACK[input.reason] } : {}),
        ...(input.note ? { comment: input.note } : {}),
      };
    }
    try {
      sub = await getStripe().subscriptions.update(row.stripeSubscriptionId, params);
      changed = true;
    } catch (err) {
      log.error({ tenantId: actor.tenantId, err: err instanceof Error ? err.message : String(err) }, "Stripe cancel failed");
      return { ok: false, status: 502, reason: "stripe_error", error: "Could not reach the payment provider. Please try again." };
    }
  }

  const periodEnd = periodEndOf(sub) ?? row.currentPeriodEnd;
  await syncRow(actor, row.stripeSubscriptionId, true, periodEnd);

  if (changed) {
    const trial = row.status === "TRIALING";
    await createAuditLog({
      tenantId: actor.tenantId,
      userId: actor.userId,
      action: "billing.subscription.cancel",
      entity: "Subscription",
      entityId: row.id,
      details: {
        stripeSubscriptionId: row.stripeSubscriptionId,
        reason: input.reason,
        note: input.note,
        trial,
        accessUntil: periodEnd?.toISOString() ?? null,
      },
      ipAddress: actor.ipAddress ?? undefined,
    });
    log.info({ tenantId: actor.tenantId, reason: input.reason, trial }, "Subscription set to cancel at period end");
    if (periodEnd) await sendCancelConfirmation(actor, row.planType, trial, periodEnd);
  }

  return { ok: true, status: 200, changed, state: stateOf(row, true, periodEnd) };
}

export async function resumePlanSubscription(actor: BillingActor, now: Date = new Date()): Promise<BillingActionResult> {
  const loaded = await loadOwnPlanSubscription(actor);
  if (!loaded.ok) return loaded.result;
  const { row, customerId } = loaded;

  if (!row.cancelAtPeriodEnd) {
    return { ok: true, status: 200, changed: false, state: stateOf(row, false, row.currentPeriodEnd) };
  }
  if (row.currentPeriodEnd && row.currentPeriodEnd.getTime() <= now.getTime()) {
    return { ok: false, status: 409, reason: "period_ended", error: "The period has ended. Choose a plan to subscribe again." };
  }

  const own = await retrieveOwn(actor, row.stripeSubscriptionId, customerId);
  if (!own.ok) return own.result;

  let sub = own.sub;
  let changed = false;
  if (isCancelling(sub)) {
    // cancel_at_period_end from our button; a bare cancel_at from a portal
    // that schedules a date. Each is cleared by its own field.
    const params: Stripe.SubscriptionUpdateParams = sub.cancel_at_period_end
      ? { cancel_at_period_end: false }
      : { cancel_at: "" };
    try {
      sub = await getStripe().subscriptions.update(row.stripeSubscriptionId, params);
      changed = true;
    } catch (err) {
      log.error({ tenantId: actor.tenantId, err: err instanceof Error ? err.message : String(err) }, "Stripe resume failed");
      return { ok: false, status: 502, reason: "stripe_error", error: "Could not reach the payment provider. Please try again." };
    }
  }

  const periodEnd = periodEndOf(sub) ?? row.currentPeriodEnd;
  await syncRow(actor, row.stripeSubscriptionId, false, periodEnd);

  if (changed) {
    await createAuditLog({
      tenantId: actor.tenantId,
      userId: actor.userId,
      action: "billing.subscription.resume",
      entity: "Subscription",
      entityId: row.id,
      details: { stripeSubscriptionId: row.stripeSubscriptionId, renewsAt: periodEnd?.toISOString() ?? null },
      ipAddress: actor.ipAddress ?? undefined,
    });
    log.info({ tenantId: actor.tenantId }, "Subscription resumed");
  }

  return { ok: true, status: 200, changed, state: stateOf(row, false, periodEnd) };
}
