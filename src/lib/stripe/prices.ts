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
