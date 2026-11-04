"use client";

// /crawler/history: every crawl the workspace has, newest first, as card rows.
// Each row shows a state tile, host, a date · time · kind line, Pages, Findings
// and Health, a status pill, a report link and a pin toggle. Filters are an exact
// site and a status. Pages hold 20 and use a keyset cursor. Retention is explained
// in one line from the plan's kept-crawl count. Reads GET
// /api/seo/v1/crawl?history=1 (tenant-scoped).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Clock, Info, Loader2, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SITE_CRAWLER_COPY, type DashLocale, type SiteCrawlerCopy } from "@/lib/i18n/dashboard";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import { CRAWL_PIN_MAX, RETENTION_UNFINISHED_DAYS } from "@/lib/site-crawler/constants";
import type { CrawlDto, CrawlQuotaDto } from "@/lib/site-crawler/types";
import { CRAWLER_ROUTES, CrawlerNav, hostOfCrawl } from "./site-crawler-nav";
import { CrawlerHeader } from "./site-crawler-client";

interface HistoryResponse {
  crawls: CrawlDto[];
  quota: CrawlQuotaDto | null;
  total: number;
  nextCursor: string | null;
  pageSize: number;
  hosts?: string[];
}

export function historyQuery(host: string, status: string, cursor: string | null): string {
  const q = new URLSearchParams({ history: "1" });
  if (host.trim()) q.set("host", host.trim());
  if (status) q.set("status", status);
  if (cursor) q.set("cursor", cursor);
  return q.toString();
}

/** Where a crawl stands, as History shows it. Only "complete" crawls are full site reports. */
export type HistoryState = "complete" | "running" | "cancelled" | "stopped" | "failed";

export function historyState(c: Pick<CrawlDto, "status" | "stoppedReason">): HistoryState {
  if (c.status === "QUEUED" || c.status === "RUNNING") return "running";
  // A list crawl whose list expired before it ran never crawled anything.
  if (c.status === "FAILED" || c.stoppedReason === "list_expired") return "failed";
  if (c.status === "CANCELLED") return "cancelled";
  if (c.stoppedReason) return "stopped";
  return "complete";
}

/** The kind line under the host: how the crawl ran, or why it ended early. */
export function kindLine(c: CrawlDto, u: SiteCrawlerCopy["ux"], int: Intl.NumberFormat): string {
  if (c.stoppedReason === "url_cap") return u.kindLimit(int.format(c.urlCap));
  if (c.stoppedReason === "time_cap" || c.status === "CANCELLED") return u.kindStopped(int.format(c.pagesCrawled), int.format(c.urlCap));
  if (c.mode === "list") return u.kindList;
  if (c.scheduled) return u.kindScheduled;
  return u.kindFull;
}

/** Why a row shows no health score; null when it shows one. */
export function healthWhy(c: CrawlDto, u: SiteCrawlerCopy["ux"]): string | null {
  const s = historyState(c);
  if (s === "running") return u.healthWhyRunning;
  if (s === "failed") return u.healthWhyFailed;
  if (s !== "complete") return u.healthWhyIncomplete;
  return c.health === null || c.health === undefined ? u.healthWhyOld : null;
}

const PILL: Record<HistoryState, string> = {
  // Text colours ≥ 4.5:1 on their tint.
  complete: "bg-emerald-50 text-emerald-800",
  running: "bg-blue-50 text-blue-800",
  cancelled: "bg-gray-100 text-gray-700",
  stopped: "bg-amber-50 text-amber-800",
  failed: "bg-red-50 text-red-700",
};

function pillLabel(s: HistoryState, u: SiteCrawlerCopy["ux"]): string {
  return {
    complete: u.pillCompleted,
    running: u.pillRunning,
    cancelled: u.pillCancelled,
    stopped: u.pillStopped,
    failed: u.pillFailed,
  }[s];
}

function healthTone(score: number): string {
  if (score >= 80) return "text-green-800";
  if (score >= 50) return "text-amber-800";
  return "text-red-700";
}

function StateTile({ state }: { state: HistoryState }) {
  const base = "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl";
  if (state === "complete")
    return (
      <span aria-hidden="true" data-tile="complete" className={`${base} bg-emerald-50 text-emerald-700`}>
        <Check className="h-5 w-5" focusable="false" />
      </span>
    );
  if (state === "running")
    return (
      <span aria-hidden="true" data-tile="running" className={`${base} bg-blue-50 text-blue-700`}>
        <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" focusable="false" />
      </span>
    );
  return (
    <span aria-hidden="true" data-tile="clock" className={`${base} bg-gray-100 text-gray-600`}>
      <Clock className="h-5 w-5" focusable="false" />
    </span>
  );
}

const PILL_SELECT =
  "rounded-full border border-gray-300 bg-white py-1.5 pl-4 pr-8 text-sm text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

export function CrawlHistory({ locale }: { locale: DashLocale }) {
  const t = SITE_CRAWLER_COPY[locale];
  const u = t.ux;
  const int = useMemo(() => new Intl.NumberFormat(locale === "en" ? "en-US" : locale), [locale]);
  const day = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }), [locale]);
  const time = useMemo(() => new Intl.DateTimeFormat(locale, { timeStyle: "short" }), [locale]);
  const [host, setHost] = useState("");
  const [status, setStatus] = useState("");
  // Cursors of the pages walked so far; the last one is the page shown (null = first).
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [hosts, setHosts] = useState<string[]>([]);
  const [pinError, setPinError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const cursor = cursors[cursors.length - 1] ?? null;

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/seo/v1/crawl?${historyQuery(host, status, cursor)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: HistoryResponse | null) => {
        if (cancelled) return;
        setData(
          d ?? {
            crawls: [],
            quota: null,
            total: 0,
            nextCursor: null,
            pageSize: 20,
          },
        );
        if (d?.hosts) setHosts(d.hosts);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [host, status, cursor]);

  async function togglePin(c: CrawlDto) {
    setBusy(c.id);
    setPinError(null);
    const res = await fetch(`/api/seo/v1/crawl/${c.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pinned: !c.pinned }),
    }).catch(() => null);
    const body = res ? await res.json().catch(() => null) : null;
    if (res?.ok && body)
      setData(
        (d) =>
          d && {
            ...d,
            crawls: d.crawls.map((x) => (x.id === c.id ? { ...x, pinned: !c.pinned } : x)),
          },
      );
    else if (body?.code === "PIN_LIMIT") setPinError(t.p4a.errPinLimit(String(CRAWL_PIN_MAX)));
    setBusy(null);
  }

  const quota = data?.quota ?? null;
  const filtered = Boolean(host || status);
  const pageIndex = cursors.length - 1;
  const from = data && data.total > 0 ? pageIndex * data.pageSize + 1 : 0;
  const to = data ? Math.min(data.total, pageIndex * data.pageSize + data.crawls.length) : 0;
  const newCrawl = (
    <Link
      href={CRAWLER_ROUTES.start}
      className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
    >
      {u.navStart}
      <span aria-hidden="true">→</span>
    </Link>
  );

  return (
    <div className="space-y-6">
      <CrawlerHeader t={t} locale={locale} quota={quota} howto="history" />
      <CrawlerNav current="history" t={u} />

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between" data-testid="history-hero">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-widest text-gray-600">{u.histEyebrow}</p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">{u.histTitle}</h1>
          <p className="mt-1 text-sm text-gray-600">{u.histSubhead}</p>
        </div>
        {newCrawl}
      </header>

      <div className="flex flex-wrap items-center gap-3" data-testid="history-filters">
        <div className="flex min-w-0 items-center gap-2">
          <label htmlFor="history-host" className="text-xs font-medium text-gray-700">
            {u.filterHost}
          </label>
          <select
            id="history-host"
            className={`${PILL_SELECT} min-w-0 max-w-[14rem] truncate`}
            value={host}
            onChange={(e) => {
              setHost(e.target.value);
              setCursors([null]);
            }}
          >
            <option value="">{u.filterAllSites}</option>
            {hosts.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="history-status" className="text-xs font-medium text-gray-700">
            {u.filterStatus}
          </label>
          <select
            id="history-status"
            className={PILL_SELECT}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setCursors([null]);
            }}
          >
            <option value="">{u.statusAll}</option>
            <option value="COMPLETED">{u.pillCompleted}</option>
            <option value="ACTIVE">{u.pillRunning}</option>
            <option value="CANCELLED">{u.pillCancelled}</option>
            <option value="STOPPED">{u.pillStopped}</option>
            <option value="FAILED">{u.pillFailed}</option>
          </select>
        </div>
      </div>

      {pinError && (
        <p role="alert" className="text-sm text-red-700">
          {pinError}
        </p>
      )}

      {!data ? null : data.crawls.length === 0 ? (
        filtered ? (
          <p className="rounded-xl border border-gray-200 bg-white py-10 text-center text-sm text-gray-600" data-testid="history-no-match">
            {u.historyNoMatch}
          </p>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-12 text-center" data-testid="history-empty">
            {/* eslint-disable-next-line @next/next/no-img-element -- a static SVG; next/image adds nothing */}
            <img src={CRAWLER_BRAND.mark} alt="" width={80} height={80} className="h-20 w-20" />
            <h2 className="text-base font-semibold text-gray-900">{u.historyEmpty}</h2>
            <p className="max-w-sm text-sm text-gray-600">{u.historyEmptyBody}</p>
            {newCrawl}
          </div>
        )
      ) : (
        <ul className="space-y-3" data-testid="history-rows">
          {data.crawls.map((c) => {
            const h = hostOfCrawl(c.rootUrl);
            const state = historyState(c);
            const why = healthWhy(c, u);
            const created = new Date(c.createdAt);
            const findings = c.kinds ? c.kinds.issue + c.kinds.warning + c.kinds.opportunity : null;
            const pinnable = state !== "running" && !c.dataPurgedAt;
            return (
              <li
                key={c.id}
                data-crawl={c.id}
                data-state={state}
                className="group flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 hover:border-gray-300 md:grid md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:items-center md:gap-6"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <StateTile state={state} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900">{h}</p>
                    <p className="text-xs text-gray-600 md:truncate" data-kind-line>
                      {day.format(created)} · {time.format(created)} · {kindLine(c, u, int)}
                      {c.dataPurgedAt ? ` · ${u.summaryOnly}` : ""}
                    </p>
                  </div>
                </div>

                <dl className="grid grid-cols-3 gap-4 text-left md:flex md:gap-6 md:text-right">
                  <div>
                    <dt className="text-xs text-gray-600">{u.colPages}</dt>
                    <dd className="text-sm font-semibold tabular-nums text-gray-900">{int.format(c.pagesCrawled)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-600">{u.colFindings}</dt>
                    <dd className="text-sm font-semibold tabular-nums text-gray-900" data-kinds title={c.kinds ? u.colKinds : undefined}>
                      {findings === null ? u.healthNone : int.format(findings)}
                      {c.kinds && (
                        <span className="sr-only">
                          {" "}
                          ({u.colKinds}: {int.format(c.kinds.issue)} · {int.format(c.kinds.warning)} · {int.format(c.kinds.opportunity)})
                        </span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-600">{u.colHealth}</dt>
                    <dd className="text-sm font-semibold tabular-nums" data-health>
                      {why === null ? (
                        <span className={healthTone(c.health!)}>{u.healthScore(int.format(c.health!))}</span>
                      ) : (
                        <span className="text-gray-600" title={why}>
                          {u.healthNone}
                          <span className="sr-only"> {why}</span>
                        </span>
                      )}
                    </dd>
                  </div>
                </dl>

                {/* Pill and actions share a row on phones; separate grid cells from md up. */}
                <div className="flex items-center justify-between gap-3 md:contents">
                  <span className={`w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${PILL[state]}`} data-pill>
                    {pillLabel(state, u)}
                  </span>

                  <div className="flex items-center justify-end gap-1">
                    {pinnable && (
                      <button
                        type="button"
                        aria-label={c.pinned ? u.unpinCrawl(h) : u.pinCrawl(h)}
                        aria-pressed={Boolean(c.pinned)}
                        title={c.pinned ? t.p4a.unpin : t.p4a.pin}
                        disabled={busy === c.id}
                        onClick={() => void togglePin(c)}
                        className={`rounded p-1.5 text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:opacity-100 disabled:opacity-50 ${
                          c.pinned ? "" : "md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100"
                        }`}
                      >
                        <Pin className={`h-4 w-4 ${c.pinned ? "fill-current" : ""}`} aria-hidden="true" focusable="false" />
                      </button>
                    )}
                    <Link
                      href={CRAWLER_ROUTES.results(c.id)}
                      aria-label={state === "complete" ? u.viewReportOf(h) : u.viewDetailsOf(h)}
                      className="whitespace-nowrap rounded px-2 py-1 text-sm font-medium text-blue-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      {state === "complete" ? u.viewReport : u.viewDetails} <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {data && (data.nextCursor || pageIndex > 0) && (
        <div className="flex items-center justify-between" data-testid="history-pager">
          <Button variant="outline" size="sm" disabled={pageIndex === 0} onClick={() => setCursors((s) => (s.length > 1 ? s.slice(0, -1) : s))}>
            {t.prevPage}
          </Button>
          <span className="text-xs text-gray-600">{u.historyPage(int.format(from), int.format(to), int.format(data.total))}</span>
          <Button variant="outline" size="sm" disabled={!data.nextCursor} onClick={() => data.nextCursor && setCursors((s) => [...s, data.nextCursor])}>
            {t.nextPage}
          </Button>
        </div>
      )}

      <div className="space-y-1">
        <p className="flex gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900" data-testid="history-note">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" focusable="false" />
          {u.incompleteNote}
        </p>
        {quota?.crawlsKept !== undefined && (
          <p className="text-xs text-gray-600" data-testid="retention">
            {u.historyRetention(int.format(quota.crawlsKept), int.format(CRAWL_PIN_MAX), int.format(RETENTION_UNFINISHED_DAYS))}
          </p>
        )}
      </div>
    </div>
  );
}
