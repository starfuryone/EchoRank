// src/lib/site-explorer/types.ts
//
// Wire shapes shared by the Site Explorer route handlers and the client
// component. The DataForSEO-side shapes live in dataforseo/endpoints.ts;
// these are OUR normalized, persisted shapes — one per card on the page.

/** The four sections an analysis is made of, in render order. */
export const SITE_EXPLORER_SECTIONS = [
  "overview",
  "rankedKeywords",
  "competitors",
  "backlinks",
] as const;

export type SiteExplorerSection = (typeof SITE_EXPLORER_SECTIONS)[number];

/** completed = all four sections loaded; partial = at least one failed. */
export type SiteExplorerStatus = "completed" | "partial";

/** dataforseo_labs/google/domain_rank_overview/live, organic metrics only. */
export interface OverviewSection {
  /** Estimated monthly organic traffic (DataForSEO ETV). */
  etv: number;
  /** Keywords the domain ranks for in the top 100. */
  keywordCount: number;
  /** What that traffic would cost as paid clicks, USD/month. */
  estimatedPaidTrafficCost: number;
  /** Rank spread, collapsed from DataForSEO's 10 buckets to 5 readable ones. */
  distribution: {
    pos1: number;
    pos2_3: number;
    pos4_10: number;
    pos11_20: number;
    pos21_100: number;
  };
}

/** One row of the top-keywords table. */
export interface RankedKeywordRow {
  keyword: string;
  /** rank_group — the organic-only position, 1-based. */
  position: number;
  searchVolume: number;
  /** Estimated traffic value this keyword sends the domain. */
  etv: number;
  url: string;
}

export interface RankedKeywordsSection {
  items: RankedKeywordRow[];
  /** DataForSEO's total for the domain, which is far larger than `items`. */
  totalCount: number;
}

/** One row of the competitors table. */
export interface CompetitorRow {
  domain: string;
  /** Keywords this domain and the target both rank for. */
  intersections: number;
  /** The competitor's average position across those shared keywords. */
  avgPosition: number;
  /** The COMPETITOR's estimated traffic from the shared keywords. */
  etv: number;
}

export interface CompetitorsSection {
  items: CompetitorRow[];
}

/**
 * backlinks/summary/live headline metrics.
 *
 * The dofollow split is reported at the REFERRING-DOMAIN level, not the link
 * level: `referring_domains` / `referring_domains_nofollow` is a directly
 * reported pair on the same base, whereas the per-link `nofollow` figure lives
 * in an attributes block counted against referring pages. Differencing across
 * those two bases would produce a plausible number that means nothing.
 */
export interface BacklinksSection {
  backlinks: number;
  referringDomains: number;
  referringMainDomains: number;
  /** DataForSEO domain rank, 0–1000. */
  rank: number;
  brokenBacklinks: number;
  /** Referring domains linking without rel=nofollow. */
  dofollowDomains: number;
  nofollowDomains: number;
  /** dofollowDomains / referringDomains, 0–1. Null when there are no domains. */
  dofollowRatio: number | null;
}

/** Shape returned by all three Site Explorer routes. */
export interface SiteExplorerAnalysisDto {
  id: string;
  domain: string;
  locationCode: number;
  languageCode: string;
  status: SiteExplorerStatus;
  costUsd: number;
  overview: OverviewSection | null;
  rankedKeywords: RankedKeywordsSection | null;
  competitors: CompetitorsSection | null;
  backlinks: BacklinksSection | null;
  /** Section keys that did not load. Each renders its own "couldn't load" card. */
  failedSections: SiteExplorerSection[];
  createdAt: string;
  /** True when the POST replayed a stored analysis instead of spending. */
  cached?: boolean;
  /** ms until this domain can be re-analyzed; only set on a cache hit. */
  reRunAvailableInMs?: number;
}

/** One row of the history list — no section payloads, just the summary. */
export interface SiteExplorerHistoryRow {
  id: string;
  domain: string;
  status: SiteExplorerStatus;
  costUsd: number;
  createdAt: string;
}
