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
import { PLAN_CONFIGS, PLAN_ORDER, type SellablePlanType } from "@/lib/plan-config";

/** Plans that need their stripe_prices rows before they are shown or sold. */
export const CATALOG_GATED_PLANS: ReadonlySet<PlanType> = new Set<PlanType>(["NOSY_BAT"]);

/** The catalog-gated plans whose rows exist. Empty = none launched (the safe default). */
export type LaunchedPlans = ReadonlySet<PlanType>;
export const NONE_LAUNCHED: LaunchedPlans = new Set<PlanType>();

/** Is this plan on sale: not catalog-gated, or gated and launched? */
export function planOnSale(plan: PlanType, launched: LaunchedPlans = NONE_LAUNCHED): boolean {
  return !CATALOG_GATED_PLANS.has(plan) || launched.has(plan);
}

/**
 * The card order: every plan on sale by its monthly price in PLAN_CONFIGS,
 * cheapest first (owner, 2026-11-12), computed here on every call rather than
 * typed, so a price change reorders the cards. The order does not depend on
 * the Monthly / Yearly toggle (the cards must not jump), ties keep the ladder's
 * order (PLAN_ORDER), and a custom-priced plan (Enterprise, the band under the
 * cards) is not sorted: it stays last. Every surface reads this order: the
 * cards on /pricing, /site-crawler and the homepage (pricing-tiers.ts, each
 * narrowing it to its own subset), the /pricing comparison columns, the FAQ
 * and the crawler's facts. PLAN_ORDER (plan-config.ts) stays the ladder, which
 * upgrades and "Everything in X, plus:" walk.
 */
export function cardOrder(launched: LaunchedPlans = NONE_LAUNCHED): SellablePlanType[] {
  const onSale: SellablePlanType[] = [...PLAN_ORDER];
  for (const p of CATALOG_GATED_PLANS) if (launched.has(p) && !onSale.includes(p as SellablePlanType)) onSale.push(p as SellablePlanType);
  const custom = (p: SellablePlanType) => PLAN_CONFIGS[p].isCustomPricing;
  const cents = (p: SellablePlanType) => Math.round(PLAN_CONFIGS[p].monthlyPrice * 100);
  const priced = onSale
    .filter((p) => !custom(p))
    .sort((a, b) => cents(a) - cents(b) || onSale.indexOf(a) - onSale.indexOf(b));
  return [...priced, ...onSale.filter(custom)];
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
