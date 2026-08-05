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
