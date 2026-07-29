// src/lib/site-audit/types.ts
//
// Wire shapes shared by the Site Audit routes, the poller and the client.
// These are OUR normalized, persisted shapes; the DataForSEO-side shapes live
// beside the parser in parse.ts.

import type { IssueSeverity } from "./checks";

export type SiteAuditStatus = "queued" | "crawling" | "completed" | "failed";

/** Statuses where the crawl is still running and the UI should keep polling. */
export const IN_FLIGHT_STATUSES: SiteAuditStatus[] = ["queued", "crawling"];

/** Headline crawl totals. */
export interface SummarySection {
  /** DataForSEO's OnPage score, 0–100. Null when not reported. */
  onPageScore: number | null;
  pagesCrawled: number;
  pagesInQueue: number;
  /** Total pages the crawler found, which can exceed what it was allowed. */
  pagesTotal: number;
  brokenLinks: number;
  brokenResources: number;
  duplicateTitles: number;
  duplicateDescriptions: number;
  duplicateContent: number;
  /** Non-2xx responses seen, by class. */
  responses4xx: number;
  responses5xx: number;
  redirects: number;
  /** Median page load, ms. Null when not reported. */
  medianLoadTimeMs: number | null;
}

/** One catalogued problem, with how many pages it affects. */
export interface IssueRow {
  /** OnPage's own check key, e.g. "duplicate_title_tag". */
  key: string;
  severity: IssueSeverity;
  group: string;
  /** Pages failing this check. */
  count: number;
}

export interface IssuesSection {
  items: IssueRow[];
  /** Totals per severity, for the summary chips. */
  totals: Record<IssueSeverity, number>;
  /**
   * Checks OnPage reported that are not in our catalogue. Surfaced so a new
   * upstream check does not silently vanish from the report.
   */
  unclassified: string[];
}

/** One row of the "top problem pages" table. */
export interface PageRow {
  url: string;
  /** Per-page OnPage score, 0–100. Null when not reported. */
  onPageScore: number | null;
  statusCode: number | null;
  /** Failed check keys on this page, worst-first by our catalogue. */
  failedChecks: string[];
  /** Count of failed checks, so the table can sort without expanding. */
  issueCount: number;
  loadTimeMs: number | null;
}

export interface PagesSection {
  items: PageRow[];
  /** DataForSEO's total, which can exceed the rows we stored. */
  totalCount: number;
}

/** Shape returned by all three Site Audit routes. */
export interface SiteAuditDto {
  id: string;
  domain: string;
  maxPages: number;
  status: SiteAuditStatus;
  /** Pages crawled so far — the progress bar's numerator. */
  pagesCrawled: number;
  summary: SummarySection | null;
  issues: IssuesSection | null;
  pages: PagesSection | null;
  costUsd: number;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
  /** True when the POST replayed a stored audit instead of starting a crawl. */
  cached?: boolean;
  /** ms until this domain can be re-audited; only set on a cache hit. */
  reRunAvailableInMs?: number;
}

/** One row of the history list — no payloads, just the summary. */
export interface SiteAuditHistoryRow {
  id: string;
  domain: string;
  status: SiteAuditStatus;
  onPageScore: number | null;
  pagesCrawled: number;
  maxPages: number;
  costUsd: number;
  createdAt: string;
}

export interface SiteAuditUsage {
  used: number;
  limit: number;
  /** Pages this plan may crawl per audit. */
  maxPages: number;
  plan: string;
}
