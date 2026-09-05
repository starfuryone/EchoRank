// src/lib/research-log/types.ts
//
// The closed vocabulary of the Research Log, and the reuse window.
//
// PURE, AND SEPARATE FROM store.ts ON PURPOSE. The dashboard's hub panel is a
// Client Component and needs the feature keys to look up its own copy; the
// store needs Prisma. Splitting them is the same split serp/options.ts and
// backlinks/options.ts already make, and for the same reason — see CLAUDE.md's
// client/server boundary rule.

/**
 * Every billable analysis that appends to the log.
 *
 * CLOSED, and mirrored by the `feature` column's comment in schema.prisma. A
 * seventh entry is a product decision — a new thing this workspace can spend on
 * — so it should be a change someone makes deliberately in both places, not a
 * string a caller invents at a write site.
 *
 * These are NOT the same set as `CreditFeature` in dataforseo/client.ts, and
 * conflating them is the easy mistake. That set classifies a PROVIDER PATH for
 * metering ("which meter does this call bill to"). This one names a PRODUCT
 * ACTION a customer took ("what did they research"). One site crawl is many
 * provider calls; one AI Citations lookup is several. The mapping is many-to-one
 * in both directions, which is why neither can be derived from the other.
 */
export const RESEARCH_FEATURES = [
  "serp_check",
  "backlinks",
  "domain_overview",
  "site_crawl",
  "keyword_opportunity",
  "ai_citations",
] as const;

export type ResearchFeature = (typeof RESEARCH_FEATURES)[number];

export function isResearchFeature(value: string): value is ResearchFeature {
  return (RESEARCH_FEATURES as readonly string[]).includes(value);
}

/**
 * How recent a stored result has to be for reuse to be the obvious call.
 *
 * ADVISORY. Nothing enforces it: the per-tool caches (24h for SERP, backlinks
 * and Site Explorer) are what actually stop a repeat purchase inside their own
 * windows, and they are much shorter than this on purpose. Thirty days is the
 * horizon over which a link profile or a domain's keyword set has usually not
 * moved enough to be worth re-buying — the question an agent should ask before
 * spending, not a rule the server applies.
 */
export const RESEARCH_REUSE_WINDOW_DAYS = 30;

export const RESEARCH_REUSE_WINDOW_MS = RESEARCH_REUSE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/** Rows the hub panel and the default MCP read return. */
export const RESEARCH_LOG_PANEL_LIMIT = 10;

/** One row as every surface receives it. Dates and Decimals never cross raw. */
export interface ResearchLogEntry {
  id: string;
  feature: ResearchFeature;
  target: string;
  metrics: Record<string, number | string> | null;
  costUsd: number;
  /** Id of the row holding the result, in that feature's own table. */
  sourceRef: string | null;
  /** ISO 8601. */
  createdAt: string;
  /** Whole hours since the research ran. The UI turns it into "2 days ago". */
  ageHours: number;
  /** True while inside RESEARCH_REUSE_WINDOW_DAYS — "reuse this, don't re-buy". */
  reusable: boolean;
}

/** Where a logged result is read back, per feature. Used by the hub panel. */
export const RESEARCH_FEATURE_HREFS: Record<ResearchFeature, string> = {
  serp_check: "/visibility/tools/serp-checker",
  backlinks: "/visibility/tools/backlinks",
  domain_overview: "/visibility/tools/site-explorer",
  site_crawl: "/visibility/tools/site-crawler",
  keyword_opportunity: "/visibility/tools/keyword-opportunities",
  ai_citations: "/visibility/tools/ai-citations",
};
