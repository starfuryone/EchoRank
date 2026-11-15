// The reputation-tools payload's plan numbers, filled in from PLAN_CONFIGS at
// request time, like technical-geo/prices.ts. The cards were typed by hand and
// drifted: $79 / $199 / $499 and "Unlimited locations" on Agency, after the
// 2026-11-11 price change and the 25-location cap.
//
// The payload's "$" sits outside the .amt span, and its Monthly/Annual toggle
// copies data-m / data-y into that span, so the tokens carry bare amounts:
//   __AMT_<PLAN>_MONTH__     the monthly price, whole ("78")
//   __AMT_<PLAN>_YEAR_MO__   the yearly price per month, two decimals ("62.40")
//   __LOCATIONS_<PLAN>__     quotaDefaults.maxLocations ("25")

import { PLAN_CONFIGS } from "@/lib/plan-config";
import { moneyAmount, moneyAmountCents } from "@/lib/pricing-page/format";

const PLANS = ["STARTER", "GROWTH", "AGENCY"] as const;

/** Every token the payload may carry, with its value from the config. */
export function reputationToolsTokens(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const plan of PLANS) {
    const c = PLAN_CONFIGS[plan];
    out[`__AMT_${plan}_MONTH__`] = moneyAmount(c.monthlyPrice, "en");
    out[`__AMT_${plan}_YEAR_MO__`] = moneyAmountCents(c.annualPrice, "en");
    out[`__LOCATIONS_${plan}__`] = String(c.quotaDefaults.maxLocations);
  }
  return out;
}

/** The payload with every token replaced. An unknown token throws. */
export function withReputationToolsNumbers(html: string): string {
  const tokens = reputationToolsTokens();
  return html.replace(/__(?:AMT|LOCATIONS)_[A-Z_]+?__/g, (t) => {
    const v = tokens[t];
    if (v === undefined) throw new Error(`reputation-tools: unknown token ${t}`);
    return v;
  });
}
