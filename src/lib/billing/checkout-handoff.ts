// What /welcome does with a Stripe Checkout session id (PLAN-HUB Part 1).
//
// THE SESSION ID IS A DISPLAY HINT, NEVER A CREDENTIAL ON THIS PATH. It is
// user-supplied: anyone can paste anyone's. So plan-specific content is shown
// only when Stripe says the session is COMPLETE and it BELONGS to the signed-in
// tenant (client_reference_id is the tenant id, or the session's customer is
// the tenant's Stripe customer). Every other case — logged out, garbage id,
// expired, foreign, incomplete, Stripe down — collapses to ONE generic state,
// so the page cannot be used to tell them apart, and no Stripe error or
// detail reaches the response.
//
// ENTITLEMENT STILL COMES FROM THE WEBHOOK. Nothing here writes account state:
// "ready" means the webhook has already landed (the tenant shows the bought
// plan, paid), "pending" means it has not yet, and the page waits for it.
//
// Credit packs return to /credits (their own success_url) and never reach the
// plan hub; a credit session pasted into /welcome is sent back there.
import "server-only";
import type Stripe from "stripe";
import type { PlanType } from "@/generated/prisma";
import { getStripe } from "@/lib/stripe/client";
import { getBillingContext, isPaidStatus } from "@/lib/paid-plan";
import { PLAN_CONFIGS } from "@/lib/plan-config";
import { logger } from "@/infrastructure/observability/logger";

const log = logger.child({ module: "checkout-handoff" });

export interface HandoffTenant {
  tenantId: string;
  planType: PlanType;
  stripeCustomerId: string | null;
}

/** A GA4 conversion, from the retrieved session only. */
export interface HandoffConversion {
  event: "purchase" | "trial_start";
  /** Major units (e.g. 78 for $78). */
  value: number;
  currency: string;
  transactionId: string;
}

export type Handoff =
  | { kind: "generic" }
  | { kind: "credits"; sessionId: string }
  | { kind: "ready"; plan: PlanType; conversion: HandoffConversion | null }
  | { kind: "pending"; plan: PlanType; conversion: HandoffConversion | null };

const GENERIC: Handoff = { kind: "generic" };

function customerIdOf(session: Stripe.Checkout.Session): string | null {
  const c = session.customer;
  if (!c) return null;
  return typeof c === "string" ? c : c.id;
}

function planOf(session: Stripe.Checkout.Session): PlanType | null {
  const sub = session.subscription && typeof session.subscription !== "string" ? session.subscription : null;
  const tier = (session.metadata?.tier ?? sub?.metadata?.tier ?? "").toUpperCase();
  return Object.prototype.hasOwnProperty.call(PLAN_CONFIGS, tier) ? (tier as PlanType) : null;
}

/**
 * The conversion to report, from the session itself: a paid checkout is a
 * `purchase` at amount_total; a trial (amount_total 0) is a `trial_start`
 * at the subscription's own price, so a grandfathered or discounted price is
 * reported as charged, not as listed.
 */
export function conversionOf(session: Stripe.Checkout.Session): HandoffConversion | null {
  const currency = (session.currency ?? "").toUpperCase();
  if (!currency) return null;
  if ((session.amount_total ?? 0) > 0) {
    return { event: "purchase", value: session.amount_total! / 100, currency, transactionId: session.id };
  }
  const sub = session.subscription && typeof session.subscription !== "string" ? session.subscription : null;
  const unit = sub?.items?.data?.[0]?.price?.unit_amount;
  if (sub?.status === "trialing" && typeof unit === "number") {
    return { event: "trial_start", value: unit / 100, currency, transactionId: session.id };
  }
  return null;
}

/** Does this session belong to this tenant? */
export function sessionBelongsTo(session: Stripe.Checkout.Session, tenant: HandoffTenant): boolean {
  if (session.client_reference_id && session.client_reference_id === tenant.tenantId) return true;
  const customer = customerIdOf(session);
  return Boolean(customer && tenant.stripeCustomerId && customer === tenant.stripeCustomerId);
}

/**
 * Resolve /welcome's state. Never throws: every failure is the generic state.
 * `tenant` is the signed-in user's active tenant, or null when logged out.
 */
export async function resolveHandoff(sessionId: string | null | undefined, tenant: HandoffTenant | null): Promise<Handoff> {
  if (!tenant || !sessionId || !sessionId.startsWith("cs_")) return GENERIC;
  let session: Stripe.Checkout.Session;
  try {
    session = await getStripe().checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "subscription.items.data.price"],
    });
  } catch (err) {
    // Expected for an expired, mistyped or foreign id; logged, never shown.
    log.info({ err: err instanceof Error ? err.message : String(err) }, "welcome: checkout session not retrievable");
    return GENERIC;
  }
  if (session.status !== "complete" || !sessionBelongsTo(session, tenant)) return GENERIC;
  if (session.metadata?.flow === "credit_pack" || session.mode === "payment") {
    return { kind: "credits", sessionId: session.id };
  }
  const plan = planOf(session);
  if (!plan) return GENERIC;
  const conversion = conversionOf(session);
  try {
    const billing = await getBillingContext(tenant.tenantId);
    if (tenant.planType === plan && isPaidStatus(billing.status, billing.hasSubscriptionRow)) {
      return { kind: "ready", plan, conversion };
    }
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.message : String(err), tenantId: tenant.tenantId }, "welcome: billing read failed; waiting instead");
  }
  return { kind: "pending", plan, conversion };
}
