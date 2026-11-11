// src/lib/billing/subscription-charge.ts — what a subscription is actually
// charged: the amount and interval of the Stripe price it is on.
//
// WHY NOT PLAN_CONFIGS. Since the price change of 2026-11-11, PLAN_CONFIGS
// holds the price on SALE. A subscriber or trialist who signed up before it
// stays on the price they bought (nobody is migrated), so for them the config
// figure is not the one about to leave their card. The trial-ending email and
// the billing page both state that figure; both read it from the subscription's
// own price.
//
// A FAILED READ IS NOT A GUESS. If Stripe cannot be reached, a price that is
// still the one on sale (its stripe_prices row is active) is the config price
// by construction, so the caller may fall back to config; a retired price is
// "unknown", and the callers say nothing rather than a wrong amount.

import "server-only";
import { getStripe } from "@/lib/stripe/client";
import { prisma } from "@/lib/prisma";
import type { BillingInterval } from "@/lib/stripe/prices";

export interface SubscriptionCharge {
  /** Per billing period, in cents (a yearly price is the yearly total). */
  cents: number;
  interval: BillingInterval;
}

/** The answer for a price id: the charge, "config" (safe to quote config), or "unknown". */
export type ChargeAnswer =
  | { kind: "charge"; charge: SubscriptionCharge }
  | { kind: "config" }
  | { kind: "unknown" };

interface Deps {
  retrieve: (priceId: string) => Promise<{ unit_amount: number | null; recurring: { interval: string } | null }>;
  isOnSale: (priceId: string) => Promise<boolean>;
}

const defaultDeps: Deps = {
  retrieve: (priceId) => getStripe().prices.retrieve(priceId),
  isOnSale: async (priceId) =>
    !!(await prisma.stripePrice.findFirst({ where: { stripePriceId: priceId, active: true }, select: { id: true } })),
};

/** The charge behind a price id, from Stripe; on a failed read, see the header. */
export async function chargeForPrice(priceId: string | null | undefined, deps: Deps = defaultDeps): Promise<ChargeAnswer> {
  if (!priceId) return { kind: "unknown" };
  try {
    const p = await deps.retrieve(priceId);
    const interval = p.recurring?.interval;
    if (Number.isInteger(p.unit_amount) && (interval === "month" || interval === "year")) {
      return { kind: "charge", charge: { cents: p.unit_amount as number, interval } };
    }
  } catch {
    // fall through to the catalog
  }
  try {
    return (await deps.isOnSale(priceId)) ? { kind: "config" } : { kind: "unknown" };
  } catch {
    return { kind: "unknown" };
  }
}
