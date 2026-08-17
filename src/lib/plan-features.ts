// src/lib/plan-features.ts
//
// The plan card bullets. ONE SOURCE, DERIVED WHERE IT CAN BE.
//
// ── WHY THIS IS A FUNCTION AND NOT AN ARRAY ─────────────────────────────────
// These bullets used to be `features: string[]` literals inside PLAN_CONFIGS,
// sitting a few lines above the very allowances they described. They drifted
// anyway, and in the way typed numbers always drift — silently, in the
// direction of the more flattering number:
//
//   - every tier advertised "AI answer tracking across 4 engines", including
//     STARTER, whose aiCheckup queries 2 providers;
//   - /billing rendered a SECOND hand-written set (dashboard.ts planFeatures)
//     that had Growth at 3 locations and 2,000 requests against a config
//     saying 5 and 5,000 — a paying customer reading the wrong number about
//     the plan they had already bought.
//
// So every bullet whose content is a fact the code enforces is COMPUTED from
// the field that enforces it. A card cannot advertise an engine count, a
// cadence, a location count, a request volume, a search pool, a keyword cap, a
// crawl ceiling or an analysis allowance that the config does not actually
// grant, because it no longer has anywhere to type one.
//
// What remains as authored copy is the part that is genuinely copy — "Email
// review requests", "White-label dashboard" — capability names with no number
// in them, which is exactly the class of string that does not drift.
//
// ── LOCALES ────────────────────────────────────────────────────────────────
// Two bases, en and fr, folded the way the pricing page's own body copy folds:
// fr* -> fr, everything else -> en. That covers all five marketing locales and
// all three DashLocales, with de-CH falling back to EN as it does elsewhere in
// the dashboard. See planFeatureBase().

import type { PlanType } from "@/generated/prisma";
import {
  PLAN_CONFIGS,
  sellablePlan,
  type AiCheckupShape,
  type PlanConfig,
  type SellablePlanType,
} from "@/lib/plan-config";
import { isSeoToolLive } from "@/lib/seo-tools";
import { AI_TESTED_KEYWORD_LIMIT } from "@/lib/keyword-opportunity/score";

/** The two catalogues these bullets exist in. */
export type PlanFeatureBase = "en" | "fr";

/**
 * Locale -> catalogue. `fr` and `fr-CA` take the French bullets; `en`, `en-CA`
 * and `de-CH` take the English ones.
 *
 * de-CH FALLS BACK TO ENGLISH DELIBERATELY. It is the established dashboard
 * pattern for copy that has no German catalogue yet, and it is the honest
 * option: half-translated pricing reads worse than consistent English, and a
 * German string here would have to be written by someone who can check it.
 */
export function planFeatureBase(locale: string | null | undefined): PlanFeatureBase {
  return locale?.startsWith("fr") ? "fr" : "en";
}

// ─── Number formatting ──────────────────────────────────────────────────────

/**
 * Thousands separator by base: "5,000" in English, "5 000" in French.
 *
 * A PLAIN ASCII SPACE for French, not a narrow no-break space, because that is
 * what the French copy already in this codebase uses ("2 000 demandes de
 * rétroaction/mois"). Matching it matters more than being typographically
 * right in isolation — two conventions on one page is the visible defect.
 */
function num(value: number, base: PlanFeatureBase): string {
  const grouped = value.toLocaleString("en-US");
  return base === "fr" ? grouped.replace(/,/g, " ") : grouped;
}

// ─── Derived fragments ──────────────────────────────────────────────────────

/**
 * "2 AI engines" / "all AI engines".
 *
 * `providers: null` means every provider currently AVAILABLE, which is a
 * runtime fact — an adapter is available when its API key is set. There is no
 * honest number to print for it, so it renders as "all" rather than as a count
 * someone would have to keep in sync with the deployed key set.
 */
function engineCount(shape: AiCheckupShape, base: PlanFeatureBase): string {
  if (shape.providers === null) return base === "fr" ? "tous les moteurs IA" : "all AI engines";
  const n = shape.providers;
  if (base === "fr") return `${n} moteur${n === 1 ? "" : "s"} IA`;
  return `${n} AI engine${n === 1 ? "" : "s"}`;
}

/**
 * The cadence in parentheses after the engine count.
 *
 * "custom" is ENTERPRISE, whose schedule is set per contract and read from the
 * brand profile rather than from a cadence baked into config — so it names no
 * interval. "none" would be a tier with no monitor at all; none currently is,
 * but the branch is here so adding one cannot fall through to a wrong word.
 */
function cadence(shape: AiCheckupShape, base: PlanFeatureBase): string | null {
  const fr = base === "fr";
  switch (shape.frequency) {
    case "weekly":
      return fr ? "hebdomadaire" : "weekly";
    case "twice_weekly":
      return fr ? "2x/semaine" : "2×/week";
    case "daily":
      return fr ? "quotidien" : "daily";
    case "custom":
      return fr ? "selon votre contrat" : "on your schedule";
    case "none":
      return null;
  }
}

/** "AI answer tracking across 2 AI engines (weekly)". */
function trackingLine(shape: AiCheckupShape, base: PlanFeatureBase): string {
  const engines = engineCount(shape, base);
  const when = cadence(shape, base);
  const suffix = when ? ` (${when})` : "";
  return base === "fr"
    ? `Suivi des réponses IA sur ${engines}${suffix}`
    : `AI answer tracking across ${engines}${suffix}`;
}

/**
 * "250 SEO searches + 25 tracked keywords/mo".
 *
 * The keyword half DISAPPEARS at a cap of 0 rather than printing "0 tracked
 * keywords", because a zero cap is not a small allowance — it is the Rank
 * Tracker being locked, and a card should not list a tool the tier cannot
 * open. No sellable tier is at 0 today; the branch is what keeps that true
 * automatically if one ever is again.
 */
function searchLine(config: PlanConfig, base: PlanFeatureBase): string {
  const fr = base === "fr";
  const searches = config.seoSearchesPerMonth;
  const keywords = config.trackedKeywords;

  const searchPart =
    searches === null
      ? fr
        ? "Recherches SEO illimitées"
        : "Unlimited SEO searches"
      : fr
        ? `${num(searches, base)} recherches SEO`
        : `${num(searches, base)} SEO searches`;

  if (keywords === null) {
    return fr
      ? `${searchPart} + mots-clés suivis illimités`
      : `${searchPart} + unlimited tracked keywords`;
  }
  if (keywords === 0) return fr ? `${searchPart}/mois` : `${searchPart}/mo`;

  return fr
    ? `${searchPart} + ${num(keywords, base)} mots-clés suivis/mois`
    : `${searchPart} + ${num(keywords, base)} tracked keywords/mo`;
}

/**
 * The conditional Keyword Opportunity Finder line, or null.
 *
 * TWO CONDITIONS, AND BOTH ARE READ RATHER THAN DECLARED: the tool has to be
 * live in seo-tools.ts, and the tier has to have an allowance. This is the
 * §7.1 lesson applied to a card — the failure there was copy describing a
 * control that did not exist, and the fix is that the copy asks. When the
 * Finder ships or unships, this line appears or vanishes with it and nobody
 * has to remember a card exists.
 */
function opportunityLine(
  config: PlanConfig,
  base: PlanFeatureBase,
  /**
   * Spell out what an analysis buys. Set on the entry tier only: it is the
   * cheapest card and the one a reader meets the phrase "domain analysis" on
   * for the first time, and repeating the gloss on all three would read as
   * padding rather than explanation.
   */
  explain = false,
): string | null {
  if (!isSeoToolLive("keyword_opportunities")) return null;
  const analyses = config.keywordOpportunityAnalysesPerMonth;
  if (analyses === null) {
    return base === "fr" ? "Analyses de domaine illimitées" : "Unlimited domain analyses";
  }
  if (analyses <= 0) return null;

  const head =
    base === "fr"
      ? `${num(analyses, base)} analyses de domaine/mois`
      : `${num(analyses, base)} domain analyses/mo`;
  if (!explain) return head;

  // "75+" is analyses x the per-analysis AI test limit, computed rather than
  // typed — the Finder AI-tests its top AI_TESTED_KEYWORD_LIMIT keywords, so
  // that constant moving must move this claim with it. "+" because every
  // analysis also returns the untested long tail beneath those.
  const tested = num(analyses * AI_TESTED_KEYWORD_LIMIT, base);
  return base === "fr"
    ? `${head} — plus de ${tested} occasions testées par IA (Détecteur d'occasions IA)`
    : `${head} — ${tested}+ AI-tested opportunities (AI Keyword Opportunity Finder)`;
}

/** "Site crawls up to 5,000 URLs". A cap of 0 means the crawler is locked. */
function crawlLine(config: PlanConfig, base: PlanFeatureBase): string | null {
  if (config.crawlUrlCap <= 0) return null;
  return base === "fr"
    ? `Analyses de site jusqu'à ${num(config.crawlUrlCap, base)} URL`
    : `Site crawls up to ${num(config.crawlUrlCap, base)} URLs`;
}

/** "5 locations" / "Unlimited locations" (-1 is the config's unlimited). */
function locationLine(config: PlanConfig, base: PlanFeatureBase): string {
  const n = config.quotaDefaults.maxLocations;
  if (n < 0) return base === "fr" ? "Emplacements illimités" : "Unlimited locations";
  if (base === "fr") return `${num(n, base)} emplacement${n === 1 ? "" : "s"}`;
  return `${num(n, base)} location${n === 1 ? "" : "s"}`;
}

/** "5,000 feedback requests/month". */
function feedbackLine(config: PlanConfig, base: PlanFeatureBase): string {
  const n = config.quotaDefaults.maxRequestsPerMonth;
  return base === "fr"
    ? `${num(n, base)} demandes de rétroaction/mois`
    : `${num(n, base)} feedback requests/month`;
}

// ─── Authored copy ──────────────────────────────────────────────────────────

/**
 * The bullets with no number in them.
 *
 * SUPPORT WORDING IS BINDING, not decorative. "Email support" means a response
 * within 48 hours on weekdays; "Priority support" means email with a response
 * within 24 hours on weekdays. Both are spelled out on the card rather than
 * left to the reader, because "priority" on its own is a word customers price
 * their own expectations with. No tier promises phone, chat, or a weekend
 * response, and none should be added here without someone to answer them.
 */
const COPY: Record<PlanFeatureBase, Record<SellablePlanType, string[]>> = {
  en: {
    STARTER: [
      "AI Trust Score",
      "Lost-recommendation alerts",
      "Email review requests",
      "Review authenticity verification",
      "Email support — 48h weekday response",
    ],
    GROWTH: [
      "Email + SMS channels",
      "AI risk scoring & sentiment analysis",
      "Recovery tickets & workflows",
      "Escalation prediction",
      "Advanced analytics",
      "Priority support — email, 24h weekday response",
    ],
    AGENCY: [
      "White-label dashboard",
      "Client management",
      "Custom domain support",
      "Full API access",
      "All AI features",
      "Priority support — email, 24h weekday response",
    ],
    ENTERPRISE: [
      "Full AI intelligence suite",
      "Real-time reputation monitoring",
      "SSO / SAML authentication",
      "SLA guarantee (99.9% uptime)",
      "Dedicated account manager",
      "Executive dashboards",
      "Custom integrations",
      "Compliance exports",
      "Multi-location intelligence",
    ],
  },
  fr: {
    STARTER: [
      "Score de confiance IA",
      "Alertes de perte de recommandation",
      "Demandes d'avis par courriel",
      "Vérification de l'authenticité des avis",
      "Soutien par courriel — réponse en 48 h les jours ouvrables",
    ],
    GROWTH: [
      "Canaux courriel + SMS",
      "Évaluation des risques et analyse de sentiment par IA",
      "Billets et flux de récupération",
      "Prédiction des escalades",
      "Analytique avancée",
      "Soutien prioritaire — courriel, réponse en 24 h les jours ouvrables",
    ],
    AGENCY: [
      "Tableau de bord en marque blanche",
      "Gestion des clients",
      "Domaine personnalisé",
      "Accès complet à l'API",
      "Toutes les fonctions IA",
      "Soutien prioritaire — courriel, réponse en 24 h les jours ouvrables",
    ],
    ENTERPRISE: [
      "Suite complète d'intelligence IA",
      "Surveillance de la réputation en temps réel",
      "Authentification SSO / SAML",
      "Garantie de service (disponibilité de 99,9 %)",
      "Gestionnaire de compte dédié",
      "Tableaux de bord pour la direction",
      "Intégrations personnalisées",
      "Exports de conformité",
      "Intelligence multi-emplacements",
    ],
  },
};

/**
 * Where the derived lines slot into each tier's authored copy.
 *
 * ORDER IS A PRODUCT DECISION and it differs per tier, which is why it is
 * spelled out rather than computed: STARTER leads with what the tier IS
 * (a location, then tracking, then the trust signals), GROWTH leads with scale,
 * AGENCY with the agency-shaped features. A single generic order would read as
 * a spec sheet on all three.
 */
function assemble(plan: SellablePlanType, base: PlanFeatureBase): string[] {
  const config = PLAN_CONFIGS[plan];
  const copy = COPY[base][plan];

  const location = locationLine(config, base);
  const tracking = trackingLine(config.aiCheckup, base);
  const feedback = feedbackLine(config, base);
  const search = searchLine(config, base);
  const opportunity = opportunityLine(config, base, plan === "STARTER");
  const crawl = crawlLine(config, base);

  // ENTERPRISE has no card — isCustomPricing filters it out of the grid — so
  // its list stays the capability summary it has always been, with the volume
  // lines it can honestly make. Kept rather than deleted because a feature
  // matrix is the obvious next reader of this function.
  if (plan === "ENTERPRISE") {
    return [
      location,
      tracking,
      base === "fr" ? "Volume de demandes sur mesure" : "Custom request volume",
      search,
      opportunity,
      crawl,
      ...copy,
    ].filter((line): line is string => line !== null);
  }

  const ordered =
    plan === "STARTER"
      ? [
          location,
          tracking,
          copy[0], // AI Trust Score
          copy[1], // Lost-recommendation alerts
          feedback,
          copy[2], // Email review requests
          search,
          opportunity,
          crawl,
          copy[3], // Review authenticity verification
          copy[4], // Email support
        ]
      : [
          location,
          tracking,
          feedback,
          ...copy.slice(0, -2), // capability bullets, minus analytics + support
          search,
          opportunity,
          crawl,
          copy[copy.length - 2], // analytics / all-AI line
          copy[copy.length - 1], // support
        ];

  return ordered.filter((line): line is string => line !== null);
}

/**
 * The bullets for one tier, in render order.
 *
 * EVERY renderer of plan features calls this — the marketing cards on the
 * homepage and /pricing through pricingTiers(), and the in-app cards on
 * /billing. That is the whole point of it: there is no second list to update
 * and therefore no second list to forget.
 */
export function planFeatures(plan: PlanType, locale: string | null | undefined): string[] {
  return assemble(sellablePlan(plan), planFeatureBase(locale));
}

/** Every sellable tier's bullets at once — the shape /billing's cards want. */
export function planFeaturesByPlan(
  locale: string | null | undefined,
): Record<SellablePlanType, string[]> {
  const base = planFeatureBase(locale);
  return {
    STARTER: assemble("STARTER", base),
    GROWTH: assemble("GROWTH", base),
    AGENCY: assemble("AGENCY", base),
    ENTERPRISE: assemble("ENTERPRISE", base),
  };
}
