"use client";

// /crawler/history (UX restructure): every crawl the workspace has, newest
// first, filterable by host and status, with health, pages, kind totals,
// pin/unpin and open. Retention is explained in one line from the plan's
// kept-crawl count. Reads GET /api/seo/v1/crawl?history=1 (tenant-scoped).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Pin, PinOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SITE_CRAWLER_COPY, type DashLocale } from "@/lib/i18n/dashboard";
import { CRAWL_PIN_MAX, RETENTION_UNFINISHED_DAYS } from "@/lib/site-crawler/constants";
import type { CrawlDto, CrawlQuotaDto } from "@/lib/site-crawler/types";
import { CRAWLER_ROUTES, CrawlerNav, hostOfCrawl, statusLabel } from "./site-crawler-nav";
import { CrawlerHeader } from "./site-crawler-client";

interface HistoryResponse {
  crawls: CrawlDto[];
  quota: CrawlQuotaDto;
  total: number;
  page: number;
  pageSize: number;
}

export function historyQuery(host: string, status: string, page: number): string {
  const q = new URLSearchParams({ history: "1" });
  if (host.trim()) q.set("host", host.trim());
  if (status) q.set("status", status);
  if (page > 1) q.set("page", String(page));
  return q.toString();
}

export function CrawlHistory({ locale }: { locale: DashLocale }) {
  const t = SITE_CRAWLER_COPY[locale];
  const u = t.ux;
  const int = useMemo(() => new Intl.NumberFormat(locale === "en" ? "en-US" : locale), [locale]);
  const date = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }), [locale]);
  const [host, setHost] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Debounced so typing a host is one request, not one per key.
    const timer = setTimeout(() => {
      void fetch(`/api/seo/v1/crawl?${historyQuery(host, status, page)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: HistoryResponse | null) => {
          if (!cancelled) setData(d ?? { crawls: [], quota: null as never, total: 0, page: 1, pageSize: 50 });
        })
        .catch(() => undefined);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [host, status, page]);

  async function togglePin(c: CrawlDto) {
    setBusy(c.id);
    setPinError(null);
    const res = await fetch(`/api/seo/v1/crawl/${c.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pinned: !c.pinned }),
    }).catch(() => null);
    const body = res ? await res.json().catch(() => null) : null;
    if (res?.ok && body) setData((d) => d && { ...d, crawls: d.crawls.map((x) => (x.id === c.id ? { ...x, pinned: !c.pinned } : x)) });
    else if (body?.code === "PIN_LIMIT") setPinError(t.p4a.errPinLimit(String(CRAWL_PIN_MAX)));
    setBusy(null);
  }

  const quota = data?.quota ?? null;
  const filtered = Boolean(host.trim() || status);
  const from = data && data.total > 0 ? (data.page - 1) * data.pageSize + 1 : 0;
  const to = data ? Math.min(data.total, data.page * data.pageSize) : 0;

  return (
    <div className="space-y-6">
      <CrawlerHeader t={t} locale={locale} quota={quota} />
      <CrawlerNav current="history" t={u} />
      <Card>
        <CardHeader>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-gray-900">{u.historyTitle}</h2>
            {quota?.crawlsKept !== undefined && (
              <p className="text-xs text-gray-600" data-testid="retention">
                {u.historyRetention(int.format(quota.crawlsKept), int.format(CRAWL_PIN_MAX), int.format(RETENTION_UNFINISHED_DAYS))}
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1 sm:max-w-xs">
              <label htmlFor="history-host" className="mb-1 block text-xs font-medium text-gray-700">
                {u.filterHost}
              </label>
              <Input
                id="history-host"
                value={host}
                placeholder="example.com"
                onChange={(e) => {
                  setHost(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div>
              <label htmlFor="history-status" className="mb-1 block text-xs font-medium text-gray-700">
                {u.filterStatus}
              </label>
              <Select
                id="history-status"
                className="w-auto"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                options={[
                  { value: "", label: u.statusAll },
                  { value: "COMPLETED", label: t.statusCompleted },
                  { value: "FAILED", label: t.statusFailed },
                  { value: "CANCELLED", label: t.statusCancelled },
                  { value: "ACTIVE", label: u.statusInFlight },
                ]}
              />
            </div>
          </div>

          {pinError && (
            <p role="alert" className="text-sm text-red-700">
              {pinError}
            </p>
          )}

          {!data ? null : data.crawls.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-600">{filtered ? u.historyNoMatch : u.historyEmpty}</p>
          ) : (
            <>
            {/* Column titles for wide screens; each cell also carries its label for screen readers and phones. */}
            <div aria-hidden="true" className="hidden gap-x-3 border-b border-gray-200 pb-2 text-xs font-medium text-gray-600 md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_auto_auto_minmax(0,1.6fr)_auto_auto]">
              <span>{u.colHost}</span>
              <span>{u.colDate}</span>
              <span>{u.colPages}</span>
              <span>{u.colHealth}</span>
              <span>{u.colKinds}</span>
              <span>{u.colStatus}</span>
              <span>{u.colActions}</span>
            </div>
            <ul className="divide-y divide-gray-100" data-testid="history-rows">
              {data.crawls.map((c) => {
                const h = hostOfCrawl(c.rootUrl);
                return (
                  <li key={c.id} data-crawl={c.id} className="grid grid-cols-2 items-center gap-x-3 gap-y-1 py-3 text-sm md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_auto_auto_minmax(0,1.6fr)_auto_auto]">
                    <span className="col-span-2 min-w-0 md:col-span-1">
                      <span className="block truncate font-medium text-gray-900">{h}</span>
                      {c.dataPurgedAt && <span className="text-xs text-gray-600">{u.summaryOnly}</span>}
                    </span>
                    <span className="text-xs text-gray-600">{date.format(new Date(c.createdAt))}</span>
                    <span className="text-xs tabular-nums text-gray-700">
                      <span className="md:sr-only">{u.colPages}: </span>
                      {int.format(c.pagesCrawled)}
                    </span>
                    <span className="text-xs tabular-nums text-gray-700" data-health>
                      <span className="md:sr-only">{u.colHealth}: </span>
                      {c.health === null || c.health === undefined ? u.healthNone : int.format(c.health)}
                    </span>
                    <span className="text-xs tabular-nums text-gray-700" data-kinds title={u.colKinds}>
                      <span className="sr-only">{u.colKinds}: </span>
                      {c.kinds ? `${int.format(c.kinds.issue)} · ${int.format(c.kinds.warning)} · ${int.format(c.kinds.opportunity)}` : u.healthNone}
                    </span>
                    <span>
                      <Badge variant={c.status === "FAILED" ? "danger" : "default"}>{statusLabel(c.status, t)}</Badge>
                    </span>
                    <span className="flex items-center gap-1">
                      {c.status !== "QUEUED" && c.status !== "RUNNING" && !c.dataPurgedAt && (
                        <button
                          type="button"
                          aria-label={c.pinned ? u.unpinCrawl(h) : u.pinCrawl(h)}
                          aria-pressed={Boolean(c.pinned)}
                          title={c.pinned ? t.p4a.unpin : t.p4a.pin}
                          disabled={busy === c.id}
                          onClick={() => void togglePin(c)}
                          className="rounded p-1.5 text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
                        >
                          {c.pinned ? <PinOff className="h-4 w-4" aria-hidden="true" focusable="false" /> : <Pin className="h-4 w-4" aria-hidden="true" focusable="false" />}
                        </button>
                      )}
                      <Link
                        href={CRAWLER_ROUTES.results(c.id)}
                        aria-label={u.openCrawl(h)}
                        className="rounded px-2 py-1 text-sm font-medium text-blue-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        {u.open}
                      </Link>
                    </span>
                  </li>
                );
              })}
            </ul>
            </>
          )}

          {data && data.total > data.pageSize && (
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                {t.prevPage}
              </Button>
              <span className="text-xs text-gray-600">{u.historyPage(int.format(from), int.format(to), int.format(data.total))}</span>
              <Button variant="outline" size="sm" disabled={to >= data.total} onClick={() => setPage((p) => p + 1)}>
                {t.nextPage}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
