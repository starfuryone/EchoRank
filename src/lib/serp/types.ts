// src/lib/serp/types.ts
//
// Wire shapes shared by the SERP Checker route handlers, the serp-checks
// worker, and the client component. The DataForSEO-side shapes live in
// dataforseo/endpoints.ts; these are OUR normalized, persisted shapes.

export type SerpDevice = "desktop" | "mobile";
export type SerpCheckStatus = "queued" | "completed" | "failed";

/** One organic result, as persisted in SerpCheck.results.items. */
export interface SerpResultItem {
  /** DataForSEO rank_group — the organic-only rank, 1-based. */
  position: number;
  title: string;
  url: string;
  domain: string;
  snippet: string;
}

/** SerpCheck.results — deliberately an object so extra keys can be added
 * without a migration (breadcrumbs, related searches, …). */
export interface SerpResults {
  items: SerpResultItem[];
  /** DataForSEO's own total for the query, when it reports one. */
  seResultsCount?: number;
  /** The Google URL DataForSEO actually fetched. */
  checkUrl?: string;
}

/** Shape returned by GET /api/seo/v1/serp/check/[id]. */
export interface SerpCheckDto {
  id: string;
  keyword: string;
  locationCode: number;
  languageCode: string;
  device: SerpDevice;
  status: SerpCheckStatus;
  costUsd: number;
  itemCount: number | null;
  serpFeatures: string[];
  results: SerpResults | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  /** True when the POST was served from the 24 h cache instead of a new task. */
  cached?: boolean;
}
