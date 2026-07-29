"use client";

// Web Analytics — GA4 reporting.
//
// A CONNECTION-first tool. Four states precede any data (disconnected,
// picking a property, needs-reauth, missing scope) and each is a real screen,
// not an error toast. The unconnected state IS the page — there is no
// placeholder and no "coming soon".
//
// Connect/disconnect/picker plumbing mirrors the GSC integration
// (gsc-insights-client.tsx); only the scope and the API differ.
//
// Charts are hand-rolled inline SVG, matching the rest of the repo — recharts
// is a dependency but is imported nowhere on the client.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AreaChart,
  ExternalLink,
  Loader2,
  Lock,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SCAFFOLD_RELATED } from "@/lib/seo-tools";
import { GA_RANGES, DEFAULT_RANGE, REPORTS_PER_HOUR, type GaRange } from "@/lib/ga/options";
import { HEADLINE_METRICS } from "@/lib/ga/types";
import type {
  ChannelRow,
  GaConnectionStatusDto,
  GaReport,
  HeadlineMetricKey,
  TrafficPoint,
} from "@/lib/ga/types";
import {
  SEO_TOOLS_COPY,
  WEB_ANALYTICS_COPY,
  type DashLocale,
  type WebAnalyticsCopy,
} from "@/lib/i18n/dashboard";

const API = "/api/seo/v1/web-analytics";

/** "3 hours ago", module scope so Date.now() is not called during render. */
function timeAgo(iso: string, relative: Intl.RelativeTimeFormat): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 60) return relative.format(-Math.max(minutes, 1), "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return relative.format(-hours, "hour");
  return relative.format(-Math.round(hours / 24), "day");
}

/** Seconds -> "1m 34s" / "94s". Engagement time is always seconds from GA4. */
function duration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0s";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ─── Traffic chart ──────────────────────────────────────────────────────────

/**
 * Two series on ONE scale.
 *
 * Unlike the Backlinks growth chart, sessions and users are the same order of
 * magnitude (users is a subset of sessions), so a shared axis is meaningful
 * and lets the gap between the lines read as "sessions per user".
 */
function TrafficChart({
  points,
  t,
  int,
}: {
  points: TrafficPoint[];
  t: WebAnalyticsCopy;
  int: Intl.NumberFormat;
}) {
  const W = 720;
  const H = 220;
  const PAD_L = 40;
  const PAD_B = 24;

  if (points.length < 2) return null;

  const plotW = W - PAD_L - 10;
  const plotH = H - PAD_B - 14;
  const max = Math.max(1, ...points.map((p) => Math.max(p.sessions, p.users)));
  const xOf = (i: number) => PAD_L + (i / (points.length - 1)) * plotW;
  const yOf = (v: number) => 14 + (1 - v / max) * plotH;

  const line = (pick: (p: TrafficPoint) => number) =>
    points.map((p, i) => `${xOf(i).toFixed(1)},${yOf(pick(p)).toFixed(1)}`).join(" ");

  const ticks = [max, Math.round(max / 2), 0];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0.5 w-4 rounded bg-blue-600" />
          {t.legendSessions}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0.5 w-4 rounded bg-emerald-500" />
          {t.legendUsers}
        </span>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[480px]" role="img" aria-label={t.trafficTitle}>
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={PAD_L} x2={W - 10} y1={yOf(tick)} y2={yOf(tick)} stroke="#f3f4f6" strokeWidth={1} />
              <text x={4} y={yOf(tick) + 4} className="fill-gray-400" fontSize={11}>
                {int.format(tick)}
              </text>
            </g>
          ))}
          <polyline points={line((p) => p.sessions)} fill="none" stroke="#2563eb" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={line((p) => p.users)} fill="none" stroke="#10b981" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) => (
            <rect
              key={p.date}
              x={xOf(i) - plotW / (points.length - 1) / 2}
              y={0}
              width={plotW / (points.length - 1)}
              height={H - PAD_B}
              fill="transparent"
            >
              <title>{`${p.date} · ${t.legendSessions}: ${int.format(p.sessions)} · ${t.legendUsers}: ${int.format(p.users)}`}</title>
            </rect>
          ))}
          <text x={PAD_L} y={H - 4} className="fill-gray-400" fontSize={11}>
            {points[0].date}
          </text>
          <text x={W - 10} y={H - 4} textAnchor="end" className="fill-gray-400" fontSize={11}>
            {points[points.length - 1].date}
          </text>
        </svg>
      </div>
    </div>
  );
}

// ─── Headline ───────────────────────────────────────────────────────────────

function ChangeChip({ change }: { change: number | null }) {
  if (change === null) return <span className="text-xs text-gray-400">—</span>;
  const up = change > 0;
  const flat = Math.abs(change) < 0.05;
  const cls = flat ? "text-gray-500" : up ? "text-emerald-600" : "text-red-600";
  return (
    <span className={`text-xs font-medium ${cls}`}>
      {flat ? "→" : up ? "↑" : "↓"} {Math.abs(change).toFixed(1)}%
    </span>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export function WebAnalyticsClient({ locale }: { locale: DashLocale }) {
  const t = WEB_ANALYTICS_COPY[locale];
  const tools = SEO_TOOLS_COPY[locale];
  const it = tools.items.web_analytics;

  const { int, pct, relative } = useMemo(
    () => ({
      int: new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }),
      pct: new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }),
      relative: new Intl.RelativeTimeFormat(locale, { numeric: "auto" }),
    }),
    [locale],
  );

  const [status, setStatus] = useState<GaConnectionStatusDto | null>(null);
  const [report, setReport] = useState<GaReport | null>(null);
  const [range, setRange] = useState<GaRange>(DEFAULT_RANGE);
  const [refreshing, setRefreshing] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Distinct from `error`: these replace the page, not sit above it. */
  const [blocker, setBlocker] = useState<"NEEDS_REAUTH" | "MISSING_SCOPE" | null>(null);
  const [statusToken, setStatusToken] = useState(0);

  const reloadStatus = useCallback(() => setStatusToken((n) => n + 1), []);

  // ── Surface the callback's ?ga_error / ?connected on first paint ────────
  //
  // Read in an effect rather than a useState initializer: this component is
  // server-rendered too, and touching window during the initial render would
  // either crash on the server or hydrate to different markup. The state write
  // is deferred past the effect body so nothing is set synchronously during
  // the commit — it still lands before paint.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("ga_error");
    if (!code && !params.get("connected")) return;

    // Clean the query first, so a refresh cannot re-show a stale banner.
    window.history.replaceState({}, "", window.location.pathname);
    if (!code) return;

    const map: Record<string, string> = {
      denied: t.errorDenied,
      bad_state: t.errorBadState,
      no_refresh_token: t.errorNoRefreshToken,
      no_properties: t.errorNoProperties,
      missing_scope: t.missingScopeBody,
      exchange_failed: t.errorExchangeFailed,
    };
    queueMicrotask(() => {
      setError(map[code] ?? t.connectFailed);
      if (code === "missing_scope") setBlocker("MISSING_SCOPE");
    });
  }, [t]);

  // ── Connection status ───────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/status`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => {
        if (cancelled) return;
        setStatus(data as GaConnectionStatusDto);
        if ((data as GaConnectionStatusDto).status === "NEEDS_REAUTH") setBlocker("NEEDS_REAUTH");
      })
      .catch(() => {
        if (!cancelled) setError(t.loadFailed);
      });
    return () => {
      cancelled = true;
    };
  }, [t, statusToken]);

  const ready = Boolean(status?.connected && status.propertyId && status.status === "ACTIVE");

  // ── Report ──────────────────────────────────────────────────────────────

  /** Maps a failed report response onto either a blocking state or a banner. */
  const applyFailure = useCallback(
    (body: { code?: string; limit?: number } | null) => {
      if (body?.code === "NEEDS_REAUTH") return setBlocker("NEEDS_REAUTH");
      if (body?.code === "MISSING_SCOPE") return setBlocker("MISSING_SCOPE");
      if (body?.code === "QUOTA_EXCEEDED") return setError(t.quotaBody);
      if (body?.code === "RATE_LIMITED") {
        return setError(t.rateLimitBody(Number(body.limit) || REPORTS_PER_HOUR));
      }
      setError(t.loadFailed);
    },
    [t],
  );

  // Range changes and first paint. State is only touched inside the promise
  // callbacks — a synchronous setState here would re-render mid-effect.
  useEffect(() => {
    if (!ready || blocker) return;
    let cancelled = false;

    fetch(`${API}/report?range=${range}`)
      .then(async (res) => ({ ok: res.ok, body: await res.json().catch(() => null) }))
      .then(({ ok, body }) => {
        if (cancelled) return;
        if (!ok) return applyFailure(body);
        setError(null);
        setReport(body.report as GaReport);
      })
      .catch(() => {
        if (!cancelled) setError(t.loadFailed);
      });

    return () => {
      cancelled = true;
    };
  }, [ready, blocker, range, applyFailure, t]);

  /** User-initiated refresh: bypasses the cache and takes a rate-limit slot. */
  async function refresh() {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch(`${API}/report?range=${range}&force=1`);
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        applyFailure(body);
        return;
      }
      setReport(body.report as GaReport);
    } catch {
      setError(t.loadFailed);
    } finally {
      setRefreshing(false);
    }
  }

  async function choose(propertyId: string) {
    setPicking(propertyId);
    setError(null);
    try {
      const res = await fetch(`${API}/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId }),
      });
      if (!res.ok) {
        setError(t.connectFailed);
        return;
      }
      reloadStatus();
    } catch {
      setError(t.connectFailed);
    } finally {
      setPicking(null);
    }
  }

  async function unlink() {
    if (!window.confirm(t.disconnectConfirm)) return;
    try {
      await fetch(`${API}/disconnect`, { method: "POST" });
      setReport(null);
      setBlocker(null);
      reloadStatus();
    } catch {
      setError(t.loadFailed);
    }
  }

  const METRIC_LABEL: Record<HeadlineMetricKey, string> = {
    sessions: t.metricSessions,
    totalUsers: t.metricTotalUsers,
    newUsers: t.metricNewUsers,
    engagementRate: t.metricEngagementRate,
    avgEngagementTime: t.metricAvgEngagementTime,
    conversions: t.metricConversions,
  };

  const header = (
    <div>
      <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">{it.name}</h2>
      <p className="mt-1 text-sm text-gray-500">{it.description}</p>
    </div>
  );

  /** The one-line distinction from the internal reputation analytics page. */
  const distinction = (
    <p className="text-xs leading-relaxed text-gray-500">
      {t.vsInternalNote}{" "}
      {SCAFFOLD_RELATED.web_analytics && (
        <Link
          href={SCAFFOLD_RELATED.web_analytics}
          className="font-medium text-blue-600 hover:text-blue-700"
        >
          {t.vsInternalLink}
        </Link>
      )}
    </p>
  );

  const banner = error && (
    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
      <p className="text-sm text-red-800">{error}</p>
    </div>
  );

  // ── Blocking states ─────────────────────────────────────────────────────

  if (blocker === "MISSING_SCOPE") {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <CardContent>
            <div className="flex flex-col items-center py-14 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
                <ShieldAlert className="h-7 w-7 text-amber-500" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">{t.missingScopeTitle}</h3>
              <p className="mt-2 max-w-md text-sm text-gray-500">{t.missingScopeBody}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (blocker === "NEEDS_REAUTH") {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <CardContent>
            <div className="flex flex-col items-center py-14 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                <Lock className="h-7 w-7 text-gray-400" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">{t.reauthTitle}</h3>
              <p className="mt-2 max-w-md text-sm text-gray-500">{t.reauthBody}</p>
              <a
                href={`${API}/connect`}
                className="mt-6 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                {t.reauthCta}
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Disconnected: the connect card IS the page ──────────────────────────
  if (status && !status.connected) {
    return (
      <div className="space-y-6">
        {header}
        {banner}
        <Card>
          <CardContent>
            <div className="flex flex-col items-center py-14 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
                <AreaChart className="h-7 w-7 text-blue-500" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">{t.connectTitle}</h3>
              <p className="mt-2 max-w-md text-sm text-gray-500">{t.connectBody}</p>
              <a
                href={`${API}/connect`}
                className="mt-6 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                {t.connectCta}
              </a>
              <p className="mt-3 max-w-sm text-xs text-gray-400">{t.connectPrivacy}</p>
              <div className="mt-6 max-w-md">{distinction}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Connected but no property chosen: the picker ────────────────────────
  if (status?.connected && !status.propertyId) {
    const properties = status.properties ?? [];
    return (
      <div className="space-y-6">
        {header}
        {banner}
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-gray-900">{t.pickTitle}</h3>
            <p className="mt-1 text-sm text-gray-500">{t.pickBody}</p>
          </CardHeader>
          <CardContent>
            {properties.length === 0 ? (
              <p className="text-sm text-gray-500">{t.noProperties}</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {properties.map((property) => (
                  <li
                    key={property.propertyId}
                    className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {property.displayName}
                      </p>
                      <p className="truncate text-xs text-gray-400">{property.accountName}</p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => void choose(property.propertyId)}
                      loading={picking === property.propertyId}
                      disabled={picking !== null}
                    >
                      {picking === property.propertyId ? t.picking : t.pickCta}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Connected + property: the report ────────────────────────────────────
  return (
    <div className="space-y-6">
      {header}
      {banner}

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-gray-900">
              {t.connectedTo(status?.propertyName ?? status?.propertyId ?? "")}
            </h3>
            {report && (
              <p className="mt-1 text-xs text-gray-500">
                {report.startDate} – {report.endDate}{" "}
                {t.comparedTo(report.previousStartDate, report.previousEndDate)}
                {report.cached && ` · ${t.cachedNote}`}
                {` · ${t.updatedAgo(timeAgo(report.generatedAt, relative))}`}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="inline-flex rounded-lg border border-gray-300 p-0.5"
              role="group"
              aria-label={t.rangeLabel}
            >
              {GA_RANGES.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={range === value}
                  onClick={() => setRange(value)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    range === value ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {value === 7 ? t.range7 : value === 28 ? t.range28 : t.range90}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              type="button"
              onClick={() => void refresh()}
              loading={refreshing}
            >
              {!refreshing && <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />}
              {refreshing ? t.refreshing : t.refresh}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {distinction}
          <div className="flex flex-wrap gap-3 text-xs">
            <button
              type="button"
              onClick={() => void unlink()}
              className="font-medium text-gray-500 underline hover:text-gray-700"
            >
              {t.disconnect}
            </button>
            <a href={`${API}/connect`} className="font-medium text-gray-500 underline hover:text-gray-700">
              {t.changeProperty}
            </a>
          </div>
        </CardContent>
      </Card>

      {ready && !report && !error && (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center py-12 text-center">
              <Loader2 className="mb-3 h-8 w-8 animate-spin text-blue-500" aria-hidden="true" />
              <p className="text-sm text-gray-500">{t.loading}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {report?.empty && (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center py-12 text-center">
              <AreaChart className="mb-3 h-8 w-8 text-gray-300" aria-hidden="true" />
              <p className="text-sm font-medium text-gray-900">{t.emptyTitle}</p>
              <p className="mt-1 max-w-md text-sm text-gray-500">{t.emptyBody}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {report && !report.empty && (
        <>
          {/* Headline */}
          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-gray-900">{t.headlineTitle}</h3>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-6 sm:grid-cols-3 lg:grid-cols-6">
                {HEADLINE_METRICS.map((key) => {
                  const metric = report.headline.find((m) => m.key === key);
                  if (!metric) return null;
                  const display = metric.unavailable
                    ? t.metricUnavailable
                    : key === "engagementRate"
                      ? pct.format(metric.value)
                      : key === "avgEngagementTime"
                        ? duration(metric.value)
                        : int.format(metric.value);
                  return (
                    <div key={key}>
                      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
                        {METRIC_LABEL[key]}
                      </dt>
                      <dd
                        className={`mt-1 text-2xl font-semibold ${
                          metric.unavailable ? "text-gray-300" : "text-gray-900"
                        }`}
                        title={metric.unavailable ? t.metricUnavailableHint : undefined}
                      >
                        {display}
                      </dd>
                      {!metric.unavailable && <ChangeChip change={metric.change} />}
                    </div>
                  );
                })}
              </dl>
            </CardContent>
          </Card>

          {/* Traffic */}
          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-gray-900">{t.trafficTitle}</h3>
              <p className="mt-1 text-xs text-gray-500">{t.trafficSubtitle}</p>
            </CardHeader>
            <CardContent>
              <TrafficChart points={report.traffic} t={t} int={int} />
            </CardContent>
          </Card>

          {/* Channels */}
          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-gray-900">{t.channelsTitle}</h3>
              <p className="mt-1 text-xs text-gray-500">{t.channelsSubtitle}</p>
            </CardHeader>
            <CardContent>
              {report.channels.length === 0 ? (
                <p className="text-sm text-gray-500">{t.channelsEmpty}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                      <th className="py-2 pr-3 font-semibold">{t.colChannel}</th>
                      <th className="w-56 py-2 pr-3 font-semibold">{t.colSessions}</th>
                      <th className="w-20 py-2 pr-3 text-right font-semibold">{t.colShare}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {report.channels.map((row: ChannelRow) => (
                      <tr key={row.channel}>
                        <td className="max-w-0 truncate py-2 pr-3 text-gray-800" title={row.channel}>
                          {row.channel}
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-2">
                            <div
                              aria-hidden="true"
                              className="h-2 shrink-0 rounded bg-blue-500/80"
                              style={{ width: `${Math.max(row.share * 100, 2)}%`, minWidth: 4 }}
                            />
                            <span className="shrink-0 text-gray-600">{int.format(row.sessions)}</span>
                          </div>
                        </td>
                        <td className="py-2 pr-3 text-right text-gray-500">{pct.format(row.share)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {/* Pages + referrers */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <h3 className="text-base font-semibold text-gray-900">{t.pagesTitle}</h3>
              </CardHeader>
              <CardContent>
                {report.pages.length === 0 ? (
                  <p className="text-sm text-gray-500">{t.pagesEmpty}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                          <th className="py-2 pr-3 font-semibold">{t.colPage}</th>
                          <th className="w-20 py-2 pr-3 text-right font-semibold">{t.colViews}</th>
                          <th className="w-24 py-2 pr-3 text-right font-semibold">{t.colEngagement}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {report.pages.map((row) => (
                          <tr key={row.path}>
                            <td className="max-w-0 truncate py-2 pr-3 text-gray-800" title={row.path}>
                              {row.path}
                            </td>
                            <td className="py-2 pr-3 text-right text-gray-600">{int.format(row.views)}</td>
                            <td className="py-2 pr-3 text-right text-gray-500">
                              {pct.format(row.engagementRate)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="text-base font-semibold text-gray-900">{t.referrersTitle}</h3>
                <p className="mt-1 text-xs text-gray-500">{t.referrersSubtitle}</p>
              </CardHeader>
              <CardContent>
                {report.referrers.length === 0 ? (
                  <p className="text-sm text-gray-500">{t.referrersEmpty}</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                        <th className="py-2 pr-3 font-semibold">{t.colSource}</th>
                        <th className="w-24 py-2 pr-3 text-right font-semibold">{t.colSessions}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {report.referrers.map((row) => (
                        <tr key={row.source}>
                          <td className="max-w-0 truncate py-2 pr-3 text-gray-800" title={row.source}>
                            <span className="inline-flex items-center gap-1">
                              <ExternalLink className="h-3 w-3 shrink-0 text-gray-300" aria-hidden="true" />
                              {row.source}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-right text-gray-600">{int.format(row.sessions)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
