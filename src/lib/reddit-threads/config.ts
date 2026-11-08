// src/lib/reddit-threads/config.ts — the free Reddit Threads Finder's fixed
// numbers, in one dependency-free module (the page, the client form and the
// API routes all read it).
//
// BROUGHT BACK 2026-11-08 WITHOUT REDDIT'S API. The tool retired on
// 2026-08-16 (ad0fc2c4) read reddit.com/search.json; this one asks Google,
// through DataForSEO, for `site:reddit.com <keyword>` in one country. Nothing
// is fetched from reddit.com and nothing is scraped.

/** Path segment under /[locale]/free-tools (the old slug), and the lead source. */
export const REDDIT_SLUG = "reddit-threads";
export const REDDIT_SRC = "reddit-threads";

/** One SERP page: top-10 organic. DataForSEO bills each further 10 again. */
export const MAX_THREADS = 10;

/** New (paid) searches per IP per UTC day. A search served from cache does not count. */
export const SEARCHES_PER_IP_PER_DAY = 10;

/** CSV downloads (email gate) per IP per UTC day (pattern: the authority checker's unlocks). */
export const CSV_PER_IP_PER_DAY = 20;

/** Every result is cached this long per keyword + country + time filter, in the shared store. */
export const CACHE_DAYS = 7;

/**
 * The tool's own daily DataForSEO budget, in USD (the brief: default $1),
 * separate from the other free tools' caps. REDDIT_THREADS_DAILY_USD
 * overrides it; 0 turns every new search off (cached answers still serve).
 * Each call's real cost is the `cost` DataForSEO returns, written to
 * SeoApiCall by the metering; the budget sums those rows.
 */
export const DEFAULT_DAILY_BUDGET_USD = 1;

/** The owner on every SeoApiCall row this tool writes (not a Tenant row, like FREE_TOOLS_TENANT_ID). */
export const REDDIT_TENANT_ID = "free-tools-reddit";

export function dailyBudgetUsd(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.REDDIT_THREADS_DAILY_USD;
  if (raw === undefined || raw.trim() === "") return DEFAULT_DAILY_BUDGET_USD;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_DAILY_BUDGET_USD;
}

/**
 * What this search needs from a provider, for the search router
 * (ECHORANK-SEARCH-ROUTING.md): top-10 organic only, a country-level
 * location, no AI Overview, no SERP-feature parsing. Any provider that
 * returns ten organic results for a country can answer it, so the router may
 * move it to Serper. The Discussions and forums block is read only when it is
 * already in the same response; it is never asked for.
 */
export const REDDIT_SEARCH_ROUTE = {
  kind: "organic_top10",
  location: "country",
  aiOverview: false,
  featureParsing: false,
} as const;

/** Countries offered: DataForSEO location_code, ISO region (for the label), search language. */
export const REDDIT_COUNTRIES = [
  { code: 2840, region: "US", language: "en" },
  { code: 2826, region: "GB", language: "en" },
  { code: 2124, region: "CA", language: "en" },
  { code: 2036, region: "AU", language: "en" },
  { code: 2250, region: "FR", language: "fr" },
  { code: 2276, region: "DE", language: "de" },
  { code: 2756, region: "CH", language: "de" },
] as const;

export type RedditCountryCode = (typeof REDDIT_COUNTRIES)[number]["code"];
export const DEFAULT_COUNTRY: RedditCountryCode = 2840;

export function redditCountry(code: unknown) {
  return REDDIT_COUNTRIES.find((c) => c.code === Number(code)) ?? null;
}

/** Google's time filter (tbs=qdr:…), sent as DataForSEO's search_param. */
export const TIME_FILTERS = ["any", "year", "month"] as const;
export type TimeFilter = (typeof TIME_FILTERS)[number];

export const TIME_PARAM: Record<TimeFilter, string | null> = {
  any: null,
  year: "&tbs=qdr:y",
  month: "&tbs=qdr:m",
};

export function isTimeFilter(v: unknown): v is TimeFilter {
  return typeof v === "string" && (TIME_FILTERS as readonly string[]).includes(v);
}

/** Longest keyword accepted (the query also carries "site:reddit.com "). */
export const MAX_KEYWORD_LENGTH = 120;

/** Trim, collapse spaces; null when empty or too long. */
export function normalizeKeyword(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const k = raw.replace(/\s+/g, " ").trim();
  if (!k || k.length > MAX_KEYWORD_LENGTH) return null;
  return k;
}
