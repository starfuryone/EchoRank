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
  /** googleOrganicLiveAdvanced — SERP Checker */
  organicLive: "v3/serp/google/organic/live/advanced",
  /** googleOrganicTaskPost — SERP Checker + rank tracking (cheaper, async) */
  organicTaskPost: "v3/serp/google/organic/task_post",
  /** googleOrganicTasksReady — FREE at DataForSEO, skip metering */
  organicTasksReady: "v3/serp/google/organic/tasks_ready",
  /** googleOrganicTaskGetAdvanced — FREE at DataForSEO, skip metering.
   * The live path appends `/<taskId>`; this constant is the fixture key. */
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
  domainPagesSummary: "v3/backlinks/domain_pages_summary/live",
  history: "v3/backlinks/history/live",
} as const;

// ---------------------------------------------------------------------------
// OnPage / Lighthouse + Business Data (local SEO) + account
// ---------------------------------------------------------------------------
export const ONPAGE = {
  /** lighthouseLiveJson */
  lighthouse: "v3/on_page/lighthouse/live/json",
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

export type RelevantPageItem = {
  page_address?: string;
  metrics?: { organic?: { count?: number; etv?: number; pos_1?: number } };
};

export type BacklinksSummaryItem = {
  target?: string;
  rank?: number;
  backlinks?: number;
  referring_domains?: number;
  referring_main_domains?: number;
  referring_ips?: number;
  broken_backlinks?: number;
  referring_links_types?: Record<string, number>;
  referring_links_attributes?: Record<string, number>;
};

export type SerpOrganicItem = {
  type?: string;
  rank_group?: number;
  rank_absolute?: number;
  domain?: string;
  title?: string;
  url?: string;
  description?: string;
  breadcrumb?: string;
};

// ---------------------------------------------------------------------------
// Thin call helpers. Location/language codes come from the ported
// keyword-locations.ts table (open-seo src/shared/keyword-locations.ts).
// ---------------------------------------------------------------------------

type Loc = { locationCode: number; languageCode: string };

export function domainRankOverview(input: { target: string } & Loc) {
  return postTask<DomainRankOverviewItem[]>(LABS.domainRankOverview, {
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
  return postTask<BacklinksSummaryItem[]>(BACKLINKS.summary, {
    target: input.target,
    internal_list_limit: 10,
    backlinks_status_type: "live",
    include_subdomains: true,
  });
}

export function serpOrganicLive(
  input: { keyword: string; device?: "desktop" | "mobile"; depth?: number } & Loc,
) {
  return postTask<{ items?: SerpOrganicItem[] }[]>(SERP.organicLive, {
    keyword: input.keyword,
    location_code: input.locationCode,
    language_code: input.languageCode,
    device: input.device ?? "desktop",
    depth: input.depth ?? 100,
  });
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
