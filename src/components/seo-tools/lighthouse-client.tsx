"use client";

// Lighthouse — the tenant submits a URL, one POST runs a PageSpeed Insights
// audit (10-30 s), and the results render.
//
// The long wait is the defining UI constraint here: unlike the DataForSEO
// tools there is nothing to stream and no partial state, so the loading view
// has to be honest about the duration rather than pretend to be fast.
//
// Gauges are hand-rolled SVG arcs, matching the repo's existing approach
// (rank-tracker-client.tsx, prompt-trends.tsx) — recharts is a dependency but
// is imported nowhere on the client.
//
// Score colours are Lighthouse's OWN published bands (0-49 red / 50-89 amber /
// 90-100 green) so a score here matches Chrome DevTools and web.dev exactly.

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Gauge, Loader2, Smartphone, Zap } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/utils";
import { LighthouseHelpButton } from "@/components/seo-tools/lighthouse-help";
import { isValidAuditUrl } from "@/lib/lighthouse/url";
import {
  DEFAULT_STRATEGY,
  LIGHTHOUSE_STRATEGIES,
  metricBand,
  scoreBand,
  type LighthouseStrategy,
  type ScoreBand,
} from "@/lib/lighthouse/options";
import {
  LIGHTHOUSE_CATEGORIES,
  type CategoryScores,
  type CruxData,
  type LabMetric,
  type LighthouseAuditDto,
  type LighthouseCategory,
  type LighthouseHistoryRow,
  type LighthouseUsage,
} from "@/lib/lighthouse/types";
import {
  LIGHTHOUSE_TOOL_COPY,
  SEO_TOOLS_COPY,
  type DashLocale,
  type LighthouseToolCopy,
} from "@/lib/i18n/dashboard";

const API = "/api/seo/v1/lighthouse";

interface HistoryResponse {
  audits: LighthouseHistoryRow[];
  usage: LighthouseUsage;
}

/** "3 hours ago" / "il y a 3 heures", from an ISO timestamp. Module scope so
 * the impure Date.now() is not called during render. */
function timeAgo(iso: string, relative: Intl.RelativeTimeFormat): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 60) return relative.format(-Math.max(minutes, 1), "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return relative.format(-hours, "hour");
  return relative.format(-Math.round(hours / 24), "day");
}

/** Lighthouse's own palette: red / amber / green at 50 and 90. */
const BAND_COLOR: Record<ScoreBand, string> = {
  poor: "#dc2626", // red-600
  average: "#d97706", // amber-600
  good: "#16a34a", // green-600
};
const BAND_TEXT: Record<ScoreBand, string> = {
  poor: "text-red-600",
  average: "text-amber-600",
  good: "text-green-600",
};

function bandLabel(band: ScoreBand | null, t: LighthouseToolCopy): string {
  if (band === "good") return t.bandGood;
  if (band === "average") return t.bandAverage;
  if (band === "poor") return t.bandPoor;
  return t.scoreNotAvailable;
}

// ─── Score gauge ────────────────────────────────────────────────────────────

/**
 * Circular score arc.
 *
 * A null score renders an empty grey ring and "Not scored" rather than a zero
 * arc: Lighthouse genuinely fails to score categories sometimes, and showing
 * that as 0/100 would be a fabricated failing grade.
 */
function ScoreGauge({
  label,
  score,
  t,
}: {
  label: string;
  score: number | null;
  t: LighthouseToolCopy;
}) {
  const SIZE = 96;
  const STROKE = 8;
  const radius = (SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const band = scoreBand(score);
  const color = band ? BAND_COLOR[band] : "#d1d5db";
  const filled = score === null ? 0 : (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <svg width={SIZE} height={SIZE} role="img" aria-label={`${label}: ${score ?? "—"}`}>
          {/* Rotated so the arc starts at 12 o'clock rather than 3. */}
          <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={radius}
              fill="none"
              stroke="#f3f4f6"
              strokeWidth={STROKE}
            />
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`${filled} ${circumference}`}
            />
          </g>
        </svg>
        <span
          className={`absolute inset-0 flex items-center justify-center text-xl font-semibold ${
            band ? BAND_TEXT[band] : "text-gray-400"
          }`}
        >
          {score ?? "—"}
        </span>
      </div>
      <div className="text-center">
        <p className="text-xs font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-400">{bandLabel(band, t)}</p>
      </div>
    </div>
  );
}

// ─── Core Web Vitals ────────────────────────────────────────────────────────

/** Three-segment distribution bar for one CrUX metric. */
function DistributionBar({ distribution }: { distribution: [number, number, number] }) {
  const segments: { value: number; color: string }[] = [
    { value: distribution[0], color: BAND_COLOR.good },
    { value: distribution[1], color: BAND_COLOR.average },
    { value: distribution[2], color: BAND_COLOR.poor },
  ];
  return (
    <div aria-hidden="true" className="flex h-1.5 w-full overflow-hidden rounded bg-gray-100">
      {segments.map((segment, i) => (
        <div key={i} style={{ width: `${segment.value * 100}%`, background: segment.color }} />
      ))}
    </div>
  );
}

/** CrUX verdict -> our band vocabulary, so colours stay consistent. */
function cruxBand(category: string): ScoreBand | null {
  if (category === "FAST") return "good";
  if (category === "AVERAGE") return "average";
  if (category === "SLOW") return "poor";
  return null;
}

/** CLS is unitless; everything else CrUX reports is milliseconds. */
function formatCruxValue(key: string, value: number): string {
  if (key === "CLS") return value.toFixed(3);
  return value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${Math.round(value)} ms`;
}

function FieldData({ crux, t }: { crux: CruxData; t: LighthouseToolCopy }) {
  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-semibold text-gray-900">{t.fieldDataTitle}</h4>
        <p className="text-xs text-gray-500">{t.fieldDataIntro}</p>
        {crux.originFallback && (
          <p className="mt-1 text-xs text-amber-700">{t.fieldDataOriginNote}</p>
        )}
      </div>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {crux.metrics.map((metric) => {
          const band = cruxBand(metric.category);
          return (
            <div key={metric.key} className="space-y-1.5">
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
                {/* Metric abbreviations are never translated. */}
                {metric.key}
              </dt>
              <dd
                className={`text-lg font-semibold ${band ? BAND_TEXT[band] : "text-gray-400"}`}
              >
                {formatCruxValue(metric.key, metric.p75)}
              </dd>
              <DistributionBar distribution={metric.distribution} />
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function LabData({ metrics, t }: { metrics: LabMetric[]; t: LighthouseToolCopy }) {
  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-semibold text-gray-900">{t.labDataTitle}</h4>
        <p className="text-xs text-gray-500">{t.labDataIntro}</p>
      </div>
      <dl className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {metrics.map((metric) => {
          const band = metricBand(metric.key, metric.value);
          return (
            <div key={metric.key}>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
                {metric.key}
              </dt>
              <dd
                className={`mt-1 text-base font-semibold ${
                  band ? BAND_TEXT[band] : "text-gray-500"
                }`}
              >
                {metric.display || t.metricNoValue}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export function LighthouseClient({ locale }: { locale: DashLocale }) {
  const t = LIGHTHOUSE_TOOL_COPY[locale];
  const tools = SEO_TOOLS_COPY[locale];
  const it = tools.items.lighthouse;

  const relative = useMemo(
    () => new Intl.RelativeTimeFormat(locale, { numeric: "auto" }),
    [locale],
  );

  const [url, setUrl] = useState("");
  const [strategy, setStrategy] = useState<LighthouseStrategy>(DEFAULT_STRATEGY);
  const [audit, setAudit] = useState<LighthouseAuditDto | null>(null);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [limitReached, setLimitReached] = useState<number | null>(null);
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

  const trimmed = url.trim();
  const valid = trimmed.length > 0 && isValidAuditUrl(trimmed);
  const showInvalid = trimmed.length > 0 && !valid;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || running) return;

    setRunning(true);
    setError(null);
    setLimitReached(null);
    setAudit(null);

    try {
      const res = await fetch(`${API}/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed, strategy }),
      });
      const body = await res.json().catch(() => null);

      if (res.status === 429 && body?.code === "RATE_LIMITED") {
        setLimitReached(Number(body.limit));
        return;
      }
      if (!res.ok) {
        // The API's messages here are specific and actionable ("could not load
        // that page", "took too long"), so they are surfaced rather than
        // flattened into a generic failure.
        setError(body?.error || t.runFailed);
        return;
      }

      setAudit(body.audit as LighthouseAuditDto);
      if (body.usage) setHistory((prev) => (prev ? { ...prev, usage: body.usage } : prev));
      reloadHistory();
    } catch {
      setError(t.runFailed);
    } finally {
      setRunning(false);
    }
  }

  /** Opening a stored audit is a read — it never re-runs anything. */
  async function openAudit(id: string) {
    setError(null);
    try {
      const res = await fetch(`${API}/${id}`);
      if (!res.ok) return;
      setAudit((await res.json()) as LighthouseAuditDto);
    } catch {
      // Leave the current results in place.
    }
  }

  const usage = history?.usage;

  const CATEGORY_LABELS: Record<LighthouseCategory, string> = {
    performance: t.scorePerformance,
    accessibility: t.scoreAccessibility,
    bestPractices: t.scoreBestPractices,
    seo: t.scoreSeo,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">{it.name}</h2>
          <p className="mt-1 text-sm text-gray-500">{it.description}</p>
        </div>
        <div className="shrink-0">
          <LighthouseHelpButton locale={locale} />
        </div>
      </div>

      {/* ── Form ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-4">
          <h3 className="text-base font-semibold text-gray-900">{t.formTitle}</h3>
          {usage && (
            <span className="text-xs text-gray-500">{t.usage(usage.used, usage.limit)}</span>
          )}
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-gray-500">{t.formIntro}</p>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                id="lighthouse-url"
                label={t.urlLabel}
                placeholder={t.urlPlaceholder}
                value={url}
                maxLength={2000}
                autoComplete="off"
                spellCheck={false}
                error={showInvalid ? t.invalidUrl : undefined}
                onChange={(e) => setUrl(e.target.value)}
              />
              <fieldset>
                <legend className="mb-1 block text-sm font-medium text-gray-700">
                  {t.strategyLabel}
                </legend>
                <div className="inline-flex rounded-lg border border-gray-300 p-0.5">
                  {LIGHTHOUSE_STRATEGIES.map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={strategy === value}
                      onClick={() => setStrategy(value)}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        strategy === value
                          ? "bg-blue-600 text-white"
                          : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {value === "mobile" ? t.strategyMobile : t.strategyDesktop}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-gray-400">{t.strategyHint}</p>
              </fieldset>
            </div>
            <Button type="submit" loading={running} disabled={!valid}>
              {!running && <Zap className="mr-2 h-4 w-4" aria-hidden="true" />}
              {running ? t.running : t.run}
            </Button>
          </form>
        </CardContent>
      </Card>

      {limitReached !== null && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">{t.limitTitle}</p>
          <p className="mt-1 text-sm text-amber-800">{t.limitBody(limitReached)}</p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* ── Running ──────────────────────────────────────────────────── */}
      {running && (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center py-12 text-center">
              <Loader2 className="mb-3 h-8 w-8 animate-spin text-blue-500" aria-hidden="true" />
              <p className="text-sm font-medium text-gray-900">{t.runningTitle}</p>
              <p className="mt-1 max-w-sm text-sm text-gray-500">{t.runningBody}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Results ──────────────────────────────────────────────────── */}
      {!running && audit && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="min-w-0 break-all text-lg font-semibold text-gray-900">{audit.url}</h3>
            <Badge variant="info">
              {audit.strategy === "mobile" ? t.strategyMobile : t.strategyDesktop}
            </Badge>
            {audit.cached && (
              <span className="text-xs text-gray-500">
                {t.auditedAgo(timeAgo(audit.fetchedAt, relative))}
                {" · "}
                {t.reRunIn(Math.ceil((audit.reRunAvailableInMs ?? 0) / 3_600_000))}
              </span>
            )}
            {audit.lighthouseVersion && (
              <span className="text-xs text-gray-400">{t.versionNote(audit.lighthouseVersion)}</span>
            )}
          </div>
          {audit.cached && <p className="text-sm text-gray-500">{t.cachedIntro}</p>}

          {/* Scores */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-gray-400" aria-hidden="true" />
                <h3 className="text-base font-semibold text-gray-900">{t.scoresTitle}</h3>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                {LIGHTHOUSE_CATEGORIES.map((category) => (
                  <ScoreGauge
                    key={category}
                    label={CATEGORY_LABELS[category]}
                    score={(audit.scores as CategoryScores)[category]}
                    t={t}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Core Web Vitals: field data when it exists, lab always */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-gray-400" aria-hidden="true" />
                <h3 className="text-base font-semibold text-gray-900">{t.vitalsTitle}</h3>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {audit.crux ? (
                <FieldData crux={audit.crux} t={t} />
              ) : (
                // Most pages have no CrUX data; saying so is the honest state.
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-sm font-semibold text-gray-900">{t.noFieldDataTitle}</p>
                  <p className="mt-1 text-sm text-gray-600">{t.noFieldDataBody}</p>
                </div>
              )}
              <LabData metrics={audit.metrics} t={t} />
            </CardContent>
          </Card>

          {/* Opportunities */}
          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-gray-900">{t.opportunitiesTitle}</h3>
              <p className="mt-1 text-xs text-gray-500">{t.opportunitiesIntro}</p>
            </CardHeader>
            <CardContent>
              {audit.opportunities.length === 0 ? (
                <p className="text-sm text-gray-500">{t.opportunitiesEmpty}</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {audit.opportunities.map((opportunity) => (
                    <li key={opportunity.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900">{opportunity.title}</p>
                        <span className="shrink-0 text-xs font-medium text-amber-700">
                          {opportunity.savingsMs > 0
                            ? t.savingsMs(opportunity.savingsMs)
                            : t.savingsBytes((opportunity.savingsBytes / 1024).toFixed(0))}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-gray-500">
                        {opportunity.description}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── History ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-gray-900">{t.recentTitle}</h3>
        </CardHeader>
        <CardContent>
          {!history || history.audits.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <Gauge className="mb-3 h-8 w-8 text-gray-300" aria-hidden="true" />
              <p className="text-sm text-gray-500">{t.recentEmpty}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                    <th className="py-2 pr-3 font-semibold">{t.colUrl}</th>
                    <th className="w-24 py-2 pr-3 font-semibold">{t.colDevice}</th>
                    <th className="w-48 py-2 pr-3 font-semibold">{t.scoresTitle}</th>
                    <th className="w-44 py-2 pr-3 font-semibold">{t.colWhen}</th>
                    <th className="w-16 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {history.audits.map((row) => (
                    <tr key={row.id}>
                      <td className="max-w-0 truncate py-2 pr-3 text-gray-800" title={row.url}>
                        {row.url}
                      </td>
                      <td className="py-2 pr-3 text-gray-500">
                        {row.strategy === "mobile" ? t.strategyMobile : t.strategyDesktop}
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex gap-1.5">
                          {LIGHTHOUSE_CATEGORIES.map((category) => {
                            const score = row.scores?.[category] ?? null;
                            const band = scoreBand(score);
                            return (
                              <span
                                key={category}
                                title={CATEGORY_LABELS[category]}
                                className={`inline-flex h-6 w-8 items-center justify-center rounded text-xs font-semibold ${
                                  band ? BAND_TEXT[band] : "text-gray-400"
                                }`}
                                style={{
                                  background: band ? `${BAND_COLOR[band]}14` : "#f9fafb",
                                }}
                              >
                                {score ?? "—"}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-gray-500">
                        {formatDateTime(row.fetchedAt, locale)}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => void openAudit(row.id)}
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
