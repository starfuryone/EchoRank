// src/lib/site-crawler/csv-columns.ts
//
// Export column definitions for the Site Crawler tables.
//
// IN A LIB MODULE, NOT IN THE ROUTE. Two routes need these — the issues list
// (`?format=csv`, honouring the current filters) and the whole-crawl /export —
// and a Next route file is only supposed to export HTTP method handlers.
// Exporting a constant from one route.ts and importing it into another is the
// kind of thing that type-checks locally and fails the production build.

import type { CsvColumn } from "@/lib/csv-export";
import { RULE_COPY } from "@/lib/crawl-rules";

/** The row shape the CSV columns and the Prisma select agree on. */
export interface CrawlIssueRow {
  id: string;
  type: string;
  severity: string;
  detail: string | null;
  crawlPage: { url: string; statusCode: number | null };
}

/**
 * Issue export columns.
 *
 * `url` and `detail` are the untrusted fields — a crawled page's own <title> or
 * meta description reaches `detail` verbatim — which is exactly what the
 * serializer's formula guard exists for.
 */
export const ISSUE_COLUMNS: CsvColumn<CrawlIssueRow>[] = [
  { header: "Severity", value: (r) => r.severity },
  { header: "Type", value: (r) => r.type },
  { header: "URL", value: (r) => r.crawlPage.url },
  { header: "Status code", value: (r) => r.crawlPage.statusCode },
  { header: "Detail", value: (r) => r.detail },
];

/**
 * The subset of CrawlPage the pages export writes.
 *
 * Mirrors the JSON route's `select` exactly, minus the issue count — the crawl
 * stores LENGTHS for title and meta description rather than the strings
 * themselves (no HTML bodies are kept), so the export reports what exists
 * rather than inventing columns the crawler never collected.
 */
export interface CrawlPageRow {
  id: string;
  url: string;
  statusCode: number | null;
  title: string | null;
  titleLength: number | null;
  metaDescLength: number | null;
  h1Count: number | null;
  wordCount: number | null;
  depth: number | null;
  internalLinks: number | null;
  inlinkCount: number | null;
  inSitemap: boolean | null;
  canonical: string | null;
  redirectTarget: string | null;
  contentType: string | null;
  foundOn: string | null;
  /** Phase 4b: {"<search index>": matches}; null on non-HTML pages. */
  searchHits?: unknown;
}

/**
 * Page export columns.
 *
 * `title`, `canonical` and `redirectTarget` are scraped from the crawled site,
 * so they are the untrusted ones the formula guard covers.
 */
export const PAGE_COLUMNS: CsvColumn<CrawlPageRow>[] = [
  { header: "URL", value: (r) => r.url },
  { header: "Status code", value: (r) => r.statusCode },
  { header: "Title", value: (r) => r.title },
  { header: "Title length", value: (r) => r.titleLength },
  { header: "Meta description length", value: (r) => r.metaDescLength },
  { header: "H1 count", value: (r) => r.h1Count },
  { header: "Word count", value: (r) => r.wordCount },
  { header: "Depth", value: (r) => r.depth },
  { header: "Internal links", value: (r) => r.internalLinks },
  { header: "Inlinks", value: (r) => r.inlinkCount },
  { header: "In sitemap", value: (r) => r.inSitemap },
  { header: "Canonical", value: (r) => r.canonical },
  { header: "Redirect target", value: (r) => r.redirectTarget },
  { header: "Content type", value: (r) => r.contentType },
  { header: "Found on", value: (r) => r.foundOn },
];

// ─── Phase 3a: Issues by rule ───────────────────────────────────────────────

/** One row of the Issues tab. */
export interface RuleListRow {
  ruleId: string;
  family: string | null;
  kind: string;
  priority: string;
  urls: number;
  share: number;
}

export const RULE_LIST_COLUMNS: CsvColumn<RuleListRow>[] = [
  { header: "Issue", value: (r) => RULE_COPY[r.ruleId]?.name ?? r.ruleId },
  { header: "Rule id", value: (r) => r.ruleId },
  { header: "Family", value: (r) => r.family },
  { header: "Kind", value: (r) => r.kind },
  { header: "Priority", value: (r) => r.priority },
  { header: "URLs", value: (r) => r.urls },
  { header: "% of crawled", value: (r) => r.share },
];

/** One finding of one rule, as the per-rule page list selects it. */
export interface RulePageRow {
  id: string;
  ruleId: string | null;
  type: string;
  evidence: unknown;
  detail: string | null;
  crawlPage: { url: string; statusCode: number | null; foundOn: string | null };
}

/** Evidence as "key: value · key: value"; pre-3a rows fall back to their detail string. */
export function evidenceCell(r: Pick<RulePageRow, "evidence" | "detail">): string | null {
  const e = r.evidence as Record<string, unknown> | null;
  if (!e || typeof e !== "object") return r.detail;
  return Object.entries(e)
    .filter(([, v]) => v !== null && v !== "")
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(" · ");
}

/**
 * Per-rule page list columns. Evidence carries crawled-page text (a title, a
 * canonical) — untrusted, which the serializer's formula guard handles.
 */
export const RULE_PAGE_COLUMNS: CsvColumn<RulePageRow>[] = [
  { header: "URL", value: (r) => r.crawlPage.url },
  { header: "Status code", value: (r) => r.crawlPage.statusCode },
  { header: "Rule id", value: (r) => r.ruleId ?? r.type },
  { header: "Issue", value: (r) => RULE_COPY[r.ruleId ?? ""]?.name ?? r.type },
  { header: "Evidence", value: (r) => evidenceCell(r) },
  { header: "Found on", value: (r) => r.crawlPage.foundOn },
];

// ─── Phase 4a: link graph exports ───────────────────────────────────────────

/** One internal link to a broken URL: the page it is on, where it points, the anchor, the status. */
export interface BrokenLinkRow {
  id: string;
  source: string;
  target: string;
  anchor: string | null;
  statusCode: number | null;
}

/** Anchors and URLs are crawled-site text: untrusted, formula-guarded by the serializer. */
export const BROKEN_LINK_COLUMNS: CsvColumn<BrokenLinkRow>[] = [
  { header: "Source URL", value: (r) => r.source },
  { header: "Broken URL", value: (r) => r.target },
  { header: "Anchor text", value: (r) => r.anchor },
  // No status = no response at all (timeout, DNS, refused).
  { header: "Status code", value: (r) => r.statusCode ?? "no response" },
];

/** One redirecting URL with every hop. */
export interface RedirectChainRow {
  id: string;
  url: string;
  foundOn: string | null;
  redirectChain: unknown;
}

function hops(r: RedirectChainRow): { url: string; status: number }[] {
  return Array.isArray(r.redirectChain) ? (r.redirectChain as { url: string; status: number }[]) : [];
}

export const REDIRECT_CHAIN_COLUMNS: CsvColumn<RedirectChainRow>[] = [
  { header: "URL", value: (r) => r.url },
  { header: "Redirects", value: (r) => Math.max(0, hops(r).length - 1) },
  { header: "First status", value: (r) => hops(r)[0]?.status ?? null },
  { header: "Final URL", value: (r) => hops(r).at(-1)?.url ?? null },
  { header: "Final status", value: (r) => hops(r).at(-1)?.status || null },
  { header: "Chain", value: (r) => hops(r).map((h) => `${h.url} (${h.status || "no response"})`).join(" → ") },
  { header: "Found on", value: (r) => r.foundOn },
];

/** One page linking to another (the Inlinks panel's export). */
export interface InlinkRow {
  id: string;
  source: string;
  anchor: string | null;
  nofollow: boolean;
}

export const INLINK_COLUMNS: CsvColumn<InlinkRow>[] = [
  { header: "Source URL", value: (r) => r.source },
  { header: "Anchor text", value: (r) => r.anchor },
  { header: "Nofollow", value: (r) => r.nofollow },
];

/** A page's count for one search, or null when it was not searched (non-HTML, pre-4b). */
export function searchCount(hits: unknown, index: number): number | null {
  if (!hits || typeof hits !== "object") return null;
  const n = (hits as Record<string, unknown>)[String(index)];
  return typeof n === "number" ? n : null;
}

/** The pages export plus one count column per custom search (Phase 4b), headed "Search: <name>". */
export function pageColumns(searchNames: readonly string[]): CsvColumn<CrawlPageRow>[] {
  return [
    ...PAGE_COLUMNS,
    ...searchNames.map((name, i): CsvColumn<CrawlPageRow> => ({ header: `Search: ${name}`, value: (r) => searchCount(r.searchHits, i) })),
  ];
}

/** Phase 4b: one HTML page and what each extractor found on it (null = nothing). */
export interface ExtractionRow {
  id: string;
  url: string;
  values: (string[] | null)[];
  /** Phase 4b segments, as names. */
  segment: string;
}

/** URL, one column per extractor (values " | "-joined), then segment. Headers are the extractor names. */
export function extractionColumns(names: readonly string[]): CsvColumn<ExtractionRow>[] {
  return [
    { header: "URL", value: (r) => r.url },
    ...names.map((name, i): CsvColumn<ExtractionRow> => ({ header: name, value: (r) => r.values[i]?.join(" | ") ?? "" })),
    { header: "Segment", value: (r) => r.segment },
  ];
}
