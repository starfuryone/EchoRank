"use client";

// Site Explorer — the tenant submits a domain, one POST runs four live
// upstream calls, and the four cards below fill in together.
//
// Synchronous by design: unlike the SERP Checker there is no queue and no
// poll, so the honest loading state is four section skeletons for the ~3-5 s
// the call actually takes. Zero invented numbers — every cell comes from a
// stored envelope, and a section that failed says so instead of showing zeros.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Globe, Link2, Loader2, Search, Users } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/utils";
import { isValidDomain } from "@/lib/site-explorer/domain";
import { SCAFFOLD_RELATED } from "@/lib/seo-tools";
import type {
  RankedKeywordRow,
  SiteExplorerAnalysisDto,
  SiteExplorerHistoryRow,
  SiteExplorerSection,
} from "@/lib/site-explorer/types";
import {
  SEO_TOOLS_COPY,
  SITE_EXPLORER_COPY,
  type DashLocale,
  type SiteExplorerCopy,
} from "@/lib/i18n/dashboard";

const API = "/api/seo/v1/site-explorer";

interface HistoryResponse {
  analyses: SiteExplorerHistoryRow[];
  usage: { used: number; limit: number; plan: string };
  totalCostUsd: number;
}

type SortKey = "position" | "searchVolume" | "etv";

// ─── Formatting ─────────────────────────────────────────────────────────────

function useFormatters(locale: DashLocale) {
  return useMemo(
    () => ({
      int: new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }),
      dec: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
      usd: new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }),
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

// ─── Shared card pieces ─────────────────────────────────────────────────────

function Metric({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
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

function SectionFailed({ t }: { t: SiteExplorerCopy }) {
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

/** One card, with its own loading / failed / empty states. */
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
  t: SiteExplorerCopy;
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

// ─── Keywords table ─────────────────────────────────────────────────────────

type SortState = { key: SortKey; desc: boolean };

/** Module scope, not nested in KeywordsTable: a component created during
 * render is remounted every keystroke, which drops focus and defeats memoization. */
function SortHeader({
  label,
  sortKey,
  className,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  className?: string;
  sort: SortState;
  onSort: (key: SortKey) => void;
}) {
  const active = sort.key === sortKey;
  return (
    <th className={className} aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        {label}
        <span aria-hidden="true" className={active ? "text-gray-500" : "text-transparent"}>
          {sort.desc ? "▼" : "▲"}
        </span>
      </button>
    </th>
  );
}

function KeywordsTable({
  rows,
  t,
  int,
}: {
  rows: RankedKeywordRow[];
  t: SiteExplorerCopy;
  int: Intl.NumberFormat;
}) {
  const [sort, setSort] = useState<SortState>({ key: "position", desc: false });

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => (a[sort.key] - b[sort.key]) * (sort.desc ? -1 : 1));
    return copy;
  }, [rows, sort]);

  // Position sorts ascending first (best rank on top); the value columns sort
  // descending first (biggest number on top) — the useful default either way.
  const toggle = useCallback((key: SortKey) => {
    setSort((prev) =>
      prev.key === key ? { key, desc: !prev.desc } : { key, desc: key !== "position" },
    );
  }, []);

  if (rows.length === 0) {
    return <p className="text-sm text-gray-500">{t.emptyKeywords}</p>;
  }

  return (
    <div className="max-h-[32rem] overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="border-b border-gray-200 text-left text-xs text-gray-400">
            <th className="py-2 pr-3 font-semibold uppercase tracking-wide">{t.colKeyword}</th>
            <SortHeader
              label={t.colPosition}
              sortKey="position"
              className="w-20 py-2 pr-3 text-left"
              sort={sort}
              onSort={toggle}
            />
            <SortHeader
              label={t.colVolume}
              sortKey="searchVolume"
              className="w-28 py-2 pr-3 text-left"
              sort={sort}
              onSort={toggle}
            />
            <SortHeader
              label={t.colEtv}
              sortKey="etv"
              className="w-24 py-2 pr-3 text-left"
              sort={sort}
              onSort={toggle}
            />
            <th className="w-64 py-2 pr-3 font-semibold uppercase tracking-wide">{t.colUrl}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.map((row) => (
            <tr key={`${row.keyword}-${row.url}`}>
              <td className="max-w-0 truncate py-2 pr-3 text-gray-800" title={row.keyword}>
                {row.keyword}
              </td>
              <td className="py-2 pr-3 font-medium text-gray-900">{row.position || "—"}</td>
              <td className="py-2 pr-3 text-gray-600">{int.format(row.searchVolume)}</td>
              <td className="py-2 pr-3 text-gray-600">{int.format(Math.round(row.etv))}</td>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export function SiteExplorerClient({ locale }: { locale: DashLocale }) {
  const t = SITE_EXPLORER_COPY[locale];
  const tools = SEO_TOOLS_COPY[locale];
  const it = tools.items.site_explorer;
  const scaffold = tools.scaffolds.site_explorer;
  const { int, dec, usd, relative } = useFormatters(locale);

  const [domain, setDomain] = useState("");
  const [analysis, setAnalysis] = useState<SiteExplorerAnalysisDto | null>(null);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [quotaLimit, setQuotaLimit] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // History reloads are driven by a token rather than an imperative call, so
  // the fetch stays inside its effect (the repo's idiom — see SerpCheckerClient).
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

  const trimmed = domain.trim();
  const valid = trimmed.length > 0 && isValidDomain(trimmed);
  const showInvalid = trimmed.length > 0 && !valid;

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
        body: JSON.stringify({ domain: trimmed }),
      });
      const body = await res.json().catch(() => null);

      if (res.status === 429 && body?.code === "QUOTA_EXCEEDED") {
        setQuotaLimit(Number(body.limit));
        return;
      }
      if (!res.ok) {
        setError(body?.code === "INVALID_REQUEST" ? t.invalidDomain : t.submitFailed);
        return;
      }

      setAnalysis(body.analysis as SiteExplorerAnalysisDto);
      if (body.usage) {
        setHistory((prev) => (prev ? { ...prev, usage: body.usage } : prev));
      }
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
      setAnalysis((await res.json()) as SiteExplorerAnalysisDto);
    } catch {
      // Leave the current cards in place.
    }
  }

  const usage = history?.usage;
  const remaining = usage ? Math.max(usage.limit - usage.used, 0) : null;
  const failed = (key: SiteExplorerSection) => analysis?.failedSections.includes(key) ?? false;

  const relatedHref = SCAFFOLD_RELATED.site_explorer;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">{it.name}</h2>
        <p className="mt-1 text-sm text-gray-500">{it.description}</p>
      </div>

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
                id="site-explorer-domain"
                label={t.domainLabel}
                placeholder={t.domainPlaceholder}
                value={domain}
                maxLength={253}
                autoComplete="off"
                spellCheck={false}
                error={showInvalid ? t.invalidDomain : undefined}
                onChange={(e) => setDomain(e.target.value)}
              />
            </div>
            <p className="text-xs text-gray-400">{t.domainHint}</p>
            <div className="flex flex-wrap items-center gap-4">
              <Button type="submit" loading={running} disabled={!valid}>
                {!running && <Search className="mr-2 h-4 w-4" aria-hidden="true" />}
                {running ? t.analyzing : scaffold.cta}
              </Button>
              {relatedHref && scaffold.related && (
                <Link
                  href={relatedHref}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {scaffold.related}
                </Link>
              )}
            </div>
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
              <h3 className="text-lg font-semibold text-gray-900">{analysis.domain}</h3>
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

          {/* Overview */}
          <SectionCard
            title={t.overviewTitle}
            icon={Globe}
            loading={running}
            failed={failed("overview")}
            skeletonRows={3}
            t={t}
          >
            {analysis?.overview && (
              <div className="space-y-6">
                <dl className="grid gap-6 sm:grid-cols-3">
                  <Metric
                    label={t.metricTraffic}
                    value={int.format(Math.round(analysis.overview.etv))}
                    unit={t.metricTrafficUnit}
                  />
                  <Metric
                    label={t.metricKeywords}
                    value={int.format(analysis.overview.keywordCount)}
                    unit={t.metricKeywordsUnit}
                  />
                  <Metric
                    label={t.metricTrafficValue}
                    value={usd.format(analysis.overview.estimatedPaidTrafficCost)}
                    unit={t.metricTrafficValueUnit}
                  />
                </dl>

                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {t.distributionTitle}
                  </h4>
                  {analysis.overview.keywordCount === 0 ? (
                    <p className="text-sm text-gray-500">{t.noDistribution}</p>
                  ) : (
                    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                      {(
                        [
                          ["pos1", analysis.overview.distribution.pos1],
                          ["pos2_3", analysis.overview.distribution.pos2_3],
                          ["pos4_10", analysis.overview.distribution.pos4_10],
                          ["pos11_20", analysis.overview.distribution.pos11_20],
                          ["pos21_100", analysis.overview.distribution.pos21_100],
                        ] as const
                      ).map(([key, value]) => (
                        <div key={key} className="rounded-lg border border-gray-200 px-3 py-2">
                          <dt className="text-xs text-gray-400">{t.distributionLabels[key]}</dt>
                          <dd className="text-lg font-semibold text-gray-900">
                            {int.format(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              </div>
            )}
          </SectionCard>

          {/* Top keywords */}
          <SectionCard
            title={t.keywordsTitle}
            subtitle={
              analysis?.rankedKeywords
                ? `${t.keywordsSubtitle(
                    analysis.rankedKeywords.items.length,
                    analysis.rankedKeywords.totalCount,
                  )} · ${t.sortHint}`
                : undefined
            }
            icon={Search}
            loading={running}
            failed={failed("rankedKeywords")}
            skeletonRows={6}
            t={t}
          >
            {analysis?.rankedKeywords && (
              <KeywordsTable rows={analysis.rankedKeywords.items} t={t} int={int} />
            )}
          </SectionCard>

          {/* Competitors */}
          <SectionCard
            title={t.competitorsTitle}
            subtitle={t.competitorsSubtitle}
            icon={Users}
            loading={running}
            failed={failed("competitors")}
            skeletonRows={5}
            t={t}
          >
            {analysis?.competitors &&
              (analysis.competitors.items.length === 0 ? (
                <p className="text-sm text-gray-500">{t.emptyCompetitors}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                        <th className="py-2 pr-3 font-semibold">{t.colDomain}</th>
                        <th className="w-36 py-2 pr-3 font-semibold">{t.colIntersections}</th>
                        <th className="w-32 py-2 pr-3 font-semibold">{t.colAvgPosition}</th>
                        <th className="w-28 py-2 pr-3 font-semibold">{t.colEtv}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {analysis.competitors.items.map((row) => (
                        <tr key={row.domain}>
                          <td className="max-w-0 truncate py-2 pr-3 font-medium text-gray-900" title={row.domain}>
                            {row.domain}
                          </td>
                          <td className="py-2 pr-3 text-gray-600">
                            {int.format(row.intersections)}
                          </td>
                          <td className="py-2 pr-3 text-gray-600">
                            {row.avgPosition ? dec.format(row.avgPosition) : "—"}
                          </td>
                          <td className="py-2 pr-3 text-gray-600">
                            {int.format(Math.round(row.etv))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
          </SectionCard>

          {/* Backlinks */}
          <SectionCard
            title={t.backlinksTitle}
            icon={Link2}
            loading={running}
            failed={failed("backlinks")}
            skeletonRows={3}
            t={t}
          >
            {analysis?.backlinks && (
              <div className="space-y-4">
                <dl className="grid gap-6 sm:grid-cols-3 lg:grid-cols-5">
                  <Metric
                    label={t.metricBacklinks}
                    value={int.format(analysis.backlinks.backlinks)}
                  />
                  <Metric
                    label={t.metricReferringDomains}
                    value={int.format(analysis.backlinks.referringDomains)}
                  />
                  <Metric
                    label={t.metricDofollow}
                    value={int.format(analysis.backlinks.dofollowDomains)}
                  />
                  <Metric
                    label={t.metricRank}
                    value={int.format(analysis.backlinks.rank)}
                    unit={t.metricRankUnit}
                  />
                  <Metric
                    label={t.metricBroken}
                    value={int.format(analysis.backlinks.brokenBacklinks)}
                  />
                </dl>
                <p className="text-sm text-gray-500">
                  {analysis.backlinks.dofollowRatio === null
                    ? t.noDofollowData
                    : t.dofollowRatio(
                        dec.format(analysis.backlinks.dofollowRatio * 100),
                      )}
                </p>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* ── History ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex items-center justify-between gap-4">
          <h3 className="text-base font-semibold text-gray-900">{t.historyTitle}</h3>
          {history && history.totalCostUsd > 0 && (
            <span className="text-xs text-gray-500">
              {t.spend(history.totalCostUsd.toFixed(4))}
            </span>
          )}
        </CardHeader>
        <CardContent>
          {!history || history.analyses.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <Globe className="mb-3 h-8 w-8 text-gray-300" aria-hidden="true" />
              <p className="text-sm text-gray-500">{t.historyEmpty}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                    <th className="py-2 pr-3 font-semibold">{t.colDomain}</th>
                    <th className="w-28 py-2 pr-3 font-semibold">{t.colStatus}</th>
                    <th className="w-24 py-2 pr-3 text-right font-semibold">{t.colCost}</th>
                    <th className="w-44 py-2 pr-3 font-semibold">{t.colWhen}</th>
                    <th className="w-16 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {history.analyses.map((row) => (
                    <tr key={row.id}>
                      <td className="max-w-0 truncate py-2 pr-3 text-gray-800" title={row.domain}>
                        {row.domain}
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
