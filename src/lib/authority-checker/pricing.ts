// src/lib/authority-checker/pricing.ts — the "from $29" on the Link Authority
// Checker's landing page, derived from the plans rather than typed: the lowest
// monthly price among the plans that include the tool and allow it at least
// one check. Today that is the AI Visibility plan.

import { PLAN_CONFIGS, PLAN_ORDER } from "@/lib/plan-config";
import { planAllowsArea } from "@/lib/plan-access";

export function linkAuthorityFromPrice(): number {
  const prices = PLAN_ORDER.filter((p) => {
    const c = PLAN_CONFIGS[p];
    return !c.isCustomPricing && c.linkAuthorityChecksPerMonth !== 0 && planAllowsArea(p, "link_authority");
  }).map((p) => PLAN_CONFIGS[p].monthlyPrice);
  return Math.min(...prices);
}
