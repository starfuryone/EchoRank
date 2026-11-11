// src/lib/site-crawler/nosybat-facts.ts
//
// THE ONE SOURCE of every number and claim the crawler's copy makes, on every
// surface: /site-crawler, /pricing, the homepage, /enterprise, the guides,
// the in-app crawler, the emails, the API and MCP docs. No copy types a count,
// a cap or a price; it reads one from here (tests/nosybat-facts.test.ts greps
// the copy sources for digits beside "URL", "pages", "crawl" and "checks").
//
// Derived, never written down:
//   - per plan: plan-config.ts (caps, names, prices) and plan-access.ts
//     (whether the plan opens the crawler at all);
//   - the rule count and families: the crawl-rules registry (rule-count.ts,
//     public families only);
//   - the free crawl: free-limits.ts;
//   - pinned crawls: constants.ts.
//
// GATED BY ENFORCEMENT, NOT BY CONFIG. A cap in plan-config is only a promise
// once code enforces it. NOSYBAT_ENFORCED says which of the newer limits are
// enforced; copy about one of them renders only while its marker is true, and
// the test checks each true marker against the code that enforces it, so the
// marker cannot outlive (or precede) the enforcement.
//
// Server-side: the rule count pulls in the registry. Client Components take
// what they need as props, or import types only.

import type { PlanType } from "@/generated/prisma";
import { hasFeature } from "@/lib/feature-flags";
import { planAllowsArea } from "@/lib/plan-access";
import { PLAN_CONFIGS, TRIAL_DAYS, type CrawlCadence, type PlanConfig } from "@/lib/plan-config";
import { NONE_LAUNCHED, cardOrder, type LaunchedPlans } from "@/lib/plan-launch";
import type { RuleFamily } from "@/lib/crawl-rules";
import { CRAWL_PIN_MAX } from "./constants";
import { FREE_CRAWL_IP_DAILY, FREE_CRAWL_RETENTION_DAYS, FREE_CRAWL_URL_CAP } from "./free-limits";
import { PUBLIC_RULES, ruleCountLabel } from "./rule-count";

// Which gated limits code enforces today: nosybat-enforced.ts (dependency-free,
// so the in-app Help modal can read it too).
import { NOSYBAT_ENFORCED, type NosybatGated } from "./nosybat-enforced";
export { NOSYBAT_ENFORCED, type NosybatGated };

/** The check areas the pitch names, each present when one of its families is in the public registry. */
export const CHECK_AREAS = ["onPage", "technical", "hreflang", "https", "accessibility", "spelling", "performance"] as const;
export type CheckArea = (typeof CHECK_AREAS)[number];
const AREA_FAMILIES: Readonly<Record<CheckArea, readonly RuleFamily[]>> = {
  onPage: ["page_titles", "meta_description", "h1", "h2", "content", "images"],
  technical: ["response_codes", "canonicals", "directives", "links", "sitemaps", "pagination", "robots", "url"],
  hreflang: ["hreflang"],
  https: ["security"],
  accessibility: ["accessibility"],
  spelling: ["spelling"],
  performance: ["performance"],
};

export interface NosybatPlan {
  id: PlanType;
  name: string;
  /** USD a month; 0 on a custom-priced plan. */
  monthlyPrice: number;
  /** Custom pricing (Enterprise): its copy says "custom limits", never a number. */
  custom: boolean;
  /** The plan opens the crawler (plan-access) and lets a crawl fetch something. */
  hasCrawler: boolean;
  urlsPerCrawl: number;
  /** null = unlimited. */
  crawlsPerMonth: number | null;
  /** null = unlimited. */
  pagesPerMonth: number | null;
  crawlsAtOnce: number;
  crawlsKept: number;
  renderedPages: number;
  schedules: number;
  cadences: readonly CrawlCadence[];
  /** Custom extractors per crawl. */
  extractors: number;
  /** Pages per crawl sent to PageSpeed Insights (0 = off). */
  psiPages: number;
  /** The plan opens the public API and MCP server (plan-access "public_api"). */
  api: boolean;
}

export interface NosybatFacts {
  rules: {
    count: number;
    /** As shown: rounded down to the ten with a "+" ("340+"). */
    label: string;
    families: ReadonlySet<string>;
    areas: readonly CheckArea[];
  };
  plans: Readonly<Record<PlanType, NosybatPlan>>;
  /** Self-serve plans with the crawler, cheapest first (Enterprise is custom and not here). */
  crawlPlans: readonly NosybatPlan[];
  /** The first plan that includes the crawler, and its price. */
  firstPlan: NosybatPlan;
  /** The largest self-serve plan: the "up to" figures. */
  topPlan: NosybatPlan;
  /** Self-serve plans without the crawler (the AI Visibility plan): the free crawl only. */
  noCrawlerPlans: readonly NosybatPlan[];
  pinnedMax: number;
  free: { pages: number; perVisitorDaily: number; retentionDays: number };
  /** The paid plans' free trial, in days (plan-config TRIAL_DAYS). */
  trialDays: number;
  enforced: Readonly<Record<NosybatGated, boolean>>;
  /** What every crawl plan has, so copy may say "on every plan from {firstPlan}". */
  everyPlan: { render: boolean; extraction: boolean; schedules: boolean; api: boolean };
}

export interface NosybatFactsInput {
  plans?: Readonly<Record<PlanType, PlanConfig>>;
  /** The public rules (rule-count.ts). A test passes its own. */
  rules?: readonly { family: string }[];
  enforced?: Readonly<Record<NosybatGated, boolean>>;
  /**
   * The catalog-gated plans on sale (src/lib/plan-launch.ts; the page reads
   * them from src/lib/stripe/catalog.ts). Default: none, so the crawler-only
   * plan is in no table, price or "from" line until its Stripe prices exist.
   */
  launched?: LaunchedPlans;
}

function planFacts(id: PlanType, c: PlanConfig): NosybatPlan {
  return {
    id,
    name: c.name,
    monthlyPrice: c.monthlyPrice,
    custom: Boolean(c.isCustomPricing),
    hasCrawler: planAllowsArea(id, "crawler") && c.crawlUrlCap > 0,
    urlsPerCrawl: c.crawlUrlCap,
    crawlsPerMonth: c.crawlsPerMonth,
    pagesPerMonth: c.crawlPagesPerMonth,
    crawlsAtOnce: c.crawlConcurrency,
    crawlsKept: c.crawlsKept,
    renderedPages: c.crawlRenderedPages,
    schedules: c.crawlSchedules,
    cadences: c.crawlScheduleCadences,
    extractors: c.crawlExtractors,
    psiPages: c.crawlPsiPages,
    // Keys are made in the API Access tool (feature api_access: Agency and
    // Enterprise today); the route allowlist alone would say every paid plan.
    api: hasFeature(id, "api_access") && planAllowsArea(id, "public_api"),
  };
}

/** Pure: the facts from a plan table, a rule list and the enforcement markers. */
export function buildNosybatFacts(input: NosybatFactsInput = {}): NosybatFacts {
  const cfg = input.plans ?? PLAN_CONFIGS;
  const rules = input.rules ?? PUBLIC_RULES;
  // Every plan's facts (the crawler-only plan's too, for its own pages); the
  // lists below walk the card order, which holds it only once it is on sale.
  const plans = Object.fromEntries((Object.keys(cfg) as PlanType[]).map((id) => [id, planFacts(id, cfg[id])])) as Record<PlanType, NosybatPlan>;
  const selfServe = cardOrder(input.launched ?? NONE_LAUNCHED).map((id) => plans[id]).filter((p) => !p.custom);
  const crawlPlans = selfServe.filter((p) => p.hasCrawler);
  if (crawlPlans.length === 0) throw new Error("nosybatFacts: no self-serve plan includes the crawler");
  const families = new Set(rules.map((r) => r.family));
  return {
    rules: {
      count: rules.length,
      label: ruleCountLabel(rules.length),
      families,
      areas: CHECK_AREAS.filter((a) => AREA_FAMILIES[a].some((f) => families.has(f))),
    },
    plans,
    crawlPlans,
    firstPlan: crawlPlans[0]!,
    topPlan: crawlPlans[crawlPlans.length - 1]!,
    noCrawlerPlans: selfServe.filter((p) => !p.hasCrawler),
    pinnedMax: CRAWL_PIN_MAX,
    free: { pages: FREE_CRAWL_URL_CAP, perVisitorDaily: FREE_CRAWL_IP_DAILY, retentionDays: FREE_CRAWL_RETENTION_DAYS },
    trialDays: TRIAL_DAYS,
    enforced: input.enforced ?? NOSYBAT_ENFORCED,
    everyPlan: {
      render: crawlPlans.every((p) => p.renderedPages > 0),
      extraction: crawlPlans.every((p) => p.extractors > 0),
      schedules: crawlPlans.every((p) => p.schedules > 0 && p.cadences.length > 0),
      api: crawlPlans.every((p) => p.api),
    },
  };
}

let cached: NosybatFacts | null = null;
/** The live facts: PLAN_CONFIGS, the public registry, NOSYBAT_ENFORCED. */
export function nosybatFacts(): NosybatFacts {
  return (cached ??= buildNosybatFacts());
}

/** Whether a gated limit may be shown. */
export const shows = (f: NosybatFacts, g: NosybatGated): boolean => f.enforced[g];

// ─── Formatting ─────────────────────────────────────────────────────────────

/** The copy bases the facts are written in: de-CH copy is "de". */
export type FactsBase = "en" | "fr" | "de";

/** en-US 2,500 · fr-CA 2 500 · de-CH 2’500. */
export function nbNum(n: number, base: FactsBase): string {
  return new Intl.NumberFormat(base === "fr" ? "fr-CA" : base === "de" ? "de-CH" : "en-US").format(n);
}

/** "$79", the plan's price as the cards show it (USD in every locale). */
export function nbUsd(n: number, base: FactsBase): string {
  // Whole dollars as before ("$79"); a price with cents keeps both decimals
  // ("$22.40", "$22,40" in French): the crawler-only plan's.
  const cents = Math.round(n * 100);
  if (cents % 100 === 0) return `$${nbNum(cents / 100, base)}`;
  return `$${new Intl.NumberFormat(base === "fr" ? "fr-CA" : base === "de" ? "de-CH" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)}`;
}

/** "a, b and c" in the base's language. */
export function nbList(items: readonly string[], base: FactsBase): string {
  return new Intl.ListFormat(base === "fr" ? "fr" : base === "de" ? "de" : "en", { type: "conjunction" }).format(items);
}

/** "a, b or c". */
export function nbOr(items: readonly string[], base: FactsBase): string {
  return new Intl.ListFormat(base === "fr" ? "fr" : base === "de" ? "de" : "en", { type: "disjunction" }).format(items);
}
