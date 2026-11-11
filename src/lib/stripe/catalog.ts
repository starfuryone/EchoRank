import "server-only";

// src/lib/stripe/catalog.ts — which catalog-gated plans (src/lib/plan-launch.ts)
// have their stripe_prices rows, i.e. are on sale.
//
// A plan is launched when it has an ACTIVE USD row for BOTH intervals: a card
// with a monthly price and no yearly one would break the toggle. Read on the
// pages that show cards (revalidated every few minutes) and on every checkout
// of a gated tier. A failed read is "not launched": the safe answer is not to
// sell a plan whose prices we cannot see (the scratch build has no database).

import type { PlanType } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { PLAN_CONFIGS } from "@/lib/plan-config";
import { CATALOG_GATED_PLANS, NONE_LAUNCHED, type LaunchedPlans } from "@/lib/plan-launch";
import type { BillingInterval } from "./lookup-keys";

/** stripe_prices.plan_tier for a plan: its slug ("nosy_bat"). */
export const catalogTier = (plan: PlanType): string => PLAN_CONFIGS[plan].slug;

type Rows = { planTier: string; interval: string }[];
type Reader = (tiers: string[]) => Promise<Rows>;

const readRows: Reader = (tiers) =>
  prisma.stripePrice.findMany({
    where: { planTier: { in: tiers }, currency: "USD", active: true },
    select: { planTier: true, interval: true },
  });

/** The gated plans with an active monthly and yearly USD row. */
export async function launchedPlans(read: Reader = readRows): Promise<LaunchedPlans> {
  const gated = [...CATALOG_GATED_PLANS];
  if (gated.length === 0) return NONE_LAUNCHED;
  let rows: Rows;
  try {
    rows = await read(gated.map(catalogTier));
  } catch {
    return NONE_LAUNCHED;
  }
  const has = (tier: string, interval: BillingInterval) => rows.some((r) => r.planTier === tier && r.interval.toLowerCase() === interval);
  return new Set(gated.filter((p) => has(catalogTier(p), "month") && has(catalogTier(p), "year")));
}

/**
 * May this checkout tier be sold right now? Always true for a tier that is not
 * catalog-gated; for a gated one, true only once it is launched.
 */
export async function checkoutTierOnSale(tier: string, read: Reader = readRows): Promise<boolean> {
  const plan = (Object.keys(PLAN_CONFIGS) as PlanType[]).find((p) => catalogTier(p) === tier);
  if (!plan || !CATALOG_GATED_PLANS.has(plan)) return true;
  return (await launchedPlans(read)).has(plan);
}
