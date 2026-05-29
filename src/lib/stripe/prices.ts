// ---------------------------------------------------------------------------
// Stripe multi-currency price resolution
// ---------------------------------------------------------------------------
// 4 tiers x 5 currencies = 20 single-currency Stripe Price objects. Rather than
// fanning those out as env vars, they live in the `stripe_prices` table and are
// resolved here: forward (tier+currency -> priceId) for checkout, and reverse
// (priceId -> tier) for webhook handling.

import { prisma } from "@/lib/prisma";

export type PlanTierKey = "starter" | "growth" | "agency" | "enterprise";
export type CurrencyCode = "USD" | "EUR" | "GBP" | "CAD" | "CHF";
export type PlanType = "STARTER" | "GROWTH" | "AGENCY" | "ENTERPRISE";

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
  currency: CurrencyCode,
  interval: "month" | "year" = "month",
): Promise<string | null> {
  const row = await prisma.stripePrice.findFirst({
    where: { planTier: tier, currency, interval, active: true },
    orderBy: { createdAt: "desc" },
    select: { stripePriceId: true },
  });
  return row?.stripePriceId ?? null;
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
