// src/lib/site-crawler/nosybat-plan-table.ts
//
// The crawler's by-plan table, ONE definition for every surface that shows
// it: /site-crawler (#features), the /pricing comparison table's crawler
// group, and the in-app Help's "Your plan" tab (which shows the workspace's
// own figures through the same labels). Every cell reads nosybatFacts; a row
// about a gated limit (pages a month, crawls at once, crawls kept) is left
// out while its limit is not enforced (NOSYBAT_ENFORCED).
//
// Plans differ in caps, not in features: the last row is one cell across
// every plan column, "Every plan from {first plan}".

import { flag as flagOn, FLAGS, type Flags } from "@/lib/flags";
import type { CrawlCadence } from "@/lib/plan-config";
import { nbList, nbNum, nbOr, shows, type FactsBase, type NosybatFacts, type NosybatGated, type NosybatPlan } from "./nosybat-facts";

type T3 = Readonly<Record<FactsBase, string>>;

export interface PlanTableRow {
  id: "urls" | "crawls" | "pages" | "at-once" | "kept" | "rendered" | "schedules" | "everything";
  label: string;
  /** The gated limit this row states; absent = always shown. */
  gated?: NosybatGated;
  /** A plan's cell. Absent on a row that spans every plan column. */
  cell?: (p: NosybatPlan) => string;
  /** One cell across every plan column. */
  all?: string;
}

const UNLIMITED: T3 = { en: "Unlimited", fr: "Illimité", de: "Unbegrenzt" };

export const CADENCE_WORDS: Readonly<Record<FactsBase, Readonly<Record<CrawlCadence, string>>>> = {
  en: { daily: "daily", weekly: "weekly", monthly: "monthly" },
  fr: { daily: "quotidiennes", weekly: "hebdomadaires", monthly: "mensuelles" },
  de: { daily: "täglich", weekly: "wöchentlich", monthly: "monatlich" },
};

/** "Unlimited" for null, else the number. */
export const countOrUnlimited = (n: number | null, b: FactsBase): string => (n === null ? UNLIMITED[b] : nbNum(n, b));

/** "3 newest + 5 pinned". */
export function keptCell(n: number, pinned: number, b: FactsBase): string {
  if (b === "fr") return `${nbNum(n, b)} plus récentes + ${nbNum(pinned, b)} épinglées`;
  if (b === "de") return `${nbNum(n, b)} neueste + ${nbNum(pinned, b)} angeheftete`;
  return `${nbNum(n, b)} newest + ${nbNum(pinned, b)} pinned`;
}

/** "2 · weekly or monthly". */
export function scheduleCell(n: number, cadences: readonly CrawlCadence[], b: FactsBase): string {
  if (n <= 0 || cadences.length === 0) return "—";
  return `${nbNum(n, b)} · ${nbOr(cadences.map((c) => CADENCE_WORDS[b][c]), b)}`;
}

/** "Every plan from Starter". */
export function everyPlanFrom(f: NosybatFacts, b: FactsBase): string {
  const n = f.firstPlan.name;
  return b === "fr" ? `Chaque forfait à partir de ${n}` : b === "de" ? `Jedes Abo ab ${n}` : `Every plan from ${n}`;
}

/**
 * The "everything" row's label: "All 340+ checks, JavaScript rendering,
 * extraction, compare, API & MCP". Each feature named only while it is on
 * (its flag) and on every crawl plan (nosybatFacts.everyPlan).
 */
export function everythingLabel(f: NosybatFacts, b: FactsBase, flags: Flags = FLAGS): string {
  const on = (x: Parameters<typeof flagOn>[0]) => flagOn(x, flags);
  const words: Record<FactsBase, { checks: string; render: string; extraction: string; compare: string; api: string }> = {
    en: { checks: `All ${f.rules.label} checks`, render: "JavaScript rendering", extraction: "extraction", compare: "compare", api: "API & MCP" },
    fr: { checks: `Les ${f.rules.label} vérifications`, render: "rendu JavaScript", extraction: "extraction", compare: "comparaison", api: "API et MCP" },
    de: { checks: `Alle ${f.rules.label} Prüfungen`, render: "JavaScript-Rendering", extraction: "Extraktion", compare: "Vergleich", api: "API & MCP" },
  };
  const w = words[b];
  const parts = [
    w.checks,
    on("crawl.render") && f.everyPlan.render && w.render,
    on("crawl.extraction") && f.everyPlan.extraction && w.extraction,
    on("crawl.compare") && w.compare,
    on("crawl.api") && f.everyPlan.api && w.api,
  ].filter((x): x is string => Boolean(x));
  return nbList(parts, b);
}

const LABELS: Readonly<Record<Exclude<PlanTableRow["id"], "everything">, T3>> = {
  urls: { en: "URLs per crawl", fr: "URL par exploration", de: "URLs pro Crawl" },
  crawls: { en: "Crawls a month", fr: "Explorations par mois", de: "Crawls pro Monat" },
  pages: { en: "Pages per month", fr: "Pages par mois", de: "Seiten pro Monat" },
  "at-once": { en: "Crawls at once", fr: "Explorations simultanées", de: "Gleichzeitige Crawls" },
  kept: { en: "Crawls kept", fr: "Explorations conservées", de: "Gespeicherte Crawls" },
  rendered: { en: "Rendered (JavaScript) pages per crawl", fr: "Pages rendues (JavaScript) par exploration", de: "Gerenderte Seiten (JavaScript) pro Crawl" },
  schedules: { en: "Scheduled crawls", fr: "Explorations planifiées", de: "Geplante Crawls" },
};

export const planTableLabel = (id: keyof typeof LABELS, b: FactsBase): string => LABELS[id][b];

/** The rows, in order, gated rows dropped while their limit is not enforced. */
export function nosybatPlanTable(f: NosybatFacts, b: FactsBase, flags: Flags = FLAGS): PlanTableRow[] {
  const rows: PlanTableRow[] = [
    { id: "urls", label: LABELS.urls[b], cell: (p) => nbNum(p.urlsPerCrawl, b) },
    // Not in the brief's table, but enforced (quota.ts) and on Starter the
    // binding limit: leaving it out would overstate what Starter can do.
    { id: "crawls", label: LABELS.crawls[b], cell: (p) => countOrUnlimited(p.crawlsPerMonth, b) },
    { id: "pages", label: LABELS.pages[b], gated: "pagesPerMonth", cell: (p) => countOrUnlimited(p.pagesPerMonth, b) },
    { id: "at-once", label: LABELS["at-once"][b], gated: "crawlsAtOnce", cell: (p) => nbNum(p.crawlsAtOnce, b) },
    { id: "kept", label: LABELS.kept[b], gated: "crawlsKept", cell: (p) => keptCell(p.crawlsKept, f.pinnedMax, b) },
    { id: "rendered", label: LABELS.rendered[b], cell: (p) => (p.renderedPages > 0 ? nbNum(p.renderedPages, b) : "—") },
  ];
  if (flagOn("crawl.schedule", flags)) {
    rows.push({ id: "schedules", label: LABELS.schedules[b], cell: (p) => scheduleCell(p.schedules, p.cadences, b) });
  }
  rows.push({ id: "everything", label: everythingLabel(f, b, flags), all: everyPlanFrom(f, b) });
  return rows.filter((r) => !r.gated || shows(f, r.gated));
}

/** "Free 100-page crawl only": the AI Visibility plan's whole crawler column. */
export function freeCrawlOnly(f: NosybatFacts, b: FactsBase): string {
  const n = nbNum(f.free.pages, b);
  return b === "fr" ? `Exploration gratuite de ${n} pages seulement` : b === "de" ? `Nur der Gratis-Crawl mit ${n} Seiten` : `Free ${n}-page crawl only`;
}

/** Enterprise: never a number. */
export function enterpriseLimits(b: FactsBase): string {
  return b === "fr" ? "Limites sur mesure" : b === "de" ? "Individuelle Limits" : "Custom limits";
}
