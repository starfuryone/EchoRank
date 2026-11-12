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
import { pricingBase, toCents } from "@/lib/pricing-page/format";
import { NONE_LAUNCHED, cardOrder, type LaunchedPlans } from "@/lib/plan-launch";
import { buildNosybatFacts } from "@/lib/site-crawler/nosybat-facts";
import { nosybatCardLines } from "@/lib/site-crawler/nosybat-card";
import { HOME_PRICING_CHROME } from "@/lib/i18n/content";
import { normalizeLocale } from "@/lib/seo/constants";
import type { HomePricingTier } from "@/app/[locale]/PricingSection";
import { CHECKUPS_PER_WEEK } from "@/lib/snapshot/tracking";

/**
 * Whole-percent saving of the annual rate over monthly, rounded DOWN. In
 * cents: 10.50 → 8.40 is exactly 20%, which (10.5 - 8.4) / 10.5 in
 * floating point puts at 19.999… and the floor at 19.
 */
export function savePctOf(monthly: number | null, annual: number | null): number | null {
  if (!monthly || annual === null || monthly <= 0 || annual >= monthly) return null;
  const m = toCents(monthly);
  return Math.floor(((m - toCents(annual)) * 100) / m);
}

/**
 * Plans whose card states the yearly saving as an amount ("save $52.80" since
 * the 2026-11-11 price change) rather than a percentage: the crawler-only plan
 * (owner's spec, 2026-11-10: "…/mo billed yearly, save <amount>").
 */
const SAVE_AS_AMOUNT: ReadonlySet<SellablePlanType> = new Set<SellablePlanType>(["NOSY_BAT"]);

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
 * The cards for one page, cheapest first (cardOrder(), plan-launch.ts: by
 * monthly price, the same order on either toggle). `plans` narrows the set
 * (default: every card plan): /site-crawler shows the crawl plans only, since
 * the AI-only plan has no crawler, in the same order. `launched` holds the
 * catalog-gated plans on sale (src/lib/stripe/catalog.ts): the crawler-only
 * plan has a card only once its Stripe prices exist.
 */
export function pricingTiers(
  locale: string,
  plans?: readonly SellablePlanType[],
  opts: { launched?: LaunchedPlans } = {},
): HomePricingTier[] {
  const chrome = HOME_PRICING_CHROME[normalizeLocale(locale)];
  const launched = opts.launched ?? NONE_LAUNCHED;
  const shown = cardOrder(launched).filter((plan) => !PLAN_CONFIGS[plan].isCustomPricing && (!plans || plans.includes(plan)));
  const base = pricingBase(locale);
  return shown.map((plan) => {
    const c = PLAN_CONFIGS[plan];
    const monthly = c.isCustomPricing ? null : c.monthlyPrice;
    const annual = c.isCustomPricing ? null : c.annualPrice;
    const headlines = planHeadlines(plan, locale, shown);
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
      // In cents: 141.60 × 12 is 1699.20, not 1699.1999999999998.
      annualTotal: annual === null ? null : (toCents(annual) * 12) / 100,
      saveAmount:
        SAVE_AS_AMOUNT.has(plan) && monthly !== null && annual !== null && annual < monthly
          ? ((toCents(monthly) - toCents(annual)) * 12) / 100
          : null,
      trialDays: TRIAL_DAYS,
      // The card's short form: derived from this tier's own allowances, in
      // this locale (pricing-page/headlines.ts). The full per-tier list stays
      // in plan-features.ts for /billing; the comparison table on /pricing
      // carries the rest. The crawler-only plan's lines come from nosybatFacts
      // (site-crawler/nosybat-card.ts), in the page's own number style.
      ...headlines,
      lines:
        plan === "NOSY_BAT"
          ? nosybatCardLines(buildNosybatFacts({ launched }), base).map((l) => (base === "fr" ? l.replace(/ /g, " ") : l))
          : headlines.lines,
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
