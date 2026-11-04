// src/lib/site-crawler/types.ts
//
// Shapes shared by the API routes and the client component. Kept apart from
// service.ts so the "use client" bundle can import them without dragging
// Prisma and the queue registry along with it.

import type { Severity } from "./checks";
import type { CrawlConfigView } from "./crawl-config";

export type CrawlStatusValue = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";

/** Statuses the UI keeps polling. */
export const IN_FLIGHT_CRAWL_STATUSES: CrawlStatusValue[] = ["QUEUED", "RUNNING"];

export function isInFlight(status: string): boolean {
  return (IN_FLIGHT_CRAWL_STATUSES as string[]).includes(status);
}

/**
 * Render mode (Phase 3b). none = raw HTML only; thin = render only pages whose
 * raw HTML has under THIN_MAX_WORDS words or no links; all = every HTML page.
 * Either way capped by the plan's rendered pages per crawl.
 */
export const RENDER_MODES = ["none", "thin", "all"] as const;
export type RenderMode = (typeof RENDER_MODES)[number];
export const THIN_MAX_WORDS = 50;

export function isRenderMode(v: unknown): v is RenderMode {
  return typeof v === "string" && (RENDER_MODES as readonly string[]).includes(v);
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
  renderMode: RenderMode;
  /** The plan's rendered-page ceiling when the crawl was created. */
  renderCap: number;
  pagesRendered: number;
  /** Phase 4a. */
  mode?: "spider" | "list";
  /** Secrets as { set: true }; null = the defaults. */
  config?: CrawlConfigView | null;
  pinned?: boolean;
  /** Set once retention deleted the crawl's pages: summary only. */
  dataPurgedAt?: string | null;
  /** Start response only, list mode: lines that were not public http(s) URLs. */
  listSkipped?: number;
  /** Present on the detail endpoint once the crawl has settled. */
  severityCounts?: SeverityCounts;
  /** Site health 0–100 (summary.health; site-health.ts). Null before the crawl settles or on older crawls. */
  health?: number | null;
  /** Phase 4e forms login: failed = the crawl ran unauthenticated. */
  login?: { status: "ok" | "failed"; reason: string | null } | null;
}

export interface SeverityCounts {
  ERROR: number;
  WARNING: number;
  NOTICE: number;
}

export interface CrawlQuotaDto {
  urlCap: number;
  /** Pages one crawl may render; 0 = render mode unavailable on the plan. */
  renderCap: number;
  monthlyLimit: number | null;
  used: number;
  remaining: number | null;
  allowed: boolean;
  locked: boolean;
  /** Phase 4a: crawls kept with full data (plan-config crawlsKept). */
  crawlsKept?: number;
  /** Phase 4b caps: extractors and searches per crawl, segments per site. */
  extractorCap?: number;
  searchCap?: number;
  segmentCap?: number;
  /** Phase 4c: schedules per tenant and the cadences this tier may pick. */
  scheduleCap?: number;
  scheduleCadences?: readonly ("daily" | "weekly" | "monthly")[];
  /** Phase 4d: pages per crawl for PageSpeed and for backlink metrics. */
  psiCap?: number;
  backlinkCap?: number;
  /** Phase 4e: custom JS snippets and AI-prompted pages per crawl. */
  jsSnippetCap?: number;
  aiPageCap?: number;
  /** Phase 4g. */
  semanticCap?: number;
  inspectionCap?: number;
  lighthouseUsed?: number;
  lighthouseLimit?: number;
  backlinkUnitUsd?: number;
  seoBudgetLeftUsd?: number;
  /** Phase 4e AI prompts. */
  aiTokensUsed?: number;
  aiTokenLimit?: number | null;
  aiClaude?: boolean;
  aiKeys?: { openai: boolean; gemini: boolean };
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
  /** Phase 4d: pages with data per joined source, and what each source did. */
  metricOverview?: {
    coverage: Partial<Record<"gsc" | "psi" | "ga4" | "backlinks" | "gsc_inspection", number>>;
    total: number;
    status: Partial<Record<"gsc" | "psi" | "ga4" | "backlinks" | "gsc_inspection", { status: string; stoppedReason?: string; targets?: number; completed?: number }>>;
  };
  statusCodes: Record<string, number>;
  depths: Record<string, number>;
  issuesBySeverity: Record<string, number>;
  issuesByType: Record<string, number>;
  /** Errors / warnings / notices — getIssueTotals, the same source as the header tiles. */
  totals: SeverityCounts;
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
  /** Phase 3a: per-rule tallies and totals by kind — from the summary, or computed from crawl_issues. */
  issues?: Record<string, RuleTallyDto>;
  issuesByKind?: Record<RuleKindDto, number>;
  /** True when the tallies were counted on read (an older crawl). */
  computed?: boolean;
  /** Phase 4b: pages and issue totals per segment (no segment filter). */
  segments?: SegmentOverviewDto[];
  /** Phase 4b: the segment the totals and tallies were narrowed to. */
  segment?: { index: number; name: string; pages: number };
}

export interface SegmentOverviewDto {
  index: number;
  name: string;
  pages: number;
  totals: SeverityCounts;
}

export type RuleKindDto = "issue" | "warning" | "opportunity";

export interface RuleTallyDto {
  count: number;
  kind: RuleKindDto;
  priority: "high" | "medium" | "low";
  /** Distinct pages affected (Fix first); absent on summaries from before it. */
  pages?: number;
}

/** A crawl from before Phase 2: no site-wide summary, tallies only. */
export interface PartialSummaryDto {
  partial: true;
  issues: Record<string, RuleTallyDto>;
  issuesByKind: Record<RuleKindDto, number>;
  totals: SeverityCounts;
  computed: boolean;
  segments?: SegmentOverviewDto[];
  segment?: { index: number; name: string; pages: number };
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
  /** Phase 4a: the first page seen linking here. */
  foundOn?: string | null;
  /** Phase 4b: {"<search index>": matches}; null on non-HTML pages. */
  searchHits?: Record<string, number> | null;
  issueCount: number;
  /** Phase 4g: Link Score 0–100; null when not computed. */
  linkScore?: number | null;
}

export interface CrawlPagesPage {
  pages: (CrawlPageRow & { metrics?: Partial<Record<"gsc" | "psi" | "ga4" | "backlinks" | "gsc_inspection", unknown>> })[];
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
  /** Phase 4b: "" = any; "N:hit" / "N:none" = custom search N matched / did not. */
  search: string;
  /** Phase 4c: URLs starting with this (a Structure tab click). "" = any. */
  urlPrefix?: string;
  /** Phase 4d: a metric sort key (metrics-shared METRIC_COLUMNS) and direction; "" = the default order. */
  sort?: string;
  dir?: "asc" | "desc";
}

export const EMPTY_PAGE_FILTERS: PageFilters = { inSitemap: "", depth: "", minInlinks: "", search: "", urlPrefix: "" };

/** The pages route's query for a set of filters (the table and its CSV share it). */
export function pageFilterParams(f: PageFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (f.inSitemap) params.set("inSitemap", f.inSitemap);
  if (f.depth) params.set("depth", f.depth);
  if (f.minInlinks) params.set("minInlinks", f.minInlinks);
  if (f.urlPrefix) params.set("urlPrefix", f.urlPrefix);
  if (f.sort) {
    params.set("sort", f.sort);
    params.set("dir", f.dir ?? "desc");
  }
  const [index, which] = f.search.split(":");
  if (index && which) {
    params.set("search", index);
    params.set("hit", which === "hit" ? "true" : "false");
  }
  return params;
}
