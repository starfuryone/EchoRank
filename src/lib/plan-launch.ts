// src/lib/plan-launch.ts — plans that are sold only once their Stripe prices
// exist.
//
// The crawler-only plan (NOSY_BAT, 2026-11-10) ships in code before its Stripe
// product does: the operator creates the prices with
// /opt/echorank/prompts/stripe-nosy-bat.sh, whose seed step writes the
// stripe_prices rows. Until both of its rows (month and year) are there:
//   - no card shows it (/pricing, /site-crawler), and no copy names it: the
//     callers pass the launched set to cardPlans() / nosybatFacts();
//   - the checkout route refuses it (src/app/api/billing/checkout/route.ts).
// The rows are read by src/lib/stripe/catalog.ts (server-only). This module is
// dependency-free: the pricing grid (a Client Component) and the card
// headlines import it.

import type { PlanType } from "@/generated/prisma";
import { PLAN_ORDER, type SellablePlanType } from "@/lib/plan-config";

/** Plans that need their stripe_prices rows before they are shown or sold. */
export const CATALOG_GATED_PLANS: ReadonlySet<PlanType> = new Set<PlanType>(["NOSY_BAT"]);

/**
 * Where a gated plan's card goes once it is on sale: after this ladder plan.
 * The crawler-only plan sits after AI Visibility (owner, 2026-11-10). It is
 * not on PLAN_ORDER (plan-config.ts), which stays the ladder.
 */
const CARD_AFTER: Readonly<Record<string, SellablePlanType>> = { NOSY_BAT: "AI_VISIBILITY" };

/** The catalog-gated plans whose rows exist. Empty = none launched (the safe default). */
export type LaunchedPlans = ReadonlySet<PlanType>;
export const NONE_LAUNCHED: LaunchedPlans = new Set<PlanType>();

/** Is this plan on sale: not catalog-gated, or gated and launched? */
export function planOnSale(plan: PlanType, launched: LaunchedPlans = NONE_LAUNCHED): boolean {
  return !CATALOG_GATED_PLANS.has(plan) || launched.has(plan);
}

/** The card order: the ladder, with every launched gated plan at its place (CARD_AFTER). */
export function cardOrder(launched: LaunchedPlans = NONE_LAUNCHED): SellablePlanType[] {
  const out: SellablePlanType[] = [...PLAN_ORDER];
  for (const p of CATALOG_GATED_PLANS) {
    if (!launched.has(p) || out.includes(p)) continue;
    const after = out.indexOf(CARD_AFTER[p] ?? out[0]!);
    out.splice(after + 1, 0, p);
  }
  return out;
}

/**
 * The crawler-only plan's card id on the pricing grid, so a link can open
 * /pricing at it (the Product mega menu's plan item: /pricing#nosy-bat). The
 * card renders only once the plan is launched; before that the link lands on
 * the top of /pricing.
 */
export const NOSY_BAT_CARD_ANCHOR = "nosy-bat";

/** Plans that are side products, not a step on the ladder: no "Everything in X, plus:" above or below them. */
export const OFF_LADDER_PLANS: ReadonlySet<PlanType> = CATALOG_GATED_PLANS;
