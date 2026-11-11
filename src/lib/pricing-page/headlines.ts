// src/lib/pricing-page/headlines.ts
//
// The plan cards' headline lines (ECHORANK-PRICING.md §3), in one fixed order:
// AI tracking FIRST (ECHORANK-AI-TIER.md, 2026-11-07), repetitions, locations,
// feedback requests, SEO searches + tracked keywords, domain analyses, crawls,
// support. A line whose allowance is 0 is absent, not printed as 0.
//
// EVERY NUMBER IS READ FROM PLAN_CONFIGS. The authored part is the sentence
// around it, in en / fr / de. The longer per-tier bullet lists stay in
// plan-features.ts, where /billing reads them; these are the short form the
// marketing cards lead with, and the comparison table under the cards carries
// everything else.
//
// "EVERYTHING IN STARTER, PLUS…": the entry card lists all its lines; each
// higher card opens with that phrase, then its AI line (always), then only the
// lines whose text differs from the card below it. Every number on the ladder rises, so in
// practice a higher card restates the volumes at its own level and drops what
// it shares (Agency's support line is Growth's). Computed, not curated: a
// config change that makes two tiers equal removes the line by itself.

import {
  PLAN_CONFIGS,
  type AiCheckupShape,
  type PlanConfig,
  type SellablePlanType,
} from "@/lib/plan-config";
import { isSeoToolLive } from "@/lib/seo-tools";
import { hasFeature } from "@/lib/feature-flags";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import { NOSYBAT_ENFORCED } from "@/lib/site-crawler/nosybat-enforced";
import { NONE_LAUNCHED, OFF_LADDER_PLANS, cardOrder, type LaunchedPlans } from "@/lib/plan-launch";
import { flag } from "@/lib/flags";
import { planAllowsArea } from "@/lib/plan-access";
import { ENGINE_CATALOGUE } from "@/lib/ai-monitor/engines";
import { PLAN_AUDIENCE } from "./audience";
import { fmtNum, pricingBase, type PricingBase } from "./format";

/**
 * The tiers that render a card: everything not custom-priced, in card order.
 * A plan sold only once its Stripe prices exist (the crawler-only plan) is in
 * the list only when `launched` holds it (src/lib/plan-launch.ts); the default
 * is the ladder alone.
 */
export function cardPlans(launched: LaunchedPlans = NONE_LAUNCHED): SellablePlanType[] {
  return cardOrder(launched).filter((p) => !PLAN_CONFIGS[p].isCustomPricing);
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

/**
 * The engines a tier's checkups query, by name, in the order the runner takes
 * them (the head of the catalogue, engines.ts). Text only: no vendor logos.
 * Null when the tier takes every reachable engine.
 */
export function engineNames(shape: AiCheckupShape): string[] | null {
  if (shape.providers === null) return null;
  return [...ENGINE_CATALOGUE]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, shape.providers)
    .map((e) => e.displayName);
}

/**
 * THE FIRST LINE ON EVERY CARD: "{prompts} AI prompts · {engines} engines ·
 * {frequency}", then the engines by name.
 */
export function tracking(c: PlanConfig, b: PricingBase): string {
  const shape = c.aiCheckup;
  const when = cadence(shape, b);
  const names = engineNames(shape);
  const p = fmtNum(shape.prompts, b);
  const head = { en: `${p} AI prompts`, fr: `${p} requêtes IA`, de: `${p} KI-Prompts` }[b];
  const parts = [head, engines(shape, b), when].filter(Boolean).join(" · ");
  return names ? `${parts} (${names.join(", ")})` : parts;
}

/**
 * The citation tools (Citation Finder + Citation Opportunities), read from the
 * same feature key their pages gate on. Every plan has it, so in practice the
 * line shows on the entry card and is "shared" above it.
 */
function citations(plan: SellablePlanType, b: PricingBase): string | null {
  if (!hasFeature(plan, "citation_tracking")) return null;
  return {
    en: "Cited sources and citation opportunities",
    fr: "Sources citées et occasions de citation",
    de: "Zitierte Quellen und Zitat-Chancen",
  }[b];
}

/** Trend history: the AI Search overview's score history and every checkup. */
function trendHistory(plan: SellablePlanType, b: PricingBase): string | null {
  if (!hasFeature(plan, "ai_visibility")) return null;
  return {
    en: "Trend history: score and every checkup",
    fr: "Historique des tendances : score et chaque vérification",
    de: "Trendverlauf: Score und jeder Check",
  }[b];
}

/** Growth and up ask each prompt more than once; null at one repetition. */
function repetitions(c: PlanConfig, b: PricingBase): string | null {
  const n = c.aiCheckup.repetitions;
  if (n <= 1) return null;
  return { en: `Each prompt asked ${n}× per engine`, fr: `Chaque requête posée ${n} fois par moteur`, de: `Jeder Prompt ${n}× pro Engine` }[b];
}

/** Null at 0 (the AI Visibility plan has no feedback requests): absent, not "0". */
function feedback(c: PlanConfig, b: PricingBase): string | null {
  if (c.quotaDefaults.maxRequestsPerMonth <= 0) return null;
  const n = fmtNum(c.quotaDefaults.maxRequestsPerMonth, b);
  return { en: `${n} feedback requests/month`, fr: `${n} demandes de rétroaction/mois`, de: `${n} Feedback-Anfragen/Monat` }[b];
}

/** Null when the tier has no SEO searches at all (the AI Visibility plan). */
function searches(c: PlanConfig, b: PricingBase): string | null {
  const s = c.seoSearchesPerMonth;
  const k = c.trackedKeywords;
  if (s === 0 && !k) return null;
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

// The crawler lines (the crawler's pitch, ECHORANK-NOSYBAT-COPY-REFRESH.md
// Phase 2): the crawls and their size, the month's page allowance, JavaScript
// rendering, crawls at once. Read from plan-config; the page allowance and
// the crawls at once only while code enforces them (nosybat-enforced.ts, which
// is dependency-free: this module reaches the billing page's client bundle
// through plan-features.ts, so it cannot read nosybat-facts.ts).

/** The crawler is on the plan: plan-access opens it and a crawl may fetch something. */
const hasCrawler = (plan: SellablePlanType, c: PlanConfig) => planAllowsArea(plan, "crawler") && c.crawlUrlCap > 0;

/**
 * "20 <crawler> crawls/mo, up to 5,000 URLs each · 100,000 pages/mo · 2 at
 * once". One line, not three: the cards hold at most nine entries
 * (tests/pricing-cards.dom.test.tsx). Null without the crawler.
 */
function crawls(plan: SellablePlanType, c: PlanConfig, b: PricingBase): string | null {
  if (!hasCrawler(plan, c)) return null;
  const name = CRAWLER_BRAND.name;
  const cap = fmtNum(c.crawlUrlCap, b);
  const per = c.crawlsPerMonth;
  const head =
    per === null
      ? {
          en: `Unlimited ${name} crawls, up to ${cap} URLs each`,
          fr: `Explorations ${name} illimitées, jusqu'à ${cap} URL chacune`,
          de: `Unbegrenzte Crawls mit ${name}, je bis ${cap} URLs`,
        }[b]
      : {
          en: `${fmtNum(per, b)} ${name} crawls/mo, up to ${cap} URLs each`,
          fr: `${fmtNum(per, b)} explorations ${name}/mois, jusqu'à ${cap} URL chacune`,
          de: `${fmtNum(per, b)} Crawls mit ${name}/Monat, je bis ${cap} URLs`,
        }[b];
  const pages = c.crawlPagesPerMonth;
  const parts = [head];
  if (NOSYBAT_ENFORCED.pagesPerMonth && pages !== null && pages > 0) {
    parts.push({ en: `${fmtNum(pages, b)} pages/mo`, fr: `${fmtNum(pages, b)} pages/mois`, de: `${fmtNum(pages, b)} Seiten/Monat` }[b]);
  }
  // Crawls at once only where more than one may run: one is the norm, not a selling point.
  if (NOSYBAT_ENFORCED.crawlsAtOnce && c.crawlConcurrency > 1) {
    const n = fmtNum(c.crawlConcurrency, b);
    parts.push({ en: `${n} at once`, fr: `${n} simultanées`, de: `${n} gleichzeitig` }[b]);
  }
  return parts.join(" · ");
}

/**
 * "JavaScript rendering included": the same words on every crawl plan, so the
 * ladder shows it once, on the entry card ("Everything in Starter, plus:").
 */
function rendering(plan: SellablePlanType, c: PlanConfig, b: PricingBase): string | null {
  if (!hasCrawler(plan, c) || !flag("crawl.render") || c.crawlRenderedPages <= 0) return null;
  return { en: "JavaScript rendering included", fr: "Rendu JavaScript inclus", de: "JavaScript-Rendering inbegriffen" }[b];
}
/**
 * Support level per tier. BINDING WORDING, the same promise plan-features.ts
 * and the homepage FAQ make ("What support is included?"): email within 48 h
 * on weekdays, or priority email within 24 h on weekdays. No tier promises
 * phone, chat or weekends. tests/pricing-page.test.ts asserts the en and fr
 * strings equal the plan-features bullets, so the two cannot drift.
 */
export const SUPPORT_LEVEL: Record<SellablePlanType, "email" | "priority" | "contract"> = {
  AI_VISIBILITY: "email",
  NOSY_BAT: "email",
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

/** The AI line FIRST on every card (ECHORANK-AI-TIER.md Phase 2), then the rest. */
function allLines(plan: SellablePlanType, b: PricingBase): string[] {
  const c = PLAN_CONFIGS[plan];
  // The crawler-only plan: the crawler lines and support, nothing else (it
  // has no AI tracking, locations, feedback or SEO tools). /pricing replaces
  // these with its own lines from nosybatFacts (pricing-tiers.ts).
  if (plan === "NOSY_BAT") return [crawls(plan, c, b), rendering(plan, c, b), supportLine(plan, b)].filter((l): l is string => l !== null);
  return [
    tracking(c, b),
    citations(plan, b),
    trendHistory(plan, b),
    repetitions(c, b),
    locations(c, b),
    feedback(c, b),
    searches(c, b),
    analyses(c, b),
    crawls(plan, c, b),
    rendering(plan, c, b),
    supportLine(plan, b),
  ].filter((l): l is string => l !== null);
}

// The audience lines and the Enterprise card live in ./audience.ts (no
// dependencies: the pricing grid, a Client Component, imports them).
export { ENTERPRISE_CARD, PLAN_AUDIENCE } from "./audience";

export interface PlanHeadlines {
  /** "Everything in Starter, plus:" — null on the entry card. */
  inherits: string | null;
  lines: string[];
  /** Who the plan is for, under the price. */
  audience: string;
}

/**
 * `ladder` is the cards actually shown, so "Everything in X, plus:" always
 * names a card on the same page (/site-crawler has no AI Visibility card, so
 * its Starter card is the entry card there).
 */
export function planHeadlines(plan: SellablePlanType, locale: string, ladder: readonly SellablePlanType[] = cardPlans()): PlanHeadlines {
  const b = pricingBase(locale);
  const lines = allLines(plan, b);
  const audience = PLAN_AUDIENCE[plan][b];
  // A side plan (the crawler-only one) is not a step: no "Everything in X,
  // plus:" on it, and the card after it inherits from the ladder plan before.
  if (OFF_LADDER_PLANS.has(plan)) return { inherits: null, lines, audience };
  const steps = ladder.filter((p) => !OFF_LADDER_PLANS.has(p));
  const i = steps.indexOf(plan);
  if (i <= 0) return { inherits: null, lines, audience };
  const below = steps[i - 1]!;
  const shared = new Set(allLines(below, b));
  const name = PLAN_CONFIGS[below].name;
  return {
    inherits: {
      en: `Everything in ${name}, plus:`,
      fr: `Tout ce qu'offre ${name}, plus :`,
      de: `Alles aus ${name}, dazu:`,
    }[b],
    // The AI line (always lines[0]) stays even when it equals the card below:
    // it is the one line every card leads with, and Growth's reads the same as
    // Starter's — what differs is the repetitions line under it.
    lines: lines.filter((l, idx) => idx === 0 || !shared.has(l)),
    audience,
  };
}
