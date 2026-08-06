"use client";

// Site Crawler — start a crawl, watch it run, read the issues.
//
// The defining constraint, same as Site Audit: a crawl OUTLIVES the page view.
// It can run for an hour. So nothing here depends on the tab staying open —
// the POST returns a queued row, the past-crawls list shows in-flight runs, and
// selecting one resumes polling from whatever state it is in.
//
// Every string comes from SITE_CRAWLER_COPY. The regression this guards
// against is a translated sidebar above an English body, which is why there is
// no inline English in the markup at all, including the issue-type labels.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Download, Loader2, Network } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDateTime } from "@/lib/utils";
import { ISSUE_TYPES, type Severity } from "@/lib/site-crawler/checks";
import {
  EMPTY_PAGE_FILTERS,
  isInFlight,
  type CrawlDto,
  type CrawlIssuePage,
  type CrawlListResponse,
  type CrawlPagesPage,
  type CrawlQuotaDto,
  type CrawlSummaryDto,
  type DuplicateKind,
  type DuplicatePage,
  type PageFilters,
  type RedirectPage,
} from "@/lib/site-crawler/types";
import {
  DuplicatesPanel,
  OverviewPanel,
  PagesPanel,
  RedirectsPanel,
} from "@/components/seo-tools/site-crawler-panels";
import { SITE_CRAWLER_COPY, type DashLocale, type SiteCrawlerCopy } from "@/lib/i18n/dashboard";

type TabId = "overview" | "issues" | "duplicates" | "redirects" | "pages";

const TABS: TabId[] = ["overview", "issues", "duplicates", "redirects", "pages"];

function tabLabel(id: TabId, t: SiteCrawlerCopy): string {
  if (id === "overview") return t.tabOverview;
  if (id === "issues") return t.tabIssues;
  if (id === "duplicates") return t.tabDuplicates;
  if (id === "redirects") return t.tabRedirects;
  return t.tabPages;
}

/** Poll cadence while a crawl is in flight, per spec. */
const POLL_MS = 3_000;
const ISSUE_PAGE_SIZE = 50;

const SEVERITIES: Severity[] = ["ERROR", "WARNING", "NOTICE"];

function severityLabel(severity: string, t: SiteCrawlerCopy): string {
  if (severity === "ERROR") return t.severityError;
  if (severity === "WARNING") return t.severityWarning;
  return t.severityNotice;
}

function severityTone(severity: string): "danger" | "warning" | "default" {
  if (severity === "ERROR") return "danger";
  if (severity === "WARNING") return "warning";
  return "default";
}

function statusLabel(status: string, t: SiteCrawlerCopy): string {
  switch (status) {
    case "QUEUED":
      return t.statusQueued;
    case "RUNNING":
      return t.statusRunning;
    case "COMPLETED":
      return t.statusCompleted;
    case "FAILED":
      return t.statusFailed;
    default:
      return t.statusCancelled;
  }
}

function stoppedLabel(reason: string | null, t: SiteCrawlerCopy): string | null {
  if (!reason) return null;
  if (reason === "url_cap") return t.stoppedUrlCap;
  if (reason === "time_cap") return t.stoppedTimeCap;
  if (reason === "cancelled") return t.stoppedCancelled;
  return reason; // a FAILED crawl carries its truncated error here
}

export function SiteCrawlerClient({ locale }: { locale: DashLocale }) {
  const t = SITE_CRAWLER_COPY[locale];
  const int = useMemo(() => new Intl.NumberFormat(locale === "en" ? "en-US" : locale), [locale]);

  const [quota, setQuota] = useState<CrawlQuotaDto | null>(null);
  const [crawls, setCrawls] = useState<CrawlDto[]>([]);
  const [active, setActive] = useState<CrawlDto | null>(null);
  const [issues, setIssues] = useState<CrawlIssuePage | null>(null);

  const [url, setUrl] = useState("");
  const [starting, setStarting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [severity, setSeverity] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);

  // ── Phase 2 tabs ────────────────────────────────────────────────────────
  // Each panel's data is fetched when its tab is first opened, not up front:
  // a crawl of 25,000 pages has four more endpoints behind it and nobody
  // opens all of them.
  const [tab, setTab] = useState<TabId>("overview");
  const [summary, setSummary] = useState<CrawlSummaryDto | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicatePage | null>(null);
  const [dupKind, setDupKind] = useState<DuplicateKind>("title");
  const [dupPage, setDupPage] = useState(1);
  const [redirects, setRedirects] = useState<RedirectPage | null>(null);
  const [redirectPage, setRedirectPage] = useState(1);
  const [pageRows, setPageRows] = useState<CrawlPagesPage | null>(null);
  const [pageFilters, setPageFilters] = useState<PageFilters>(EMPTY_PAGE_FILTERS);
  const [pagesPage, setPagesPage] = useState(1);

  /** Fetches; never sets state itself, so effects can decide when to apply. */
  const loadList = useCallback(async (): Promise<CrawlListResponse | null> => {
    const res = await fetch("/api/seo/v1/crawl");
    if (!res.ok) return null;
    return (await res.json()) as CrawlListResponse;
  }, []);

  const applyList = useCallback((data: CrawlListResponse) => {
    setQuota(data.quota);
    setCrawls(data.crawls);
    // Resume whatever is in flight, so a reload lands back on the live crawl.
    setActive(
      (current) =>
        current ?? data.crawls.find((c) => isInFlight(c.status)) ?? data.crawls[0] ?? null,
    );
  }, []);

  const refresh = useCallback(async () => {
    const data = await loadList();
    if (data) applyList(data);
  }, [loadList, applyList]);

  useEffect(() => {
    // Async IIFE: the setState calls land in a promise callback, not in the
    // effect body, which is what the react-hooks/set-state-in-effect rule is
    // asking for and also what makes the cancelled-unmount check possible.
    let cancelled = false;
    void (async () => {
      const loaded = await loadList();
      if (!cancelled && loaded) applyList(loaded);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadList, applyList]);

  // Poll the active crawl while it runs. Cleared as soon as it settles, so a
  // finished crawl costs no requests.
  useEffect(() => {
    if (!active || !isInFlight(active.status)) return;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/seo/v1/crawl/${active.id}`);
      if (!res.ok) return;
      const fresh: CrawlDto = await res.json();
      setActive(fresh);
      if (!isInFlight(fresh.status)) void refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [active, refresh]);

  const loadIssues = useCallback(
    async (crawlId: string, currentPage: number, sev: string, ty: string) => {
      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: String(ISSUE_PAGE_SIZE),
      });
      if (sev) params.set("severity", sev);
      if (ty) params.set("type", ty);
      const res = await fetch(`/api/seo/v1/crawl/${crawlId}/issues?${params}`);
      if (!res.ok) return null;
      return (await res.json()) as CrawlIssuePage;
    },
    [],
  );

  useEffect(() => {
    if (!active || isInFlight(active.status)) return;
    let cancelled = false;
    void (async () => {
      const data = await loadIssues(active.id, page, severity, type);
      if (!cancelled && data) setIssues(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [active, page, severity, type, loadIssues]);

  /** Fetch whichever tab is open. A 404 summary is a real answer, not an error. */
  const loadTab = useCallback(
    async (crawlId: string, which: TabId): Promise<unknown | null> => {
      const url =
        which === "overview"
          ? `/api/seo/v1/crawl/${crawlId}/summary`
          : which === "duplicates"
            ? `/api/seo/v1/crawl/${crawlId}/duplicates?type=${dupKind}&page=${dupPage}`
            : which === "redirects"
              ? `/api/seo/v1/crawl/${crawlId}/redirects?page=${redirectPage}`
              : (() => {
                  const params = new URLSearchParams({ page: String(pagesPage), pageSize: "50" });
                  if (pageFilters.inSitemap) params.set("inSitemap", pageFilters.inSitemap);
                  if (pageFilters.depth) params.set("depth", pageFilters.depth);
                  if (pageFilters.minInlinks) params.set("minInlinks", pageFilters.minInlinks);
                  return `/api/seo/v1/crawl/${crawlId}/pages?${params}`;
                })();

      const res = await fetch(url);
      if (!res.ok) return null;
      return res.json();
    },
    [dupKind, dupPage, redirectPage, pagesPage, pageFilters],
  );

  useEffect(() => {
    if (!active || isInFlight(active.status) || tab === "issues") return;
    let cancelled = false;
    void (async () => {
      const data = await loadTab(active.id, tab);
      if (cancelled) return;
      if (tab === "overview") setSummary((data as CrawlSummaryDto | null) ?? null);
      if (tab === "duplicates") setDuplicates((data as DuplicatePage | null) ?? null);
      if (tab === "redirects") setRedirects((data as RedirectPage | null) ?? null);
      if (tab === "pages") setPageRows((data as CrawlPagesPage | null) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [active, tab, loadTab]);

  async function start(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setStarting(true);
    try {
      const res = await fetch("/api/seo/v1/crawl", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          data?.code === "QUOTA_EXCEEDED"
            ? t.errQuota
            : data?.code === "INVALID_REQUEST"
              ? t.errInvalidUrl
              : t.errGeneric,
        );
        return;
      }
      setUrl("");
      setActive(data);
      setPage(1);
      await refresh();
    } catch {
      setError(t.errGeneric);
    } finally {
      setStarting(false);
    }
  }

  async function cancel() {
    if (!active) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/seo/v1/crawl/${active.id}/cancel`, { method: "POST" });
      if (res.ok) setActive(await res.json());
      await refresh();
    } finally {
      setCancelling(false);
    }
  }

  // Locked tier: the same upsell shape the other gated tools use — the feature
  // is named and priced, not hidden.
  if (quota?.locked) {
    return (
      <div className="space-y-6">
        <Header t={t} />
        <Card>
          <CardContent className="py-10 text-center">
            <Network className="mx-auto h-8 w-8 text-gray-300" aria-hidden="true" />
            <h3 className="mt-3 text-base font-semibold text-gray-900">{t.lockedTitle}</h3>
            <p className="mx-auto mt-2 max-w-lg text-sm text-gray-500">{t.lockedBody}</p>
            <Link
              href="/billing"
              className="mt-5 inline-flex items-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              {t.lockedCta}
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const running = active && isInFlight(active.status);

  return (
    <div className="space-y-6">
      <Header t={t} />

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={start} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[260px] flex-1">
              <label htmlFor="crawl-url" className="mb-1 block text-sm font-medium text-gray-700">
                {t.urlLabel}
              </label>
              <Input
                id="crawl-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t.urlPlaceholder}
                disabled={starting || Boolean(running)}
              />
            </div>
            <Button type="submit" disabled={starting || !url.trim() || Boolean(running)}>
              {starting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {t.starting}
                </>
              ) : (
                t.startCta
              )}
            </Button>
          </form>

          <div className="mt-3 space-y-1 text-xs text-gray-500">
            {quota && <p>{t.capNote(int.format(quota.urlCap))}</p>}
            {quota &&
              (quota.monthlyLimit === null ? (
                <p>{t.quotaUnlimited(int.format(quota.used))}</p>
              ) : (
                <p>{t.quotaNote(int.format(quota.used), int.format(quota.monthlyLimit))}</p>
              ))}
            <p>{t.politeNote}</p>
          </div>

          {error && (
            <p className="mt-3 flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      {active && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">{active.rootUrl}</p>
                <p className="text-xs text-gray-500">{formatDateTime(active.createdAt, locale)}</p>
              </div>
              <Badge variant={active.status === "FAILED" ? "danger" : "default"}>
                {statusLabel(active.status, t)}
              </Badge>
            </div>
          </CardHeader>

          <CardContent>
            {running ? (
              <div className="space-y-3">
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-gray-900 transition-[width] duration-500"
                    style={{
                      width: `${Math.min(100, Math.round((active.pagesCrawled / Math.max(1, active.urlCap)) * 100))}%`,
                    }}
                  />
                </div>
                <p className="text-sm text-gray-600">
                  {t.progress(int.format(active.pagesCrawled), int.format(active.urlCap))}
                </p>
                <p className="text-xs text-gray-400">{t.crawlingNote}</p>
                <Button variant="outline" size="sm" onClick={cancel} disabled={cancelling}>
                  {cancelling ? t.cancelling : t.cancelCta}
                </Button>
              </div>
            ) : (
              <Summary crawl={active} t={t} int={int} />
            )}
          </CardContent>
        </Card>
      )}

      {active && !running && (
        <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
          {TABS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-current={tab === id ? "page" : undefined}
              className={
                tab === id
                  ? "rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white"
                  : "rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100"
              }
            >
              {tabLabel(id, t)}
            </button>
          ))}
        </div>
      )}

      {active && !running && tab === "overview" && (
        <OverviewPanel summary={summary} t={t} int={int} />
      )}

      {active && !running && tab === "duplicates" && (
        <DuplicatesPanel
          data={duplicates}
          kind={dupKind}
          onKind={(k) => {
            setDupKind(k);
            setDupPage(1);
            setDuplicates(null);
          }}
          onPage={(p) => {
            setDupPage(p);
            setDuplicates(null);
          }}
          t={t}
          int={int}
        />
      )}

      {active && !running && tab === "redirects" && (
        <RedirectsPanel
          data={redirects}
          onPage={(p) => {
            setRedirectPage(p);
            setRedirects(null);
          }}
          t={t}
          int={int}
        />
      )}

      {active && !running && tab === "pages" && (
        <PagesPanel
          data={pageRows}
          filters={pageFilters}
          onFilters={(f) => {
            setPageFilters(f);
            setPagesPage(1);
            setPageRows(null);
          }}
          onPage={(p) => {
            setPagesPage(p);
            setPageRows(null);
          }}
          t={t}
          int={int}
        />
      )}

      {active && !running && tab === "issues" && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-gray-900">{t.issuesTitle}</h3>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  aria-label={t.filterSeverity}
                  className="w-auto"
                  value={severity}
                  onChange={(e) => {
                    setSeverity(e.target.value);
                    setPage(1);
                  }}
                  options={[
                    { value: "", label: `${t.filterSeverity}: ${t.filterAll}` },
                    ...SEVERITIES.map((s) => ({ value: s, label: severityLabel(s, t) })),
                  ]}
                />
                <Select
                  aria-label={t.filterType}
                  className="w-auto"
                  value={type}
                  onChange={(e) => {
                    setType(e.target.value);
                    setPage(1);
                  }}
                  options={[
                    { value: "", label: `${t.filterType}: ${t.filterAll}` },
                    ...ISSUE_TYPES.map((it) => ({ value: it, label: t.issueTypes[it] ?? it })),
                  ]}
                />
                <a
                  // ?format=csv on the issues route rather than /export: this
                  // one honours the severity and type filters above, so the
                  // file matches the table the user is looking at. /export
                  // still exists for the whole crawl, unfiltered.
                  href={`/api/seo/v1/crawl/${active.id}/issues?format=csv${
                    severity ? `&severity=${encodeURIComponent(severity)}` : ""
                  }${type ? `&type=${encodeURIComponent(type)}` : ""}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-gray-300"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  {t.exportCsv}
                </a>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {!issues || issues.issues.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-500">
                {severity || type ? t.noIssuesFiltered : t.noIssues}
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                        <th scope="col" className="py-2 pr-3">{t.colSeverity}</th>
                        <th scope="col" className="py-2 pr-3">{t.colType}</th>
                        <th scope="col" className="py-2 pr-3">{t.colUrl}</th>
                        <th scope="col" className="py-2">{t.colDetail}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {issues.issues.map((issue) => (
                        <tr key={issue.id} className="border-b border-gray-100 align-top">
                          <td className="py-2 pr-3">
                            <Badge variant={severityTone(issue.severity)}>
                              {severityLabel(issue.severity, t)}
                            </Badge>
                          </td>
                          <td className="py-2 pr-3 text-gray-900">
                            {t.issueTypes[issue.type] ?? issue.type}
                          </td>
                          <td className="max-w-sm py-2 pr-3">
                            <span className="block truncate text-gray-600" title={issue.url}>
                              {issue.url}
                            </span>
                          </td>
                          <td className="py-2 text-gray-500">{issue.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {issues.totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={issues.page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      {t.prevPage}
                    </Button>
                    <span className="text-xs text-gray-500">
                      {t.pageOf(int.format(issues.page), int.format(issues.totalPages))}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={issues.page >= issues.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      {t.nextPage}
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-gray-900">{t.pastTitle}</h3>
        </CardHeader>
        <CardContent>
          {crawls.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">{t.noCrawls}</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {crawls.map((crawl) => (
                <li key={crawl.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setActive(crawl);
                      setPage(1);
                      setTab("overview");
                      setSummary(null);
                      setDuplicates(null);
                      setRedirects(null);
                      setPageRows(null);
                      setDupPage(1);
                      setRedirectPage(1);
                      setPagesPage(1);
                      setPageFilters(EMPTY_PAGE_FILTERS);
                    }}
                    className="flex w-full flex-wrap items-center justify-between gap-3 py-3 text-left hover:bg-gray-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-gray-900">{crawl.rootUrl}</p>
                      <p className="text-xs text-gray-500">
                        {formatDateTime(crawl.createdAt, locale)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">
                        {int.format(crawl.pagesCrawled)} · {int.format(crawl.issueCount)}
                      </span>
                      <Badge variant={crawl.status === "FAILED" ? "danger" : "default"}>
                        {statusLabel(crawl.status, t)}
                      </Badge>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Header({ t }: { t: SiteCrawlerCopy }) {
  return (
    <div>
      <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">{t.title}</h2>
      <p className="mt-1 max-w-3xl text-sm text-gray-500">{t.subtitle}</p>
    </div>
  );
}

function Summary({
  crawl,
  t,
  int,
}: {
  crawl: CrawlDto;
  t: SiteCrawlerCopy;
  int: Intl.NumberFormat;
}) {
  const stopped = stoppedLabel(crawl.stoppedReason, t);
  // The split comes from the detail endpoint, which groups by severity once the
  // crawl has settled. Zeroes until that response lands — never a guess derived
  // from whichever issue page happens to be loaded.
  const counts = crawl.severityCounts ?? { ERROR: 0, WARNING: 0, NOTICE: 0 };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label={t.summaryPages} value={int.format(crawl.pagesCrawled)} />
        <Tile label={t.summaryErrors} value={int.format(counts.ERROR)} />
        <Tile label={t.summaryWarnings} value={int.format(counts.WARNING)} muted />
        <Tile label={t.summaryNotices} value={int.format(counts.NOTICE)} muted />
      </div>
      {stopped && <p className="text-xs text-gray-500">{stopped}</p>}
    </div>
  );
}

function Tile({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${muted ? "text-gray-600" : "text-gray-900"}`}>
        {value}
      </p>
    </div>
  );
}
