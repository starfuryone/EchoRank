// src/lib/site-crawler/sheets-layout.ts
//
// The Google Sheets export layout (Phase 4c): tab names and header rows.
// Dependency-free, ONE source: the exporter (sheets.ts) writes these headers
// and the Looker Studio help article (help-articles-crawler.ts) documents
// them, so the guide cannot describe a column the sheet does not have.

export const SHEET_TABS = ["Summary", "Issues", "Pages", "Compare"] as const;

export const SUMMARY_HEADER = [
  "Crawl date (UTC)",
  "Host",
  "Start URL",
  "Crawl ID",
  "Pages crawled",
  "Indexable pages",
  "4xx/5xx pages",
  "Redirects",
  "Errors",
  "Warnings",
  "Notices",
  "Compared with (date)",
  "Pages added",
  "Pages removed",
  "Pages changed",
  "New issues",
  "Resolved issues",
] as const;
export const ISSUES_HEADER = ["Crawl ID", "Rule ID", "Issue", "Kind", "Priority", "Findings"] as const;
export const PAGES_HEADER = ["Crawl ID", "URL", "Status", "Indexable", "Title", "Depth", "Inlinks", "Word count", "In sitemap"] as const;
export const COMPARE_HEADER = ["Crawl ID", "Compared with", "Measure", "Value"] as const;

/** Rows the Pages tab holds at most (one export). */
export const SHEETS_PAGE_ROWS = 50_000;
