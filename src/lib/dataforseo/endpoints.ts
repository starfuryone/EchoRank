/**
 * src/lib/dataforseo/endpoints.ts
 *
 * One wrapper per DataForSEO endpoint that open-seo calls, mapped from its
 * SDK method names to raw v3 paths. Each takes the task payload and returns
 * the parsed first result; metering happens in the caller via meteredCall.
 *
 * SDK method -> v3 path mapping verified against open-seo @ HEAD (Jul 2026).
 */

import { postTask, getEndpoint, type ApiResult } from "./client";
import { backlinksSummaryTask } from "./backlinks-summary";

// ---------------------------------------------------------------------------
// DataForSEO Labs — keyword research + domain analytics
// ---------------------------------------------------------------------------
export const LABS = {
  /** googleRelatedKeywordsLive */
  relatedKeywords: "v3/dataforseo_labs/google/related_keywords/live",
  /** googleKeywordSuggestionsLive */
  keywordSuggestions: "v3/dataforseo_labs/google/keyword_suggestions/live",
  /** googleKeywordIdeasLive */
  keywordIdeas: "v3/dataforseo_labs/google/keyword_ideas/live",
  /** googleKeywordOverviewLive */
  keywordOverview: "v3/dataforseo_labs/google/keyword_overview/live",
  /** googleDomainRankOverviewLive */
  domainRankOverview: "v3/dataforseo_labs/google/domain_rank_overview/live",
  /** googleRankedKeywordsLive */
  rankedKeywords: "v3/dataforseo_labs/google/ranked_keywords/live",
  /** googleRelevantPagesLive */
  relevantPages: "v3/dataforseo_labs/google/relevant_pages/live",
  /** googleSerpCompetitorsLive */
  serpCompetitors: "v3/dataforseo_labs/google/serp_competitors/live",
  /** googleCompetitorsDomainLive — Site Explorer's competitors card */
  competitorsDomain: "v3/dataforseo_labs/google/competitors_domain/live",
} as const;

// ---------------------------------------------------------------------------
// Content Analysis — web mentions of a phrase (Content Explorer)
// ---------------------------------------------------------------------------
// A different pricing model from Labs, and worth stating where the paths live:
// each of these bills a FIXED $0.024036 per call plus ~$0.0000353 per returned
// item (measured Jul 2026 from the recorded envelopes). Cost is therefore ~96%
// independent of how much comes back — a phrase with zero mentions costs almost
// exactly what a phrase with fifty does. Callers must treat every call as
// expensive regardless of the expected result size.
export const CONTENT_ANALYSIS = {
  /** Recent pages mentioning a phrase — the mentions table. */
  search: "v3/content_analysis/search/live",
  /** Totals for the same phrase — the summary band. Skip when total_count is 0. */
  summary: "v3/content_analysis/summary/live",
} as const;

// ---------------------------------------------------------------------------
// Keywords Data (Google Ads) — true search volume / CPC
// ---------------------------------------------------------------------------
export const ADS = {
  /** googleAdsSearchVolumeLive */
  searchVolume: "v3/keywords_data/google_ads/search_volume/live",
  /** googleAdsKeywordsForKeywordsLive */
  keywordsForKeywords: "v3/keywords_data/google_ads/keywords_for_keywords/live",
} as const;

// ---------------------------------------------------------------------------
// SERP
// ---------------------------------------------------------------------------
export const SERP = {
  /** googleOrganicTaskPost — SERP Checker + rank tracking (cheaper, async) */
  organicTaskPost: "v3/serp/google/organic/task_post",
  /** googleOrganicTasksReady — genuinely free ($0 envelope); skip metering. */
  organicTasksReady: "v3/serp/google/organic/tasks_ready",
  /**
   * googleOrganicTaskGetAdvanced. The live path appends `/<taskId>`; this
   * constant is the fixture key.
   *
   * NOT metered, and NOT because it is free — its envelope reports the same
   * `cost` as the task_post that created it ($0.006 at depth 100 in the
   * recorded fixtures). That figure is an ECHO of the charge already made when
   * the task was posted, not a second charge. Metering here as well would
   * double-bill every keyword. The single charge is taken at task_post in
   * serp/service.ts and rank-tracker/service.ts; the poller reads with the
   * unmetered getEndpoint() on purpose.
   */
  organicTaskGet: "v3/serp/google/organic/task_get/advanced",
  /** googleMapsLiveAdvanced */
  mapsLive: "v3/serp/google/maps/live/advanced",
  /** googleLocalFinderLiveAdvanced */
  localFinderLive: "v3/serp/google/local_finder/live/advanced",
} as const;

// ---------------------------------------------------------------------------
// Backlinks
// ---------------------------------------------------------------------------
export const BACKLINKS = {
  summary: "v3/backlinks/summary/live",
  list: "v3/backlinks/backlinks/live",
  referringDomains: "v3/backlinks/referring_domains/live",
  /** Anchor texts pointing at the target — Backlinks tool. */
  anchors: "v3/backlinks/anchors/live",
  /** Most-linked pages OF the target — Backlinks tool. */
  domainPages: "v3/backlinks/domain_pages/live",
  domainPagesSummary: "v3/backlinks/domain_pages_summary/live",
  history: "v3/backlinks/history/live",
} as const;

// ---------------------------------------------------------------------------
// OnPage / Lighthouse + Business Data (local SEO) + account
// ---------------------------------------------------------------------------
export const ONPAGE = {
  /** lighthouseLiveJson. NOTE: the Lighthouse TOOL uses Google PageSpeed
   * Insights instead (free, and the only source of CrUX field data) — see
   * src/lib/pagespeed/client.ts. This constant is unused by that feature. */
  lighthouse: "v3/on_page/lighthouse/live/json",

  // ── Site Audit: an ASYNC CRAWL, not a standard-queue task. ──────────────
  // The lifecycle is task_post -> poll summary until crawl_progress
  // "finished" -> read pages. It does NOT go through serp tasks_ready, and
  // summary must be polled DURING the crawl because pages_crawled is what the
  // progress UI shows. See src/lib/site-audit/poll.ts.
  /** Starts a crawl. Billed per page actually crawled. */
  taskPost: "v3/on_page/task_post",
  /** Crawl progress + totals. Path is `${summary}/${taskId}`. FREE. */
  summary: "v3/on_page/summary",
  /** Per-page results with their failed checks. FREE (POST with the task id). */
  pages: "v3/on_page/pages",
} as const;

export const BUSINESS = {
  listingsSearch: "v3/business_data/business_listings/search/live",
  questionsAnswers: "v3/business_data/google/questions_and_answers/live",
} as const;

/** FREE — balance/spend. Do NOT meter. */
export const ACCOUNT = { userData: "v3/appendix/user_data" } as const;

// ---------------------------------------------------------------------------
// Typed shapes for the tools in scope. Validate with zod at the route edge —
// DataForSEO types almost everything as optional.
// ---------------------------------------------------------------------------

/**
 * ONE ITEM of domain_rank_overview, i.e. `result[0].items[0]` — the metrics
 * live a level below the result element, not on it (verified against the
 * recorded envelope, Jul 2026). Call sites type the result as
 * `{ items?: DomainRankOverviewItem[] }[]`.
 */
export type DomainRankOverviewItem = {
  se_type?: string;
  location_code?: number;
  language_code?: string;
  metrics?: {
    organic?: {
      pos_1?: number;
      pos_2_3?: number;
      pos_4_10?: number;
      pos_11_20?: number;
      pos_21_30?: number;
      pos_31_40?: number;
      pos_41_50?: number;
      pos_51_60?: number;
      pos_61_70?: number;
      pos_71_80?: number;
      pos_81_90?: number;
      pos_91_100?: number;
      etv?: number;
      count?: number;
      estimated_paid_traffic_cost?: number;
    };
    paid?: Record<string, number>;
  };
};

export type RankedKeywordItem = {
  se_type?: string;
  keyword_data?: {
    keyword?: string;
    keyword_info?: {
      search_volume?: number;
      cpc?: number;
      competition?: number;
      monthly_searches?: { year: number; month: number; search_volume: number }[];
    };
    keyword_properties?: { keyword_difficulty?: number };
    search_intent_info?: { main_intent?: string };
  };
  ranked_serp_element?: {
    serp_item?: {
      rank_group?: number;
      rank_absolute?: number;
      url?: string;
      title?: string;
      etv?: number;
    };
  };
};

/**
 * competitors_domain returns the target itself as one of the rows (100 %
 * intersection with itself), so callers filter on `domain`.
 *
 * Three metric blocks, easy to mix up (semantics verified against the recorded
 * envelope, Jul 2026):
 *  - `metrics`            — the TARGET's numbers on the intersecting keywords
 *  - `competitor_metrics` — the COMPETITOR's numbers on those same keywords
 *  - `full_domain_metrics`— the competitor's entire organic footprint
 *
 * The competitors table wants `competitor_metrics` — "what they pull from the
 * keywords you share", not how big they are overall and not your own traffic
 * (which is near-identical on every row and therefore useless as a column).
 */
export type CompetitorsDomainItem = {
  se_type?: string;
  domain?: string;
  avg_position?: number;
  sum_position?: number;
  intersections?: number;
  metrics?: { organic?: { count?: number; etv?: number; pos_1?: number } };
  competitor_metrics?: { organic?: { count?: number; etv?: number; pos_1?: number } };
  full_domain_metrics?: { organic?: { count?: number; etv?: number } };
};

export type RelevantPageItem = {
  page_address?: string;
  metrics?: { organic?: { count?: number; etv?: number; pos_1?: number } };
};

/** Canonical shape + parser live in ./backlinks-summary (shared by Site
 * Explorer and the Backlinks tool). Re-exported so existing importers of
 * `BacklinksSummaryItem` from this module keep working. */
import type { BacklinksSummaryItem } from "./backlinks-summary";
export type { BacklinksSummaryItem };

// ---------------------------------------------------------------------------
// Thin call helpers. Location/language codes come from the ported
// keyword-locations.ts table (open-seo src/shared/keyword-locations.ts).
// ---------------------------------------------------------------------------

type Loc = { locationCode: number; languageCode: string };

export function domainRankOverview(input: { target: string } & Loc) {
  return postTask<{ items?: DomainRankOverviewItem[] }[]>(LABS.domainRankOverview, {
    target: input.target,
    location_code: input.locationCode,
    language_code: input.languageCode,
    limit: 1,
  });
}

export function rankedKeywords(
  input: {
    target: string;
    limit: number;
    offset?: number;
    orderBy?: string[];
    filters?: unknown[];
    includeSubdomains?: boolean;
  } & Loc,
) {
  return postTask<{ items?: RankedKeywordItem[]; total_count?: number }[]>(
    LABS.rankedKeywords,
    {
      target: input.target,
      location_code: input.locationCode,
      language_code: input.languageCode,
      limit: input.limit,
      offset: input.offset,
      order_by: input.orderBy,
      filters: input.filters,
      include_subdomains: input.includeSubdomains,
    },
  );
}

export function competitorsDomain(input: { target: string; limit: number } & Loc) {
  return postTask<{ items?: CompetitorsDomainItem[]; total_count?: number }[]>(
    LABS.competitorsDomain,
    {
      target: input.target,
      location_code: input.locationCode,
      language_code: input.languageCode,
      limit: input.limit,
    },
  );
}

export function relevantPages(
  input: { target: string; limit: number; offset?: number } & Loc,
) {
  return postTask<{ items?: RelevantPageItem[]; total_count?: number }[]>(
    LABS.relevantPages,
    {
      target: input.target,
      location_code: input.locationCode,
      language_code: input.languageCode,
      limit: input.limit,
      offset: input.offset,
    },
  );
}

export function backlinksSummary(input: { target: string }) {
  return postTask<BacklinksSummaryItem[]>(
    BACKLINKS.summary,
    backlinksSummaryTask(input.target, { includeSubdomains: true }),
  );
}

export function keywordSuggestions(
  input: { keyword: string; limit: number; offset?: number } & Loc,
) {
  return postTask<{ items?: unknown[]; total_count?: number }[]>(
    LABS.keywordSuggestions,
    {
      keyword: input.keyword,
      location_code: input.locationCode,
      language_code: input.languageCode,
      limit: input.limit,
      offset: input.offset,
      include_serp_info: false,
    },
  );
}

export function lighthouse(input: {
  url: string;
  forMobile?: boolean;
  categories?: string[];
}) {
  return postTask<unknown[]>(ONPAGE.lighthouse, {
    url: input.url,
    for_mobile: input.forMobile ?? false,
    categories: input.categories ?? [
      "performance",
      "accessibility",
      "best-practices",
      "seo",
    ],
  });
}

/** Free — account balance. Use for the ops dashboard, never metered.
 * user_data is a GET endpoint; POSTing it returns 40400 Not Found. */
export function accountBalance(): Promise<ApiResult<unknown[]>> {
  return getEndpoint<unknown[]>(ACCOUNT.userData);
}
