// src/lib/authority-checker/config.ts
//
// The free Website Authority Checker's fixed numbers, in one dependency-free
// module (the page, the client form and the API routes all read it).
//
// Every number here is the brief's (2026-11-07) except the two marked
// "pattern": those copy the free site crawler's existing values.

/** Path segment under /[locale]/free-tools, and the ?src= every CTA carries. */
export const AUTHORITY_SLUG = "authority-checker";
export const AUTHORITY_SRC = "authority-checker";

/** One domain plus up to three competitors. */
export const MAX_COMPETITORS = 3;

/** New (paid) checks per IP per UTC day. A check served from cache does not count. */
export const CHECKS_PER_IP_PER_DAY = 10;

/** Email unlocks per IP per UTC day (pattern: the free crawler's unlock limit). */
export const UNLOCKS_PER_IP_PER_DAY = 20;

/** Every DataForSEO answer is cached this long per domain, in the shared store. */
export const CACHE_DAYS = 7;

/** How long a result link (and its unlock) lives (pattern: the free crawler's 7 days). */
export const RESULT_TTL_DAYS = 7;

/** The top referring domains the unlocked view lists. */
export const TOP_REFERRING_DOMAINS = 10;

/**
 * The tool's own daily DataForSEO budget, in USD, separate from the other free
 * tools' shared cap (FREE_TOOLS_DAILY_USD_CAP). AUTHORITY_CHECKER_DAILY_USD
 * overrides it; 0 turns every new check off (cached answers still serve).
 */
export const DEFAULT_DAILY_BUDGET_USD = 3;

/** The share of the daily budget at which one Matrix alert goes out. */
export const BUDGET_ALERT_SHARE = 0.8;

/**
 * The owner on every SeoApiCall row this tool writes. Not a Tenant row, like
 * FREE_TOOLS_TENANT_ID: its own id so this tool's spend is summed apart from
 * the shared free-tools cap, and so the two budgets cannot starve each other.
 */
export const AUTHORITY_TENANT_ID = "free-tools-authority";

export function dailyBudgetUsd(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.AUTHORITY_CHECKER_DAILY_USD;
  if (raw === undefined || raw.trim() === "") return DEFAULT_DAILY_BUDGET_USD;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_DAILY_BUDGET_USD;
}
