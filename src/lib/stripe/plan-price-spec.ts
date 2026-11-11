// src/lib/stripe/plan-price-spec.ts — the Stripe amounts for every card plan,
// DERIVED from PLAN_CONFIGS.
//
// One source for three consumers that used to type the amounts themselves:
// scripts/seed-plan-prices-usd.ts (which checks the prices holding each lookup
// key against these), scripts/plan-prices-json.ts (which prints them for the
// operator's /opt/echorank/prompts/stripe-price-change.sh), and the tests.
// A price change is an edit to plan-config.ts and nothing else here.
//
// Cents throughout. annualPrice in PLAN_CONFIGS is the per-month equivalent,
// so the yearly price is twelve of it, in cents: 62.40 × 12 in floating point
// is 748.8000000000001, 6240 × 12 is 74880.
//
// ENTERPRISE is absent: sales-led, no price rows, "Contact us" wherever tiers
// are compared. Dependency-free apart from plan-config (no Prisma, no Stripe).

import { PLAN_CONFIGS, type SellablePlanType } from "@/lib/plan-config";

export type PriceInterval = "month" | "year";

export interface PlanPriceSpec {
  plan: SellablePlanType;
  /** stripe_prices.plan_tier and the lookup key's tier: the plan's slug. */
  planTier: string;
  /** Product name suffix, for a product the seed has to create. */
  label: string;
  monthlyCents: number;
  annualCents: number;
}

/** The plans with Stripe prices, in the seed's order. */
export const PRICED_PLANS: readonly SellablePlanType[] = ["AI_VISIBILITY", "NOSY_BAT", "STARTER", "GROWTH", "AGENCY"];

const cents = (dollars: number): number => Math.round(dollars * 100);

export const PLAN_PRICE_SPECS: readonly PlanPriceSpec[] = PRICED_PLANS.map((plan) => {
  const c = PLAN_CONFIGS[plan];
  return {
    plan,
    planTier: c.slug,
    label: c.name,
    monthlyCents: cents(c.monthlyPrice),
    annualCents: cents(c.annualPrice) * 12,
  };
});

/** Active USD rows the catalog holds once seeded: 5 plans x 2 intervals = 10. */
export const EXPECTED_ACTIVE_ROWS = PLAN_PRICE_SPECS.length * 2;

export function amountFor(spec: PlanPriceSpec, interval: PriceInterval): number {
  return interval === "month" ? spec.monthlyCents : spec.annualCents;
}

/** echorank_<tier>_usd_<interval>, as src/lib/stripe/lookup-keys.ts builds it. */
export function lookupKeyFor(spec: PlanPriceSpec, interval: PriceInterval): string {
  return `echorank_${spec.planTier}_usd_${interval}`;
}
