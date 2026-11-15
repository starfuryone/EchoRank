// The reputation-management payload's three plan prices, filled in from
// PLAN_CONFIGS at request time. The owner's file ships the cards as
//   <span class="amt" data-plan-price="STARTER">78</span>
// with the "$" in its own span, so only the number is replaced: the monthly
// price, whole dollars, from the same PLAN_CONFIGS[plan].monthlyPrice the
// /pricing cards read (src/lib/pricing-tiers.ts). The typed number in the
// payload is never served; it only says what the file said on the day it came.

import { PLAN_CONFIGS, type SellablePlanType } from "@/lib/plan-config";
import { moneyAmount } from "@/lib/pricing-page/format";

/** The plans the payload prices, in card order. */
export const PRICED_PLANS = ["STARTER", "GROWTH", "AGENCY"] as const satisfies readonly SellablePlanType[];
type PricedPlan = (typeof PRICED_PLANS)[number];

const SPAN_RE = /(<span class="amt" data-plan-price=")([A-Z_]+)(">)[^<]*(<\/span>)/g;

/** The monthly amount a card shows, without the currency sign ("78"). */
export function cardAmount(plan: PricedPlan): string {
  return moneyAmount(PLAN_CONFIGS[plan].monthlyPrice, "en");
}

/**
 * The payload with every data-plan-price span set from the config. An unknown
 * plan, or a payload without exactly one card per plan, throws: a page that
 * cannot be priced is a build error, not a stale number on the site.
 */
export function withPlanPriceSpans(html: string): string {
  const seen: string[] = [];
  const out = html.replace(SPAN_RE, (_m, open: string, plan: string, mid: string, close: string) => {
    if (!(PRICED_PLANS as readonly string[]).includes(plan)) {
      throw new Error(`reputation-management: unknown data-plan-price ${plan}`);
    }
    seen.push(plan);
    return `${open}${plan}${mid}${cardAmount(plan as PricedPlan)}${close}`;
  });
  if (seen.join() !== PRICED_PLANS.join()) {
    throw new Error(`reputation-management: expected price cards ${PRICED_PLANS.join()}, found ${seen.join() || "none"}`);
  }
  return out;
}
