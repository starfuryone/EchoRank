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
  crawlPage: { url: string; statusCode: number | null };
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
];
