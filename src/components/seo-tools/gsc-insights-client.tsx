"use client";

// GSC Insights — real Search Console data for the tenant's connected
// property. States: disconnected → connect CTA; connected-without-property →
// localized picker; NEEDS_REAUTH → banner + reconnect; connected → totals,
// hand-rolled dual-line SVG chart (the repo's chart idiom — PromptTrends /
// RiskDashboard), top queries/pages tables, Sync now (rate-limited),
// disconnect. Zero fake numbers: everything renders from live API responses.

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  SearchCheck,
  MousePointerClick,
  Eye,
  Percent,
  Hash,
  RefreshCw,
  Unplug,
  AlertCircle,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GscInsightsHelpButton } from "@/components/seo-tools/gsc-insights-help";
import { formatDate } from "@/lib/utils";
import { GSC_COPY, SEO_TOOLS_COPY, type DashLocale, type GscCopy } from "@/lib/i18n/dashboard";

interface Status {
  connected: boolean;
  status?: "ACTIVE" | "NEEDS_REAUTH";
  siteUrl?: string | null;
  googleEmail?: string | null;
  lastSyncAt?: string | null;
  /** Rows the last sync stored. Null = never synced; 0 is a real answer. */
  lastRowsSynced?: number | null;
  sites?: { siteUrl: string }[];
  error?: string;
}
interface Row {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}
interface Performance {
  startDate: string;
  endDate: string;
  totals: { clicks: number; impressions: number; ctr: number; position: number };
  daily: { date: string; clicks: number; impressions: number }[];
  topQueries: Row[];
  topPages: Row[];
  error?: string;
}

/** Dual-line chart, hand-rolled SVG per the repo's chart idiom. Clicks and
 * impressions are normalized to their own maxima (two scales, one canvas). */
function DualLineChart({ daily, t }: { daily: Performance["daily"]; t: GscCopy }) {
  const W = 640;
  const H = 120;
  if (daily.length < 2) return null;
  const maxC = Math.max(1, ...daily.map((d) => d.clicks));
  const maxI = Math.max(1, ...daily.map((d) => d.impressions));
  const x = (i: number) => (i / (daily.length - 1)) * (W - 8) + 4;
  const yC = (v: number) => H - 6 - (v / maxC) * (H - 16);
  const yI = (v: number) => H - 6 - (v / maxI) * (H - 16);
  const pts = (f: (v: number) => number, key: "clicks" | "impressions") =>
    daily.map((d, i) => `${x(i)},${f(d[key])}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t.chartTitle}>
        <polyline points={pts(yI, "impressions")} fill="none" stroke="#93c5fd" strokeWidth="1.5" />
        <polyline points={pts(yC, "clicks")} fill="none" stroke="#2563eb" strokeWidth="2" />
      </svg>
      <div className="mt-2 flex gap-4 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-blue-600" /> {t.clicksLegend}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-blue-300" /> {t.impressionsLegend}
        </span>
      </div>
    </div>
  );
}

function RowsTable({
  rows,
  firstCol,
  t,
  locale,
}: {
  rows: Row[];
  firstCol: string;
  t: GscCopy;
  locale: DashLocale;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
            <th className="py-2 pr-3 font-semibold">{firstCol}</th>
            <th className="w-20 py-2 pr-3 text-right font-semibold">{t.colClicks}</th>
            <th className="w-24 py-2 pr-3 text-right font-semibold">{t.colImpressions}</th>
            <th className="w-16 py-2 pr-3 text-right font-semibold">{t.colCtr}</th>
            <th className="w-16 py-2 text-right font-semibold">{t.colPosition}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r) => (
            <tr key={r.keys[0]}>
              <td className="max-w-0 truncate py-2 pr-3 text-gray-800" title={r.keys[0]}>
                {r.keys[0]}
              </td>
              <td className="py-2 pr-3 text-right font-medium text-gray-900">
                {r.clicks.toLocaleString(locale)}
              </td>
              <td className="py-2 pr-3 text-right text-gray-600">
                {r.impressions.toLocaleString(locale)}
              </td>
              <td className="py-2 pr-3 text-right text-gray-600">
                {(r.ctr * 100).toFixed(1)}%
              </td>
              <td className="py-2 text-right text-gray-600">{r.position.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GscInsightsClient({ locale }: { locale: DashLocale }) {
  const t = GSC_COPY[locale];
  const it = SEO_TOOLS_COPY[locale].items.gsc_insights;
  const params = useSearchParams();
  const urlError = params.get("gsc_error");

  const [status, setStatus] = useState<Status | null>(null);
  const [perf, setPerf] = useState<Performance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(
    params.get("connected") ? GSC_COPY[locale].connectedBanner : null,
  );
  const [busy, setBusy] = useState(false);

  const loadStatus = useCallback(() => {
    return fetch("/api/ai/visibility/gsc/status")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((s: Status) => {
        setStatus(s);
        if (!(s.connected && s.status === "ACTIVE" && s.siteUrl)) return;
        return fetch("/api/ai/visibility/gsc/performance").then((pr) => {
          if (pr.status === 409) {
            setStatus({ ...s, status: "NEEDS_REAUTH" });
            return;
          }
          if (!pr.ok) throw new Error(String(pr.status));
          return pr.json().then((p: Performance) => setPerf(p));
        });
      })
      .catch(() => setError(t.loadFailed));
  }, [t]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function selectSite(siteUrl: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/ai/visibility/gsc/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteUrl }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setStatus(null);
      setPerf(null);
      await loadStatus();
    } catch {
      setError(t.loadFailed);
    } finally {
      setBusy(false);
    }
  }

  async function syncNow() {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/ai/visibility/gsc/sync", { method: "POST" });
      if (res.status === 429) {
        setError(t.rateLimited);
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const d = (await res.json()) as { rows: number };
      setNotice(t.syncDone(d.rows));
      await loadStatus();
    } catch {
      setError(t.loadFailed);
    } finally {
      setBusy(false);
    }
  }

  async function doDisconnect() {
    if (!window.confirm(t.disconnectConfirm)) return;
    setBusy(true);
    try {
      await fetch("/api/ai/visibility/gsc/disconnect", { method: "POST" });
      setStatus({ connected: false });
      setPerf(null);
      setNotice(null);
    } finally {
      setBusy(false);
    }
  }

  const hasData =
    perf && (perf.totals.clicks > 0 || perf.totals.impressions > 0 || perf.daily.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">{it.name}</h2>
          <p className="mt-1 text-sm text-gray-500">{it.description}</p>
        </div>
        <div className="shrink-0">
          <GscInsightsHelpButton locale={locale} />
        </div>
      </div>

      {urlError && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {t.errors[urlError] ?? t.loadFailed}
        </p>
      )}
      {notice && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
          {notice}
        </p>
      )}
      {error && (
        <p className="flex items-center gap-2 text-sm text-red-500">
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
      )}

      {!status && !error && <p className="text-sm text-gray-400">{t.loading}</p>}

      {/* Disconnected */}
      {status && !status.connected && (
        <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
            <SearchCheck className="h-7 w-7 text-gray-400" aria-hidden="true" />
          </div>
          <h3 className="text-base font-semibold text-gray-900">{t.connectTitle}</h3>
          <p className="mt-2 max-w-md text-sm text-gray-500">{t.connectBody}</p>
          {/* Full document navigation (route 302s to Google) — a button with
              location.assign, since next/link is for pages, not API routes. */}
          <button
            type="button"
            onClick={() => window.location.assign("/api/ai/visibility/gsc/connect")}
            className="mt-6 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            {t.connectCta}
          </button>
        </div>
      )}

      {/* Needs re-auth */}
      {status?.connected && status.status === "NEEDS_REAUTH" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">{t.reauthBanner}</p>
          <button
            type="button"
            onClick={() => window.location.assign("/api/ai/visibility/gsc/connect")}
            className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {t.reconnect}
          </button>
        </div>
      )}

      {/* Property picker */}
      {status?.connected && status.status === "ACTIVE" && !status.siteUrl && (
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-gray-900">{t.pickTitle}</h3>
            <p className="mt-1 text-sm text-gray-500">{t.pickBody}</p>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-gray-100">
              {(status.sites ?? []).map((s) => (
                <li key={s.siteUrl} className="flex items-center justify-between gap-3 px-6 py-3">
                  <code className="truncate font-mono text-sm text-gray-800">{s.siteUrl}</code>
                  <Button size="sm" onClick={() => selectSite(s.siteUrl)} disabled={busy}>
                    {busy ? t.picking : t.pickButton}
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Connected header + data */}
      {status?.connected && status.status === "ACTIVE" && status.siteUrl && (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
            <span>
              {t.propertyLabel}:{" "}
              <code className="font-mono text-gray-800">{status.siteUrl}</code>
              {status.googleEmail && <span className="ml-2">({status.googleEmail})</span>}
            </span>
            <span className="text-xs text-gray-400">
              {status.lastSyncAt ? t.lastSync(formatDate(status.lastSyncAt, locale)) : t.neverSynced}
            </span>
            {/* Row count sits beside the timestamp so "the sync ran" and "the
                sync stored rows" are two visibly different facts. */}
            {typeof status.lastRowsSynced === "number" && (
              <span
                className={
                  status.lastRowsSynced === 0
                    ? "text-xs font-medium text-amber-700"
                    : "text-xs text-gray-400"
                }
              >
                {status.lastRowsSynced === 0
                  ? t.syncedNoRows
                  : t.syncedRows(status.lastRowsSynced)}
              </span>
            )}
            <span className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={syncNow} disabled={busy}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                {busy ? t.syncing : t.syncNow}
              </Button>
              <Button variant="outline" size="sm" onClick={doDisconnect} disabled={busy}>
                <Unplug className="mr-1.5 h-3.5 w-3.5" />
                {t.disconnect}
              </Button>
            </span>
          </div>

          {/* A sync that stored nothing looks exactly like a broken one, so it
              gets the explanation rather than leaving the user to guess. */}
          {status.lastRowsSynced === 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              {t.syncedNoRowsHint}
            </p>
          )}

          {!perf && !error && <p className="text-sm text-gray-400">{t.loading}</p>}

          {perf && !hasData && (
            <div className="rounded-xl border border-gray-200 bg-white p-10 text-center shadow-sm">
              <p className="text-sm text-gray-500">{t.emptyData}</p>
            </div>
          )}

          {perf && hasData && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  title={t.statClicks}
                  value={perf.totals.clicks.toLocaleString(locale)}
                  icon={<MousePointerClick className="h-5 w-5" />}
                />
                <StatCard
                  title={t.statImpressions}
                  value={perf.totals.impressions.toLocaleString(locale)}
                  icon={<Eye className="h-5 w-5" />}
                />
                <StatCard
                  title={t.statCtr}
                  value={`${(perf.totals.ctr * 100).toFixed(1)}%`}
                  icon={<Percent className="h-5 w-5" />}
                />
                <StatCard
                  title={t.statPosition}
                  value={perf.totals.position.toFixed(1)}
                  icon={<Hash className="h-5 w-5" />}
                />
              </div>

              <Card>
                <CardHeader>
                  <h3 className="text-base font-semibold text-gray-900">{t.chartTitle}</h3>
                </CardHeader>
                <CardContent>
                  <DualLineChart daily={perf.daily} t={t} />
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <h3 className="text-base font-semibold text-gray-900">{t.topQueriesTitle}</h3>
                  </CardHeader>
                  <CardContent>
                    <RowsTable rows={perf.topQueries} firstCol={t.colQuery} t={t} locale={locale} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <h3 className="text-base font-semibold text-gray-900">{t.topPagesTitle}</h3>
                  </CardHeader>
                  <CardContent>
                    <RowsTable rows={perf.topPages} firstCol={t.colPage} t={t} locale={locale} />
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
