// ---------------------------------------------------------------------------
// Stripe price resolution (USD only)
// ---------------------------------------------------------------------------
// 4 sellable tiers, USD only. Rather than fanning price ids out as env
// vars, they live in the `stripe_prices` table and are resolved here: forward
// (tier -> priceId) for checkout, and reverse (priceId -> tier) for webhook
// handling.

import { prisma } from "@/lib/prisma";

export type PlanTierKey =
  | "starter"
  | "growth"
  | "agency"
  | "enterprise";
/** USD-only: Echorank360 bills all locales in US dollars. */
export type CurrencyCode = "USD";
export type PlanType =
  /** @deprecated Retired tier; kept because Subscription rows may carry it. */
  | "AI_VISIBILITY"
  | "STARTER"
  | "GROWTH"
  | "AGENCY"
  | "ENTERPRISE";

const TIER_TO_PLAN: Record<PlanTierKey, PlanType> = {
  starter: "STARTER",
  growth: "GROWTH",
  agency: "AGENCY",
  enterprise: "ENTERPRISE",
};

/**
 * Resolve the active Stripe Price id for a tier + currency. Used when creating
 * a Checkout Session — pass the currency from the geo-resolved request context.
 */
export async function getStripePriceId(
  tier: PlanTierKey,
  currency: CurrencyCode = "USD",
  interval: "month" | "year" = "month",
): Promise<string | null> {
  const row = await prisma.stripePrice.findFirst({
    where: { planTier: tier, currency, interval, active: true },
    orderBy: { createdAt: "desc" },
    select: { stripePriceId: true },
  });
  return row?.stripePriceId ?? null;
}

export type BillingInterval = "month" | "year";

/**
 * The billing interval behind a subscription's price id.
 *
 * The Subscription row records planType and stripePriceId but no interval, so
 * "monthly or annual?" is only answerable through this table.
 *
 * NO `active` FILTER, unlike the two lookups either side of it. Those pick a
 * price to CHARGE, and a retired one must never be picked; this one describes a
 * subscription that is already on its price, and retiring that price does not
 * change how often it bills. Filtering here would blank the interval for exactly
 * the long-lived customers most likely to be on an older price.
 *
 * An id the catalog has never seen resolves to null rather than to a guess: the
 * trial-ending email would rather name the plan alone than tell a customer the
 * wrong amount is about to leave their card.
 */
export async function resolveIntervalFromPriceId(
  priceId: string | null | undefined,
): Promise<BillingInterval | null> {
  if (!priceId) return null;
  const row = await prisma.stripePrice.findFirst({
    where: { stripePriceId: priceId },
    orderBy: { createdAt: "desc" },
    select: { interval: true },
  });
  const interval = row?.interval?.toLowerCase();
  return interval === "month" || interval === "year" ? interval : null;
}

/**
 * Reverse-lookup a Stripe Price id back to its plan tier + currency. Used by
 * the subscription webhook so we record the tier (not the price id), and so
 * new prices work the moment they're added to the table — no code change.
 */
export async function resolvePlanFromPriceId(
  priceId: string,
): Promise<{ planType: PlanType; currency: string } | null> {
  const row = await prisma.stripePrice.findFirst({
    where: { stripePriceId: priceId, active: true },
    select: { planTier: true, currency: true },
  });
  if (!row) return null;

  const planType = TIER_TO_PLAN[row.planTier.toLowerCase() as PlanTierKey];
  if (!planType) return null;

  return { planType, currency: row.currency };
}
