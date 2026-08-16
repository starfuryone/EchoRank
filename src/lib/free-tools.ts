// src/lib/free-tools.ts
//
// Single typed source of truth for the public free-tools hub.
//
// Pattern: src/lib/seo-tools.ts. The hub grid, the route table, the sitemap
// entries and the per-page JSON-LD all render from this array — a tool is added
// HERE and nowhere else. The hand-maintained-duplicate failure this avoids is
// the Jul 31 pricing drift, where structured data carried its own copy of the
// numbers and published prices nobody charged.
//
// COPY LIVES IN THE I18N CATALOG, not here, keyed by id — the same split
// seo-tools.ts uses. What lives here is structure: slugs, badges, limits, and
// whether a tool spends money.
//
// NOTE ON "BATCH A": the brief described a SERP Simulator as already live. It
// was not — /free-tools did not exist in any branch or in production. This file
// creates the hub, and the simulator is built here with the rest.

export const FREE_TOOLS_BASE = "/free-tools";

export type FreeToolId =
  | "serp_volatility"
  | "ai_search_grader"
  | "content_optimizer"
  | "share_of_search"
  | "serp_simulator";

/**
 * What a tool costs us per run.
 *
 * "none"     — pure client-side or cache-only; no API route at all.
 * "paid_api" — spends real money; gated by the daily USD cap.
 * "shared"   — a scheduled job spends on everyone's behalf; reads are free.
 *
 * A fourth variant, "free_api" (a server call costing nothing but our egress
 * IP's reputation), existed for the Reddit Threads Finder alone and went with
 * it. Reinstate it if another zero-cost proxy tool ever lands.
 */
export type FreeToolCost = "none" | "paid_api" | "shared";

export interface FreeTool {
  id: FreeToolId;
  /** Path segment under /[locale]/free-tools. */
  slug: string;
  cost: FreeToolCost;
  /** Daily runs per IP. Null when there is nothing to limit. */
  dailyLimit: number | null;
  /** API route under /api/free/v1, when the tool has one. */
  apiPath: string | null;
  /** NEW badge on the hub card. */
  isNew: boolean;
  /**
   * Structured data flavour. "software" for interactive tools, "faq" for the
   * ones whose page answers real questions.
   */
  jsonLd: "software" | "faq";
}

export const FREE_TOOLS: FreeTool[] = [
  // RETIRED: reddit_threads (Reddit Threads Finder). Removed 2026-08-16; its
  // page path still 301s from src/app/[locale]/free-tools/reddit-threads/route.ts
  // and stays in RETIRED_LOCALIZED_PATHS in src/lib/seo/registry.ts so the
  // locale-less URL keeps canonicalizing instead of hitting the auth gate.
  {
    id: "serp_volatility",
    slug: "serp-volatility",
    // A daily worker buys one basket for everyone; visitors only read cache.
    cost: "shared",
    dailyLimit: null,
    apiPath: "/api/free/v1/serp-volatility",
    isNew: true,
    jsonLd: "faq",
  },
  {
    id: "ai_search_grader",
    slug: "ai-search-grader",
    cost: "paid_api",
    dailyLimit: 1,
    apiPath: "/api/free/v1/ai-search-grader",
    isNew: true,
    jsonLd: "software",
  },
  {
    id: "content_optimizer",
    slug: "content-optimizer",
    // Runs entirely in the browser. There is deliberately no API route: an
    // anonymous LLM endpoint is an unmetered bill waiting to happen.
    cost: "none",
    dailyLimit: null,
    apiPath: null,
    isNew: true,
    jsonLd: "software",
  },
  {
    id: "share_of_search",
    slug: "share-of-search",
    cost: "paid_api",
    dailyLimit: 2,
    apiPath: "/api/free/v1/share-of-search",
    isNew: true,
    jsonLd: "software",
  },
  {
    id: "serp_simulator",
    slug: "serp-simulator",
    cost: "none",
    dailyLimit: null,
    apiPath: null,
    // Not part of the six new tools — built alongside them because the brief
    // believed it already existed and its hub card would otherwise 404.
    isNew: false,
    jsonLd: "software",
  },
];

/**
 * The extension card.
 *
 * Not a FreeTool: it is served by Caddy from /opt/echorank/extension-dist,
 * outside this app, so it has no slug under /free-tools and no route of its
 * own. It appears on the hub because a visitor looking for free things should
 * find it.
 */
export const EXTENSION_CARD_HREF = "/extension/download.html";

export function freeToolBySlug(slug: string): FreeTool | undefined {
  return FREE_TOOLS.find((t) => t.slug === slug);
}

export function freeToolById(id: FreeToolId): FreeTool {
  const tool = FREE_TOOLS.find((t) => t.id === id);
  if (!tool) throw new Error(`Unknown free tool: ${id}`);
  return tool;
}

/** Every locale-prefixed path the hub owns, for the sitemap and route tests. */
export function freeToolRoutes(): string[] {
  return [FREE_TOOLS_BASE, ...FREE_TOOLS.map((t) => `${FREE_TOOLS_BASE}/${t.slug}`)];
}

/** Tools that can spend money — the ones the daily USD cap must gate. */
export function paidFreeTools(): FreeTool[] {
  return FREE_TOOLS.filter((t) => t.cost === "paid_api");
}

/**
 * Signup CTA target for a tool, carrying its attribution.
 *
 * One helper so the `?src=` value cannot drift from the slug — the whole point
 * of the parameter is telling which card sent someone.
 */
export function signupHref(tool: FreeTool): string {
  return `/register?src=free-tools-${tool.slug}`;
}
