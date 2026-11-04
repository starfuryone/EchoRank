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
import dynamic from "next/dynamic";
import { AlertCircle, CircleQuestionMark, Download, Loader2, Network } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDateTime } from "@/lib/utils";
import type { Severity } from "@/lib/site-crawler/checks";
import { RULE_COPY, RULE_IDS } from "@/lib/crawl-rules-meta";
import { RulesPanel } from "./site-crawler-rules-panel";
import {
  EMPTY_PAGE_FILTERS,
  pageFilterParams,
  isInFlight,
  type CrawlDto,
  type RenderMode,
  type CrawlIssuePage,
  type CrawlListResponse,
  type CrawlPagesPage,
  type CrawlQuotaDto,
  type CrawlSummaryDto,
  type PartialSummaryDto,
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
import { AcceptedWords } from "@/components/seo-tools/site-crawler-accepted-words";
import { CrawlConfigSection, problemText } from "@/components/seo-tools/site-crawler-config";
import { CrawlTools } from "@/components/seo-tools/site-crawler-crawl-tools";
import { InlinksPanel } from "@/components/seo-tools/site-crawler-inlinks";
import { ExtractionPanel } from "@/components/seo-tools/site-crawler-extraction";
import { ExternalPanel } from "@/components/seo-tools/site-crawler-external";
import { ComparePanel } from "@/components/seo-tools/site-crawler-compare";
import { CrawlSchedules } from "@/components/seo-tools/site-crawler-schedules";
import { AddDataSection, confirmLines } from "@/components/seo-tools/site-crawler-add-data";
import { AiPromptsSection, AiStatusLine, aiConfirmLine, type AiQuota } from "@/components/seo-tools/site-crawler-ai";
import type { AiConfig } from "@/lib/site-crawler/ai-shared";
import { MetricTiles } from "@/components/seo-tools/site-crawler-metrics";
import { SourceLines } from "@/components/seo-tools/site-crawler-sources";
import type { AddData } from "@/lib/site-crawler/crawl-config";
import { SheetsExport } from "@/components/seo-tools/site-crawler-sheets";
import { ReportDownloadButton } from "@/components/reports/ReportDownloadButton";
import { lookerStudioHref } from "@/lib/site-crawler/sheets-layout";
import { SegmentOverview, SegmentPicker } from "@/components/seo-tools/site-crawler-segments";
import type { ConfigProblem, CrawlConfigInput } from "@/lib/site-crawler/crawl-config";
import { parseUrlList } from "@/lib/site-crawler/url-list";
import { flag } from "@/lib/flags";
import { SITE_CRAWLER_COPY, type DashLocale, type SiteCrawlerCopy } from "@/lib/i18n/dashboard";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import { helpArticleFor, learnHref } from "@/lib/help-content";

type TabId = "overview" | "rules" | "issues" | "duplicates" | "redirects" | "pages" | "structure" | "compare" | "extraction" | "external";

/** The Issues filter: every registry rule, by name. Pre-3a rows match through legacy-map. */
const RULE_OPTIONS = RULE_IDS.map((id) => ({ value: id, label: RULE_COPY[id]?.name ?? id })).sort((a, b) =>
  a.label.localeCompare(b.label),
);

const TABS: TabId[] = ["overview", "rules", "issues", "duplicates", "redirects", "pages"];

// Phase 4c: the Structure tab's d3 code loads only when the tab is opened.
const StructurePanel = dynamic(() => import("./site-crawler-structure"), { ssr: false, loading: () => null });

/**
 * The tabs a crawl shows: Structure while its pages are kept, Compare when
 * it also completed (Phase 4c), Extraction only when it ran extractors (4b).
 */
export function crawlTabs(crawl: (Pick<CrawlDto, "config"> & { dataPurgedAt?: string | null; status?: string }) | null): TabId[] {
  const tabs: TabId[] = [...TABS];
  if (flag("crawl.visualise") && crawl && !crawl.dataPurgedAt) tabs.push("structure");
  if (flag("crawl.compare") && crawl && !crawl.dataPurgedAt && (crawl.status ?? "COMPLETED") === "COMPLETED") tabs.push("compare");
  if (
    (flag("crawl.extraction") && (crawl?.config?.extractors?.length ?? 0) > 0) ||
    (flag("crawl.customJs") && (crawl?.config?.js?.length ?? 0) > 0) ||
    (flag("crawl.ai") && (crawl?.config?.ai?.prompts.length ?? 0) > 0)
  )
    tabs.push("extraction");
  // Phase 4g: outbound links, while the crawl's links are kept.
  if (flag("crawl.externalLinks") && crawl && !crawl.dataPurgedAt) tabs.push("external");
  return tabs;
}

function tabLabel(id: TabId, t: SiteCrawlerCopy): string {
  if (id === "overview") return t.tabOverview;
  if (id === "rules") return t.tabRules;
  if (id === "issues") return t.tabIssues;
  if (id === "duplicates") return t.tabDuplicates;
  if (id === "redirects") return t.tabRedirects;
  if (id === "extraction") return t.p4b.tabExtraction;
  if (id === "structure") return t.p4c.tabStructure;
  if (id === "compare") return t.p4c.tabCompare;
  if (id === "external") return t.p4g.tabExternal;
  return t.tabPages;
}

/** The Add data section's view of the crawl quota (Phase 4d). */
function addDataQuota(q: CrawlQuotaDto) {
  return {
    psiCap: q.psiCap ?? 0,
    lighthouseUsed: q.lighthouseUsed ?? 0,
    lighthouseLimit: q.lighthouseLimit ?? 0,
    backlinkCap: q.backlinkCap ?? 0,
    backlinkUnitUsd: q.backlinkUnitUsd ?? 0,
    seoBudgetLeftUsd: q.seoBudgetLeftUsd ?? 0,
  };
}

/** The AI prompts' view of the crawl quota (Phase 4e). */
function aiQuota(q: CrawlQuotaDto): AiQuota {
  return {
    aiPageCap: q.aiPageCap ?? 0,
    aiTokensUsed: q.aiTokensUsed ?? 0,
    aiTokenLimit: q.aiTokenLimit === undefined ? 0 : q.aiTokenLimit,
    aiClaude: q.aiClaude ?? false,
    aiKeys: q.aiKeys ?? { openai: false, gemini: false },
  };
}

/** The host of what was typed in the URL field, for the Add data segment list. */
function hostOfInput(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  try {
    return new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`).hostname.toLowerCase() || null;
  } catch {
    return null;
  }
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
  if (reason === "list_expired") return t.p4a.stoppedListExpired;
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
  const [renderMode, setRenderMode] = useState<RenderMode>("none");
  // Phase 4a: spider or list mode, the configuration section's output.
  const [mode, setMode] = useState<"spider" | "list">("spider");
  const [listText, setListText] = useState("");
  const [cfg, setCfg] = useState<{ config: CrawlConfigInput | null; saveAsDefault: boolean }>({ config: null, saveAsDefault: false });
  const onConfig = useCallback((next: { config: CrawlConfigInput | null; saveAsDefault: boolean }) => setCfg(next), []);
  const [problems, setProblems] = useState<ConfigProblem[]>([]);
  // Phase 4d: the post-crawl opt-ins, confirmed with their cost before the crawl starts.
  const [addData, setAddData] = useState<AddData | null>(null);
  const [ai, setAi] = useState<AiConfig | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [inlinksFor, setInlinksFor] = useState<{ id: string; url: string } | null>(null);
  const listUrls = useMemo(() => parseUrlList(listText), [listText]);
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
  const [summary, setSummary] = useState<CrawlSummaryDto | PartialSummaryDto | null>(null);
  // Phase 4b: the segment every tab, total and CSV is filtered to, per crawl
  // (picking another crawl drops it without an effect).
  const [segmentSel, setSegmentSel] = useState<{ crawlId: string; value: string }>({ crawlId: "", value: "" });
  const segmentNames = flag("crawl.segments") ? (active?.config?.segments ?? []).map((g) => g.name) : [];
  const segment = active && segmentSel.crawlId === active.id && Number(segmentSel.value) < segmentNames.length ? segmentSel.value : "";
  const pickSegment = (value: string) => {
    if (!active) return;
    setSegmentSel({ crawlId: active.id, value });
    setPage(1);
    setDupPage(1);
    setRedirectPage(1);
    setPagesPage(1);
    setSummary(null);
    setDuplicates(null);
    setRedirects(null);
    setPageRows(null);
  };
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
    // ?crawl=<id> (the scheduled-crawl email's link) opens that crawl; else
    // resume whatever is in flight, so a reload lands back on the live crawl.
    const wanted = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("crawl");
    setActive(
      (current) =>
        current ??
        data.crawls.find((c) => c.id === wanted) ??
        data.crawls.find((c) => isInFlight(c.status)) ??
        data.crawls[0] ??
        null,
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

  // A settled crawl that came from the list — a reload, or one picked from
  // history — carries no severityCounts: only the detail endpoint does. Fetch
  // it once, or the header tiles sit at 0 / 0 / 0 while Overview shows the
  // real split (both now read getIssueTotals on the server).
  useEffect(() => {
    if (!active || isInFlight(active.status) || active.severityCounts) return;
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/seo/v1/crawl/${active.id}`);
      if (cancelled || !res.ok) return;
      const fresh: CrawlDto = await res.json();
      if (!cancelled) setActive((current) => (current?.id === fresh.id ? fresh : current));
    })();
    return () => {
      cancelled = true;
    };
  }, [active]);

  const loadIssues = useCallback(
    async (crawlId: string, currentPage: number, sev: string, ty: string, seg: string) => {
      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: String(ISSUE_PAGE_SIZE),
      });
      if (sev) params.set("severity", sev);
      if (ty) params.set("type", ty);
      if (seg) params.set("segment", seg);
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
      const data = await loadIssues(active.id, page, severity, type, segment);
      if (!cancelled && data) setIssues(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [active, page, severity, type, segment, loadIssues]);

  /** Fetch whichever tab is open. A 404 summary is a real answer, not an error. */
  const loadTab = useCallback(
    async (crawlId: string, which: TabId): Promise<unknown | null> => {
      const seg = segment ? `segment=${encodeURIComponent(segment)}` : "";
      const url =
        which === "overview"
          ? `/api/seo/v1/crawl/${crawlId}/summary?${seg}`
          : which === "duplicates"
            ? `/api/seo/v1/crawl/${crawlId}/duplicates?type=${dupKind}&page=${dupPage}&${seg}`
            : which === "redirects"
              ? `/api/seo/v1/crawl/${crawlId}/redirects?page=${redirectPage}&${seg}`
              : (() => {
                  const params = pageFilterParams(pageFilters);
                  params.set("page", String(pagesPage));
                  params.set("pageSize", "50");
                  if (segment) params.set("segment", segment);
                  return `/api/seo/v1/crawl/${crawlId}/pages?${params}`;
                })();

      const res = await fetch(url);
      if (!res.ok) return null;
      return res.json();
    },
    [dupKind, dupPage, redirectPage, pagesPage, pageFilters, segment],
  );

  useEffect(() => {
    if (!active || isInFlight(active.status) || tab === "issues" || tab === "rules" || tab === "extraction" || tab === "external" || tab === "structure" || tab === "compare") return;
    let cancelled = false;
    void (async () => {
      const data = await loadTab(active.id, tab);
      if (cancelled) return;
      if (tab === "overview") setSummary((data as CrawlSummaryDto | PartialSummaryDto | null) ?? null);
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
    const extra = mode === "spider" ? addData : null;
    const aiExtra = mode === "spider" && flag("crawl.ai") ? ai : null;
    if ((extra || aiExtra) && !confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    setError(null);
    setProblems([]);
    setNotice(null);
    setStarting(true);
    try {
      const listing = mode === "list";
      const res = await fetch("/api/seo/v1/crawl", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: listing ? "" : url,
          renderMode: quota && quota.renderCap > 0 ? renderMode : "none",
          ...(listing ? { mode: "list", urls: listUrls } : {}),
          ...((flag("crawl.config") && cfg.config) || extra || aiExtra
            ? {
                config: { ...(flag("crawl.config") && cfg.config ? cfg.config : {}), ...(extra ? { addData: extra } : {}), ...(aiExtra ? { ai: aiExtra } : {}) },
                saveAsDefault: !listing && flag("crawl.config") && cfg.config !== null && cfg.saveAsDefault,
              }
            : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (data?.code === "INVALID_CONFIG") {
          setError(t.p4a.errConfig);
          setProblems(Array.isArray(data.problems) ? data.problems : []);
          return;
        }
        setError(
          data?.code === "QUOTA_EXCEEDED"
            ? t.errQuota
            : data?.code === "INVALID_LIST"
              ? data.reason === "too_long"
                ? t.p4a.errListTooLong(int.format(data.cap))
                : t.p4a.errListEmpty
              : data?.code === "INVALID_REQUEST"
                ? t.errInvalidUrl
                : t.errGeneric,
        );
        return;
      }
      if (data?.listSkipped) setNotice(t.p4a.listSkipped(int.format(data.listSkipped)));
      setUrl("");
      setListText("");
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
        <Header t={t} locale={locale} />
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
      <Header t={t} locale={locale} />

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={start} className="flex flex-wrap items-end gap-3">
            {flag("crawl.listMode") && (
              <div className="w-full sm:w-auto">
                <Select
                  id="crawl-mode"
                  label={t.p4a.modeLabel}
                  value={mode}
                  onChange={(e) => setMode(e.target.value as "spider" | "list")}
                  disabled={starting || Boolean(running)}
                  options={[
                    { value: "spider", label: t.p4a.modeSpider },
                    { value: "list", label: t.p4a.modeList },
                  ]}
                />
              </div>
            )}
            {mode === "spider" ? (
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
            ) : (
              <div className="w-full">
                <label htmlFor="crawl-list" className="mb-1 block text-sm font-medium text-gray-700">
                  {t.p4a.listLabel}
                </label>
                <textarea
                  id="crawl-list"
                  rows={5}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
                  value={listText}
                  onChange={(e) => setListText(e.target.value)}
                  placeholder={t.p4a.listPlaceholder}
                  disabled={starting || Boolean(running)}
                />
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                  <label className="cursor-pointer text-blue-700 hover:underline">
                    {t.p4a.listUpload}
                    <input
                      type="file"
                      accept=".txt,.csv,text/plain,text/csv"
                      className="sr-only"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) setListText(await file.text());
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <span>{t.p4a.listCount(int.format(listUrls.length))}</span>
                </div>
              </div>
            )}
            {quota && quota.renderCap > 0 && (
              <div className="w-full sm:w-auto">
                <Select
                  id="crawl-render"
                  label={t.renderLabel}
                  value={renderMode}
                  onChange={(e) => setRenderMode(e.target.value as RenderMode)}
                  disabled={starting || Boolean(running)}
                  options={[
                    { value: "none", label: t.renderNone },
                    { value: "thin", label: t.renderThin },
                    { value: "all", label: t.renderAll },
                  ]}
                />
              </div>
            )}
            <Button
              type="submit"
              disabled={starting || (mode === "spider" ? !url.trim() : listUrls.length === 0) || Boolean(running)}
            >
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
            {quota && mode === "spider" && <p>{t.capNote(int.format(quota.urlCap))}</p>}
            {quota && mode === "list" && <p>{t.p4a.listHelp(int.format(quota.urlCap))}</p>}
            {quota && quota.renderCap > 0 && renderMode !== "none" && (
              <p>{t.renderCapNote(int.format(quota.renderCap))}</p>
            )}
            {quota &&
              (quota.monthlyLimit === null ? (
                <p>{t.quotaUnlimited(int.format(quota.used), quota.used)}</p>
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
          {problems.length > 0 && (
            <ul className="mt-1 list-disc pl-10 text-sm text-red-600">
              {problems.map((p, i) => (
                <li key={i}>{problemText(p, t.p4a, t.p4b, t.p4d, t.p4e)}</li>
              ))}
            </ul>
          )}
          {notice && <p className="mt-3 text-sm text-gray-600">{notice}</p>}

          {flag("crawl.config") && mode === "spider" && quota && (
            <CrawlConfigSection
              t={t.p4a}
              t4b={t.p4b}
              t4e={t.p4e}
              renders={quota.renderCap > 0 && renderMode !== "none"}
              caps={{ extractors: quota.extractorCap ?? 0, searches: quota.searchCap ?? 0, segments: quota.segmentCap ?? 0, js: quota.jsSnippetCap ?? 0 }}
              rootUrl={url}
              urlCap={int.format(quota.urlCap)}
              disabled={starting || Boolean(running)}
              onChange={onConfig}
            >
              {flag("crawl.schedule") && (
                <CrawlSchedules
                  t={t.p4c}
                  locale={locale}
                  rootUrl={url}
                  renderMode={quota.renderCap > 0 ? renderMode : "none"}
                  config={cfg.config}
                  cap={quota.scheduleCap ?? 0}
                  cadences={quota.scheduleCadences ?? []}
                  disabled={starting}
                />
              )}
            </CrawlConfigSection>
          )}

          {(flag("crawl.psi") || flag("crawl.backlinks") || flag("crawl.gsc") || flag("crawl.ga4") || flag("crawl.ai")) && mode === "spider" && quota && (
            <AddDataSection
              t={t.p4d}
              host={hostOfInput(url)}
              quota={addDataQuota(quota)}
              value={addData}
              onChange={(v) => {
                setAddData(v);
                setConfirming(false);
              }}
              disabled={starting || Boolean(running)}
              extra={
                flag("crawl.ai")
                  ? (segments) => (
                      <AiPromptsSection
                        t={t.p4e}
                        t4d={t.p4d}
                        quota={aiQuota(quota)}
                        value={ai}
                        segments={segments}
                        int={int}
                        disabled={starting || Boolean(running)}
                        onChange={(v) => {
                          setAi(v);
                          setConfirming(false);
                        }}
                      />
                    )
                  : undefined
              }
            >
              <SourceLines t={t.p4d} host={hostOfInput(url)} />
            </AddDataSection>
          )}

          {confirming && (addData || ai) && quota && (
            <div role="dialog" aria-labelledby="crawl-confirm-title" className="mt-4 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p id="crawl-confirm-title" className="text-sm font-semibold text-gray-900">
                {t.p4d.confirmTitle}
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
                {[...(addData ? confirmLines(t.p4d, addData, addDataQuota(quota)) : []), ...(ai ? [aiConfirmLine(t.p4e, ai, int)] : [])].map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Button size="sm" onClick={(e) => void start(e)} disabled={starting}>
                  {t.p4d.confirmStart}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>
                  {t.p4d.confirmBack}
                </Button>
              </div>
            </div>
          )}

          <AcceptedWords t={t} />
        </CardContent>
      </Card>

      {active && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">
                  {active.mode === "list" && <Badge className="mr-2">{t.p4a.listBadge}</Badge>}
                  {active.rootUrl}
                </p>
                <p className="text-xs text-gray-500">{formatDateTime(active.createdAt, locale)}</p>
              </div>
              <div className="flex items-center gap-2">
                {/* Phase 4c: the PDF crawl report; the button probes the route and hides itself when unavailable. */}
                {flag("crawl.reports") && active.status === "COMPLETED" && !active.dataPurgedAt && (
                  <ReportDownloadButton key={active.id} endpoint={`/api/seo/v1/crawl/${active.id}/report`} />
                )}
                <Badge variant={active.status === "FAILED" ? "danger" : "default"}>
                  {statusLabel(active.status, t)}
                </Badge>
              </div>
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
                {active.renderMode !== "none" && (
                  <p className="text-xs text-gray-500">
                    {t.renderedProgress(int.format(active.pagesRendered), int.format(active.renderCap))}
                  </p>
                )}
                <p className="text-xs text-gray-400">{t.crawlingNote}</p>
                <Button variant="outline" size="sm" onClick={cancel} disabled={cancelling}>
                  {cancelling ? t.cancelling : t.cancelCta}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Summary crawl={active} t={t} int={int} />
                <CrawlTools
                  crawl={active}
                  segment={segment || null}
                  t={t.p4a}
                  kept={int.format(quota?.crawlsKept ?? 0)}
                  onUpdated={(c) => {
                    setActive(c);
                    setCrawls((list) => list.map((x) => (x.id === c.id ? { ...x, pinned: c.pinned } : x)));
                  }}
                />
                {flag("crawl.sheets") && active.status === "COMPLETED" && !active.dataPurgedAt && (
                  <SheetsExport crawlId={active.id} t={t.p4c} int={int} guideHref={lookerStudioHref(locale)} />
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {active && !running && (
        <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
          <SegmentPicker names={segmentNames} value={segment} onChange={pickSegment} t={t} />
          {crawlTabs(active).map((id) => (
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
        <>
          <SegmentOverview segments={summary?.segments} segment={summary?.segment} onPick={pickSegment} t={t} int={int} />
          {summary && "metricOverview" in summary && summary.metricOverview && <MetricTiles data={summary.metricOverview} t={t.p4d} int={int} />}
          {flag("crawl.ai") && summary && "metricOverview" in summary && summary.metricOverview && (
            <AiStatusLine status={summary.metricOverview.status as object} t={t.p4e} int={int} />
          )}
          <OverviewPanel summary={summary} t={t} int={int} />
        </>
      )}

      {active && !running && tab === "rules" && <RulesPanel crawlId={active.id} segment={segment || null} t={t} int={int} />}

      {active && !running && tab === "external" && <ExternalPanel crawlId={active.id} t={t} int={int} />}

      {active && !running && tab === "extraction" && (
        <ExtractionPanel
          crawlId={active.id}
          extractorNames={[...(active.config?.extractors ?? []).map((e) => e.name), ...(active.config?.js ?? []).map((s) => `JS: ${s.name}`), ...(active.config?.ai?.prompts ?? []).map((p, i) => `AI: ${p.preset === "custom" ? `${t.p4e.aiPresets.custom} ${i + 1}` : t.p4e.aiPresets[p.preset]}`)]}
          segment={segment || null}
          t={t}
          int={int}
        />
      )}

      {active && !running && tab === "structure" && (
        <StructurePanel
          crawlId={active.id}
          rootUrl={active.rootUrl}
          segment={segment || null}
          purged={Boolean(active.dataPurgedAt)}
          onFilterPages={(urlPrefix) => {
            setPageFilters({ ...EMPTY_PAGE_FILTERS, urlPrefix });
            setPagesPage(1);
            setPageRows(null);
            setTab("pages");
          }}
          t={t}
          int={int}
        />
      )}

      {active && !running && tab === "compare" && (
        <ComparePanel
          crawlId={active.id}
          segment={segment || null}
          segmentName={segment ? (segmentNames[Number(segment)] ?? null) : null}
          locale={locale}
          t={t}
          int={int}
        />
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
          onInlinks={flag("crawl.links") && !active.dataPurgedAt ? setInlinksFor : undefined}
          searchNames={flag("crawl.extraction") ? (active.config?.searches ?? []).map((s) => s.name) : []}
          csvHref={`/api/seo/v1/crawl/${active.id}/pages?${pageFilterParams(pageFilters)}&format=csv${segment ? `&segment=${encodeURIComponent(segment)}` : ""}`}
          t={t}
          int={int}
        />
      )}

      {active && !running && tab === "pages" && inlinksFor && (
        <InlinksPanel crawlId={active.id} page={inlinksFor} t={t.p4a} onClose={() => setInlinksFor(null)} />
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
                    ...RULE_OPTIONS,
                  ]}
                />
                <a
                  // ?format=csv on the issues route rather than /export: this
                  // one honours the severity and type filters above, so the
                  // file matches the table the user is looking at. /export
                  // still exists for the whole crawl, unfiltered.
                  href={`/api/seo/v1/crawl/${active.id}/issues?format=csv${
                    severity ? `&severity=${encodeURIComponent(severity)}` : ""
                  }${type ? `&type=${encodeURIComponent(type)}` : ""}${segment ? `&segment=${encodeURIComponent(segment)}` : ""}`}
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
                            {t.issueTypes[issue.type] ?? RULE_COPY[issue.type]?.name ?? issue.type}
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
                      setInlinksFor(null);
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

function Header({ t, locale }: { t: SiteCrawlerCopy; locale: DashLocale }) {
  // The guide behind the Help button comes from pageHelp (help-content.ts),
  // asserted against the Knowledge Hub's routes. New tab, as the help hub
  // opens public /learn pages: the guide is a marketing page, and losing the
  // crawl you were reading is not a fair trade.
  const guide = helpArticleFor("/crawler");
  return (
    <div>
      {guide && (
        <a
          href={learnHref(locale, guide)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t.helpAria}
          className="float-right inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <CircleQuestionMark className="mr-2 h-4 w-4 text-blue-600" aria-hidden="true" />
          {t.helpButton}
        </a>
      )}
      {/* The lockup carries the name and the byline, so neither is repeated in
          text; the alt text is the accessible name. The top bar already reads
          the brand name as the page's h1, so this is an h2. */}
      <h2>
        {/* eslint-disable-next-line @next/next/no-img-element -- a static SVG; next/image adds nothing */}
        <img
          src={CRAWLER_BRAND.logoOnLight}
          alt={`${t.brandName} — ${t.byline}`}
          width={128}
          height={40}
          className="h-10 w-auto"
        />
      </h2>
      <p className="mt-2 max-w-3xl text-sm text-gray-500">{t.subtitle}</p>
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
      {crawl.renderMode !== "none" && (
        <p className="text-xs text-gray-500">
          {t.renderedProgress(int.format(crawl.pagesRendered), int.format(crawl.renderCap))}
        </p>
      )}
      {stopped && <p className="text-xs text-gray-500">{stopped}</p>}
      {crawl.login && (
        <p role="status" className={crawl.login.status === "failed" ? "text-xs text-amber-700" : "text-xs text-gray-500"}>
          {crawl.login.status === "failed" ? t.p4e.loginFailedNote(t.p4e.loginReasons[crawl.login.reason ?? ""] ?? t.p4e.loginReasons.success_check_failed) : t.p4e.loginOkNote}
        </p>
      )}
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
