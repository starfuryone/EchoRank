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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, BookOpen, CircleQuestionMark, Download, Library, Loader2, Network } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDateTime } from "@/lib/utils";
import type { Severity } from "@/lib/site-crawler/checks";
import { RULE_COPY, RULE_IDS } from "@/lib/crawl-rules-meta";
import { IssuesView } from "./site-crawler-issues";
import { howtoStorageKey, type HowtoView } from "@/lib/site-crawler/howto-copy";
import { PagesView, extractionNamesOf } from "./site-crawler-pages";
import {
  EMPTY_PAGE_FILTERS,
  isInFlight,
  type CrawlDto,
  type RenderMode,
  type CrawlIssuePage,
  type CrawlListResponse,
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
  RedirectsPanel,
} from "@/components/seo-tools/site-crawler-panels";
import { AcceptedWords } from "@/components/seo-tools/site-crawler-accepted-words";
import { CrawlConfigSection, problemText } from "@/components/seo-tools/site-crawler-config";
import { CrawlTools } from "@/components/seo-tools/site-crawler-crawl-tools";
import { ExtractionPanel, extractionQuery } from "@/components/seo-tools/site-crawler-extraction";
import { ExternalPanel } from "@/components/seo-tools/site-crawler-external";
import { ComparePanel } from "@/components/seo-tools/site-crawler-compare";
import { AddDataSection, confirmLines, useSiteSegmentNames } from "@/components/seo-tools/site-crawler-add-data";
import { AdvancedSection, summaryLine } from "@/components/seo-tools/site-crawler-advanced";
import { CRAWLER_ROUTES, CrawlerNav, RecentCrawls, hostOfCrawl, statusLabel } from "@/components/seo-tools/site-crawler-nav";
import { CompletenessBanner, ExportsMenu, FixFirst, ResultsHero, TabStrip, completenessLines } from "@/components/seo-tools/site-crawler-results";
import { AiPromptsSection, AiStatusLine, aiConfirmLine, type AiQuota } from "@/components/seo-tools/site-crawler-ai";
import { SemanticSection, semanticConfirmLine, semanticStatusText } from "@/components/seo-tools/site-crawler-semantic";
import { InspectionSection } from "@/components/seo-tools/site-crawler-inspection";
import type { TopPages } from "@/lib/site-crawler/crawl-config";
import type { AiConfig } from "@/lib/site-crawler/ai-shared";
import { MetricTiles } from "@/components/seo-tools/site-crawler-metrics";
import { SourceLines } from "@/components/seo-tools/site-crawler-sources";
import type { AddData } from "@/lib/site-crawler/crawl-config";
import { SheetsExport } from "@/components/seo-tools/site-crawler-sheets";
import { ReportDownloadButton } from "@/components/reports/ReportDownloadButton";
import { ArchivedPanel } from "@/components/seo-tools/site-crawler-archived";
import { crawlDataState } from "@/lib/site-crawler/data-state";

/** True when a (not purged) crawl's rows are in the archive or moving (data-state.ts). */
const rowsArchived = (crawl: Pick<CrawlDto, "storageState" | "dataPurgedAt">) => crawlDataState(crawl) === "archived";
import { lookerStudioHref } from "@/lib/site-crawler/sheets-layout";
import { SegmentOverview, SegmentPicker } from "@/components/seo-tools/site-crawler-segments";
import type { ConfigProblem, CrawlConfigInput } from "@/lib/site-crawler/crawl-config";
import { parseUrlList } from "@/lib/site-crawler/url-list";
import { flag } from "@/lib/flags";
import { SITE_CRAWLER_COPY, type DashLocale, type SiteCrawlerCopy } from "@/lib/i18n/dashboard";
import { helpModalFor, learnHref } from "@/lib/help-content";
import { CRAWLER_GUIDES_HREF } from "@/lib/crawler-guides-link";

type TabId = "overview" | "rules" | "issues" | "duplicates" | "redirects" | "pages" | "structure" | "compare" | "extraction" | "external" | "metrics" | "segments";

/** The Results view's top-level groups (UX restructure); each tab sits in one. */
type GroupId = "issues" | "pages" | "links" | "data" | "compare";
const GROUPS: GroupId[] = ["issues", "pages", "links", "data", "compare"];
const GROUP_OF: Record<TabId, GroupId> = {
  overview: "data",
  rules: "issues",
  issues: "issues",
  pages: "pages",
  duplicates: "links",
  redirects: "links",
  external: "links",
  structure: "links",
  extraction: "data",
  metrics: "data",
  segments: "data",
  compare: "compare",
};
/** Sub-view order inside a group. */
const SUB_ORDER: TabId[] = ["rules", "issues", "pages", "duplicates", "redirects", "external", "structure", "extraction", "metrics", "segments", "compare"];

/** The Issues filter: every registry rule, by name. Pre-3a rows match through legacy-map. */
const RULE_OPTIONS = RULE_IDS.map((id) => ({ value: id, label: RULE_COPY[id]?.name ?? id })).sort((a, b) =>
  a.label.localeCompare(b.label),
);

const TABS: TabId[] = ["rules", "issues", "duplicates", "redirects", "pages"];

// Phase 4c: the Structure tab's d3 code loads only when the tab is opened.
// <CrawlerHelpModal>: loaded only when the Help button (or ?help=1) opens it.
const CrawlerHelpModal = dynamic(() => import("./site-crawler-help"), { ssr: false, loading: () => null });
// <CrawlerHowtoModal>: the view's walkthrough, loaded only when it opens.
const CrawlerHowtoModal = dynamic(() => import("./site-crawler-howto"), { ssr: false, loading: () => null });
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
  // Data: metric tiles and step status; segments when the crawl was segmented.
  tabs.push("metrics");
  if (flag("crawl.segments") && (crawl?.config?.segments?.length ?? 0) > 0) tabs.push("segments");
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
  if (id === "metrics") return t.ux.subMetrics;
  if (id === "segments") return t.ux.subSegments;
  return t.tabPages;
}

function groupLabel(id: GroupId, t: SiteCrawlerCopy): string {
  if (id === "issues") return t.ux.grpIssues;
  if (id === "pages") return t.ux.grpPages;
  if (id === "links") return t.ux.grpLinks;
  if (id === "data") return t.ux.grpData;
  return t.ux.grpCompare;
}

/** A tab's label as a sub-view of its group ("By rule" / "All findings" in Issues). */
function subLabel(id: TabId, t: SiteCrawlerCopy): string {
  if (id === "rules") return t.ux.subByRule;
  if (id === "issues") return t.ux.subAll;
  return tabLabel(id, t);
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


function stoppedLabel(reason: string | null, t: SiteCrawlerCopy): string | null {
  if (!reason) return null;
  if (reason === "url_cap") return t.stoppedUrlCap;
  if (reason === "time_cap") return t.stoppedTimeCap;
  if (reason === "monthly_allowance") return t.stoppedMonthly;
  if (reason === "cancelled") return t.stoppedCancelled;
  if (reason === "list_expired") return t.p4a.stoppedListExpired;
  return reason; // a FAILED crawl carries its truncated error here
}

/** The crawler's task views: Start (/crawler) and Results (/crawler/[id]). */
export type CrawlerView = "start" | "results";

export function SiteCrawlerClient({
  locale,
  view = "start",
  crawlId = null,
  initialTab = "rules",
  initialUrl,
}: {
  locale: DashLocale;
  view?: CrawlerView;
  crawlId?: string | null;
  /** The tab Results opens on: Issues by default; /crawler/[id]/pages opens Pages. */
  initialTab?: "rules" | "pages";
  /** Start view: the URL field's first value (/crawler?url=, page.tsx checks it). */
  initialUrl?: string;
}) {
  const router = useRouter();
  const t = SITE_CRAWLER_COPY[locale];
  const int = useMemo(() => new Intl.NumberFormat(locale === "en" ? "en-US" : locale), [locale]);
  // The monthly page allowance's reset date: the 1st, shown as a date in UTC.
  const resetDate = (iso: string) =>
    new Intl.DateTimeFormat(locale === "en" ? "en-US" : locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(iso));

  const [quota, setQuota] = useState<CrawlQuotaDto | null>(null);
  const [crawls, setCrawls] = useState<CrawlDto[]>([]);
  const [active, setActive] = useState<CrawlDto | null>(null);
  const [issues, setIssues] = useState<CrawlIssuePage | null>(null);

  const [url, setUrl] = useState(initialUrl ?? "");
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
  /** Bumped by "Reset to defaults": remounts the configuration, which re-reads the site's saved settings. */
  const [resetKey, setResetKey] = useState(0);
  // The host's saved segments, for the AI and semantic "chosen by" pickers outside Add data.
  const segmentNamesForHost = useSiteSegmentNames(view === "start" && mode === "spider" ? hostOfInput(url) : null);
  const [semantic, setSemantic] = useState<TopPages | null>(null);
  const [inspection, setInspection] = useState<TopPages | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
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
  // Results open on Issues → By rule; ?rule=<id> (Fix first's link) opens that rule.
  // On /crawler/[id]/pages, ?rule=<id> instead filters Pages to that rule's pages.
  const deepRule = useSearchParams()?.get("rule") ?? null;
  const [tab, setTab] = useState<TabId>(initialTab);
  const [ruleSel, setRuleSel] = useState<string | null>(initialTab === "rules" ? deepRule : null);
  /** The sub-view last open in each group, so switching groups and back keeps your place. */
  const [lastSub, setLastSub] = useState<Partial<Record<GroupId, TabId>>>({});
  const pickTab = (id: TabId) => {
    setTab(id);
    setLastSub((m) => ({ ...m, [GROUP_OF[id]]: id }));
  };
  /** Fix first → Issues › By rule, that rule's affected pages open. */
  const openRule = (ruleId: string) => {
    setRuleSel(ruleId);
    pickTab("rules");
    if (typeof document !== "undefined") document.getElementById("tab-issues")?.scrollIntoView?.({ block: "start" });
  };
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
    setSummary(null);
    setDuplicates(null);
    setRedirects(null);
  };
  const [duplicates, setDuplicates] = useState<DuplicatePage | null>(null);
  const [dupKind, setDupKind] = useState<DuplicateKind>("title");
  const [dupPage, setDupPage] = useState(1);
  const [redirects, setRedirects] = useState<RedirectPage | null>(null);
  const [redirectPage, setRedirectPage] = useState(1);
  // The Pages view owns its filters and rows; these are what it opens with
  // (a Structure click sets a URL prefix, /pages?rule= a rule).
  const [pageFilters, setPageFilters] = useState<PageFilters>(() =>
    initialTab === "pages" && deepRule ? { ...EMPTY_PAGE_FILTERS, rule: deepRule } : EMPTY_PAGE_FILTERS,
  );

  /** Fetches; never sets state itself, so effects can decide when to apply. */
  const loadList = useCallback(async (): Promise<CrawlListResponse | null> => {
    const res = await fetch("/api/seo/v1/crawl");
    if (!res.ok) return null;
    return (await res.json()) as CrawlListResponse;
  }, []);

  const applyList = useCallback((data: CrawlListResponse) => {
    setQuota(data.quota);
    setCrawls(data.crawls);
    // Results view: the crawl in the URL (fetched on its own below when it is
    // older than the list). The Start view shows no crawl of its own.
    if (view === "results") setActive((current) => current ?? data.crawls.find((c) => c.id === crawlId) ?? null);
  }, [view, crawlId]);

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

  // Results view, a crawl past the list window: read it by id.
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    if (view !== "results" || !crawlId || active) return;
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/seo/v1/crawl/${encodeURIComponent(crawlId)}`);
      if (cancelled) return;
      if (res.ok) setActive((await res.json()) as CrawlDto);
      else setMissing(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [view, crawlId, active]);

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
    // An archived crawl's findings are in the archive: no request until it is restored.
    if (!active || isInFlight(active.status) || rowsArchived(active)) return;
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
        which === "duplicates"
            ? `/api/seo/v1/crawl/${crawlId}/duplicates?type=${dupKind}&page=${dupPage}&${seg}`
            : `/api/seo/v1/crawl/${crawlId}/redirects?page=${redirectPage}&${seg}`;

      const res = await fetch(url);
      if (!res.ok) return null;
      return res.json();
    },
    [dupKind, dupPage, redirectPage, segment],
  );

  useEffect(() => {
    if (!active || isInFlight(active.status) || rowsArchived(active) || (tab !== "duplicates" && tab !== "redirects")) return;
    let cancelled = false;
    void (async () => {
      const data = await loadTab(active.id, tab);
      if (cancelled) return;
      if (tab === "duplicates") setDuplicates((data as DuplicatePage | null) ?? null);
      if (tab === "redirects") setRedirects((data as RedirectPage | null) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [active, tab, loadTab]);

  // The summary feeds the hero, Fix first and the Data tabs: loaded once the
  // crawl settles, again when the segment changes.
  const settledId = active && !isInFlight(active.status) ? active.id : null;
  useEffect(() => {
    if (!settledId) return;
    let cancelled = false;
    const seg = segment ? `segment=${encodeURIComponent(segment)}` : "";
    void fetch(`/api/seo/v1/crawl/${settledId}/summary?${seg}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: CrawlSummaryDto | PartialSummaryDto | null) => {
        if (!cancelled) setSummary(d ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [settledId, segment]);

  async function start(event: React.FormEvent) {
    event.preventDefault();
    const extra = mode === "spider" ? addData : null;
    const aiExtra = mode === "spider" && flag("crawl.ai") ? ai : null;
    const semExtra = mode === "spider" && flag("crawl.semantic") ? semantic : null;
    const insExtra = mode === "spider" && flag("crawl.inspection") ? inspection : null;
    if ((extra || aiExtra || semExtra || insExtra) && !confirming) {
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
          ...((flag("crawl.config") && cfg.config) || extra || aiExtra || semExtra || insExtra
            ? {
                config: {
                  ...(flag("crawl.config") && cfg.config ? cfg.config : {}),
                  ...(extra ? { addData: extra } : {}),
                  ...(aiExtra ? { ai: aiExtra } : {}),
                  ...(semExtra ? { semantic: semExtra } : {}),
                  ...(insExtra ? { inspection: insExtra } : {}),
                },
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
            : data?.code === "PAGE_ALLOWANCE_EXCEEDED" && typeof data.limit === "number" && typeof data.resetsAt === "string"
              ? t.errPages(int.format(Number(data.used) || 0), int.format(data.limit), resetDate(data.resetsAt))
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
      // The crawl's own page: progress while it runs, the results after.
      router.push(`/crawler/${data.id}`);
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
        <CrawlerHeader t={t} locale={locale} quota={quota} />
        <Card>
          <CardContent className="py-10 text-center">
            <Network className="mx-auto h-8 w-8 text-gray-500" aria-hidden="true" />
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
  // The crawl archive: a kept crawl whose rows are in Spaces shows its summary,
  // then "Archived — Restore" in place of every tab that reads rows.
  const archived = Boolean(active && rowsArchived(active));
  // Start view: one crawl at a time per workspace, so a crawl in flight anywhere holds the Start button.
  const busy = crawls.some((c) => isInFlight(c.status));
  const advancedCount = [cfg.config, addData, ai, semantic, inspection].filter(Boolean).length;
  const resetAdvanced = () => {
    setResetKey((k) => k + 1);
    setAddData(null);
    setAi(null);
    setSemantic(null);
    setInspection(null);
    setConfirming(false);
    setNotice(t.ux.resetDone);
  };

  if (view === "start") {
    return (
      <div className="space-y-6">
        <CrawlerHeader t={t} locale={locale} quota={quota} howto="overview" />
        <CrawlerNav current="start" t={t.ux} />

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
                  disabled={starting || busy}
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
                  disabled={starting || busy}
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
                  disabled={starting || busy}
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
                  disabled={starting || busy}
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
              disabled={starting || (mode === "spider" ? !url.trim() : listUrls.length === 0) || busy}
            >
              {starting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> {t.starting}
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
            {quota?.pages && !quota.locked && (
              <p data-testid="crawl-pages-month">
                {quota.pages.limit === null
                  ? t.pagesUnlimited(int.format(quota.pages.used))
                  : t.pagesNote(int.format(quota.pages.used), int.format(quota.pages.limit), resetDate(quota.pages.resetsAt))}
              </p>
            )}
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
                <li key={i}>{problemText(p, t.p4a, t.p4b, t.p4d, t.p4e, t.p4g)}</li>
              ))}
            </ul>
          )}
          {notice && <p className="mt-3 text-sm text-gray-600">{notice}</p>}

          {mode === "spider" && quota && (
            <details className="mt-4 rounded-lg border border-gray-200 bg-gray-50" id="crawl-advanced">
              <summary className="flex cursor-pointer select-none flex-wrap items-baseline justify-between gap-2 px-4 py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                <span className="text-sm font-semibold text-gray-900">{t.ux.advancedTitle}</span>
                <span className="text-xs text-gray-600">{advancedCount ? t.ux.advancedSet(int.format(advancedCount)) : t.ux.notSet}</span>
              </summary>
              <div className="space-y-3 border-t border-gray-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-gray-600">{t.ux.advancedHelp}</p>
                  <button type="button" onClick={resetAdvanced} className="text-xs font-medium text-blue-700 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                    {t.ux.reset}
                  </button>
                </div>
          {flag("crawl.config") && mode === "spider" && quota && (
            <CrawlConfigSection
              key={resetKey}
              ux={t.ux}
              t={t.p4a}
              t4b={t.p4b}
              t4e={t.p4e}
              renders={quota.renderCap > 0 && renderMode !== "none"}
              caps={{ extractors: quota.extractorCap ?? 0, searches: quota.searchCap ?? 0, segments: quota.segmentCap ?? 0, js: quota.jsSnippetCap ?? 0 }}
              rootUrl={url}
              urlCap={int.format(quota.urlCap)}
              disabled={starting || busy}
              onChange={onConfig}
            />
          )}

          {(flag("crawl.psi") || flag("crawl.backlinks") || flag("crawl.gsc") || flag("crawl.ga4") || flag("crawl.ai") || flag("crawl.semantic") || flag("crawl.inspection")) && mode === "spider" && quota && (
            <AdvancedSection id="add-data" title={t.ux.secAddData} summary={summaryLine([addData?.psi && t.ux.sumPsi(int.format(addData.psi.pages)), addData?.backlinks && t.ux.sumBacklinks(int.format(addData.backlinks.pages)), inspection && t.ux.sumInspection(int.format(inspection.pages))], t.ux.notSet)}>
            <AddDataSection
              bare
              t={t.p4d}
              host={hostOfInput(url)}
              quota={addDataQuota(quota)}
              value={addData}
              onChange={(v) => {
                setAddData(v);
                setConfirming(false);
              }}
              disabled={starting || busy}
              extra={(segments) => (
                <>
                  {flag("crawl.inspection") && (
                    <InspectionSection
                      t={t.p4g}
                      t4d={t.p4d}
                      host={hostOfInput(url)}
                      cap={quota.inspectionCap ?? 0}
                      value={inspection}
                      segments={segments}
                      int={int}
                      disabled={starting || busy}
                      onChange={(v) => {
                        setInspection(v);
                        setConfirming(false);
                      }}
                    />
                  )}
                </>
              )}
            >
              <SourceLines t={t.p4d} host={hostOfInput(url)} />
            </AddDataSection>
            </AdvancedSection>
          )}

                {/* Not drawn on a plan whose AI page cap is 0 (the crawler-only
                    plan: the prompts run Claude on our key, plan-config.ts). */}
                {flag("crawl.ai") && (quota?.aiPageCap ?? 0) > 0 && (
                  <AdvancedSection id="ai" title={t.ux.secAi} summary={ai ? t.ux.sumAi(int.format(ai.prompts.length), int.format(ai.top.pages)) : t.ux.notSet}>
                    <AiPromptsSection
                        t={t.p4e}
                        t4d={t.p4d}
                        quota={aiQuota(quota)}
                        value={ai}
                        segments={segmentNamesForHost}
                        int={int}
                        disabled={starting || busy}
                        onChange={(v) => {
                          setAi(v);
                          setConfirming(false);
                        }}
                      />
                  </AdvancedSection>
                )}
                {flag("crawl.semantic") && (
                  <AdvancedSection id="semantic" title={t.ux.secSemantic} summary={semantic ? t.ux.sumPages(int.format(semantic.pages)) : t.ux.notSet}>
                    <SemanticSection
                      t={t.p4g}
                      t4d={t.p4d}
                      cap={quota.semanticCap ?? 0}
                      hasKey={quota.aiKeys?.openai ?? false}
                      value={semantic}
                      segments={segmentNamesForHost}
                      int={int}
                      disabled={starting || busy}
                      onChange={(v) => {
                        setSemantic(v);
                        setConfirming(false);
                      }}
                    />
                  </AdvancedSection>
                )}
                <AdvancedSection id="spelling" title={t.ux.secSpelling} summary={t.ux.spellingSummary}>
                  <AcceptedWords t={t} />
                </AdvancedSection>
              </div>
            </details>
          )}

          {confirming && (addData || ai || semantic || inspection) && quota && (
            <div role="dialog" aria-labelledby="crawl-confirm-title" className="mt-4 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p id="crawl-confirm-title" className="text-sm font-semibold text-gray-900">
                {t.p4d.confirmTitle}
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
                {[...(addData ? confirmLines(t.p4d, addData, addDataQuota(quota)) : []), ...(ai ? [aiConfirmLine(t.p4e, ai, int)] : []), ...(semantic ? [semanticConfirmLine(t.p4g, semantic, int)] : []), ...(inspection ? [t.p4g.confirmIns(int.format(inspection.pages))] : [])].map((line) => (
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


        </CardContent>
      </Card>

      <RecentCrawls crawls={crawls.slice(0, 5)} locale={locale} t={t} int={int} />
      </div>
    );
  }

  // ── Results (/crawler/[id]) ─────────────────────────────────────────────
  const tabsOf = crawlTabs(active);
  const subsOf = (g: GroupId) => SUB_ORDER.filter((id) => GROUP_OF[id] === g && tabsOf.includes(id));
  const groupsOf = GROUPS.filter((g) => subsOf(g).length > 0);
  return (
    <div className="space-y-6">
      <CrawlerHeader t={t} locale={locale} quota={quota} howto={tab === "pages" ? "pages" : "issues"} />
      <CrawlerNav current="results" t={t.ux} />
      {missing && !active && <p className="text-sm text-gray-700">{t.ux.notFound}</p>}

      {active && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-gray-900" data-testid="results-host">
                  {active.mode === "list" && <Badge className="mr-2">{t.p4a.listBadge}</Badge>}
                  {hostOfCrawl(active.rootUrl)}
                </h2>
                <p className="truncate text-xs text-gray-600" title={active.rootUrl}>
                  {formatDateTime(active.createdAt, locale)} · {active.rootUrl}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={active.status === "FAILED" ? "danger" : "default"}>
                  {active.status === "QUEUED" && active.queuePosition ? t.statusQueuedAt(int.format(active.queuePosition)) : statusLabel(active.status, t)}
                </Badge>
                {!running && !active.dataPurgedAt && !archived && (
                  <ExportsMenu
                    t={t}
                    links={[
                      { href: `/api/seo/v1/crawl/${active.id}/export?view=issues${segment ? `&segment=${encodeURIComponent(segment)}` : ""}`, label: t.ux.exportIssues },
                      { href: `/api/seo/v1/crawl/${active.id}/pages?format=csv${segment ? `&segment=${encodeURIComponent(segment)}` : ""}`, label: t.ux.exportPages },
                      { href: `/api/seo/v1/crawl/${active.id}/export?view=broken-links${segment ? `&segment=${encodeURIComponent(segment)}` : ""}`, label: t.p4a.exportBrokenLinks },
                      { href: `/api/seo/v1/crawl/${active.id}/export?view=redirects${segment ? `&segment=${encodeURIComponent(segment)}` : ""}`, label: t.p4a.exportRedirectHops },
                      ...(tabsOf.includes("external") ? [{ href: `/api/seo/v1/crawl/${active.id}/external?format=csv`, label: t.ux.exportExternal }] : []),
                      ...(tabsOf.includes("extraction") ? [{ href: `/api/seo/v1/crawl/${active.id}/extractions?${extractionQuery("", segment || null)}&format=csv`, label: t.ux.exportExtraction }] : []),
                    ]}
                  >
                    {/* Phase 4c: the PDF crawl report; the button probes the route and hides itself when unavailable. */}
                    {flag("crawl.reports") && active.status === "COMPLETED" && (
                      <ReportDownloadButton key={active.id} endpoint={`/api/seo/v1/crawl/${active.id}/report`} />
                    )}
                    {flag("crawl.sheets") && active.status === "COMPLETED" && (
                      <SheetsExport crawlId={active.id} t={t.p4c} int={int} guideHref={lookerStudioHref(locale)} />
                    )}
                  </ExportsMenu>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {running ? (
              <div className="space-y-3">
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-gray-900 transition-[width] duration-500 motion-reduce:transition-none"
                    style={{
                      width: `${Math.min(100, Math.round((active.pagesCrawled / Math.max(1, active.urlCap)) * 100))}%`,
                    }}
                  />
                </div>
                <p className="text-sm text-gray-600">
                  {t.progress(int.format(active.pagesCrawled), int.format(active.urlCap))}
                </p>
                {active.renderMode !== "none" && (
                  <p className="text-xs text-gray-600">
                    {t.renderedProgress(int.format(active.pagesRendered), int.format(active.renderCap))}
                  </p>
                )}
                <p className="text-xs text-gray-600">{t.crawlingNote}</p>
                <Button variant="outline" size="sm" onClick={cancel} disabled={cancelling}>
                  {cancelling ? t.cancelling : t.cancelCta}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <CompletenessBanner lines={completenessLines(active, summary, t, int)} />
                <ResultsHero crawl={active} summary={summary} t={t} int={int} />
                <details className="rounded-lg border border-gray-200" id="crawl-details">
                  <summary className="cursor-pointer select-none px-4 py-2 text-sm font-medium text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                    {t.ux.details}
                  </summary>
                  <div className="space-y-4 border-t border-gray-200 p-4">
                    <Summary crawl={active} t={t} int={int} />
                    <OverviewPanel summary={summary} t={t} int={int} />
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
                  </div>
                </details>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {active && !running && archived && (
        <ArchivedPanel
          key={active.id}
          crawlId={active.id}
          storageState={active.storageState ?? "ARCHIVED"}
          host={hostOfCrawl(active.rootUrl)}
          a={t.archive}
          onRestored={() => {
            void fetch(`/api/seo/v1/crawl/${active.id}`)
              .then((r) => (r.ok ? r.json() : null))
              .then((fresh: CrawlDto | null) => fresh && setActive((current) => (current?.id === fresh.id ? fresh : current)));
          }}
        />
      )}

      {active && !running && !archived && (
        <FixFirst
          summary={summary}
          onOpenRule={openRule}
          ruleHref={(r) => `${CRAWLER_ROUTES.results(active.id)}?rule=${encodeURIComponent(r)}`}
          t={t}
          int={int}
        />
      )}

      {active && !running && !archived && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <TabStrip
              label={t.ux.tabsLabel}
              items={groupsOf.map((g) => ({ id: g, label: groupLabel(g, t) }))}
              current={GROUP_OF[tab]}
              onSelect={(g) => setTab(lastSub[g] && tabsOf.includes(lastSub[g]!) ? lastSub[g]! : subsOf(g)[0]!)}
            />
            <SegmentPicker names={segmentNames} value={segment} onChange={pickSegment} t={t} />
          </div>
          {subsOf(GROUP_OF[tab]).length > 1 && (
            <TabStrip
              size="sm"
              label={t.ux.subTabsLabel}
              items={subsOf(GROUP_OF[tab]).map((id) => ({ id, label: subLabel(id, t) }))}
              current={tab}
              onSelect={pickTab}
            />
          )}
        </div>
      )}

      {active && !running && !archived && <div role="tabpanel" aria-labelledby={`tab-${subsOf(GROUP_OF[tab]).length > 1 ? tab : GROUP_OF[tab]}`} className="space-y-4">

      {active && !running && !archived && tab === "metrics" && (
        <>
          {summary && "metricOverview" in summary && summary.metricOverview ? <MetricTiles data={summary.metricOverview} t={t.p4d} int={int} /> : <OverviewPanel summary={summary} t={t} int={int} />}
          {flag("crawl.ai") && summary && "metricOverview" in summary && summary.metricOverview && (
            <AiStatusLine status={summary.metricOverview.status as object} t={t.p4e} int={int} />
          )}
          {flag("crawl.semantic") && summary && "metricOverview" in summary && summary.metricOverview && (
            <p className="text-xs text-gray-600">
              {semanticStatusText((summary.metricOverview.status as { semantic?: Parameters<typeof semanticStatusText>[0] }).semantic, t.p4g, int)}
            </p>
          )}
        </>
      )}

      {active && !running && !archived && tab === "segments" && (
        <SegmentOverview segments={summary?.segments} segment={summary?.segment} onPick={pickSegment} t={t} int={int} />
      )}

      {active && !running && !archived && tab === "rules" && (
        <IssuesView
          key={ruleSel ?? ""}
          crawlId={active.id}
          crawl={active}
          locale={locale}
          segmentNames={segmentNames}
          segment={segment}
          onSegment={pickSegment}
          initialRule={ruleSel}
          t={t}
          int={int}
        />
      )}

      {active && !running && !archived && tab === "external" && <ExternalPanel crawlId={active.id} t={t} int={int} />}

      {active && !running && !archived && tab === "extraction" && (
        <ExtractionPanel
          crawlId={active.id}
          extractorNames={[...(active.config?.extractors ?? []).map((e) => e.name), ...(active.config?.js ?? []).map((s) => `JS: ${s.name}`), ...(active.config?.ai?.prompts ?? []).map((p, i) => `AI: ${p.preset === "custom" ? `${t.p4e.aiPresets.custom} ${i + 1}` : t.p4e.aiPresets[p.preset]}`)]}
          segment={segment || null}
          t={t}
          int={int}
        />
      )}

      {active && !running && !archived && tab === "structure" && (
        <StructurePanel
          crawlId={active.id}
          rootUrl={active.rootUrl}
          segment={segment || null}
          purged={Boolean(active.dataPurgedAt)}
          onFilterPages={(urlPrefix) => {
            setPageFilters({ ...EMPTY_PAGE_FILTERS, urlPrefix });
            setTab("pages");
          }}
          t={t}
          int={int}
        />
      )}

      {active && !running && !archived && tab === "compare" && (
        <ComparePanel
          crawlId={active.id}
          segment={segment || null}
          segmentName={segment ? (segmentNames[Number(segment)] ?? null) : null}
          locale={locale}
          t={t}
          int={int}
        />
      )}

      {active && !running && !archived && tab === "duplicates" && (
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

      {active && !running && !archived && tab === "redirects" && (
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

      {active && !running && !archived && tab === "pages" && (
        <PagesView
          key={JSON.stringify(pageFilters)}
          crawlId={active.id}
          crawl={active}
          locale={locale}
          segmentNames={segmentNames}
          segment={segment}
          onSegment={pickSegment}
          initialFilters={pageFilters}
          searchNames={flag("crawl.extraction") ? (active.config?.searches ?? []).map((x) => x.name) : []}
          extractionNames={extractionNamesOf(active.config, t)}
          linksOn={flag("crawl.links") && !active.dataPurgedAt}
          t={t}
          int={int}
        />
      )}

      {active && !running && !archived && tab === "issues" && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-gray-900">{t.issuesTitle}</h3>
              <div className="flex flex-wrap items-end gap-2">
                <Select
                  id="issues-severity"
                  label={t.filterSeverity}
                  className="w-auto"
                  value={severity}
                  onChange={(e) => {
                    setSeverity(e.target.value);
                    setPage(1);
                  }}
                  options={[
                    { value: "", label: t.filterAll },
                    ...SEVERITIES.map((s) => ({ value: s, label: severityLabel(s, t) })),
                  ]}
                />
                <Select
                  id="issues-type"
                  label={t.filterType}
                  className="w-auto"
                  value={type}
                  onChange={(e) => {
                    setType(e.target.value);
                    setPage(1);
                  }}
                  options={[
                    { value: "", label: t.filterAll },
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
                      <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-600">
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
      </div>}
    </div>
  );
}

/** A view's walkthrough state in localStorage: "seen", "off", none, or "unavailable" (storage blocked). */
export function readHowto(view: HowtoView): "seen" | "off" | null | "unavailable" {
  try {
    const v = window.localStorage.getItem(howtoStorageKey(view));
    return v === "seen" || v === "off" ? v : null;
  } catch {
    return "unavailable";
  }
}

export function writeHowto(view: HowtoView, value: "seen" | "off"): void {
  try {
    window.localStorage.setItem(howtoStorageKey(view), value);
  } catch {
    // Private mode or blocked storage: the walkthrough just won't remember.
  }
}

export function CrawlerHeader({ t, locale, quota, howto }: { t: SiteCrawlerCopy; locale: DashLocale; quota: CrawlQuotaDto | null; howto?: HowtoView }) {
  // The Help button opens <CrawlerHelpModal> (pageHelp's modal entry for
  // /crawler, help-content.ts), loaded on demand so this page's bundle does
  // not carry it. ?help=1 opens it on arrival (schedule email, public page).
  // Its footer still opens the full /learn guide in a new tab.
  // The How to button opens this view's walkthrough the same way: ?howto=1
  // opens it on arrival, and each view opens it by itself once, on the first
  // visit, unless "Don't show again" is set (localStorage, per view).
  const help = helpModalFor("/crawler");
  const params = useSearchParams();
  const deepLinked = params?.get("help") === "1";
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const howtoButton = useRef<HTMLButtonElement>(null);
  const [howtoOpen, setHowtoOpen] = useState(false);
  const [howtoOff, setHowtoOff] = useState(false);
  const howtoDeep = params?.get("howto") === "1";
  useEffect(() => {
    if (!howto) return;
    // Storage is read after mount (the server render has none), and applied
    // on the next frame rather than synchronously inside the effect.
    const frame = requestAnimationFrame(() => {
      const state = readHowto(howto);
      setHowtoOff(state === "off");
      if (howtoDeep) setHowtoOpen(true);
      else if (state === null) {
        setHowtoOpen(true);
        writeHowto(howto, "seen");
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [howto, howtoDeep]);
  const shown = open || (deepLinked && !dismissed);
  const close = () => {
    setOpen(false);
    setDismissed(true);
    // Back to the trigger, also when the dialog opened from the deep link (nothing had focus then).
    requestAnimationFrame(() => button.current?.focus());
  };
  const closeHowto = () => {
    setHowtoOpen(false);
    requestAnimationFrame(() => howtoButton.current?.focus());
  };
  const headerButton =
    "inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2";
  // The brand lives in the top bar (mark, name, byline); this header starts
  // with the description, How to / Help / Guides right-aligned on the same
  // row. Guides is a link, not a dialog: the crawler guides on the public
  // Knowledge Hub (#nosy-bat), in the dashboard's language, in a new tab. It
  // shows on every crawler view, the locked-plan screen included.
  const guidesHref = learnHref(locale, CRAWLER_GUIDES_HREF);
  return (
    <div className="flex items-start justify-between gap-3" data-testid="crawler-header">
      <p className="max-w-3xl text-sm text-gray-600">{t.subtitle}</p>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {howto && (
          <button ref={howtoButton} type="button" onClick={() => setHowtoOpen(true)} aria-haspopup="dialog" className={headerButton} data-testid="howto-button">
            <BookOpen className="mr-2 h-4 w-4 text-emerald-700" aria-hidden="true" />
            {t.ux.howtoButton}
          </button>
        )}
        {help && (
          <button
            ref={button}
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t.helpAria}
            aria-haspopup="dialog"
            className={headerButton}
          >
            <CircleQuestionMark className="mr-2 h-4 w-4 text-blue-600" aria-hidden="true" />
            {t.helpButton}
          </button>
        )}
        <a href={guidesHref} target="_blank" rel="noopener noreferrer" aria-label={t.ux.guidesAria} className={headerButton} data-testid="guides-link">
          <Library className="mr-2 h-4 w-4 text-emerald-700" aria-hidden="true" />
          {t.ux.guidesButton}
        </a>
      </div>
      {help && shown && (
        <CrawlerHelpModal t={t} locale={locale} quota={quota} guideHref={learnHref(locale, help.guide)} allGuidesHref={guidesHref} onClose={close} />
      )}
      {howto && howtoOpen && (
        <CrawlerHowtoModal
          view={howto}
          locale={locale}
          onClose={closeHowto}
          dontShow={howtoOff}
          onDontShow={(off) => {
            setHowtoOff(off);
            writeHowto(howto, off ? "off" : "seen");
          }}
        />
      )}
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
