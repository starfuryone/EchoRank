// src/lib/free-audit/facts.ts — the numbers and links the free AI Readiness
// Audit's result shows, from config (no typed numbers): the AI Visibility
// plan's price and allowance (its live engines), the Link Authority Checker's
// "from" price, the free crawl's page cap. Serializable, so the server page
// hands it to the Client Components.

import { cadenceLabel } from "@/lib/ai-visibility-landing/copy";
import { AV_PLAN, avMonthlyPrice, planEngineNames } from "@/lib/ai-visibility-landing/facts";
import { linkAuthorityFromPrice } from "@/lib/authority-checker/pricing";
import { pricingBase, usd, fmtNum } from "@/lib/pricing-page/format";
import { PLAN_CONFIGS } from "@/lib/plan-config";
import { SITE_URL } from "@/lib/seo/constants";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import { FREE_CRAWL_URL_CAP } from "@/lib/site-crawler/free-limits";
import type { ResultFacts } from "@/components/free-audit/FreeAuditResult";
import { FREE_AUDITS_PER_DAY, FREE_AUDIT_RESULT_DAYS, FREE_AUDIT_WINDOW_HOURS } from "./limits";

/** ?src= of the result's plan CTA. */
export const FREE_AUDIT_RESULT_SRC = "free-audit-result";

export function resultFacts(locale: string, env: NodeJS.ProcessEnv = process.env): ResultFacts {
  const base = pricingBase(locale);
  const l = locale;
  const shape = PLAN_CONFIGS[AV_PLAN].aiCheckup;
  const engines = planEngineNames(AV_PLAN, env);
  const list = new Intl.ListFormat(base === "fr" ? "fr-CA" : base === "de" ? "de-CH" : "en-US", { style: "long", type: "conjunction" });
  const la = linkAuthorityFromPrice();
  return {
    locale: l,
    perDay: FREE_AUDITS_PER_DAY,
    hours: FREE_AUDIT_WINDOW_HOURS,
    resultDays: FREE_AUDIT_RESULT_DAYS,
    av: {
      price: usd(avMonthlyPrice(), base),
      prompts: shape.prompts,
      engines: list.format(engines),
      cadence: cadenceLabel(base, shape.frequency),
      href: `/${l}/pricing?plan=ai_visibility&src=${FREE_AUDIT_RESULT_SRC}`,
    },
    linkAuthority: { price: usd(la, base), href: `/${l}/free-tools/authority-checker` },
    nosyBat: { pages: fmtNum(FREE_CRAWL_URL_CAP, base), name: CRAWLER_BRAND.name, href: `/${l}/free-tools/site-crawler` },
    checkHref: `/${l}/ai-visibility-check`,
    siteUrl: SITE_URL,
  };
}
