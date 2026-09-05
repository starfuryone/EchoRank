"use client";

// src/components/seo-tools/ai-citations-client.tsx
//
// The AI Citations tool body: a target, the platforms to ask about, optional
// competitors, and the result — cited pages, per-platform totals, and a share-
// of-voice bar.
//
// ── WHAT THIS COMPONENT MAY IMPORT ─────────────────────────────────────────
// Types and pure modules only. `@/lib/ai-citations/target` and `.../options`
// are dependency-free by design so the scope labels and the platform list can
// be shared with the server without dragging prisma or the DataForSEO client
// into the browser bundle. Never import `.../service` here — it is server-only
// and would be a build error, by design (CLAUDE.md).
//
// ── NULL IS RENDERED AS "no data", NEVER AS 0 ──────────────────────────────
// The provider distinguishes "we measured zero" from "we have nothing", and so
// does every shape underneath this. Collapsing them in the UI would be the one
// place all that care is thrown away, so `metric()` renders null as an em dash
// and a share of null as "no data".

import { useCallback, useMemo, useState } from "react";
import { Loader2, Quote, ExternalLink } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExportCsvButton } from "@/components/seo-tools/export-csv-button";
import { AI_CITATIONS_COPY, type DashLocale } from "@/lib/i18n/dashboard";
// The PURE platform module. Importing this from dataforseo/endpoints pulls
// "server-only" into the browser bundle and fails the build — see that
// module's header.
import { LLM_PLATFORMS, type LlmPlatform } from "@/lib/ai-citations/platforms";
import {
  CITATION_SCOPES,
  isValidCitationTarget,
  type CitationScope,
} from "@/lib/ai-citations/target";
import type { AiCitationsAnalysisDto, CitedSourceRow } from "@/lib/ai-citations/types";

const MAX_COMPETITOR_INPUTS = 5;

/** An em dash for "not measured". See the header. */
function metric(value: number | null): string {
  return value === null ? "—" : value.toLocaleString();
}

function hoursFrom(ms: number): number {
  return Math.max(1, Math.round(ms / 3_600_000));
}

interface ApiError {
  error?: string;
  code?: string;
  limit?: number;
  used?: number;
  resetsAt?: string;
}

export function AiCitationsClient({
  locale,
  defaultTarget,
}: {
  locale: DashLocale;
  defaultTarget: string;
}) {
  const t = AI_CITATIONS_COPY[locale];

  const [target, setTarget] = useState(defaultTarget);
  const [scope, setScope] = useState<CitationScope>("subdomains");
  const [platforms, setPlatforms] = useState<LlmPlatform[]>([...LLM_PLATFORMS]);
  const [competitors, setCompetitors] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [analysis, setAnalysis] = useState<AiCitationsAnalysisDto | null>(null);

  const canSubmit =
    !busy && platforms.length > 0 && isValidCitationTarget(target, scope);

  const togglePlatform = useCallback((platform: LlmPlatform) => {
    setPlatforms((current) =>
      current.includes(platform)
        ? // Never let the last chip be unchecked: a lookup with no platform is
          // a request the server would reject, so the UI does not offer it.
          current.length === 1
          ? current
          : current.filter((entry) => entry !== platform)
        : [...current, platform],
    );
  }, []);

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/seo/v1/ai-citations/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target,
          scope,
          platforms,
          competitors: competitors
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean)
            .slice(0, MAX_COMPETITOR_INPUTS),
        }),
      });
      const body = (await response.json()) as { analysis?: AiCitationsAnalysisDto } & ApiError;
      if (!response.ok || !body.analysis) {
        setError(body ?? { error: t.errorGeneric });
        return;
      }
      setAnalysis(body.analysis);
    } catch {
      setError({ error: t.errorGeneric });
    } finally {
      setBusy(false);
    }
  }, [target, scope, platforms, competitors, t.errorGeneric]);

  const csvColumns = useMemo(
    () => [
      { header: t.colUrl, value: (row: CitedSourceRow) => row.url },
      { header: t.colDomain, value: (row: CitedSourceRow) => row.domain ?? "" },
      { header: t.colPlatform, value: (row: CitedSourceRow) => row.platform },
      { header: t.colMentions, value: (row: CitedSourceRow) => row.mentions },
      { header: t.colVolume, value: (row: CitedSourceRow) => row.capturedVolume },
      {
        header: t.colPrompts,
        value: (row: CitedSourceRow) => row.prompts.map((p) => p.question).join(" | "),
      },
    ],
    [t],
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-gray-900">{t.formTitle}</h3>
          <p className="mt-1 text-sm text-gray-500">{t.formIntro}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-0 flex-1">
              <span className="mb-1 block text-xs font-medium text-gray-500">
                {t.targetLabel}
              </span>
              <input
                type="text"
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                placeholder={t.targetPlaceholder}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-gray-500">
                {t.scopeLabel}
              </span>
              <select
                value={scope}
                onChange={(event) => setScope(event.target.value as CitationScope)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {CITATION_SCOPES.map((value) => (
                  <option key={value} value={value}>
                    {t.scopes[value]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <span className="mb-1 block text-xs font-medium text-gray-500">
              {t.platformsLabel}
            </span>
            <div className="flex flex-wrap gap-2">
              {LLM_PLATFORMS.map((platform) => {
                const on = platforms.includes(platform);
                return (
                  <button
                    key={platform}
                    type="button"
                    aria-pressed={on}
                    onClick={() => togglePlatform(platform)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      on
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-gray-300 bg-white text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    {t.platforms[platform]}
                  </button>
                );
              })}
            </div>
            {/* A provider restriction, not ours — and one the customer will
                otherwise read as a bug when the ChatGPT column is empty. */}
            {platforms.includes("chat_gpt") && (
              <p className="mt-1.5 text-xs text-gray-400">{t.chatGptMarketNote}</p>
            )}
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">
              {t.competitorsLabel}
            </span>
            <input
              type="text"
              value={competitors}
              onChange={(event) => setCompetitors(event.target.value)}
              placeholder={t.competitorsPlaceholder}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-gray-400">{t.competitorsHint}</span>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={run} disabled={!canSubmit}>
              {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {busy ? t.running : t.submit}
            </Button>
            {/* The cost hint. A lookup is several provider calls; saying so
                before the click is cheaper than explaining it afterwards. */}
            <span className="text-xs text-gray-400">{t.costHint}</span>
          </div>

          {error && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {error.code === "NOT_ENABLED"
                ? t.errorNotEnabled
                : error.code === "PLAN_LOCKED"
                  ? t.errorPlanLocked
                  : error.code === "quota_exceeded"
                    ? t.errorQuota
                    : (error.error ?? t.errorGeneric)}
            </p>
          )}
        </CardContent>
      </Card>

      {analysis && (
        <>
          {analysis.cached && analysis.reRunAvailableInMs !== undefined && (
            <p className="text-xs text-gray-400">
              {t.cachedNote(hoursFrom(analysis.reRunAvailableInMs))}
            </p>
          )}

          {analysis.failedPlatforms.length > 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {t.partialNote(
                analysis.failedPlatforms.map((p) => t.platforms[p]).join(", "),
              )}
            </p>
          )}

          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-gray-900">{t.totalsTitle}</h3>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {analysis.totals.map((total) => (
                  <div key={total.platform} className="rounded-lg border border-gray-200 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      {t.platforms[total.platform]}
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-gray-900">
                      {metric(total.mentions)}
                    </p>
                    <p className="text-xs text-gray-500">{t.totalMentions}</p>
                    <p className="mt-2 text-xs text-gray-400">
                      {t.totalVolume}: {metric(total.aiSearchVolume)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {analysis.shareOfVoice && analysis.shareOfVoice.entries.length > 0 && (
            <Card>
              <CardHeader>
                <h3 className="text-base font-semibold text-gray-900">{t.sovTitle}</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {t.sovIntro(
                    analysis.shareOfVoice.platforms.map((p) => t.platforms[p]).join(", "),
                  )}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {analysis.shareOfVoice.entries.map((entry) => (
                  <div key={entry.label}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span
                        className={
                          entry.isTarget ? "font-semibold text-gray-900" : "text-gray-600"
                        }
                      >
                        {entry.label}
                        {entry.isTarget && (
                          <Badge variant="info" className="ml-2">
                            {t.sovYou}
                          </Badge>
                        )}
                      </span>
                      <span className="tabular-nums text-gray-500">
                        {entry.sharePct === null
                          ? t.sovNoData
                          : `${entry.sharePct.toFixed(1)}%`}
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={entry.isTarget ? "h-full bg-blue-600" : "h-full bg-gray-400"}
                        style={{ width: `${entry.sharePct ?? 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Quote className="h-4 w-4 text-gray-400" aria-hidden="true" />
                  <h3 className="text-base font-semibold text-gray-900">{t.sourcesTitle}</h3>
                </div>
                {analysis.sources.length > 0 && (
                  <ExportCsvButton
                    rows={analysis.sources}
                    columns={csvColumns}
                    tool="ai-citations"
                    label={t.exportCsv}
                  />
                )}
              </div>
              <p className="mt-1 text-sm text-gray-500">{t.sourcesIntro}</p>
            </CardHeader>
            <CardContent className="p-0">
              {analysis.sources.length === 0 ? (
                <p className="px-6 py-4 text-sm text-gray-500">{t.sourcesEmpty}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                      <tr>
                        <th className="px-6 py-2 font-medium">{t.colUrl}</th>
                        <th className="px-3 py-2 font-medium">{t.colPlatform}</th>
                        <th className="px-3 py-2 text-right font-medium">{t.colMentions}</th>
                        <th className="px-3 py-2 text-right font-medium">{t.colVolume}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {analysis.sources.map((row) => (
                        <tr key={`${row.platform}:${row.url}`} className="align-top">
                          <td className="max-w-md px-6 py-3">
                            {/* rel="nofollow noopener" — these URLs came from
                                LLM answers via the provider, and are already
                                scheme-filtered server-side. */}
                            <a
                              href={row.url}
                              target="_blank"
                              rel="nofollow noopener noreferrer"
                              className="inline-flex items-center gap-1 break-all text-blue-600 hover:text-blue-700"
                            >
                              {row.url}
                              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                            </a>
                            {row.prompts.length > 0 && (
                              <ul className="mt-1 space-y-0.5">
                                {row.prompts.map((prompt) => (
                                  <li key={prompt.question} className="text-xs text-gray-500">
                                    “{prompt.question}”
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                          <td className="px-3 py-3 text-gray-600">
                            {t.platforms[row.platform]}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-gray-600">
                            {metric(row.mentions)}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-gray-600">
                            {metric(row.capturedVolume)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-gray-400">{t.samplingNote}</p>
        </>
      )}
    </div>
  );
}
