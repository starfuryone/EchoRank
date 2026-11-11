// The technical-geo payload's prices, filled in from PLAN_CONFIGS at request
// time. The payload is a String.raw document with no interpolation, so it
// carries tokens (__PRICE_<PLAN>_MONTH__, __PRICE_<PLAN>_YEAR_MO__) instead of
// typed amounts, which drifted: it said $79 / $199 / $499 after the cards had
// moved on. Monthly prices print whole ("$78"), the yearly per-month figure
// with both decimals ("$62.40"), as on the cards.

import { PLAN_CONFIGS, type SellablePlanType } from "@/lib/plan-config";
import { usd, usdCents } from "@/lib/pricing-page/format";

const PLANS: readonly SellablePlanType[] = ["AI_VISIBILITY", "NOSY_BAT", "STARTER", "GROWTH", "AGENCY"];

/** Every token the payload may carry, with its value from the config. */
export function priceTokens(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const plan of PLANS) {
    const c = PLAN_CONFIGS[plan];
    out[`__PRICE_${plan}_MONTH__`] = usd(c.monthlyPrice, "en");
    out[`__PRICE_${plan}_YEAR_MO__`] = usdCents(c.annualPrice, "en");
  }
  return out;
}

/** The payload with every price token replaced. An unknown token throws. */
export function withPlanPrices(html: string): string {
  const tokens = priceTokens();
  return html.replace(/__PRICE_[A-Z_]+?_(?:MONTH|YEAR_MO)__/g, (t) => {
    const v = tokens[t];
    if (v === undefined) throw new Error(`technical-geo: unknown price token ${t}`);
    return v;
  });
}
