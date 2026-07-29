"use client";

// Brand Radar — real persisted tenant data only:
//   latest VisibilityAudit → score/grade stat cards
//   PromptRun aggregates   → mention rate + per-engine coverage
//   PromptTrends component → per-prompt sparklines (same data as /visibility)
//   AlertEvent visibility_* rows → recent alerts list
// Trust score is intentionally absent: nothing persists one.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Gauge, Sparkles, MessageSquareText, Bell, RadarIcon, AlertCircle } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PromptTrends } from "@/components/visibility/prompt-trends";
import { BrandRadarHelpButton } from "@/components/seo-tools/brand-radar-help";
import { formatDate } from "@/lib/utils";
import {
  BRAND_RADAR_COPY,
  SEO_TOOLS_COPY,
  type DashLocale,
} from "@/lib/i18n/dashboard";

interface EngineRow {
  engine: string;
  runs: number;
  mentioned: number;
  rate: number;
}
interface RadarData {
  brand: { name: string; domain: string | null };
  audit: { url: string; score: number; grade: string; at: string } | null;
  prompts: {
    feature: boolean;
    total: number;
    active: number;
    windowDays: number;
    runs: number;
    mentionRate: number | null;
    lastRunAt: string | null;
    engines: EngineRow[];
  };
  alerts: { id: string; kind: string; severity: string; title: string; createdAt: string }[];
  error?: string;
}

export function BrandRadarClient({ locale }: { locale: DashLocale }) {
  const t = BRAND_RADAR_COPY[locale];
  const tools = SEO_TOOLS_COPY[locale];
  const [data, setData] = useState<RadarData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ai/visibility/brand-radar")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setData)
      .catch(() => setError(t.loadFailed));
  }, [t]);

  const it = tools.items.brand_radar;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">
            {it.name}
          </h2>
          <p className="mt-1 text-sm text-gray-500">{it.description}</p>
        </div>
        <div className="shrink-0">
          <BrandRadarHelpButton locale={locale} />
        </div>
      </div>

      {error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="mb-3 h-10 w-10 text-red-400" />
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      )}

      {!data && !error && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-200" />
            ))}
          </div>
          <p className="text-sm text-gray-400">{t.loading}</p>
        </div>
      )}

      {data && !error && !data.audit && data.prompts.total === 0 ? (
        /* Honest empty state → the actions that generate real data */
        <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
            <RadarIcon className="h-7 w-7 text-gray-400" aria-hidden="true" />
          </div>
          <h3 className="text-base font-semibold text-gray-900">{t.emptyTitle}</h3>
          <p className="mt-2 max-w-md text-sm text-gray-500">{t.emptyBody}</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/visibility"
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              {t.auditCta}
            </Link>
            {data.prompts.feature && (
              <Link
                href="/visibility/tools/custom-prompts"
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                {t.promptsCta}
              </Link>
            )}
          </div>
        </div>
      ) : (
        data &&
        !error && (
          <>
            {data.brand.domain && (
              <p className="text-sm text-gray-500">
                {t.domainLabel}: <span className="font-medium text-gray-800">{data.brand.domain}</span>
                {data.audit && (
                  <span className="ml-3 text-xs text-gray-400">
                    {t.auditAt(formatDate(data.audit.at, locale))}
                  </span>
                )}
              </p>
            )}

            {/* Stat cards — only stats that exist */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {data.audit && (
                <StatCard
                  title={t.statScore}
                  value={`${data.audit.score}/100`}
                  icon={<Gauge className="h-5 w-5" />}
                />
              )}
              {data.audit && (
                <StatCard
                  title={t.statGrade}
                  value={data.audit.grade}
                  icon={<Sparkles className="h-5 w-5" />}
                />
              )}
              {data.prompts.mentionRate !== null && (
                <StatCard
                  title={t.statMentionRate(data.prompts.windowDays)}
                  value={`${data.prompts.mentionRate}%`}
                  icon={<RadarIcon className="h-5 w-5" />}
                />
              )}
              {data.prompts.feature && (
                <StatCard
                  title={t.statActivePrompts}
                  value={String(data.prompts.active)}
                  icon={<MessageSquareText className="h-5 w-5" />}
                />
              )}
            </div>

            {/* Engine coverage (real runs only) */}
            {data.prompts.feature && (
              <Card>
                <CardHeader>
                  <h3 className="text-base font-semibold text-gray-900">{t.enginesTitle}</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {t.enginesIntro(data.prompts.windowDays)}
                  </p>
                </CardHeader>
                <CardContent className="p-0">
                  {data.prompts.engines.length === 0 ? (
                    <p className="px-6 pb-5 text-sm text-gray-500">{t.noRuns}</p>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {data.prompts.engines.map((e) => (
                        <li key={e.engine} className="flex items-center justify-between px-6 py-3">
                          <div>
                            <p className="text-sm font-medium capitalize text-gray-900">
                              {e.engine}
                            </p>
                            <p className="text-xs text-gray-400">{t.engineRuns(e.runs)}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="h-1.5 w-32 overflow-hidden rounded bg-gray-100">
                              <div
                                className="h-full rounded bg-emerald-500"
                                style={{ width: `${e.rate}%` }}
                              />
                            </div>
                            <span className="w-10 text-right text-sm font-medium text-gray-700">
                              {e.rate}%
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Per-prompt trends — same component/data as /visibility */}
            {data.prompts.feature && data.prompts.total > 0 && (
              <div>
                <p className="mb-2 text-xs text-gray-400">{t.trendsNote}</p>
                <PromptTrends locale={locale} />
              </div>
            )}

            {/* Recent visibility alerts */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-gray-400" aria-hidden="true" />
                  <h3 className="text-base font-semibold text-gray-900">{t.alertsTitle}</h3>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {data.alerts.length === 0 ? (
                  <p className="px-6 pb-5 text-sm text-gray-500">{t.noAlerts}</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {data.alerts.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-3 px-6 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-gray-800">{a.title}</p>
                          <p className="text-xs text-gray-400">{formatDate(a.createdAt, locale)}</p>
                        </div>
                        <Badge variant={a.severity === "critical" ? "danger" : "warning"}>
                          {t.severityLabels[a.severity] ?? a.severity}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )
      )}
    </div>
  );
}
