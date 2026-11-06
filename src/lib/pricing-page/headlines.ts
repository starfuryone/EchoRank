// src/lib/pricing-page/headlines.ts
//
// The plan cards' headline lines (ECHORANK-PRICING.md §3): six to eight per
// card, in one fixed order — locations, AI answer tracking, feedback requests,
// SEO searches + tracked keywords, domain analyses, crawls, support.
//
// EVERY NUMBER IS READ FROM PLAN_CONFIGS. The authored part is the sentence
// around it, in en / fr / de. The longer per-tier bullet lists stay in
// plan-features.ts, where /billing reads them; these are the short form the
// marketing cards lead with, and the comparison table under the cards carries
// everything else.
//
// "EVERYTHING IN STARTER, PLUS…": the entry card lists all its lines; each
// higher card opens with that phrase and then shows only the lines whose text
// differs from the card below it. Every number on the ladder rises, so in
// practice a higher card restates the volumes at its own level and drops what
// it shares (Agency's support line is Growth's). Computed, not curated: a
// config change that makes two tiers equal removes the line by itself.

import {
  PLAN_CONFIGS,
  PLAN_ORDER,
  type AiCheckupShape,
  type PlanConfig,
  type SellablePlanType,
} from "@/lib/plan-config";
import { isSeoToolLive } from "@/lib/seo-tools";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import { fmtNum, pricingBase, type PricingBase } from "./format";

/** The tiers that render a card: everything not custom-priced, in ladder order. */
export function cardPlans(): SellablePlanType[] {
  return PLAN_ORDER.filter((p) => !PLAN_CONFIGS[p].isCustomPricing);
}

function locations(c: PlanConfig, b: PricingBase): string {
  const n = c.quotaDefaults.maxLocations;
  if (n < 0) return { en: "Unlimited locations", fr: "Emplacements illimités", de: "Unbegrenzte Standorte" }[b];
  const one = n === 1;
  if (b === "fr") return `${fmtNum(n, b)} emplacement${one ? "" : "s"}`;
  if (b === "de") return `${fmtNum(n, b)} Standort${one ? "" : "e"}`;
  return `${fmtNum(n, b)} location${one ? "" : "s"}`;
}

/** "2 AI engines" / "all AI engines" — null providers means every available one. */
export function engines(shape: AiCheckupShape, b: PricingBase): string {
  const n = shape.providers;
  if (n === null) return { en: "all AI engines", fr: "tous les moteurs IA", de: "allen KI-Engines" }[b];
  if (b === "fr") return `${n} moteur${n === 1 ? "" : "s"} IA`;
  if (b === "de") return `${n} KI-Engine${n === 1 ? "" : "s"}`;
  return `${n} AI engine${n === 1 ? "" : "s"}`;
}

export function cadence(shape: AiCheckupShape, b: PricingBase): string | null {
  switch (shape.frequency) {
    case "weekly":
      return { en: "weekly", fr: "hebdomadaire", de: "wöchentlich" }[b];
    case "twice_weekly":
      return { en: "2×/week", fr: "2x/semaine", de: "2×/Woche" }[b];
    case "daily":
      return { en: "daily", fr: "quotidien", de: "täglich" }[b];
    case "custom":
      return { en: "on your schedule", fr: "selon votre contrat", de: "nach Vertrag" }[b];
    case "none":
      return null;
  }
}

function tracking(c: PlanConfig, b: PricingBase): string {
  const when = cadence(c.aiCheckup, b);
  const suffix = when ? ` (${when})` : "";
  const e = engines(c.aiCheckup, b);
  if (b === "fr") return `Suivi des réponses IA sur ${e}${suffix}`;
  if (b === "de") return `KI-Antworttracking auf ${e}${suffix}`;
  return `AI answer tracking across ${e}${suffix}`;
}

function feedback(c: PlanConfig, b: PricingBase): string {
  const n = fmtNum(c.quotaDefaults.maxRequestsPerMonth, b);
  return { en: `${n} feedback requests/month`, fr: `${n} demandes de rétroaction/mois`, de: `${n} Feedback-Anfragen/Monat` }[b];
}

function searches(c: PlanConfig, b: PricingBase): string {
  const s = c.seoSearchesPerMonth;
  const k = c.trackedKeywords;
  const sPart =
    s === null
      ? { en: "Unlimited SEO searches", fr: "Recherches SEO illimitées", de: "Unbegrenzte SEO-Suchen" }[b]
      : { en: `${fmtNum(s, b)} SEO searches`, fr: `${fmtNum(s, b)} recherches SEO`, de: `${fmtNum(s, b)} SEO-Suchen` }[b];
  if (k === 0) return `${sPart}${{ en: "/mo", fr: "/mois", de: "/Monat" }[b]}`;
  const kPart =
    k === null
      ? { en: "unlimited tracked keywords", fr: "mots-clés suivis illimités", de: "unbegrenzt verfolgte Keywords" }[b]
      : { en: `${fmtNum(k, b)} tracked keywords`, fr: `${fmtNum(k, b)} mots-clés suivis`, de: `${fmtNum(k, b)} verfolgte Keywords` }[b];
  return `${sPart} + ${kPart}`;
}

/** Null when the Finder is not live or the tier has no allowance — the line is then absent, not zero. */
function analyses(c: PlanConfig, b: PricingBase): string | null {
  if (!isSeoToolLive("keyword_opportunities")) return null;
  const n = c.keywordOpportunityAnalysesPerMonth;
  if (n === null) return { en: "Unlimited domain analyses", fr: "Analyses de domaine illimitées", de: "Unbegrenzte Domain-Analysen" }[b];
  if (n <= 0) return null;
  return { en: `${fmtNum(n, b)} domain analyses/mo`, fr: `${fmtNum(n, b)} analyses de domaine/mois`, de: `${fmtNum(n, b)} Domain-Analysen/Monat` }[b];
}

/** "4 <crawler> crawls/mo, up to 2,500 URLs each". Null when the crawler is locked (cap 0). */
function crawls(c: PlanConfig, b: PricingBase): string | null {
  if (c.crawlUrlCap <= 0) return null;
  const name = CRAWLER_BRAND.name;
  const cap = fmtNum(c.crawlUrlCap, b);
  const per = c.crawlsPerMonth;
  if (per === null) {
    return {
      en: `Unlimited ${name} crawls, up to ${cap} URLs each`,
      fr: `Explorations ${name} illimitées, jusqu'à ${cap} URL chacune`,
      de: `Unbegrenzte Crawls mit ${name}, je bis ${cap} URLs`,
    }[b];
  }
  const n = fmtNum(per, b);
  return {
    en: `${n} ${name} crawls/mo, up to ${cap} URLs each`,
    fr: `${n} explorations ${name}/mois, jusqu'à ${cap} URL chacune`,
    de: `${n} Crawls mit ${name}/Monat, je bis ${cap} URLs`,
  }[b];
}

/**
 * Support level per tier. BINDING WORDING, the same promise plan-features.ts
 * and the homepage FAQ make ("What support is included?"): email within 48 h
 * on weekdays, or priority email within 24 h on weekdays. No tier promises
 * phone, chat or weekends. tests/pricing-page.test.ts asserts the en and fr
 * strings equal the plan-features bullets, so the two cannot drift.
 */
export const SUPPORT_LEVEL: Record<SellablePlanType, "email" | "priority" | "contract"> = {
  STARTER: "email",
  GROWTH: "priority",
  AGENCY: "priority",
  ENTERPRISE: "contract",
};

export function supportLine(plan: SellablePlanType, b: PricingBase): string {
  switch (SUPPORT_LEVEL[plan]) {
    case "email":
      return {
        en: "Email support — 48h weekday response",
        fr: "Soutien par courriel — réponse en 48 h les jours ouvrables",
        de: "Support per E-Mail — Antwort innert 48 h an Werktagen",
      }[b];
    case "priority":
      return {
        en: "Priority support — email, 24h weekday response",
        fr: "Soutien prioritaire — courriel, réponse en 24 h les jours ouvrables",
        de: "Priority-Support — per E-Mail, Antwort innert 24 h an Werktagen",
      }[b];
    case "contract":
      return { en: "Dedicated account manager", fr: "Gestionnaire de compte dédié", de: "Persönliche Kundenbetreuung" }[b];
  }
}

function allLines(plan: SellablePlanType, b: PricingBase): string[] {
  const c = PLAN_CONFIGS[plan];
  return [
    locations(c, b),
    tracking(c, b),
    feedback(c, b),
    searches(c, b),
    analyses(c, b),
    crawls(c, b),
    supportLine(plan, b),
  ].filter((l): l is string => l !== null);
}

export interface PlanHeadlines {
  /** "Everything in Starter, plus:" — null on the entry card. */
  inherits: string | null;
  lines: string[];
}

export function planHeadlines(plan: SellablePlanType, locale: string): PlanHeadlines {
  const b = pricingBase(locale);
  const ladder = cardPlans();
  const i = ladder.indexOf(plan);
  const lines = allLines(plan, b);
  if (i <= 0) return { inherits: null, lines };
  const below = ladder[i - 1]!;
  const shared = new Set(allLines(below, b));
  const name = PLAN_CONFIGS[below].name;
  return {
    inherits: {
      en: `Everything in ${name}, plus:`,
      fr: `Tout ce qu'offre ${name}, plus :`,
      de: `Alles aus ${name}, dazu:`,
    }[b],
    lines: lines.filter((l) => !shared.has(l)),
  };
}
