// src/lib/site-crawler/types.ts
//
// Shapes shared by the API routes and the client component. Kept apart from
// service.ts so the "use client" bundle can import them without dragging
// Prisma and the queue registry along with it.

import type { Severity } from "./checks";

export type CrawlStatusValue = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";

/** Statuses the UI keeps polling. */
export const IN_FLIGHT_CRAWL_STATUSES: CrawlStatusValue[] = ["QUEUED", "RUNNING"];

export function isInFlight(status: string): boolean {
  return (IN_FLIGHT_CRAWL_STATUSES as string[]).includes(status);
}

export interface CrawlDto {
  id: string;
  rootUrl: string;
  status: CrawlStatusValue;
  urlCap: number;
  pagesCrawled: number;
  issueCount: number;
  stoppedReason: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  /** Present on the detail endpoint once the crawl has settled. */
  severityCounts?: SeverityCounts;
}

export interface SeverityCounts {
  ERROR: number;
  WARNING: number;
  NOTICE: number;
}

export interface CrawlQuotaDto {
  urlCap: number;
  monthlyLimit: number | null;
  used: number;
  remaining: number | null;
  allowed: boolean;
  locked: boolean;
}

export interface CrawlIssueRow {
  id: string;
  type: string;
  severity: Severity;
  detail: string | null;
  url: string;
  statusCode: number | null;
}

export interface CrawlIssuePage {
  issues: CrawlIssueRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CrawlListResponse {
  crawls: CrawlDto[];
  quota: CrawlQuotaDto;
}

// ─── Phase 2: site-wide analysis ────────────────────────────────────────────
//
// Declared here rather than imported from aggregate.ts: that module imports
// Prisma, and the client bundle must not pull a database client in just to
// know the shape of a summary.

export interface CrawlSummaryDto {
  statusCodes: Record<string, number>;
  depths: Record<string, number>;
  issuesBySeverity: Record<string, number>;
  issuesByType: Record<string, number>;
  duplicates: { title: number; metaDescription: number; content: number };
  redirects: { chains: number; loops: number; longestChain: number };
  sitemap: {
    found: boolean;
    urlCount: number;
    filesFetched: number;
    truncated: boolean;
    notCrawled: number;
    notCrawledSample: string[];
  };
  inlinks: { average: number; zeroCount: number; max: number };
  deepestPages: { url: string; depth: number }[];
  aggregationMs: number;
  /** Present when aggregation failed; the page data is still complete. */
  aggregationError?: string;
}

export type DuplicateKind = "title" | "meta" | "content";

export interface DuplicateGroupDto {
  /** Null for content groups — the hash is not worth showing. */
  value: string | null;
  members: number;
  urls: string[];
  truncated: boolean;
}

export interface DuplicatePage {
  type: DuplicateKind;
  groups: DuplicateGroupDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface RedirectRowDto {
  id: string;
  type: string;
  severity: string;
  url: string;
  statusCode: number | null;
  target: string | null;
  hops: string[];
  detail: string | null;
}

export interface RedirectPage {
  redirects: RedirectRowDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CrawlPageRow {
  id: string;
  url: string;
  statusCode: number | null;
  title: string | null;
  depth: number;
  inlinkCount: number | null;
  inSitemap: boolean | null;
  wordCount: number | null;
  issueCount: number;
}

export interface CrawlPagesPage {
  pages: CrawlPageRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Filters the Pages tab can apply. Empty string means "not filtered". */
export interface PageFilters {
  inSitemap: string;
  depth: string;
  minInlinks: string;
}

export const EMPTY_PAGE_FILTERS: PageFilters = { inSitemap: "", depth: "", minInlinks: "" };
