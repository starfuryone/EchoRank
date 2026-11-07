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

import { PLAN_CONFIGS, PLAN_ORDER, TRIAL_DAYS, type SellablePlanType } from "@/lib/plan-config";
import { planHeadlines } from "@/lib/pricing-page/headlines";
import { HOME_PRICING_CHROME } from "@/lib/i18n/content";
import { normalizeLocale } from "@/lib/seo/constants";
import type { HomePricingTier } from "@/app/[locale]/PricingSection";
import { CHECKUPS_PER_WEEK } from "@/lib/snapshot/tracking";

/** Whole-percent saving of the annual rate over monthly, rounded DOWN. */
export function savePctOf(monthly: number | null, annual: number | null): number | null {
  if (!monthly || annual === null || monthly <= 0 || annual >= monthly) return null;
  return Math.floor(((monthly - annual) / monthly) * 100);
}

/**
 * The hero's "pay yearly and save N%": the SMALLEST saving across the card
 * tiers, rounded down, so the sentence is true of every plan it introduces.
 */
export function yearlySavingPct(): number | null {
  const pcts = PLAN_ORDER.filter((p) => !PLAN_CONFIGS[p].isCustomPricing).map((p) =>
    savePctOf(PLAN_CONFIGS[p].monthlyPrice, PLAN_CONFIGS[p].annualPrice),
  );
  if (pcts.some((p) => p === null) || pcts.length === 0) return null;
  return Math.min(...(pcts as number[]));
}

/**
 * The cards for one page. `plans` narrows the set (default: every card plan,
 * AI Visibility first): /site-crawler shows Starter, Growth and Agency only,
 * since the AI-only plan has no crawler.
 */
export function pricingTiers(locale: string, plans?: readonly SellablePlanType[]): HomePricingTier[] {
  const chrome = HOME_PRICING_CHROME[normalizeLocale(locale)];
  const shown = PLAN_ORDER.filter((plan) => !PLAN_CONFIGS[plan].isCustomPricing && (!plans || plans.includes(plan)));
  return shown.map((plan) => {
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
      // avoids versus paying monthly for a year. ROUNDED DOWN: a saving claim
      // may understate, never overstate.
      savePct: savePctOf(monthly, annual),
      annualTotal: annual === null ? null : annual * 12,
      trialDays: TRIAL_DAYS,
      // The card's short form: derived from this tier's own allowances, in
      // this locale (pricing-page/headlines.ts). The full per-tier list stays
      // in plan-features.ts for /billing; the comparison table on /pricing
      // carries the rest.
      ...planHeadlines(plan, locale, shown),
      // cta / ctaLink are deliberately NOT passed through. The cards have a
      // single action now (Stripe Checkout), and PLAN_CONFIGS keeps both
      // fields because FeatureGate still reads them.
      highlighted: c.highlighted === true,
      tracking: {
        prompts: c.aiCheckup.prompts,
        providers: c.aiCheckup.providers,
        perWeek: CHECKUPS_PER_WEEK[c.aiCheckup.frequency],
      },
    };
  });
}
