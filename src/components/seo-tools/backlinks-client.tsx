"use client";

// Backlinks — the tenant submits a target, one POST runs five live upstream
// calls, and the five sections below fill in together.
//
// Sibling of site-explorer-client.tsx and deliberately the same shape:
// synchronous run, per-section skeletons while it works, a "couldn't load"
// card for any section that failed, and a history list that replays stored
// analyses for free. Zero invented numbers — every cell comes from a stored
// envelope.
//
// Charts are hand-rolled inline SVG, matching rank-tracker-client.tsx and
// prompt-trends.tsx: this repo ships no client chart library (recharts is a
// dependency but is imported nowhere).

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Link2, Loader2, Lock, Search, TrendingUp } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/utils";
import { BacklinksHelpButton } from "@/components/seo-tools/backlinks-help";
import { isValidTarget, type BacklinksMode } from "@/lib/backlinks/target";
import { sectionAppliesTo } from "@/lib/backlinks/types";
import type {
  AnchorRow,
  BacklinksAnalysisDto,
  BacklinksHistoryRow,
  BacklinksSection,
  BacklinksUsage,
  HistoryPoint,
  ReferringDomainRow,
} from "@/lib/backlinks/types";
import {
  BACKLINKS_TOOL_COPY,
  SEO_TOOLS_COPY,
  type BacklinksToolCopy,
  type DashLocale,
} from "@/lib/i18n/dashboard";

const API = "/api/seo/v1/backlinks";

interface HistoryResponse {
  analyses: BacklinksHistoryRow[];
  usage: BacklinksUsage;
  totalCostUsd: number;
}

// ─── Formatting ─────────────────────────────────────────────────────────────

function useFormatters(locale: DashLocale) {
  return useMemo(
    () => ({
      int: new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }),
      dec: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
      relative: new Intl.RelativeTimeFormat(locale, { numeric: "auto" }),
    }),
    [locale],
  );
}

/** "3 hours ago" / "il y a 3 heures", from an ISO timestamp. */
function timeAgo(iso: string, relative: Intl.RelativeTimeFormat): string {
  const elapsedMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(elapsedMs / 60_000);
  if (minutes < 60) return relative.format(-Math.max(minutes, 1), "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return relative.format(-hours, "hour");
  return relative.format(-Math.round(hours / 24), "day");
}

/** DataForSEO timestamps are "2019-01-15 23:22:06 +00:00" — date part only. */
function shortDate(value: string | null): string {
  return value ? value.slice(0, 10) : "—";
}

// ─── Shared card pieces ─────────────────────────────────────────────────────

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold text-gray-900">{value}</dd>
      {unit && <p className="text-xs text-gray-400">{unit}</p>}
    </div>
  );
}

function SectionSkeleton({ rows }: { rows: number }) {
  return (
    <div className="animate-pulse space-y-3" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-4 rounded bg-gray-100" style={{ width: `${95 - i * 7}%` }} />
      ))}
    </div>
  );
}

function SectionFailed({ t }: { t: BacklinksToolCopy }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold text-amber-900">{t.sectionFailedTitle}</p>
        <p className="mt-1 text-sm text-amber-800">{t.sectionFailedBody}</p>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  icon: Icon,
  loading,
  failed,
  skeletonRows,
  t,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  loading: boolean;
  failed: boolean;
  skeletonRows: number;
  t: BacklinksToolCopy;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-gray-400" aria-hidden="true" />
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        </div>
        {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
      </CardHeader>
      <CardContent>
        {loading ? (
          <SectionSkeleton rows={skeletonRows} />
        ) : failed ? (
          <SectionFailed t={t} />
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

// ─── Growth chart ───────────────────────────────────────────────────────────

/**
 * Two series on independent scales: backlinks and referring domains differ by
 * orders of magnitude (1.4 M vs 24 k on a real domain), so a shared y-axis
 * would flatten the smaller line onto the floor and say nothing. Each line is
 * normalized to its own min/max — the shape is the message here, not the
 * absolute height, and the tooltip carries the real numbers.
 */
function GrowthChart({
  points,
  t,
  int,
}: {
  points: HistoryPoint[];
  t: BacklinksToolCopy;
  int: Intl.NumberFormat;
}) {
  const W = 720;
  const H = 200;
  const PAD_L = 8;
  const PAD_B = 22;

  if (points.length < 2) {
    return <p className="text-sm text-gray-500">{t.historyEmpty}</p>;
  }

  const plotW = W - PAD_L - 8;
  const plotH = H - PAD_B - 12;
  const xOf = (i: number) => PAD_L + (i / (points.length - 1)) * plotW;

  const line = (values: number[]) => {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    return values
      .map((v, i) => `${xOf(i).toFixed(1)},${(12 + (1 - (v - min) / span) * plotH).toFixed(1)}`)
      .join(" ");
  };

  const backlinks = points.map((p) => p.backlinks);
  const domains = points.map((p) => p.referringDomains);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0.5 w-4 rounded bg-blue-600" />
          {t.legendBacklinks}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0.5 w-4 rounded bg-emerald-500" />
          {t.legendReferringDomains}
        </span>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[480px]"
          role="img"
          aria-label={t.historyTitle}
        >
          <polyline
            points={line(backlinks)}
            fill="none"
            stroke="#2563eb"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points={line(domains)}
            fill="none"
            stroke="#10b981"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {points.map((p, i) => (
            // Invisible full-height hit area so the tooltip works anywhere in
            // the column, not only exactly on the 2px line.
            <rect
              key={p.month}
              x={xOf(i) - plotW / (points.length - 1) / 2}
              y={0}
              width={plotW / (points.length - 1)}
              height={H - PAD_B}
              fill="transparent"
            >
              <title>
                {`${p.month} · ${t.legendBacklinks}: ${int.format(p.backlinks)} · ${t.legendReferringDomains}: ${int.format(p.referringDomains)}`}
              </title>
            </rect>
          ))}
          <text x={PAD_L} y={H - 4} className="fill-gray-400" fontSize={11}>
            {points[0].month}
          </text>
          <text x={W - 8} y={H - 4} textAnchor="end" className="fill-gray-400" fontSize={11}>
            {points[points.length - 1].month}
          </text>
        </svg>
      </div>
    </div>
  );
}

// ─── Referring domains table ────────────────────────────────────────────────

type DomainSortKey = "rank" | "backlinks" | "spamScore";

function DomainsTable({
  rows,
  t,
  int,
}: {
  rows: ReferringDomainRow[];
  t: BacklinksToolCopy;
  int: Intl.NumberFormat;
}) {
  const [sort, setSort] = useState<{ key: DomainSortKey; desc: boolean }>({
    key: "rank",
    desc: true,
  });

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => (a[sort.key] - b[sort.key]) * (sort.desc ? -1 : 1));
    return copy;
  }, [rows, sort]);

  const toggle = useCallback((key: DomainSortKey) => {
    setSort((prev) => (prev.key === key ? { key, desc: !prev.desc } : { key, desc: true }));
  }, []);

  if (rows.length === 0) return <p className="text-sm text-gray-500">{t.domainsEmpty}</p>;

  const header = (label: string, key: DomainSortKey, className: string) => {
    const active = sort.key === key;
    return (
      <th
        className={className}
        aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"}
      >
        <button
          type="button"
          onClick={() => toggle(key)}
          className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {label}
          <span aria-hidden="true" className={active ? "text-gray-500" : "text-transparent"}>
            {sort.desc ? "▼" : "▲"}
          </span>
        </button>
      </th>
    );
  };

  return (
    <div className="max-h-[28rem] overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="border-b border-gray-200 text-left text-xs text-gray-400">
            <th className="py-2 pr-3 font-semibold uppercase tracking-wide">{t.colDomain}</th>
            {header(t.colRank, "rank", "w-20 py-2 pr-3 text-left")}
            {header(t.colBacklinks, "backlinks", "w-28 py-2 pr-3 text-left")}
            {header(t.colSpam, "spamScore", "w-20 py-2 pr-3 text-left")}
            <th className="w-28 py-2 pr-3 font-semibold uppercase tracking-wide">
              {t.colFirstSeen}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.map((row) => (
            <tr key={row.domain}>
              <td className="max-w-0 truncate py-2 pr-3 text-gray-800" title={row.domain}>
                {row.domain}
                {row.lostDate && (
                  <Badge variant="warning" className="ml-2">
                    {t.lostLabel}
                  </Badge>
                )}
              </td>
              <td className="py-2 pr-3 font-medium text-gray-900">{row.rank}</td>
              <td className="py-2 pr-3 text-gray-600">{int.format(row.backlinks)}</td>
              <td className="py-2 pr-3 text-gray-600">{row.spamScore}</td>
              <td className="py-2 pr-3 text-gray-500">{shortDate(row.firstSeen)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Anchors table ──────────────────────────────────────────────────────────

function AnchorsTable({
  rows,
  maxBacklinks,
  t,
  int,
}: {
  rows: AnchorRow[];
  maxBacklinks: number;
  t: BacklinksToolCopy;
  int: Intl.NumberFormat;
}) {
  if (rows.length === 0) return <p className="text-sm text-gray-500">{t.anchorsEmpty}</p>;

  return (
    <div className="max-h-[28rem] overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
            <th className="py-2 pr-3 font-semibold">{t.colAnchor}</th>
            <th className="w-40 py-2 pr-3 font-semibold">{t.colBacklinks}</th>
            <th className="w-24 py-2 pr-3 font-semibold">{t.colRefDomains}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, i) => {
            const pct = maxBacklinks > 0 ? (row.backlinks / maxBacklinks) * 100 : 0;
            return (
              // Anchor text is not unique (and can be empty), so the index is
              // part of the key.
              <tr key={`${row.anchor}-${i}`}>
                <td className="max-w-0 truncate py-2 pr-3 text-gray-800" title={row.anchor}>
                  {row.anchor || (
                    <span className="italic text-gray-400">{t.noAnchorText}</span>
                  )}
                </td>
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    {/* Proportional bar, sized against the largest anchor in
                        the set so the comparison stays stable. */}
                    <div
                      aria-hidden="true"
                      className="h-2 shrink-0 rounded bg-blue-500/80"
                      style={{ width: `${Math.max(pct, 2)}%`, minWidth: 4 }}
                    />
                    <span className="shrink-0 text-gray-600">{int.format(row.backlinks)}</span>
                  </div>
                </td>
                <td className="py-2 pr-3 text-gray-600">{int.format(row.referringDomains)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export function BacklinksClient({ locale }: { locale: DashLocale }) {
  const t = BACKLINKS_TOOL_COPY[locale];
  const tools = SEO_TOOLS_COPY[locale];
  const it = tools.items.backlinks;
  const { int, dec, relative } = useFormatters(locale);

  const [target, setTarget] = useState("");
  const [mode, setMode] = useState<BacklinksMode>("domain");
  const [analysis, setAnalysis] = useState<BacklinksAnalysisDto | null>(null);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [quotaLimit, setQuotaLimit] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reloadHistory = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/history`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => {
        if (!cancelled) setHistory(data as HistoryResponse);
      })
      .catch(() => {
        if (!cancelled) setError(t.loadFailed);
      });
    return () => {
      cancelled = true;
    };
  }, [t, reloadToken]);

  const trimmed = target.trim();
  const valid = trimmed.length > 0 && isValidTarget(trimmed, mode);
  const showInvalid = trimmed.length > 0 && !valid;
  const invalidMessage = mode === "exact_url" ? t.invalidUrl : t.invalidDomain;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || running) return;

    setRunning(true);
    setError(null);
    setQuotaLimit(null);
    setAnalysis(null);

    try {
      const res = await fetch(`${API}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: trimmed, mode }),
      });
      const body = await res.json().catch(() => null);

      if (res.status === 429 && body?.code === "QUOTA_EXCEEDED") {
        setQuotaLimit(Number(body.limit));
        return;
      }
      if (!res.ok) {
        setError(body?.code === "INVALID_REQUEST" ? invalidMessage : t.submitFailed);
        return;
      }

      setAnalysis(body.analysis as BacklinksAnalysisDto);
      if (body.usage) setHistory((prev) => (prev ? { ...prev, usage: body.usage } : prev));
      reloadHistory();
    } catch {
      setError(t.submitFailed);
    } finally {
      setRunning(false);
    }
  }

  /** Opening a stored analysis is a read — it never spends. */
  async function openAnalysis(id: string) {
    setError(null);
    try {
      const res = await fetch(`${API}/${id}`);
      if (!res.ok) return;
      setAnalysis((await res.json()) as BacklinksAnalysisDto);
    } catch {
      // Leave the current cards in place.
    }
  }

  const usage = history?.usage;
  const remaining = usage ? Math.max(usage.limit - usage.used, 0) : null;
  const failed = (key: BacklinksSection) => analysis?.failedSections.includes(key) ?? false;
  // history and pages are domain-scoped upstream, so exact-URL analyses simply
  // do not contain them. Rendering their cards would show two permanently
  // empty sections for a mode where they can never have data.
  const shows = (key: BacklinksSection) =>
    sectionAppliesTo(key, analysis?.mode ?? mode);

  const header = (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">{it.name}</h2>
        <p className="mt-1 text-sm text-gray-500">{it.description}</p>
      </div>
      <div className="shrink-0">
        <BacklinksHelpButton locale={locale} />
      </div>
    </div>
  );

  // ── Locked plan (STARTER) ───────────────────────────────────────────────
  if (usage && !usage.canAnalyze) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <CardContent>
            <div className="flex flex-col items-center py-14 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                <Lock className="h-7 w-7 text-gray-400" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">{t.lockedTitle}</h3>
              <p className="mt-2 max-w-md text-sm text-gray-500">{t.lockedBody}</p>
              <Link
                href="/billing"
                className="mt-6 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {t.lockedCta}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {/* ── Form ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-4">
          <h3 className="text-base font-semibold text-gray-900">{t.formTitle}</h3>
          {usage && usage.limit > 0 && (
            <span className="text-xs text-gray-500">
              {t.usage(usage.used, usage.limit)}
              {remaining !== null && ` · ${t.remaining(remaining)}`}
            </span>
          )}
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-gray-500">{t.formIntro}</p>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                id="backlinks-target"
                label={t.targetLabel}
                placeholder={
                  mode === "exact_url" ? t.targetPlaceholderUrl : t.targetPlaceholderDomain
                }
                value={target}
                maxLength={2000}
                autoComplete="off"
                spellCheck={false}
                error={showInvalid ? invalidMessage : undefined}
                onChange={(e) => setTarget(e.target.value)}
              />
              <fieldset>
                <legend className="mb-1 block text-sm font-medium text-gray-700">
                  {t.modeLabel}
                </legend>
                <div className="inline-flex rounded-lg border border-gray-300 p-0.5">
                  {(
                    [
                      ["domain", t.modeDomain],
                      ["exact_url", t.modeExactUrl],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={mode === value}
                      onClick={() => setMode(value)}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        mode === value
                          ? "bg-blue-600 text-white"
                          : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  {mode === "exact_url" ? t.modeExactUrlHint : t.modeDomainHint}
                </p>
              </fieldset>
            </div>
            <Button type="submit" loading={running} disabled={!valid}>
              {!running && <Search className="mr-2 h-4 w-4" aria-hidden="true" />}
              {running ? t.analyzing : t.analyze}
            </Button>
          </form>
        </CardContent>
      </Card>

      {quotaLimit !== null && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">{t.quotaTitle}</p>
          <p className="mt-1 text-sm text-amber-800">{t.quotaBody(quotaLimit)}</p>
          <Link
            href="/billing"
            className="mt-2 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            {t.quotaCta}
          </Link>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* ── Results ──────────────────────────────────────────────────── */}
      {(running || analysis) && (
        <div className="space-y-6">
          {running && (
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-gray-900">{t.analyzingTitle}</p>
                <p className="text-sm text-gray-500">{t.analyzingBody}</p>
              </div>
            </div>
          )}

          {analysis && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h3 className="min-w-0 break-all text-lg font-semibold text-gray-900">
                {analysis.target}
              </h3>
              <Badge variant="info">
                {analysis.mode === "exact_url" ? t.modeExactUrl : t.modeDomain}
              </Badge>
              {analysis.status === "partial" && (
                <Badge variant="warning">{t.statusPartial}</Badge>
              )}
              {analysis.cached && (
                <span className="text-xs text-gray-500">
                  {t.analyzedAgo(timeAgo(analysis.createdAt, relative))}
                  {" · "}
                  {t.reRunIn(Math.ceil((analysis.reRunAvailableInMs ?? 0) / 3_600_000))}
                </span>
              )}
            </div>
          )}

          {analysis?.cached && <p className="text-sm text-gray-500">{t.cachedIntro}</p>}
          {analysis?.status === "partial" && (
            <p className="text-sm text-gray-500">{t.partialNote}</p>
          )}

          {/* Summary */}
          <SectionCard
            title={t.summaryTitle}
            icon={Link2}
            loading={running}
            failed={failed("summary")}
            skeletonRows={3}
            t={t}
          >
            {analysis?.summary && (
              <div className="space-y-4">
                <dl className="grid gap-6 sm:grid-cols-3 lg:grid-cols-6">
                  <Metric
                    label={t.metricBacklinks}
                    value={int.format(analysis.summary.backlinks)}
                  />
                  <Metric
                    label={t.metricReferringDomains}
                    value={int.format(analysis.summary.referringDomains)}
                  />
                  <Metric
                    label={t.metricDofollow}
                    value={int.format(analysis.summary.dofollowDomains)}
                  />
                  <Metric
                    label={t.metricRank}
                    value={int.format(analysis.summary.rank)}
                    unit={t.metricRankUnit}
                  />
                  <Metric
                    label={t.metricBroken}
                    value={int.format(analysis.summary.brokenBacklinks)}
                  />
                  <Metric
                    label={t.metricSpam}
                    value={int.format(analysis.summary.spamScore ?? 0)}
                    unit={t.metricSpamUnit}
                  />
                </dl>
                <p className="text-sm text-gray-500">
                  {analysis.summary.dofollowRatio === null
                    ? t.noDofollowData
                    : t.dofollowRatio(dec.format(analysis.summary.dofollowRatio * 100))}
                </p>
              </div>
            )}
          </SectionCard>

          {/* Growth — domain mode only */}
          {shows("history") && (
          <SectionCard
            title={t.historyTitle}
            subtitle={t.historySubtitle}
            icon={TrendingUp}
            loading={running}
            failed={failed("history")}
            skeletonRows={4}
            t={t}
          >
            {analysis?.history && (
              <GrowthChart points={analysis.history.points} t={t} int={int} />
            )}
          </SectionCard>
          )}

          {/* Referring domains */}
          <SectionCard
            title={t.domainsTitle}
            subtitle={
              analysis?.referringDomains
                ? t.domainsSubtitle(
                    analysis.referringDomains.items.length,
                    analysis.referringDomains.totalCount,
                  )
                : undefined
            }
            icon={Link2}
            loading={running}
            failed={failed("referringDomains")}
            skeletonRows={6}
            t={t}
          >
            {analysis?.referringDomains && (
              <DomainsTable rows={analysis.referringDomains.items} t={t} int={int} />
            )}
          </SectionCard>

          {/* Anchors */}
          <SectionCard
            title={t.anchorsTitle}
            subtitle={
              analysis?.anchors
                ? t.anchorsSubtitle(analysis.anchors.items.length, analysis.anchors.totalCount)
                : undefined
            }
            icon={Search}
            loading={running}
            failed={failed("anchors")}
            skeletonRows={6}
            t={t}
          >
            {analysis?.anchors && (
              <AnchorsTable
                rows={analysis.anchors.items}
                maxBacklinks={analysis.anchors.maxBacklinks}
                t={t}
                int={int}
              />
            )}
          </SectionCard>

          {/* Most linked pages — domain mode only */}
          {shows("pages") && (
          <SectionCard
            title={t.pagesTitle}
            subtitle={
              analysis?.pages
                ? t.pagesSubtitle(analysis.pages.items.length, analysis.pages.totalCount)
                : undefined
            }
            icon={Link2}
            loading={running}
            failed={failed("pages")}
            skeletonRows={5}
            t={t}
          >
            {analysis?.pages &&
              (analysis.pages.items.length === 0 ? (
                <p className="text-sm text-gray-500">{t.pagesEmpty}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                        <th className="py-2 pr-3 font-semibold">{t.colPage}</th>
                        <th className="w-28 py-2 pr-3 font-semibold">{t.colBacklinks}</th>
                        <th className="w-24 py-2 pr-3 font-semibold">{t.colRefDomains}</th>
                        <th className="w-20 py-2 pr-3 font-semibold">{t.colStatus}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {analysis.pages.items.map((row) => (
                        <tr key={row.url}>
                          <td className="max-w-0 py-2 pr-3">
                            <a
                              href={row.url}
                              target="_blank"
                              rel="noopener noreferrer nofollow"
                              className="block truncate text-blue-600 hover:text-blue-700"
                              title={row.url}
                            >
                              {row.url}
                            </a>
                          </td>
                          <td className="py-2 pr-3 text-gray-600">{int.format(row.backlinks)}</td>
                          <td className="py-2 pr-3 text-gray-600">
                            {int.format(row.referringDomains)}
                          </td>
                          <td className="py-2 pr-3 text-gray-500">{row.statusCode ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
          </SectionCard>
          )}
        </div>
      )}

      {/* ── History list ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex items-center justify-between gap-4">
          <h3 className="text-base font-semibold text-gray-900">{t.recentTitle}</h3>
          {history && history.totalCostUsd > 0 && (
            <span className="text-xs text-gray-500">
              {t.spend(history.totalCostUsd.toFixed(4))}
            </span>
          )}
        </CardHeader>
        <CardContent>
          {!history || history.analyses.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <Link2 className="mb-3 h-8 w-8 text-gray-300" aria-hidden="true" />
              <p className="text-sm text-gray-500">{t.recentEmpty}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                    <th className="py-2 pr-3 font-semibold">{t.colTarget}</th>
                    <th className="w-32 py-2 pr-3 font-semibold">{t.colMode}</th>
                    <th className="w-28 py-2 pr-3 font-semibold">{t.colStatus}</th>
                    <th className="w-24 py-2 pr-3 text-right font-semibold">{t.colCost}</th>
                    <th className="w-44 py-2 pr-3 font-semibold">{t.colWhen}</th>
                    <th className="w-16 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {history.analyses.map((row) => (
                    <tr key={row.id}>
                      <td className="max-w-0 truncate py-2 pr-3 text-gray-800" title={row.target}>
                        {row.target}
                      </td>
                      <td className="py-2 pr-3 text-gray-500">
                        {row.mode === "exact_url" ? t.modeExactUrl : t.modeDomain}
                      </td>
                      <td className="py-2 pr-3">
                        {row.status === "partial" ? (
                          <Badge variant="warning">{t.statusPartial}</Badge>
                        ) : (
                          <Badge variant="success">{t.statusCompleted}</Badge>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right text-gray-600">
                        ${row.costUsd.toFixed(4)}
                      </td>
                      <td className="py-2 pr-3 text-gray-500">
                        {formatDateTime(row.createdAt, locale)}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => void openAnalysis(row.id)}
                          className="text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                          {t.view}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
