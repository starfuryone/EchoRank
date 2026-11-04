"use client";

// The Pages view: /crawler/[id]/pages on its own, and the Results page's Pages
// tab. A hero (eyebrow, title, "{n} pages crawled · date"), one card with a
// server-side search (URL or title, debounced) and a scope select (all,
// indexable, non-indexable, errors, redirects, orphans, a segment), then the
// table: Page (path, title under it), Status pill, Issues (high-priority count
// as a red superscript), Page score pill, Inlinks, Link Score, an arrow to the
// page's detail panel. Status, issues, score, inlinks and link score sort from
// their headers; the Phase 4d metric groups and the crawl details sit behind a
// "Columns" menu, off by default. 50 rows a page on a server cursor; sticky
// header; cards instead of the table under sm. Export CSV carries the active
// filters. The older filters (sitemap, depth, inlinks, URL prefix, custom
// search) sit under "More filters".
//
// Page score (site-health.ts pageScore): 100 − 10 × weighted findings on the
// page (high 3, medium 1, low 0.25), at least 0. Written to crawl_pages in the
// summary pass, so it sorts and stays the same between visits.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Download, SlidersHorizontal, X } from "lucide-react";
import { RULE_COPY } from "@/lib/crawl-rules-meta";
import { flag } from "@/lib/flags";
import type { DashLocale, SiteCrawlerCopy } from "@/lib/i18n/dashboard";
import type { MetricSource } from "@/lib/site-crawler/metrics-shared";
import { scoreBand } from "@/lib/site-crawler/site-health";
import { EMPTY_PAGE_FILTERS, pageFilterParams, type CrawlDto, type CrawlPageDetail, type CrawlPagesPage, type PageFilters } from "@/lib/site-crawler/types";
import { InlinksPanel } from "./site-crawler-inlinks";
import { MetricHeader, columnsOf, formatMetric, sourceLabel, sourcesIn } from "./site-crawler-metrics";
import { CRAWLER_ROUTES, hostOfCrawl } from "./site-crawler-nav";
import { searchHitsText } from "./site-crawler-panels";

export const PAGES_PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;
const SCOPES = ["indexable", "nonindexable", "errors", "redirects", "orphans"] as const;

type Row = CrawlPagesPage["pages"][number];

/** The path (and query) of a URL; the whole URL when it does not parse. */
export function pagePath(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}` || "/";
  } catch {
    return url;
  }
}

/** Status pill tone: 2xx emerald, 3xx amber, 4xx/5xx red, none gray. Text ≥ 4.5:1 on its tint. */
export function statusTone(code: number | null | undefined): string {
  if (code === null || code === undefined) return "bg-gray-100 text-gray-700";
  if (code >= 200 && code < 300) return "bg-emerald-50 text-emerald-800";
  if (code >= 300 && code < 400) return "bg-amber-50 text-amber-800";
  return "bg-red-50 text-red-700";
}

const SCORE_TONE = { good: "bg-emerald-50 text-emerald-800", fair: "bg-amber-50 text-amber-800", poor: "bg-red-50 text-red-700" } as const;

export function ScorePill({ score, u, int }: { score: number | null | undefined; u: SiteCrawlerCopy["ux"]; int: Intl.NumberFormat }) {
  if (score === null || score === undefined) return <span className="text-gray-600">{u.healthNone}</span>;
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${SCORE_TONE[scoreBand(score)]}`}
      data-score-band={scoreBand(score)}
    >
      {u.healthScore(int.format(score))}
    </span>
  );
}

function StatusPill({ code }: { code: number | null | undefined }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${statusTone(code)}`}>{code ?? "—"}</span>;
}

function IssuesCell({ row, u, int }: { row: Row; u: SiteCrawlerCopy["ux"]; int: Intl.NumberFormat }) {
  const total = row.issueTotal ?? row.issueCount;
  const high = row.issueHigh ?? 0;
  return (
    <span className="tabular-nums text-gray-900" data-issues>
      {int.format(total)}
      {high > 0 && (
        <sup className="ml-0.5 font-semibold text-red-700" data-high>
          <span aria-hidden="true">{int.format(high)}</span>
          <span className="sr-only"> ({u.highCount(int.format(high))})</span>
        </sup>
      )}
    </span>
  );
}

// ── Detail panel ─────────────────────────────────────────────────────────────

const KIND_DOT = { issue: "bg-red-500", warning: "bg-amber-500", opportunity: "bg-blue-500" } as const;

function evidenceText(e: Record<string, unknown>): string {
  return Object.entries(e)
    .filter(([, v]) => v !== null && v !== "" && v !== undefined)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ");
}

export interface ExtractionNames {
  extract: string[];
  js: string[];
  ai: string[];
}

/** Extractor, JS snippet and AI prompt names of a crawl, by kind and index (detail panel labels). */
export function extractionNamesOf(config: CrawlDto["config"] | undefined, t: SiteCrawlerCopy): ExtractionNames {
  return {
    extract: (config?.extractors ?? []).map((e) => e.name),
    js: (config?.js ?? []).map((s) => `JS: ${s.name}`),
    ai: (config?.ai?.prompts ?? []).map((p, i) => `AI: ${p.preset === "custom" ? `${t.p4e.aiPresets.custom} ${i + 1}` : t.p4e.aiPresets[p.preset]}`),
  };
}

export function PageDetail({
  crawlId,
  pageId,
  onClose,
  extractionNames,
  linksOn,
  t,
  int,
}: {
  crawlId: string;
  pageId: string;
  onClose: () => void;
  extractionNames: ExtractionNames;
  linksOn: boolean;
  t: SiteCrawlerCopy;
  int: Intl.NumberFormat;
}) {
  const u = t.ux;
  const [data, setData] = useState<CrawlPageDetail | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/seo/v1/crawl/${crawlId}/pages/${encodeURIComponent(pageId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: CrawlPageDetail | null) => {
        if (!cancelled) setData(d);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [crawlId, pageId]);

  // Focus into the dialog; give it back to the opener on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();
    return () => opener?.focus?.();
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !panel.current) return;
    // Keep Tab inside the dialog.
    const f = [
      ...panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"]), summary'),
    ].filter((x) => !x.closest("[hidden]"));
    if (f.length === 0) return;
    const first = f[0]!;
    const last = f[f.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const p = data?.page;
  const metricSources = data ? (Object.keys(data.metrics) as MetricSource[]) : [];
  const nameOf = (kind: "extract" | "js" | "ai", i: number) => extractionNames[kind][i] ?? `${kind} ${i + 1}`;
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-gray-900/30" onClick={onClose} data-testid="page-detail-backdrop">
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="page-detail-title"
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-xl"
        data-testid="page-detail"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="page-detail-title" className="break-all text-base font-semibold text-gray-900">
              {p ? pagePath(p.url) : "…"}
            </h2>
            {p && <p className="break-all text-xs text-gray-600">{p.url}</p>}
          </div>
          <button
            ref={closeBtn}
            type="button"
            aria-label={u.detailClose}
            onClick={onClose}
            className="rounded p-1.5 text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <X className="h-4 w-4" aria-hidden="true" focusable="false" />
          </button>
        </div>

        {p && data && (
          <div className="mt-4 space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill code={p.statusCode} />
              <ScorePill score={p.pageScore} u={u} int={int} />
              {p.noindex && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{u.detailNoindex}</span>}
            </div>
            <p className="text-xs text-gray-600" data-testid="score-formula">
              {u.scoreFormula}
            </p>

            <section aria-labelledby="pd-issues">
              <h3 id="pd-issues" className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                {u.detailIssues}
              </h3>
              {data.issues.length === 0 ? (
                <p className="mt-1 text-sm text-gray-600">{u.detailNoIssues}</p>
              ) : (
                <ul className="mt-2 divide-y divide-gray-100" data-testid="page-issues">
                  {data.issues.map((i) => {
                    const copy = RULE_COPY[i.ruleId];
                    const ev = evidenceText(i.evidence ?? {});
                    return (
                      <li key={i.id} className="py-2">
                        <p className="flex items-center gap-2 text-sm">
                          <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${KIND_DOT[i.kind] ?? "bg-gray-500"}`} />
                          <span className="font-medium text-gray-900">{copy?.name ?? i.ruleId}</span>
                          <span className="text-xs text-gray-600">
                            {i.priority === "high" ? t.priorityHigh : i.priority === "medium" ? t.priorityMedium : t.priorityLow}
                          </span>
                        </p>
                        {ev && <p className="mt-0.5 break-all pl-4 text-xs text-gray-600">{ev}</p>}
                        {copy?.howToFix && (
                          <details className="mt-1 pl-4">
                            <summary className="cursor-pointer text-xs font-medium text-blue-700">{t.rulesHowToFix}</summary>
                            <p className="mt-1 text-sm text-gray-700">{copy.howToFix}</p>
                          </details>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {data.issuesTruncated && <p className="mt-1 text-xs text-gray-600">{u.detailTruncated}</p>}
            </section>

            <section aria-labelledby="pd-facts">
              <h3 id="pd-facts" className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                {u.detailFacts}
              </h3>
              <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
                {(
                  [
                    [u.detailTitle, p.title],
                    [u.detailMeta, p.metaDescription],
                    [u.detailH1, p.h1First],
                    [u.detailCanonical, p.canonical],
                    [u.detailRedirect, p.redirectTarget],
                    [t.colDepth, int.format(p.depth)],
                    [u.colInlinks, p.inlinkCount === null ? null : int.format(p.inlinkCount)],
                    [u.detailWords, p.wordCount === null ? null : int.format(p.wordCount)],
                    [u.detailFetch, p.fetchMs === null ? null : u.detailFetchMs(int.format(p.fetchMs))],
                    [t.colSitemap, p.inSitemap === null ? null : p.inSitemap ? t.filterYes : t.filterNo],
                    [t.p4a.colFoundOn, p.foundOn ?? null],
                    ...(flag("crawl.linkScore")
                      ? [[t.p4g.colLinkScore, p.linkScore === null || p.linkScore === undefined ? null : p.linkScore.toFixed(1)] as const]
                      : []),
                  ] as const
                )
                  .filter(([, v]) => v !== null && v !== undefined && v !== "")
                  .map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-gray-600">{k}</dt>
                      <dd className="break-words text-gray-900">{v}</dd>
                    </div>
                  ))}
              </dl>
            </section>

            {linksOn && (p.inlinkCount ?? 0) > 0 && <InlinksPanel crawlId={crawlId} page={{ id: p.id, url: p.url }} t={t.p4a} />}

            {metricSources.length > 0 && (
              <section aria-labelledby="pd-metrics">
                <h3 id="pd-metrics" className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  {u.detailMetrics}
                </h3>
                {metricSources.map((s) => (
                  <div key={s} className="mt-2">
                    <p className="text-xs font-medium text-gray-700">{sourceLabel(s, t.p4d)}</p>
                    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 text-sm">
                      {columnsOf([s]).map((c) => {
                        const d = data.metrics[s] ?? null;
                        return (
                          <div key={c.key} className="contents">
                            <dt className="text-gray-600">{t.p4d.colLabels[c.key] ?? c.header}</dt>
                            <dd className="tabular-nums text-gray-900">{c.text ? (c.text(d) ?? "—") : formatMetric(c.key, c.value(d), int)}</dd>
                          </div>
                        );
                      })}
                    </dl>
                  </div>
                ))}
              </section>
            )}

            {data.extractions.length > 0 && (
              <section aria-labelledby="pd-extraction">
                <h3 id="pd-extraction" className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  {u.detailExtraction}
                </h3>
                <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
                  {data.extractions.map((x) => (
                    <div key={`${x.kind}-${x.index}`} className="contents">
                      <dt className="text-gray-600">{nameOf(x.kind, x.index)}</dt>
                      <dd className="break-words text-gray-900">{x.values.length ? x.values.join(" | ") : "—"}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── The view ─────────────────────────────────────────────────────────────────

const SELECT = "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";
const INPUT =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";
const SMALL_LINK =
  "inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

export function PagesView({
  crawlId,
  crawl,
  locale,
  t,
  int,
  segmentNames = [],
  segment = "",
  onSegment,
  standalone = false,
  initialFilters = EMPTY_PAGE_FILTERS,
  searchNames = [],
  extractionNames = { extract: [], js: [], ai: [] },
  linksOn = false,
}: {
  crawlId: string;
  crawl: CrawlDto | null;
  locale: DashLocale;
  t: SiteCrawlerCopy;
  int: Intl.NumberFormat;
  segmentNames?: string[];
  /** Selected segment index as a string, "" = the whole crawl. */
  segment?: string;
  onSegment?: (value: string) => void;
  /** The /pages page: the title is the h1 and the host links to the full results. */
  standalone?: boolean;
  initialFilters?: PageFilters;
  /** Phase 4b custom searches, by index (a column and a filter). */
  searchNames?: string[];
  extractionNames?: ExtractionNames;
  /** The link graph is there: inlinks in the detail panel. */
  linksOn?: boolean;
}) {
  const u = t.ux;
  const [filters, setFilters] = useState<PageFilters>(initialFilters);
  const [qInput, setQInput] = useState(initialFilters.q ?? "");
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [data, setData] = useState<CrawlPagesPage | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [shown, setShown] = useState<string[]>([]);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const date = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }), [locale]);
  const cursor = cursors[cursors.length - 1] ?? null;

  const update = (f: PageFilters) => {
    setFilters(f);
    setCursors([null]);
  };

  // Debounced server-side search: one request when typing pauses.
  useEffect(() => {
    if ((filters.q ?? "") === qInput.trim()) return;
    const timer = setTimeout(() => update({ ...filters, q: qInput.trim() }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [qInput, filters]);

  const query = useMemo(() => {
    const params = pageFilterParams(filters);
    params.set("pageSize", String(PAGES_PAGE_SIZE));
    if (segment) params.set("segment", segment);
    return params;
  }, [filters, segment]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(query);
    if (cursor) params.set("cursor", cursor);
    void fetch(`/api/seo/v1/crawl/${crawlId}/pages?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: CrawlPagesPage | null) => {
        if (!cancelled) setData(d ?? { pages: [], page: 1, pageSize: PAGES_PAGE_SIZE, total: 0, totalPages: 1, nextCursor: null });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [crawlId, query, cursor]);

  const csvParams = new URLSearchParams(query);
  csvParams.delete("pageSize");
  csvParams.set("format", "csv");
  const csvHref = `/api/seo/v1/crawl/${crawlId}/pages?${csvParams}`;

  const rows = data?.pages ?? [];
  const sortSource = filters.sort && filters.sort.includes(".") ? (filters.sort.split(".")[0] as MetricSource) : null;
  const available = [...new Set([...sourcesIn(rows), ...(sortSource ? [sortSource] : [])])];
  const visibleSources = available.filter((s) => shown.includes(s) || s === sortSource);
  const metricCols = columnsOf(visibleSources);
  const crawlCols = shown.includes("crawl");
  const linkScoreOn = flag("crawl.linkScore");
  const onSort = (key: string, dir: "asc" | "desc") => update({ ...filters, sort: key, dir });
  const toggleShown = (k: string) => setShown((v) => (v.includes(k) ? v.filter((x) => x !== k) : [...v, k]));
  const pageIndex = cursors.length - 1;
  const from = data && data.total > 0 ? pageIndex * PAGES_PAGE_SIZE + 1 : 0;
  const to = data ? pageIndex * PAGES_PAGE_SIZE + rows.length : 0;
  const scopeValue = segment ? `seg:${segment}` : (filters.scope ?? "");
  const Title = standalone ? "h1" : "h2";
  const host = crawl ? hostOfCrawl(crawl.rootUrl) : "";
  const setF = (key: keyof PageFilters, value: string) => update({ ...filters, [key]: value });

  return (
    <section className="space-y-5" data-testid="pages-view" aria-labelledby="pages-title">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-widest text-gray-600">{u.pagesEyebrow}</p>
          <Title id="pages-title" className="mt-1 text-2xl font-semibold text-gray-900">
            {u.pagesTitle}
          </Title>
          <p className="mt-1 text-sm text-gray-600">{u.pagesSubhead}</p>
        </div>
        {crawl && (
          <div className="min-w-0 shrink-0 rounded-xl border border-gray-200 bg-white px-4 py-3 sm:max-w-xs" data-testid="pages-crawl-card">
            {standalone ? (
              <Link
                href={CRAWLER_ROUTES.results(crawl.id)}
                className="block truncate text-sm font-semibold text-gray-900 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {host}
              </Link>
            ) : (
              <p className="truncate text-sm font-semibold text-gray-900">{host}</p>
            )}
            <p className="text-xs text-gray-600">{u.pagesCrawledOn(int.format(crawl.pagesCrawled), date.format(new Date(crawl.createdAt)))}</p>
          </div>
        )}
      </header>

      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4" data-testid="pages-controls">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="pages-q" className="mb-1 block text-xs font-medium text-gray-700">
              {u.pagesSearchLabel}
            </label>
            <input
              id="pages-q"
              type="search"
              className={INPUT}
              value={qInput}
              placeholder={u.pagesSearchPlaceholder}
              onChange={(e) => setQInput(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="pages-scope" className="mb-1 block text-xs font-medium text-gray-700">
              {u.pagesScopeLabel}
            </label>
            <select
              id="pages-scope"
              className={`${SELECT} w-full md:w-auto`}
              value={scopeValue}
              onChange={(e) => {
                const v = e.target.value;
                if (v.startsWith("seg:")) {
                  onSegment?.(v.slice(4));
                  update({ ...filters, scope: "" });
                } else {
                  if (segment) onSegment?.("");
                  update({ ...filters, scope: v });
                }
              }}
            >
              <option value="">{u.scopeAll}</option>
              {SCOPES.map((s) => (
                <option key={s} value={s}>
                  {s === "indexable"
                    ? u.scopeIndexable
                    : s === "nonindexable"
                      ? u.scopeNonIndexable
                      : s === "errors"
                        ? u.scopeErrors
                        : s === "redirects"
                          ? u.scopeRedirects
                          : u.scopeOrphans}
                </option>
              ))}
              {onSegment &&
                segmentNames.map((n, i) => (
                  <option key={`seg-${i}`} value={`seg:${i}`}>
                    {u.scopeSegment(n)}
                  </option>
                ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" aria-expanded={columnsOpen} aria-controls="pages-columns" onClick={() => setColumnsOpen((o) => !o)} className={SMALL_LINK}>
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" focusable="false" />
              {u.columnsMenu}
            </button>
            <a href={csvHref} className={SMALL_LINK} data-testid="pages-csv">
              <Download className="h-4 w-4" aria-hidden="true" focusable="false" />
              {t.exportCsv}
            </a>
          </div>
        </div>

        <fieldset id="pages-columns" hidden={!columnsOpen} className="flex flex-wrap gap-x-4 gap-y-2 border-t border-gray-100 pt-3" data-testid="pages-columns">
          <legend className="sr-only">{u.columnsMenu}</legend>
          {[["crawl", u.colGroupCrawl] as const, ...available.map((s) => [s, sourceLabel(s, t.p4d)] as const)].map(([k, label]) => (
            <label key={k} className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={k === "crawl" ? crawlCols : visibleSources.includes(k as MetricSource)} onChange={() => toggleShown(k)} />
              {label}
            </label>
          ))}
        </fieldset>

        <details className="border-t border-gray-100 pt-3" data-testid="pages-more-filters">
          <summary className="cursor-pointer text-sm font-medium text-gray-700">{u.moreFilters}</summary>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="pages-sitemap" className="mb-1 block text-xs font-medium text-gray-700">
                {t.filterSitemap}
              </label>
              <select id="pages-sitemap" className={SELECT} value={filters.inSitemap} onChange={(e) => setF("inSitemap", e.target.value)}>
                <option value="">{t.filterAll}</option>
                <option value="true">{t.filterYes}</option>
                <option value="false">{t.filterNo}</option>
              </select>
            </div>
            <div className="w-28">
              <label htmlFor="pages-depth" className="mb-1 block text-xs font-medium text-gray-700">
                {t.filterDepth}
              </label>
              <input
                id="pages-depth"
                inputMode="numeric"
                className={INPUT}
                value={filters.depth}
                onChange={(e) => setF("depth", e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="w-36">
              <label htmlFor="pages-inlinks" className="mb-1 block text-xs font-medium text-gray-700">
                {t.filterInlinks}
              </label>
              <input
                id="pages-inlinks"
                inputMode="numeric"
                className={INPUT}
                value={filters.minInlinks}
                onChange={(e) => setF("minInlinks", e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="w-72 max-w-full">
              <label htmlFor="pages-prefix" className="mb-1 block text-xs font-medium text-gray-700">
                {t.p4c.filterUrlPrefix}
              </label>
              <input id="pages-prefix" className={INPUT} value={filters.urlPrefix ?? ""} onChange={(e) => setF("urlPrefix", e.target.value)} />
            </div>
            {searchNames.length > 0 && (
              <div>
                <label htmlFor="pages-custom-search" className="mb-1 block text-xs font-medium text-gray-700">
                  {t.p4b.colSearch}
                </label>
                <select id="pages-custom-search" className={SELECT} value={filters.search} onChange={(e) => setF("search", e.target.value)}>
                  <option value="">{t.p4b.filterSearchAll}</option>
                  {searchNames.flatMap((n, i) => [
                    <option key={`${i}h`} value={`${i}:hit`}>
                      {t.p4b.filterSearchHit(n)}
                    </option>,
                    <option key={`${i}n`} value={`${i}:none`}>
                      {t.p4b.filterSearchNone(n)}
                    </option>,
                  ])}
                </select>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setQInput("");
                update({ ...EMPTY_PAGE_FILTERS, sort: filters.sort, dir: filters.dir });
              }}
              className={SMALL_LINK}
            >
              {t.filterClear}
            </button>
          </div>
        </details>

        {filters.rule && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-gray-700" data-testid="pages-rule-filter">
            {u.pagesRuleFilter(RULE_COPY[filters.rule]?.name ?? filters.rule)}
            <button
              type="button"
              onClick={() => setF("rule", "")}
              className="rounded px-1.5 text-sm font-medium text-blue-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {u.clearFilter}
            </button>
          </p>
        )}
      </div>

      {data && rows.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white py-10 text-center text-sm text-gray-600" data-testid="pages-empty">
          {t.noPages}
        </p>
      ) : (
        data && (
          <>
            {/* sm and up: the table, its header sticky inside its own scroll box. */}
            <div className="hidden max-h-[70vh] overflow-auto rounded-xl border border-gray-200 bg-white sm:block">
              <table className="w-full text-left text-sm" data-testid="pages-table">
                <thead className="sticky top-0 z-10 bg-gray-50 text-xs text-gray-600">
                  <tr>
                    <th scope="col" className="py-2 pl-4 pr-3 font-medium uppercase tracking-wide">
                      {u.colPage}
                    </th>
                    <MetricHeader colKey="status" label={u.colStatus} sort={filters.sort} dir={filters.dir} onSort={onSort} />
                    <MetricHeader colKey="issues" label={u.colIssues} sort={filters.sort} dir={filters.dir} onSort={onSort} />
                    <MetricHeader colKey="score" label={u.colScore} sort={filters.sort} dir={filters.dir} onSort={onSort} />
                    <MetricHeader colKey="inlinks" label={u.colInlinks} sort={filters.sort} dir={filters.dir} onSort={onSort} />
                    {linkScoreOn && <MetricHeader colKey="linkScore" label={t.p4g.colLinkScore} sort={filters.sort} dir={filters.dir} onSort={onSort} />}
                    {crawlCols && (
                      <>
                        <th scope="col" className="py-2 pr-3 font-medium uppercase tracking-wide">
                          {t.colDepth}
                        </th>
                        <th scope="col" className="py-2 pr-3 font-medium uppercase tracking-wide">
                          {t.colSitemap}
                        </th>
                        <th scope="col" className="py-2 pr-3 font-medium uppercase tracking-wide">
                          {t.p4a.colFoundOn}
                        </th>
                        {searchNames.length > 0 && (
                          <th scope="col" className="py-2 pr-3 font-medium uppercase tracking-wide">
                            {t.p4b.colSearch}
                          </th>
                        )}
                      </>
                    )}
                    {metricCols.map((c) => (
                      <MetricHeader
                        key={c.key}
                        colKey={c.key}
                        label={t.p4d.colLabels[c.key] ?? c.header}
                        sort={filters.sort}
                        dir={filters.dir}
                        onSort={onSort}
                      />
                    ))}
                    <th scope="col" className="py-2 pr-4">
                      <span className="sr-only">{u.colDetails}</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r) => {
                    const path = pagePath(r.url);
                    return (
                      <tr key={r.id} data-page={r.id} onClick={() => setDetail(r.id)} className="cursor-pointer hover:bg-gray-50">
                        <td className="max-w-md py-2 pl-4 pr-3">
                          <span className="block truncate font-semibold text-gray-900" title={r.url}>
                            {path}
                          </span>
                          {r.title && <span className="block truncate text-xs text-gray-500">{r.title}</span>}
                        </td>
                        <td className="py-2 pr-3">
                          <StatusPill code={r.statusCode} />
                        </td>
                        <td className="py-2 pr-3">
                          <IssuesCell row={r} u={u} int={int} />
                        </td>
                        <td className="py-2 pr-3">
                          <ScorePill score={r.pageScore} u={u} int={int} />
                        </td>
                        <td className="py-2 pr-3 tabular-nums text-gray-700">{r.inlinkCount === null ? "—" : int.format(r.inlinkCount)}</td>
                        {linkScoreOn && (
                          <td className="py-2 pr-3 tabular-nums text-gray-700">
                            {r.linkScore === null || r.linkScore === undefined ? "—" : r.linkScore.toFixed(1)}
                          </td>
                        )}
                        {crawlCols && (
                          <>
                            <td className="py-2 pr-3 tabular-nums text-gray-700">{int.format(r.depth)}</td>
                            <td className="py-2 pr-3 text-gray-700">{r.inSitemap === null ? "—" : r.inSitemap ? t.filterYes : t.filterNo}</td>
                            <td className="max-w-xs py-2 pr-3">
                              <span className="block truncate text-gray-700" title={r.foundOn ?? undefined}>
                                {r.foundOn ?? "—"}
                              </span>
                            </td>
                            {searchNames.length > 0 && <td className="py-2 pr-3 text-xs text-gray-700">{searchHitsText(r.searchHits, searchNames, int)}</td>}
                          </>
                        )}
                        {metricCols.map((c) => (
                          <td key={c.key} className="py-2 pr-3 tabular-nums text-gray-700">
                            {c.text ? (c.text(r.metrics?.[c.source] ?? null) ?? "—") : formatMetric(c.key, c.value(r.metrics?.[c.source] ?? null), int)}
                          </td>
                        ))}
                        <td className="py-2 pr-4 text-right">
                          <button
                            type="button"
                            aria-label={u.openPage(path)}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDetail(r.id);
                            }}
                            className="rounded p-1 text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                          >
                            <ChevronRight className="h-4 w-4" aria-hidden="true" focusable="false" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Under sm: cards. */}
            <ul className="space-y-2 sm:hidden" data-testid="pages-cards">
              {rows.map((r) => {
                const path = pagePath(r.url);
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setDetail(r.id)}
                      aria-label={u.openPage(path)}
                      className="w-full rounded-xl border border-gray-200 bg-white p-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <span className="block truncate font-semibold text-gray-900">{path}</span>
                      {r.title && <span className="block truncate text-xs text-gray-500">{r.title}</span>}
                      <span className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-700">
                        <StatusPill code={r.statusCode} />
                        <span>
                          {u.colIssues}: <IssuesCell row={r} u={u} int={int} />
                        </span>
                        <ScorePill score={r.pageScore} u={u} int={int} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {(data.nextCursor || pageIndex > 0) && (
              <div className="flex items-center justify-between" data-testid="pages-pager">
                <button type="button" className={SMALL_LINK} disabled={pageIndex === 0} onClick={() => setCursors((s) => (s.length > 1 ? s.slice(0, -1) : s))}>
                  {t.prevPage}
                </button>
                <span className="text-xs text-gray-600">{u.pagesRange(int.format(from), int.format(to), int.format(data.total))}</span>
                <button
                  type="button"
                  className={SMALL_LINK}
                  disabled={!data.nextCursor}
                  onClick={() => data.nextCursor && setCursors((s) => [...s, data.nextCursor!])}
                >
                  {t.nextPage}
                </button>
              </div>
            )}
          </>
        )
      )}

      {detail && (
        <PageDetail crawlId={crawlId} pageId={detail} onClose={() => setDetail(null)} extractionNames={extractionNames} linksOn={linksOn} t={t} int={int} />
      )}
    </section>
  );
}
