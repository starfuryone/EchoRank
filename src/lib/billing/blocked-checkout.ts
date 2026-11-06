// src/lib/billing/blocked-checkout.ts
//
// A completed Checkout whose billing address is in the EU/EEA/UK
// (src/lib/geo/blocked-countries.ts) is refused AFTER payment, because the
// address only exists once Checkout has collected it (billing_address_collection
// is required on both checkout routes):
//
//   1. the subscription, if any, is cancelled immediately (no proration, no
//      grace) — Stripe then sends customer.subscription.deleted, which the
//      webhook already turns into a downgrade;
//   2. everything paid on the session is refunded in full: the payment intent
//      of a one-off payment (credit packs), or every paid payment on the
//      subscription's first invoice (nothing, during a trial);
//   3. the customer is emailed the same message signup shows;
//   4. it is logged, and written to the tenant's AuditLog when the tenant
//      exists. The tenant is never activated and no credits are granted: the
//      webhook returns before either.
//
// Each step is independent and best-effort, so one failing (a refund already
// made by hand, a mail outage) does not stop the others; failures are logged
// at error level for a person to finish. The webhook's own idempotency record
// keeps a retried event from doing it twice.

import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe/client";
import { sendMail } from "@/lib/mailer";
import { logger } from "@/infrastructure/observability/logger";
import { countryNotAvailable, isBlockedCountry } from "@/lib/geo/blocked-countries";

const log = logger.child({ module: "blocked-checkout" });

export const BLOCKED_CHECKOUT_ACTION = "CHECKOUT_REFUSED_BLOCKED_COUNTRY";

const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : v?.id ?? null);

/** The billing country Checkout collected, upper case, or null. */
export function billingCountryOf(session: Stripe.Checkout.Session): string | null {
  return session.customer_details?.address?.country?.toUpperCase() ?? null;
}

export interface RefusalOutcome {
  refused: boolean;
  country?: string | null;
  cancelled?: boolean;
  refundedCents?: number;
  emailed?: boolean;
}

/** Refuses the session when its billing country is blocked. Returns refused:false otherwise (and does nothing). */
export async function refuseBlockedCheckout(session: Stripe.Checkout.Session): Promise<RefusalOutcome> {
  const country = billingCountryOf(session);
  if (!isBlockedCountry(country)) return { refused: false, country };

  const stripe = getStripe();
  const subscriptionId = idOf(session.subscription as string | { id: string } | null);
  const out: RefusalOutcome = { refused: true, country, cancelled: false, refundedCents: 0, emailed: false };

  // 1. Cancel now.
  if (subscriptionId) {
    try {
      await stripe.subscriptions.cancel(subscriptionId);
      out.cancelled = true;
    } catch (err) {
      log.error({ err, subscriptionId, sessionId: session.id }, "blocked checkout: could not cancel the subscription");
    }
  }

  // 2. Refund in full.
  const refund = async (params: Stripe.RefundCreateParams, what: string) => {
    try {
      const r = await stripe.refunds.create(params, { idempotencyKey: `blocked-country:${session.id}:${what}` });
      out.refundedCents! += r.amount ?? 0;
    } catch (err) {
      log.error({ err, sessionId: session.id, what }, "blocked checkout: could not refund");
    }
  };
  const paymentIntent = idOf(session.payment_intent as string | { id: string } | null);
  if (paymentIntent && session.payment_status === "paid") {
    await refund({ payment_intent: paymentIntent }, paymentIntent);
  }
  const invoiceId = idOf(session.invoice as string | { id: string } | null);
  if (invoiceId) {
    try {
      const payments = await stripe.invoicePayments.list({ invoice: invoiceId, limit: 10 });
      for (const p of payments.data) {
        if (p.status !== "paid" || !p.amount_paid) continue;
        const pi = idOf(p.payment?.payment_intent as string | { id: string } | undefined);
        const charge = idOf((p.payment as { charge?: string | { id: string } } | undefined)?.charge);
        if (pi) await refund({ payment_intent: pi }, pi);
        else if (charge) await refund({ charge }, charge);
      }
    } catch (err) {
      log.error({ err, invoiceId, sessionId: session.id }, "blocked checkout: could not list the invoice payments");
    }
  }

  // 3. Tell the customer.
  const to = session.customer_details?.email ?? session.customer_email ?? null;
  const locale = (session.metadata?.locale as string | undefined) ?? session.locale ?? "en";
  if (to) {
    const message = countryNotAvailable(locale);
    const refundLine = refundSentence(locale, out.refundedCents ?? 0, !!subscriptionId);
    try {
      out.emailed = await sendMail({
        to: [to],
        subject: message,
        text: `${message}\n\n${refundLine}\n\nEchorank`,
        html:
          `<p style="font:16px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1e2329">${escapeHtml(message)}</p>` +
          `<p style="font:14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#474d57">${escapeHtml(refundLine)}</p>` +
          `<p style="font:14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#474d57">Echorank</p>`,
      });
    } catch (err) {
      log.error({ err, sessionId: session.id }, "blocked checkout: could not email the customer");
    }
  }

  // 4. Log it. The audit row carries ids and amounts, no email or address.
  const tenantId = session.client_reference_id ?? null;
  log.warn(
    { sessionId: session.id, tenantId, country, subscriptionId, ...out },
    "checkout refused: blocked billing country — cancelled and refunded",
  );
  if (tenantId) {
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
      if (tenant) {
        await prisma.auditLog.create({
          data: {
            tenantId,
            action: BLOCKED_CHECKOUT_ACTION,
            entity: "CheckoutSession",
            entityId: subscriptionId ?? session.id,
            details: {
              sessionId: session.id,
              mode: session.mode,
              country,
              cancelled: out.cancelled ?? false,
              refundedCents: out.refundedCents ?? 0,
              emailed: out.emailed ?? false,
            },
          },
        });
      }
    } catch (err) {
      log.error({ err, sessionId: session.id }, "blocked checkout: could not write the audit row");
    }
  }
  return out;
}

/** True when this subscription was refused at checkout (a late subscription event must not reactivate it). */
export async function wasRefusedAtCheckout(tenantId: string, subscriptionId: string): Promise<boolean> {
  try {
    const row = await prisma.auditLog.findFirst({
      where: { tenantId, action: BLOCKED_CHECKOUT_ACTION, entityId: subscriptionId },
      select: { id: true },
    });
    return !!row;
  } catch (err) {
    // A failed lookup must not stop billing for everyone else; the refusal already cancelled it at Stripe.
    log.warn({ err, tenantId, subscriptionId }, "could not check for a checkout refusal");
    return false;
  }
}

export function refundSentence(locale: string, cents: number, subscription: boolean): string {
  const fr = locale.startsWith("fr");
  const de = locale.startsWith("de");
  const amount = (cents / 100).toFixed(2);
  if (fr) {
    const paid = cents > 0 ? `Votre paiement de ${amount} a été intégralement remboursé` : "Rien ne vous a été facturé";
    return subscription ? `${paid}, et l'abonnement a été annulé.` : `${paid}.`;
  }
  if (de) {
    const paid = cents > 0 ? `Ihre Zahlung von ${amount} wurde vollständig zurückerstattet` : "Ihnen wurde nichts belastet";
    return subscription ? `${paid}, und das Abonnement wurde gekündigt.` : `${paid}.`;
  }
  const paid = cents > 0 ? `Your payment of ${amount} has been refunded in full` : "You have not been charged";
  return subscription ? `${paid}, and the subscription has been cancelled.` : `${paid}.`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
