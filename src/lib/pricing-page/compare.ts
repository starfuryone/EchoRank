// src/lib/pricing-page/compare.ts
//
// The "Free vs paid" comparison table on /pricing (ECHORANK-PRICING.md §4):
// columns Free (no account), then one per card tier; rows grouped by area.
//
// NO VALUE IS TYPED HERE. Paid cells read PLAN_CONFIGS, the feature matrix
// (hasFeature) and the seo-tools registry; Free cells read the public free
// tools' own limit constants — the same numbers those routes enforce. A cell
// is a label around a number, or a yes / no read from a capability.
//
// Server-only because two of the free limits live beside their Redis
// counters (av-free-limit.ts, snapshot/limits.ts). The page renders the table
// on the server; nothing here reaches the browser bundle.
import "server-only";

import { PLAN_CONFIGS, type PlanConfig, type SellablePlanType } from "@/lib/plan-config";
import { hasFeature } from "@/lib/feature-flags";
import { isSeoToolLive, seoToolCounts } from "@/lib/seo-tools";
import { toolCountLine } from "@/lib/i18n/content";
import type { Locale } from "@/lib/i18n/config";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import { buildNosybatFacts } from "@/lib/site-crawler/nosybat-facts";
import { NONE_LAUNCHED, type LaunchedPlans } from "@/lib/plan-launch";
import { freeCrawlOnly, nosybatPlanTable, type PlanTableRow } from "@/lib/site-crawler/nosybat-plan-table";
import { FREE_TOOLS, FREE_TOOLS_BASE, freeToolVisible, hubFreeTools } from "@/lib/free-tools";
import { AV_FREE_AUDITS_PER_DAY } from "@/lib/av-free-limit";
import { RUNS_PER_IP_PER_DAY } from "@/lib/snapshot/limits";
import { PROMPT_COUNT } from "@/lib/snapshot/prompts";
import { SNAPSHOT_ENGINES } from "@/lib/snapshot/types";
import { cadence, cardPlans, engines, supportLine } from "./headlines";
import { fmtNum, pricingBase, type PricingBase } from "./format";
import { planAllowsArea } from "@/lib/plan-access";
import { AUTHORITY_COPY } from "@/lib/authority-checker/copy";

/** One cell: text, an optional link, or a yes/no mark (rendered ✓ / — with a spoken label). */
export type CompareCell =
  | { kind: "text"; text: string; href?: string }
  | { kind: "yes" }
  | { kind: "no" };

export interface CompareRow {
  id: string;
  label: string;
  free: CompareCell;
  plans: Partial<Record<SellablePlanType, CompareCell>>;
}

export interface CompareGroup {
  id: "ai" | "reputation" | "seo" | "crawler" | "support";
  title: string;
  rows: CompareRow[];
}

export interface CompareTable {
  plans: SellablePlanType[];
  groups: CompareGroup[];
}

type T3 = Record<PricingBase, string>;
const NO: CompareCell = { kind: "no" };
const YES: CompareCell = { kind: "yes" };
const text = (t: string, href?: string): CompareCell => ({ kind: "text", text: t, ...(href ? { href } : {}) });
const unlimited: T3 = { en: "Unlimited", fr: "Illimité", de: "Unbegrenzt" };

/** A count cell: the number, "Unlimited" for null, a "no" mark for 0. */
function count(n: number | null, b: PricingBase, unit?: T3): CompareCell {
  if (n === null || n < 0) return text(unlimited[b]);
  if (n === 0) return NO;
  return text(unit ? `${fmtNum(n, b)} ${unit[b]}` : fmtNum(n, b));
}

function bool(v: boolean): CompareCell {
  return v ? YES : NO;
}

function row(
  id: string,
  label: T3,
  b: PricingBase,
  free: CompareCell,
  cell: (c: PlanConfig, plan: SellablePlanType) => CompareCell,
): CompareRow {
  const plans: CompareRow["plans"] = {};
  for (const p of cardPlans()) plans[p] = cell(PLAN_CONFIGS[p], p);
  return { id, label: label[b], free, plans };
}

/**
 * The crawler group: the by-plan table /site-crawler shows
 * (nosybat-plan-table.ts), same rows, same cells, gated rows dropped while
 * their limit is not enforced. A plan without the crawler (the AI Visibility
 * plan) gets the free crawl on the first row and "not included" below it; a
 * row that is the same on every crawl plan is a tick. `freeHref` is null when
 * the free crawler is off.
 */
function crawlerRows(b: PricingBase, freeHref: string | null, launched: LaunchedPlans): CompareRow[] {
  const f = buildNosybatFacts({ launched });
  const columns = cardPlans(launched);
  // This page's house style is a plain space between French thousands (fmtNum);
  // the facts format with fr-CA's narrow no-break space.
  const house = (s: string) => (b === "fr" ? s.replace(/ /g, " ") : s);
  const cell = (s: string): CompareCell => (s === "—" ? NO : text(house(s)));
  const freeCells: Partial<Record<PlanTableRow["id"], CompareCell>> = freeHref
    ? {
        urls: text(
          {
            en: `${fmtNum(f.free.pages, b)} pages, ${f.free.perVisitorDaily} crawls a day`,
            fr: `${fmtNum(f.free.pages, b)} pages, ${f.free.perVisitorDaily} explorations par jour`,
            de: `${fmtNum(f.free.pages, b)} Seiten, ${f.free.perVisitorDaily} Crawls pro Tag`,
          }[b],
          freeHref,
        ),
        kept: text({ en: `Result kept ${f.free.retentionDays} days`, fr: `Résultat conservé ${f.free.retentionDays} jours`, de: `Ergebnis ${f.free.retentionDays} Tage gespeichert` }[b]),
      }
    : {};
  return nosybatPlanTable(f, b).map((r, i) => {
    const plans: CompareRow["plans"] = {};
    for (const id of columns) {
      const p = f.plans[id];
      if (!p.hasCrawler) plans[id] = i === 0 && freeHref ? text(house(freeCrawlOnly(f, b)), freeHref) : NO;
      else plans[id] = r.all !== undefined ? YES : cell(r.cell!(p));
    }
    // "crawl-pages": the id this row had before the shared table.
    return { id: r.id === "pages" ? "crawl-pages" : r.id, label: house(r.label), free: freeCells[r.id] ?? NO, plans };
  });
}

/** Localized href for a marketing path. */
const href = (locale: string, path: string) => `/${locale}${path}`;

/**
 * The crawler-only plan's column in the groups built over the ladder: "not
 * included" on every AI, reputation and SEO row (its areas, plan-access.ts),
 * its own support line, and one user instead of "no per-seat charge". The
 * crawler group builds its column itself (crawlerRows).
 */
function addCrawlerOnlyColumn(groups: CompareGroup[], b: PricingBase): void {
  for (const g of groups) {
    if (g.id === "crawler") continue;
    for (const r of g.rows) {
      r.plans.NOSY_BAT =
        g.id !== "support"
          ? NO
          : r.id === "support"
            ? text(supportLine("NOSY_BAT", b))
            : r.id === "team"
              ? text({ en: "One user", fr: "Un utilisateur", de: "Ein Benutzer" }[b])
              : NO;
    }
  }
}

export function comparisonTable(locale: Locale, launched: LaunchedPlans = NONE_LAUNCHED): CompareTable {
  const b = pricingBase(locale);
  const freeCrawler = FREE_TOOLS.find((t) => t.id === "site_crawler");
  const freeCrawlOn = !!freeCrawler && freeToolVisible(freeCrawler);
  const freeCrawlHref = href(locale, `${FREE_TOOLS_BASE}/${freeCrawler?.slug ?? "site-crawler"}`);
  const engineCount = SNAPSHOT_ENGINES.length;
  const counts = seoToolCounts();
  const name = CRAWLER_BRAND.name;

  const ai: CompareGroup = {
    id: "ai",
    title: { en: "AI visibility", fr: "Visibilité IA", de: "KI-Sichtbarkeit" }[b],
    rows: [
      row(
        "audit",
        { en: "AI visibility audit", fr: "Audit de visibilité IA", de: "KI-Sichtbarkeits-Audit" },
        b,
        text(
          {
            en: `${AV_FREE_AUDITS_PER_DAY} free audit${AV_FREE_AUDITS_PER_DAY === 1 ? "" : "s"} a day`,
            fr: `${AV_FREE_AUDITS_PER_DAY} audit${AV_FREE_AUDITS_PER_DAY === 1 ? "" : "s"} gratuit${AV_FREE_AUDITS_PER_DAY === 1 ? "" : "s"} par jour`,
            de: `${AV_FREE_AUDITS_PER_DAY} Gratis-Audit${AV_FREE_AUDITS_PER_DAY === 1 ? "" : "s"} pro Tag`,
          }[b],
          href(locale, "/free-audit"),
        ),
        (_c, p) => bool(hasFeature(p, "ai_visibility")),
      ),
      row(
        "tracking",
        { en: "AI answer tracking", fr: "Suivi des réponses IA", de: "KI-Antworttracking" },
        b,
        text(
          {
            en: `One-off check: ${PROMPT_COUNT} prompts on ${engineCount} engines, ${RUNS_PER_IP_PER_DAY} a day`,
            fr: `Vérification ponctuelle : ${PROMPT_COUNT} requêtes sur ${engineCount} moteurs, ${RUNS_PER_IP_PER_DAY} par jour`,
            de: `Einmal-Check: ${PROMPT_COUNT} Prompts auf ${engineCount} Engines, ${RUNS_PER_IP_PER_DAY} pro Tag`,
          }[b],
          href(locale, "/ai-visibility-check"),
        ),
        (c) => {
          const when = cadence(c.aiCheckup, b);
          const e = engines(c.aiCheckup, b);
          const lead = b === "de" ? `Auf ${e}` : b === "fr" ? `Sur ${e}` : `Across ${e}`;
          return text(when ? `${lead}, ${when}` : lead);
        },
      ),
      row(
        "prompts",
        { en: "Prompts per brand", fr: "Requêtes par marque", de: "Prompts pro Marke" },
        b,
        NO,
        (c) => {
          const r = c.aiCheckup.repetitions;
          const base = fmtNum(c.aiCheckup.prompts, b);
          if (r <= 1) return text(base);
          return text({ en: `${base}, each asked ${r}×`, fr: `${base}, chacune posée ${r}×`, de: `${base}, je ${r}× gestellt` }[b]);
        },
      ),
      row("brands", { en: "Brands tracked", fr: "Marques suivies", de: "Verfolgte Marken" }, b, NO, (c) => count(c.aiProjects, b)),
      // Citation Finder + Citation Opportunities: the feature key their pages gate on.
      row(
        "citations",
        { en: "Cited sources and citation opportunities", fr: "Sources citées et occasions de citation", de: "Zitierte Quellen und Zitat-Chancen" },
        b,
        NO,
        (_c, p) => bool(hasFeature(p, "citation_tracking")),
      ),
      row(
        "history",
        { en: "Trend history", fr: "Historique des tendances", de: "Trendverlauf" },
        b,
        NO,
        (_c, p) => bool(hasFeature(p, "ai_visibility")),
      ),
    ],
  };

  const reputation: CompareGroup = {
    id: "reputation",
    title: { en: "Reputation", fr: "Réputation", de: "Reputation" }[b],
    rows: [
      row("locations", { en: "Locations", fr: "Emplacements", de: "Standorte" }, b, NO, (c) => count(c.quotaDefaults.maxLocations, b)),
      row(
        "feedback",
        { en: "Feedback requests / month", fr: "Demandes de rétroaction / mois", de: "Feedback-Anfragen / Monat" },
        b,
        NO,
        (c) => count(c.quotaDefaults.maxRequestsPerMonth, b),
      ),
      row("emails", { en: "Emails / month", fr: "Courriels / mois", de: "E-Mails / Monat" }, b, NO, (c) => count(c.quotaDefaults.maxEmailsPerMonth, b)),
      row("sms", { en: "SMS / month", fr: "SMS / mois", de: "SMS / Monat" }, b, NO, (c) => count(c.quotaDefaults.maxSmsPerMonth, b)),
      row(
        "authenticity",
        { en: "Review authenticity verification", fr: "Vérification de l'authenticité des avis", de: "Echtheitsprüfung von Bewertungen" },
        b,
        NO,
        (_c, p) => bool(hasFeature(p, "review_authenticity")),
      ),
      row(
        "ai-analysis",
        { en: "AI risk scoring & sentiment", fr: "Évaluation des risques et sentiment par IA", de: "KI-Risikobewertung & Stimmung" },
        b,
        NO,
        (_c, p) => bool(hasFeature(p, "ai_analysis")),
      ),
      row(
        "escalation",
        { en: "Escalation prediction", fr: "Prédiction des escalades", de: "Eskalationsprognose" },
        b,
        NO,
        (_c, p) => bool(hasFeature(p, "escalation_prediction")),
      ),
      row(
        "whitelabel",
        { en: "White-label dashboard & custom domain", fr: "Marque blanche et domaine personnalisé", de: "White-Label-Dashboard & eigene Domain" },
        b,
        NO,
        (_c, p) => bool(hasFeature(p, "whitelabel") && hasFeature(p, "custom_domain")),
      ),
    ],
  };

  const seoRows: CompareRow[] = [
    row(
      "tools",
      { en: "SEO & AI tools hub", fr: "Centre d'outils SEO et IA", de: "SEO- & KI-Werkzeuge" },
      b,
      text(
        {
          en: `${hubFreeTools().length} free tools`,
          fr: `${hubFreeTools().length} outils gratuits`,
          de: `${hubFreeTools().length} Gratis-Werkzeuge`,
        }[b],
        href(locale, FREE_TOOLS_BASE),
      ),
      // The same sentence on every card and every page (toolCountLine), for the
      // plans that include the tools hub (not the AI-only plan, src/lib/plan-access.ts).
      (_c, p) => (planAllowsArea(p, "seo_tools") ? text(toolCountLine(locale, counts)) : NO),
    ),
    // The one SEO tool on every paid plan, the AI-only one included: its
    // monthly checks (plan-config linkAuthorityChecksPerMonth). No free cell:
    // anonymous visitors cannot run it.
    row(
      "link-authority",
      { en: AUTHORITY_COPY.en.name, fr: AUTHORITY_COPY.fr.name, de: AUTHORITY_COPY["de-CH"].name },
      b,
      NO,
      (c, p) =>
        planAllowsArea(p, "link_authority")
          ? count(c.linkAuthorityChecksPerMonth, b, { en: "checks / month", fr: "vérifications / mois", de: "Prüfungen / Monat" })
          : NO,
    ),
    row(
      "searches",
      { en: "SEO searches / month", fr: "Recherches SEO / mois", de: "SEO-Suchen / Monat" },
      b,
      NO,
      (c) => count(c.seoSearchesPerMonth, b),
    ),
    row("keywords", { en: "Tracked keywords", fr: "Mots-clés suivis", de: "Verfolgte Keywords" }, b, NO, (c) => count(c.trackedKeywords, b)),
  ];
  if (isSeoToolLive("keyword_opportunities")) {
    seoRows.push(
      row(
        "analyses",
        { en: "Domain analyses / month", fr: "Analyses de domaine / mois", de: "Domain-Analysen / Monat" },
        b,
        NO,
        (c) => count(c.keywordOpportunityAnalysesPerMonth, b),
      ),
    );
  }
  seoRows.push(
    row("backlinks", { en: "Backlinks", fr: "Liens entrants", de: "Backlinks" }, b, NO, (c, p) => {
      if (!planAllowsArea(p, "seo_tools")) return NO;
      const bl = c.backlinks;
      const rows = fmtNum(bl.listRows, b);
      if (bl.tier === "basic") {
        return text({ en: `Basic: whole domain, ${rows} rows`, fr: `De base : domaine entier, ${rows} lignes`, de: `Basis: ganze Domain, ${rows} Zeilen` }[b]);
      }
      const extras = [
        bl.filters ? { en: "filters", fr: "filtres", de: "Filter" }[b] : null,
        bl.csv ? "CSV" : null,
        bl.history ? { en: "history", fr: "historique", de: "Verlauf" }[b] : null,
      ].filter(Boolean);
      const head = { en: `Full: any scope, ${rows} rows`, fr: `Complet : toute portée, ${rows} lignes`, de: `Voll: jeder Umfang, ${rows} Zeilen` }[b];
      return text(extras.length ? `${head}, ${extras.join(", ")}` : head);
    }),
    row(
      "prospecting",
      { en: "Agency prospecting (Opportunity Scanner, audit funnels)", fr: "Prospection d'agence (Détecteur d'occasions, entonnoirs d'audit)", de: "Agentur-Akquise (Opportunity Scanner, Audit-Funnels)" },
      b,
      NO,
      // Both tools are gated at their routes on requireFeature("whitelabel").
      (_c, p) => bool(hasFeature(p, "whitelabel")),
    ),
    row("api", { en: "API access", fr: "Accès à l'API", de: "API-Zugang" }, b, NO, (c, p) =>
      hasFeature(p, "api_access")
        ? count(c.quotaDefaults.maxApiRequestsPerDay, b, { en: "requests/day", fr: "requêtes/jour", de: "Anfragen/Tag" })
        : NO,
    ),
  );
  const seo: CompareGroup = { id: "seo", title: { en: "SEO tools", fr: "Outils SEO", de: "SEO-Werkzeuge" }[b], rows: seoRows };

  const crawler: CompareGroup = {
    id: "crawler",
    title: { en: `${name} crawler`, fr: `Robot d'exploration ${name}`, de: `${name}-Crawler` }[b],
    rows: crawlerRows(b, freeCrawlOn ? freeCrawlHref : null, launched),
  };

  const support: CompareGroup = {
    id: "support",
    title: { en: "Support", fr: "Soutien", de: "Support" }[b],
    rows: [
      row("support", { en: "Support", fr: "Soutien", de: "Support" }, b, NO, (_c, p) => text(supportLine(p, b))),
      row(
        "team",
        { en: "Team members", fr: "Membres de l'équipe", de: "Teammitglieder" },
        b,
        NO,
        // No seat limit exists in code: /api/team invites without a plan check.
        () => text({ en: "No per-seat charge", fr: "Aucuns frais par siège", de: "Keine Kosten pro Platz" }[b]),
      ),
    ],
  };

  const groups = [ai, reputation, seo, crawler, support];
  const plans = cardPlans(launched);
  if (plans.includes("NOSY_BAT")) addCrawlerOnlyColumn(groups, b);
  return { plans, groups };
}
