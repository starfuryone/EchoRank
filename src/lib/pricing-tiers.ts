// src/lib/pricing-tiers.ts
//
// PLAN_CONFIGS -> the card array both pricing surfaces render.
//
// EXTRACTED FROM page.tsx so /pricing and the homepage derive their numbers
// from one function over one config. The requirement for the standalone page
// was "no duplicated numbers", and the only way to hold that is for there to be
// exactly one place a price is read from.
//
// Enterprise is filtered out by the isCustomPricing FLAG rather than by plan
// id, so a future custom-priced tier drops off the grid on its own — the same
// way the JSON-LD offers already behave. Enterprise still exists everywhere
// else (feature matrix, upgrade ordering); it simply has no card.

import { PLAN_CONFIGS, PLAN_ORDER } from "@/lib/plan-config";
import { HOME_PRICING_CHROME } from "@/lib/i18n/content";
import { normalizeLocale } from "@/lib/seo/constants";
import type { HomePricingTier } from "@/app/[locale]/PricingSection";

export function pricingTiers(locale: string): HomePricingTier[] {
  const chrome = HOME_PRICING_CHROME[normalizeLocale(locale)];
  return PLAN_ORDER.filter((plan) => !PLAN_CONFIGS[plan].isCustomPricing).map((plan) => {
    const c = PLAN_CONFIGS[plan];
    const monthly = c.isCustomPricing ? null : c.monthlyPrice;
    const annual = c.isCustomPricing ? null : c.annualPrice;
    return {
      id: plan,
      name: c.name.toUpperCase(),
      monthly,
      annual,
      customLabel: c.isCustomPricing ? chrome.contactUs : null,
      // Annual is billed as 12 x annualPrice; the saving is what the tenant
      // avoids versus paying monthly for a year.
      savePct:
        monthly && annual && monthly > 0
          ? Math.round(((monthly - annual) / monthly) * 100)
          : null,
      features: c.features,
      // cta / ctaLink are deliberately NOT passed through. The cards have a
      // single action now (Stripe Checkout), and PLAN_CONFIGS keeps both
      // fields because FeatureGate still reads them.
      highlighted: c.highlighted === true,
    };
  });
}
