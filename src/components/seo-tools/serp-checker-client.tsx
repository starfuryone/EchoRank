"use client";

// SERP Checker — the tenant queues a keyword, the card polls until the
// serp-checks worker fills it in, then the top-100 organic table renders.
//
// Async by design: POST returns 202 + a queued row, so the UI's job is to be
// honest about the wait ("Results take 1–5 minutes.") rather than fake a
// spinner over a synchronous call. Zero invented numbers — every cell comes
// from a stored DataForSEO envelope.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ListOrdered, AlertCircle, Loader2, Search } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDateTime } from "@/lib/utils";
import { SerpCheckerHelpButton } from "@/components/seo-tools/serp-checker-help";
import { SERP_LANGUAGE_CODES, SERP_LOCATION_CODES } from "@/lib/serp/options";
import type { SerpCheckDto, SerpDevice } from "@/lib/serp/types";
import {
  SERP_CHECKER_COPY,
  SEO_TOOLS_COPY,
  type DashLocale,
  type SerpCheckerCopy,
} from "@/lib/i18n/dashboard";

const API = "/api/seo/v1/serp/check";
const POLL_INTERVAL_MS = 5_000;

interface HistoryResponse {
  checks: SerpCheckDto[];
  usage: { used: number; limit: number; plan: string };
  totalCostUsd: number;
}

function statusBadge(status: SerpCheckDto["status"], t: SerpCheckerCopy) {
  if (status === "completed") return <Badge variant="success">{t.statusCompleted}</Badge>;
  if (status === "failed") return <Badge variant="danger">{t.statusFailed}</Badge>;
  return <Badge variant="info">{t.statusQueued}</Badge>;
}

/** SERP feature type -> chip label. Underscores read badly in a chip. */
function featureLabel(feature: string): string {
  return feature.replace(/_/g, " ");
}

function ResultsTable({ check, t }: { check: SerpCheckDto; t: SerpCheckerCopy }) {
  const items = check.results?.items ?? [];
  if (items.length === 0) {
    return <p className="text-sm text-gray-500">{t.emptyResults}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
            <th className="w-12 py-2 pr-3 font-semibold">{t.colPosition}</th>
            <th className="py-2 pr-3 font-semibold">{t.colTitle}</th>
            <th className="w-52 py-2 pr-3 font-semibold">{t.colDomain}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((item) => (
            <tr key={`${item.position}-${item.url}`}>
              <td className="py-2 pr-3 align-top font-medium text-gray-900">{item.position}</td>
              <td className="max-w-0 py-2 pr-3 align-top">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="block truncate font-medium text-blue-600 hover:text-blue-700"
                  title={item.title || item.url}
                >
                  {item.title || t.untitled}
                </a>
                <span className="block truncate text-xs text-gray-400" title={item.url}>
                  {item.url}
                </span>
              </td>
              <td className="py-2 pr-3 align-top text-gray-600">{item.domain}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SerpCheckerClient({ locale }: { locale: DashLocale }) {
  const t = SERP_CHECKER_COPY[locale];
  const tools = SEO_TOOLS_COPY[locale];
  const it = tools.items.serp_checker;

  const [keyword, setKeyword] = useState("");
  const [locationCode, setLocationCode] = useState(String(SERP_LOCATION_CODES[0]));
  const [languageCode, setLanguageCode] = useState<string>(SERP_LANGUAGE_CODES[0]);
  const [device, setDevice] = useState<SerpDevice>("desktop");

  const [active, setActive] = useState<SerpCheckDto | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [quotaLimit, setQuotaLimit] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // History reloads are driven by a token rather than an imperative call, so
  // the fetch stays inside its effect (the repo's idiom — see BotAnalyticsClient).
  const [reloadToken, setReloadToken] = useState(0);
  const reloadHistory = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetch(API)
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

  // ── Poll the active check until the worker finishes it. ────────────────
  const activeId = active?.status === "queued" ? active.id : null;

  useEffect(() => {
    if (!activeId) return;

    let cancelled = false;
    const timer = setInterval(() => {
      fetch(`${API}/${activeId}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((next: SerpCheckDto) => {
          if (cancelled) return;
          setActive(next);
          if (next.status !== "queued") reloadHistory();
        })
        .catch(() => {
          // Transient — the next tick retries.
        });
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeId, reloadHistory]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!keyword.trim() || submitting) return;

    setSubmitting(true);
    setError(null);
    setQuotaLimit(null);

    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: keyword.trim(),
          locationCode: Number(locationCode),
          languageCode,
          device,
        }),
      });
      const body = await res.json().catch(() => null);

      if (res.status === 429 && body?.code === "QUOTA_EXCEEDED") {
        setQuotaLimit(Number(body.limit));
        return;
      }
      if (!res.ok) {
        setError(t.submitFailed);
        return;
      }

      setActive(body.check as SerpCheckDto);
      reloadHistory();
    } catch {
      setError(t.submitFailed);
    } finally {
      setSubmitting(false);
    }
  }

  async function openCheck(id: string) {
    try {
      const res = await fetch(`${API}/${id}`);
      if (!res.ok) return;
      setActive((await res.json()) as SerpCheckDto);
    } catch {
      // Leave the current card in place.
    }
  }

  const usage = history?.usage;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">{it.name}</h2>
          <p className="mt-1 text-sm text-gray-500">{it.description}</p>
        </div>
        <div className="shrink-0">
          <SerpCheckerHelpButton locale={locale} />
        </div>
      </div>

      {/* ── Form ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex items-center justify-between gap-4">
          <h3 className="text-base font-semibold text-gray-900">{t.formTitle}</h3>
          {usage && usage.limit > 0 && (
            <span className="text-xs text-gray-500">{t.usage(usage.used, usage.limit)}</span>
          )}
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-gray-500">{t.formIntro}</p>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                id="serp-keyword"
                label={t.keywordLabel}
                placeholder={t.keywordPlaceholder}
                value={keyword}
                maxLength={200}
                onChange={(e) => setKeyword(e.target.value)}
              />
              <Select
                id="serp-location"
                label={t.locationLabel}
                value={locationCode}
                onChange={(e) => setLocationCode(e.target.value)}
                options={SERP_LOCATION_CODES.map((code) => ({
                  value: String(code),
                  label: t.locationLabels[code],
                }))}
              />
              <Select
                id="serp-language"
                label={t.languageLabel}
                value={languageCode}
                onChange={(e) => setLanguageCode(e.target.value)}
                options={SERP_LANGUAGE_CODES.map((code) => ({
                  value: code,
                  label: t.languageLabels[code],
                }))}
              />
              <Select
                id="serp-device"
                label={t.deviceLabel}
                value={device}
                onChange={(e) => setDevice(e.target.value as SerpDevice)}
                options={[
                  { value: "desktop", label: t.deviceDesktop },
                  { value: "mobile", label: t.deviceMobile },
                ]}
              />
            </div>
            <Button type="submit" loading={submitting} disabled={!keyword.trim()}>
              {!submitting && <Search className="mr-2 h-4 w-4" aria-hidden="true" />}
              {submitting ? t.submitting : t.submit}
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

      {/* ── Active check ─────────────────────────────────────────────── */}
      {active && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-gray-900">
                {t.resultsFor(active.keyword)}
              </h3>
              {statusBadge(active.status, t)}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {t.locationLabels[active.locationCode as (typeof SERP_LOCATION_CODES)[number]] ??
                active.locationCode}
              {" · "}
              {active.device === "mobile" ? t.deviceMobile : t.deviceDesktop}
              {active.status === "completed" && active.itemCount !== null
                ? ` · ${t.resultCount(active.itemCount)}`
                : ""}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {active.cached && <p className="text-xs text-gray-500">{t.cachedNote}</p>}

            {active.status === "queued" && (
              <div className="flex flex-col items-center py-12 text-center">
                <Loader2 className="mb-3 h-8 w-8 animate-spin text-blue-500" aria-hidden="true" />
                <p className="text-sm font-medium text-gray-900">{t.checkingTitle}</p>
                <p className="mt-1 max-w-sm text-sm text-gray-500">{t.checkingBody}</p>
              </div>
            )}

            {active.status === "failed" && (
              <div className="flex flex-col items-center py-12 text-center">
                <AlertCircle className="mb-3 h-8 w-8 text-red-400" aria-hidden="true" />
                <p className="text-sm font-medium text-gray-900">{t.failedTitle}</p>
                <p className="mt-1 max-w-sm text-sm text-gray-500">{t.failedBody}</p>
              </div>
            )}

            {active.status === "completed" && (
              <>
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {t.featuresTitle}
                  </h4>
                  {active.serpFeatures.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {active.serpFeatures.map((feature) => (
                        <Badge key={feature}>{featureLabel(feature)}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">{t.noFeatures}</p>
                  )}
                </div>
                <ResultsTable check={active} t={t} />
              </>
            )}
          </CardContent>
        </Card>
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
          {!history || history.checks.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <ListOrdered className="mb-3 h-8 w-8 text-gray-300" aria-hidden="true" />
              <p className="text-sm text-gray-500">{t.historyEmpty}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                    <th className="py-2 pr-3 font-semibold">{t.colKeyword}</th>
                    <th className="w-24 py-2 pr-3 font-semibold">{t.colDevice}</th>
                    <th className="w-28 py-2 pr-3 font-semibold">{t.colStatus}</th>
                    <th className="w-24 py-2 pr-3 text-right font-semibold">{t.colResults}</th>
                    <th className="w-44 py-2 pr-3 font-semibold">{t.colWhen}</th>
                    <th className="w-16 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {history.checks.map((row) => (
                    <tr key={row.id}>
                      <td className="max-w-0 truncate py-2 pr-3 text-gray-800" title={row.keyword}>
                        {row.keyword}
                      </td>
                      <td className="py-2 pr-3 text-gray-600">
                        {row.device === "mobile" ? t.deviceMobile : t.deviceDesktop}
                      </td>
                      <td className="py-2 pr-3">{statusBadge(row.status, t)}</td>
                      <td className="py-2 pr-3 text-right text-gray-600">
                        {row.itemCount ?? "—"}
                      </td>
                      <td className="py-2 pr-3 text-gray-500">
                        {formatDateTime(row.createdAt, locale)}
                      </td>
                      <td className="py-2 text-right">
                        {row.status === "completed" && (
                          <button
                            type="button"
                            onClick={() => void openCheck(row.id)}
                            className="text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                          >
                            {t.view}
                          </button>
                        )}
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
