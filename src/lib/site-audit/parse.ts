// src/lib/site-audit/parse.ts
//
// OnPage summary/pages results -> our persisted section shapes. Pure functions,
// no I/O, so tests can run them against the recorded envelopes with no network
// and no database.
//
// Everything upstream is optional (DataForSEO types almost every field as
// nullable), so every field lands through a coercion helper rather than a cast.
// Zero invented numbers: a missing metric becomes 0 / null, never a guess.

import {
  checkDefinition,
  METRIC_ISSUES,
  SEVERITY_ORDER,
  type IssueSeverity,
} from "./checks";
import { MAX_PAGE_ROWS } from "./options";
import type {
  IssueRow,
  IssuesSection,
  PageRow,
  PagesSection,
  SummarySection,
} from "./types";

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function maybeNum(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// ─── on_page/summary ────────────────────────────────────────────────────────

export interface RawSummaryResult {
  crawl_progress?: string;
  crawl_status?: { max_crawl_pages?: number; pages_in_queue?: number; pages_crawled?: number };
  domain_info?: {
    name?: string;
    checks?: Record<string, boolean>;
    total_pages?: number;
    page_not_found_status_code?: number;
    ssl_info?: { valid_certificate?: boolean };
  };
  page_metrics?: {
    links_external?: number;
    links_internal?: number;
    duplicate_title?: number;
    duplicate_description?: number;
    duplicate_content?: number;
    broken_links?: number;
    broken_resources?: number;
    onpage_score?: number;
    non_indexable?: number;
    checks?: Record<string, number>;
  };
}

/** "in_progress" | "finished" — the only signal that a crawl is done. */
export function crawlProgress(result: RawSummaryResult | undefined): string {
  return str(result?.crawl_progress);
}

export function crawlIsFinished(result: RawSummaryResult | undefined): boolean {
  return crawlProgress(result) === "finished";
}

export function pagesCrawledFrom(result: RawSummaryResult | undefined): number {
  return num(result?.crawl_status?.pages_crawled);
}

export function parseSummary(result: RawSummaryResult | undefined): SummarySection {
  const metrics = result?.page_metrics ?? {};
  const checks = metrics.checks ?? {};
  const crawl = result?.crawl_status ?? {};

  return {
    // onpage_score is 0–100 already, unlike Lighthouse's 0–1.
    onPageScore: maybeNum(metrics.onpage_score),
    pagesCrawled: num(crawl.pages_crawled),
    pagesInQueue: num(crawl.pages_in_queue),
    pagesTotal: num(result?.domain_info?.total_pages),
    brokenLinks: num(metrics.broken_links),
    brokenResources: num(metrics.broken_resources),
    duplicateTitles: num(metrics.duplicate_title),
    duplicateDescriptions: num(metrics.duplicate_description),
    duplicateContent: num(metrics.duplicate_content),
    // The 4xx/5xx and redirect totals live in the checks block, not as
    // first-class metrics.
    responses4xx: num(checks.is_4xx_code),
    responses5xx: num(checks.is_5xx_code),
    redirects: num(checks.is_redirect),
    medianLoadTimeMs: null,
  };
}

/**
 * Problem checks with a non-zero count, worst severity first.
 *
 * Only checks in our catalogue appear — see checks.ts for why classifying
 * every key generically would report good things as issues. Anything
 * unrecognised is collected into `unclassified` rather than dropped silently,
 * so a new upstream check is visible rather than invisible.
 */
export function parseIssues(result: RawSummaryResult | undefined): IssuesSection {
  const metrics = result?.page_metrics ?? {};
  const checks = metrics.checks ?? {};
  const items: IssueRow[] = [];
  const unclassified: string[] = [];
  const totals: Record<IssueSeverity, number> = { error: 0, warning: 0, notice: 0 };
  const seen = new Set<string>();

  const add = (key: string, count: number) => {
    if (count <= 0 || seen.has(key)) return;
    const definition = checkDefinition(key);
    if (!definition) {
      unclassified.push(key);
      return;
    }
    seen.add(key);
    items.push({ key, severity: definition.severity, group: definition.group, count });
    totals[definition.severity] += count;
  };

  // Duplicates and broken links are NOT in the `checks` block — they are
  // first-class page_metrics fields. Reading only `checks` silently dropped
  // duplicate_title on 20 of 25 pages in the verification crawl.
  const metricCounts: Record<string, unknown> = {
    duplicate_title: metrics.duplicate_title,
    duplicate_description: metrics.duplicate_description,
    duplicate_content: metrics.duplicate_content,
    broken_links: metrics.broken_links,
    broken_resources: metrics.broken_resources,
    non_indexable: metrics.non_indexable,
  };
  for (const key of Object.keys(METRIC_ISSUES)) add(key, num(metricCounts[key]));

  for (const [key, rawCount] of Object.entries(checks)) add(key, num(rawCount));

  items.sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
      b.count - a.count ||
      a.key.localeCompare(b.key),
  );

  return { items, totals, unclassified: unclassified.sort() };
}

// ─── on_page/pages ──────────────────────────────────────────────────────────

interface RawPage {
  url?: string;
  status_code?: number;
  onpage_score?: number;
  /** Per-page check results: key -> boolean. TRUE means the condition HOLDS
   * (so for a problem check, true = the page has the problem). */
  checks?: Record<string, boolean>;
  /** No `duration_time` here despite the name appearing on other endpoints —
   * the real keys are dom_complete / time_to_interactive (verified live). */
  page_timing?: { dom_complete?: number; time_to_interactive?: number };
  meta?: { title?: string };
}

/**
 * Per-page rows, worst first.
 *
 * NOTE the polarity flip: in `on_page/pages`, a page's `checks` map is
 * key -> BOOLEAN, and the boolean is TRUE when the check's condition holds.
 * For a problem check ("is_4xx_code": true) that means the page has the
 * problem — the opposite of a "passed" flag. Treating true as "passed" would
 * invert the entire table.
 */
export function parsePages(
  result: { items?: RawPage[]; total_items_count?: number }[] | undefined,
): PagesSection {
  const first = result?.[0];
  const items: PageRow[] = (first?.items ?? [])
    .map((page): PageRow => {
      const failed = Object.entries(page.checks ?? {})
        .filter(([key, isTrue]) => isTrue === true && checkDefinition(key) !== null)
        .map(([key]) => key)
        .sort((a, b) => {
          const sa = checkDefinition(a)!.severity;
          const sb = checkDefinition(b)!.severity;
          return SEVERITY_ORDER.indexOf(sa) - SEVERITY_ORDER.indexOf(sb) || a.localeCompare(b);
        });

      return {
        url: str(page.url),
        onPageScore: maybeNum(page.onpage_score),
        statusCode: maybeNum(page.status_code),
        failedChecks: failed,
        issueCount: failed.length,
        loadTimeMs: maybeNum(
          page.page_timing?.dom_complete ?? page.page_timing?.time_to_interactive,
        ),
      };
    })
    .filter((row) => row.url.length > 0)
    // Most problems first; ties broken by the worse OnPage score.
    .sort((a, b) => b.issueCount - a.issueCount || (a.onPageScore ?? 100) - (b.onPageScore ?? 100))
    .slice(0, MAX_PAGE_ROWS);

  // `total_items_count`, NOT `total_count` — the latter is absent on this
  // endpoint and read 0 for a 25-page crawl.
  return { items, totalCount: num(first?.total_items_count) };
}
