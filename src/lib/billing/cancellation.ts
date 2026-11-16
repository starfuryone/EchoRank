// src/lib/billing/cancellation.ts — cancel and resume (CANCEL-FAIR-PLAY).
//
// THE ONLY CODE THAT CALLS STRIPE TO CANCEL OR RESUME A PLAN SUBSCRIPTION.
// cancelTenantSubscription() and resumeTenantSubscription() serve both the
// customer (POST /api/billing/cancel, /resume, from /plan and /billing) and
// platform staff (the admin area). (Two other Stripe cancels exist and are not
// this: the webhook retiring a standalone watcher on a plan upgrade, and the
// data-deletion cascade.)
//
// A CUSTOMER CANCELS AT PERIOD END, nothing else: cancel_at_period_end. They
// keep what they paid for (or their trial) until the period ends and are not
// charged again; a trial ends at trial end with no charge. Stripe ends the
// subscription then and customer.subscription.deleted moves the tenant to
// CANCELED. Only the tenant's OWNER may (billing-roles.ts canCancelSubscription).
//
// STAFF MAY ALSO END IT NOW: subscriptions.cancel, with no proration and no
// final invoice, so no refund and no charge. The result is mirrored into the
// Subscription row and Tenant.billingStatus at once, with the same values the
// customer.subscription.deleted webhook writes, so whichever lands second
// changes nothing.
//
// RESUME = cancel_at_period_end false, until the period ends. After that the
// subscription is gone at Stripe and the way back is a new checkout.
//
// THE SUBSCRIPTION IS THE TENANT'S OWN, TWICE OVER. Its id comes from the
// tenant's own Subscription row (looked up by tenantId, never by an id a
// client sent), and Stripe's copy must name the tenant's own customer before
// anything is changed. A mismatch refuses with a 409 and an error log.
//
// IDEMPOTENT. Cancelling a subscription that is already cancelling, or
// resuming one that is not, changes nothing, calls Stripe for nothing past the
// first read, sends no second email and writes no second audit row: 200 with
// changed=false. Every change that happens, and every Stripe call that fails,
// writes an audit_logs row.
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
import { canCancelSubscription } from "./billing-roles";
import { STRIPE_FEEDBACK, type CancelInput } from "./cancel-reasons";
import { renderCancelEmail } from "./cancel-email";
import { BILLING_URL, emailLocaleOf, planDisplayName } from "./trial-ending-email";

const log = logger.child({ module: "billing-cancel" });

/** Who is acting. A member acts on their own tenant; staff on any. */
export type CancelActor =
  | { kind: "member"; userId: string; role: Role; ipAddress?: string | null }
  | { kind: "platform_admin"; userId: string; email: string; ipAddress?: string | null };

export type CancelWhen = "period_end" | "now";

export interface CancelOptions {
  when: CancelWhen;
  actor: CancelActor;
  /** The optional "why", sent to Stripe as cancellation_details. */
  reason?: CancelInput;
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

const STRIPE_DOWN = "Could not reach the payment provider. Please try again.";

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

/** What Stripe said, for the audit row. */
function stripeResult(sub: Stripe.Subscription) {
  return { status: sub.status, cancelAtPeriodEnd: sub.cancel_at_period_end, cancelAt: sub.cancel_at };
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** The audit row's who: the member, or the staff member and their email. */
function actorDetails(actor: CancelActor) {
  return actor.kind === "platform_admin" ? { actor: "platform_admin", adminEmail: actor.email } : { actor: "member", role: actor.role };
}

type Row = {
  id: string;
  stripeSubscriptionId: string;
  status: BillingStatus;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
  planType: PlanType;
};

type Loaded = { ok: true; row: Row; customerId: string | null } | { ok: false; result: BillingActionResult };

async function loadPlanSubscription(tenantId: string, actor: CancelActor): Promise<Loaded> {
  if (actor.kind === "member" && !canCancelSubscription(actor.role)) {
    return {
      ok: false,
      result: {
        ok: false,
        status: 403,
        reason: "role",
        error: "Only the account owner can cancel or resume this subscription.",
        ownerName: await billingOwnerName(tenantId),
      },
    };
  }

  const [row, tenant] = await Promise.all([
    prisma.subscription.findUnique({
      where: { tenantId },
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
      where: { id: tenantId },
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

function stateOf(status: BillingStatus, cancelAtPeriodEnd: boolean, periodEnd: Date | null): SubscriptionState {
  return {
    status,
    cancelAtPeriodEnd,
    periodEnd: periodEnd ? periodEnd.toISOString() : null,
    trial: status === "TRIALING",
  };
}

/** Read Stripe's copy and check it is this tenant's. */
async function retrieveOwn(
  tenantId: string,
  subscriptionId: string,
  customerId: string | null,
): Promise<{ ok: true; sub: Stripe.Subscription } | { ok: false; result: BillingActionResult }> {
  let sub: Stripe.Subscription;
  try {
    sub = await getStripe().subscriptions.retrieve(subscriptionId);
  } catch (err) {
    log.error({ tenantId, subscriptionId, err: errMessage(err) }, "Stripe subscription read failed");
    return { ok: false, result: { ok: false, status: 502, reason: "stripe_error", error: STRIPE_DOWN } };
  }
  if (!customerId || customerIdOf(sub) !== customerId) {
    log.error({ tenantId, subscriptionId }, "Subscription row names a subscription of another customer: refusing");
    return { ok: false, result: { ok: false, status: 409, reason: "subscription_mismatch", error: "This subscription could not be matched to your account." } };
  }
  if (sub.status === "canceled" || sub.status === "incomplete_expired") {
    return { ok: false, result: { ok: false, status: 409, reason: "ended", error: "This subscription has already ended." } };
  }
  return { ok: true, sub };
}

async function syncRow(tenantId: string, subscriptionId: string, cancelAtPeriodEnd: boolean, periodEnd: Date | null) {
  await prisma.subscription.updateMany({
    where: { tenantId, stripeSubscriptionId: subscriptionId },
    data: { cancelAtPeriodEnd, ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}) },
  });
}

/** The ended state, as customer.subscription.deleted writes it. */
async function syncEnded(tenantId: string, subscriptionId: string) {
  await prisma.subscription.updateMany({
    where: { tenantId, stripeSubscriptionId: subscriptionId },
    data: { status: "CANCELED", cancelAtPeriodEnd: false },
  });
  await prisma.tenant.update({ where: { id: tenantId }, data: { billingStatus: "CANCELED" } });
}

/** A failed Stripe call is recorded, then reported; never swallowed. */
async function auditFailure(tenantId: string, actor: CancelActor, row: Row, action: string, details: Record<string, unknown>, err: unknown) {
  await createAuditLog({
    tenantId,
    userId: actor.userId || undefined,
    action,
    entity: "Subscription",
    entityId: row.id,
    details: { stripeSubscriptionId: row.stripeSubscriptionId, ...actorDetails(actor), ...details, stripeError: errMessage(err) },
    ipAddress: actor.ipAddress ?? undefined,
  });
}

/** The confirmation email. Never throws: a mail failure never undoes a cancel. */
async function sendCancelConfirmation(tenantId: string, planType: PlanType, trial: boolean, accessUntil: Date) {
  if (!isEmailConfigured()) {
    log.info({ tenantId }, "Cancel confirmation email skipped: SMTP is not configured");
    return;
  }
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
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
      log.warn({ tenantId }, "Cancel confirmation email: no OWNER email");
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
    log.info({ tenantId, sent }, "Cancel confirmation email");
  } catch (err) {
    log.warn({ tenantId, err: errMessage(err) }, "Cancel confirmation email failed");
  }
}

function cancellationDetails(reason: CancelInput | undefined) {
  if (!reason || (!reason.reason && !reason.note)) return undefined;
  return {
    ...(reason.reason ? { feedback: STRIPE_FEEDBACK[reason.reason] } : {}),
    ...(reason.note ? { comment: reason.note } : {}),
  };
}

/**
 * Cancel the tenant's plan subscription: at period end (customer or staff),
 * or now (staff only). The tenant comes from the caller's session or the
 * staff page's row, never from a request body.
 */
export async function cancelTenantSubscription(tenantId: string, opts: CancelOptions): Promise<BillingActionResult> {
  const { actor, when, reason } = opts;
  if (when === "now" && actor.kind !== "platform_admin") {
    return { ok: false, status: 403, reason: "role", error: "A subscription can only be ended at the end of its period." };
  }

  const loaded = await loadPlanSubscription(tenantId, actor);
  if (!loaded.ok) return loaded.result;
  const { row, customerId } = loaded;
  const details = cancellationDetails(reason);
  const trial = row.status === "TRIALING";

  if (when === "period_end" && row.cancelAtPeriodEnd) {
    return { ok: true, status: 200, changed: false, state: stateOf(row.status, true, row.currentPeriodEnd) };
  }

  const own = await retrieveOwn(tenantId, row.stripeSubscriptionId, customerId);
  if (!own.ok) return own.result;
  let sub = own.sub;

  if (when === "now") {
    try {
      sub = await getStripe().subscriptions.cancel(row.stripeSubscriptionId, {
        prorate: false,
        invoice_now: false,
        ...(details ? { cancellation_details: details } : {}),
      });
    } catch (err) {
      log.error({ tenantId, err: errMessage(err) }, "Stripe immediate cancel failed");
      await auditFailure(tenantId, actor, row, "billing.subscription.cancel_failed", { when, reason: reason?.reason ?? null }, err);
      return { ok: false, status: 502, reason: "stripe_error", error: STRIPE_DOWN };
    }
    await syncEnded(tenantId, row.stripeSubscriptionId);
    await createAuditLog({
      tenantId,
      userId: actor.userId || undefined,
      action: "billing.subscription.cancel_now",
      entity: "Subscription",
      entityId: row.id,
      details: {
        stripeSubscriptionId: row.stripeSubscriptionId,
        ...actorDetails(actor),
        when,
        reason: reason?.reason ?? null,
        note: reason?.note ?? null,
        trial,
        stripe: stripeResult(sub),
      },
      ipAddress: actor.ipAddress ?? undefined,
    });
    log.info({ tenantId, actor: actor.kind }, "Subscription ended immediately");
    return { ok: true, status: 200, changed: true, state: stateOf("CANCELED", false, null) };
  }

  let changed = false;
  if (!isCancelling(sub)) {
    const params: Stripe.SubscriptionUpdateParams = { cancel_at_period_end: true };
    if (details) params.cancellation_details = details;
    try {
      sub = await getStripe().subscriptions.update(row.stripeSubscriptionId, params);
      changed = true;
    } catch (err) {
      log.error({ tenantId, err: errMessage(err) }, "Stripe cancel failed");
      await auditFailure(tenantId, actor, row, "billing.subscription.cancel_failed", { when, reason: reason?.reason ?? null }, err);
      return { ok: false, status: 502, reason: "stripe_error", error: STRIPE_DOWN };
    }
  }

  const periodEnd = periodEndOf(sub) ?? row.currentPeriodEnd;
  await syncRow(tenantId, row.stripeSubscriptionId, true, periodEnd);

  if (changed) {
    await createAuditLog({
      tenantId,
      userId: actor.userId || undefined,
      action: "billing.subscription.cancel",
      entity: "Subscription",
      entityId: row.id,
      details: {
        stripeSubscriptionId: row.stripeSubscriptionId,
        ...actorDetails(actor),
        when,
        reason: reason?.reason ?? null,
        note: reason?.note ?? null,
        trial,
        accessUntil: periodEnd?.toISOString() ?? null,
        stripe: stripeResult(sub),
      },
      ipAddress: actor.ipAddress ?? undefined,
    });
    log.info({ tenantId, reason: reason?.reason ?? null, trial, actor: actor.kind }, "Subscription set to cancel at period end");
    if (periodEnd) await sendCancelConfirmation(tenantId, row.planType, trial, periodEnd);
  }

  return { ok: true, status: 200, changed, state: stateOf(row.status, true, periodEnd) };
}

/** Undo a period-end cancel, while the period lasts. */
export async function resumeTenantSubscription(tenantId: string, actor: CancelActor, now: Date = new Date()): Promise<BillingActionResult> {
  const loaded = await loadPlanSubscription(tenantId, actor);
  if (!loaded.ok) return loaded.result;
  const { row, customerId } = loaded;

  if (!row.cancelAtPeriodEnd) {
    return { ok: true, status: 200, changed: false, state: stateOf(row.status, false, row.currentPeriodEnd) };
  }
  if (row.currentPeriodEnd && row.currentPeriodEnd.getTime() <= now.getTime()) {
    return { ok: false, status: 409, reason: "period_ended", error: "The period has ended. Choose a plan to subscribe again." };
  }

  const own = await retrieveOwn(tenantId, row.stripeSubscriptionId, customerId);
  if (!own.ok) return own.result;

  let sub = own.sub;
  let changed = false;
  if (isCancelling(sub)) {
    // cancel_at_period_end from our button; a bare cancel_at from a portal
    // that schedules a date. Each is cleared by its own field.
    const params: Stripe.SubscriptionUpdateParams = sub.cancel_at_period_end ? { cancel_at_period_end: false } : { cancel_at: "" };
    try {
      sub = await getStripe().subscriptions.update(row.stripeSubscriptionId, params);
      changed = true;
    } catch (err) {
      log.error({ tenantId, err: errMessage(err) }, "Stripe resume failed");
      await auditFailure(tenantId, actor, row, "billing.subscription.resume_failed", {}, err);
      return { ok: false, status: 502, reason: "stripe_error", error: STRIPE_DOWN };
    }
  }

  const periodEnd = periodEndOf(sub) ?? row.currentPeriodEnd;
  await syncRow(tenantId, row.stripeSubscriptionId, false, periodEnd);

  if (changed) {
    await createAuditLog({
      tenantId,
      userId: actor.userId || undefined,
      action: "billing.subscription.resume",
      entity: "Subscription",
      entityId: row.id,
      details: {
        stripeSubscriptionId: row.stripeSubscriptionId,
        ...actorDetails(actor),
        renewsAt: periodEnd?.toISOString() ?? null,
        stripe: stripeResult(sub),
      },
      ipAddress: actor.ipAddress ?? undefined,
    });
    log.info({ tenantId, actor: actor.kind }, "Subscription resumed");
  }

  return { ok: true, status: 200, changed, state: stateOf(row.status, false, periodEnd) };
}
