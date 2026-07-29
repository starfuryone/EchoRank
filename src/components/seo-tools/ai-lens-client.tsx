"use client";

// AI Lens — the tenant submits a URL, the sidecar fetches it twice, and the gap
// renders. Synchronous: one POST, ~15-20 s, no queue and no poll, so the honest
// loading state names both fetches rather than showing a bare spinner over a
// wait long enough to look broken.
//
// Every error the route can return has its own card. A failed fetch is a real
// answer about the page ("it redirected off-domain", "it 404s to a crawler"), not
// a glitch to hide behind a generic retry.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2, Lock, ScanEye, Search } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AiLensHelpButton } from "@/components/seo-tools/ai-lens-help";
import { AiLensResult } from "@/components/seo-tools/ai-lens-result";
import { formatDateTime } from "@/lib/utils";
import { AI_LENS_COPY, SEO_TOOLS_COPY, type AiLensCopy, type DashLocale } from "@/lib/i18n/dashboard";
import type { AiLensVerdict } from "@/lib/ai-lens/options";
import type {
  AiLensAnalysisDto,
  AiLensHistoryRow,
  AiLensUsage,
} from "@/lib/ai-lens/types";

const API = "/api/seo/v1/ai-lens";

interface HistoryResponse {
  analyses: AiLensHistoryRow[];
  usage: AiLensUsage;
}

/** Which error card to show. Mapped from the route's `code`, not the message. */
type ErrorKind = "quota" | "foreign" | "busy" | "failed" | "load" | null;

const VERDICT_VARIANT: Record<AiLensVerdict, "success" | "warning" | "danger"> = {
  readable: "success",
  partial: "warning",
  substantial: "danger",
};

function verdictLabel(verdict: AiLensVerdict, t: AiLensCopy): string {
  if (verdict === "substantial") return t.verdictSubstantial;
  if (verdict === "partial") return t.verdictPartial;
  return t.verdictReadable;
}

export function AiLensClient({ locale }: { locale: DashLocale }) {
  const t = AI_LENS_COPY[locale];
  const it = SEO_TOOLS_COPY[locale].items.ai_lens;

  const [url, setUrl] = useState("");
  const [running, setRunning] = useState(false);
  const [analysis, setAnalysis] = useState<AiLensAnalysisDto | null>(null);
  const [cached, setCached] = useState(false);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [errorKind, setErrorKind] = useState<ErrorKind>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  // History reloads are driven by a token so the fetch stays inside its effect
  // (the repo's idiom — see SerpCheckerClient).
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
        if (!cancelled) setErrorKind("load");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = url.trim();
    if (!trimmed || running) return;

    setRunning(true);
    setErrorKind(null);
    setErrorDetail(null);
    setAnalysis(null);
    setCached(false);

    try {
      const res = await fetch(`${API}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        const code = body?.code as string | undefined;
        if (code === "QUOTA_EXCEEDED") setErrorKind("quota");
        else if (code === "FOREIGN_DOMAIN") setErrorKind("foreign");
        else if (code === "RENDER_BUSY" || code === "RATE_LIMITED") setErrorKind("busy");
        else {
          setErrorKind("failed");
          // The route's message is written for a user and names the real cause.
          if (typeof body?.error === "string") setErrorDetail(body.error);
        }
        if (body?.usage) setHistory((prev) => (prev ? { ...prev, usage: body.usage } : prev));
        return;
      }

      setAnalysis(body.analysis as AiLensAnalysisDto);
      setCached(Boolean(body.cached));
      if (body.usage) setHistory((prev) => (prev ? { ...prev, usage: body.usage } : prev));
      reloadHistory();
    } catch {
      setErrorKind("failed");
    } finally {
      setRunning(false);
    }
  }

  /** Opening a stored analysis is a read — it never spends. */
  async function open(id: string) {
    try {
      const res = await fetch(`${API}/${id}`);
      if (!res.ok) return;
      const body = await res.json();
      setAnalysis(body.analysis as AiLensAnalysisDto);
      setCached(false);
      setErrorKind(null);
    } catch {
      /* leave the current card in place */
    }
  }

  const usage = history?.usage;
  const remaining = usage ? Math.max(usage.limit - usage.used, 0) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">{it.name}</h2>
          <p className="mt-1 text-sm text-gray-500">{it.description}</p>
        </div>
        <div className="shrink-0">
          <AiLensHelpButton locale={locale} />
        </div>
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
          <p className="mb-2 text-sm text-gray-500">{t.formIntro}</p>
          {/* Which URLs this plan may analyze, stated before the input rather
              than discovered by getting a 403 back. */}
          {usage && (
            <p className="mb-4 flex items-center gap-1.5 text-xs text-gray-500">
              {!usage.crossDomain && <Lock className="h-3 w-3" aria-hidden="true" />}
              {usage.crossDomain ? t.crossDomainNote : t.ownDomainNote}
            </p>
          )}
          <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input
                id="ai-lens-url"
                label={t.urlLabel}
                placeholder={t.urlPlaceholder}
                value={url}
                maxLength={2000}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <Button type="submit" loading={running} disabled={!url.trim()}>
              {!running && <Search className="mr-2 h-4 w-4" aria-hidden="true" />}
              {running ? t.submitting : t.submit}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ── In flight ────────────────────────────────────────────────── */}
      {running && (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Loader2 className="mb-3 h-8 w-8 animate-spin text-blue-500" aria-hidden="true" />
            <p className="text-sm font-medium text-gray-900">{t.progressTitle}</p>
            <p className="mt-2 text-sm text-gray-600">{t.progressRaw}</p>
            <p className="text-sm text-gray-600">{t.progressRender}</p>
            <p className="mt-3 max-w-sm text-xs text-gray-400">{t.progressNote}</p>
          </CardContent>
        </Card>
      )}

      {/* ── Errors ───────────────────────────────────────────────────── */}
      {errorKind === "quota" && usage && (
        <ErrorCard
          tone="amber"
          title={t.quotaTitle}
          body={t.quotaBody(usage.limit)}
          cta={{ href: "/billing", label: t.quotaCta }}
        />
      )}
      {errorKind === "foreign" && (
        <ErrorCard
          tone="amber"
          title={t.foreignTitle}
          body={t.foreignBody}
          cta={{ href: "/billing", label: t.foreignCta }}
        />
      )}
      {errorKind === "busy" && <ErrorCard tone="amber" title={t.busyTitle} body={t.busyBody} />}
      {errorKind === "failed" && (
        <ErrorCard tone="red" title={t.failedTitle} body={errorDetail ?? t.failedBody} />
      )}
      {errorKind === "load" && <ErrorCard tone="red" title={t.failedTitle} body={t.loadFailed} />}

      {/* ── Result ───────────────────────────────────────────────────── */}
      {analysis && !running && (
        <div>
          <p className="mb-3 truncate text-sm text-gray-500" title={analysis.url}>
            {analysis.url}
          </p>
          <AiLensResult analysis={analysis} locale={locale} cached={cached} />
        </div>
      )}

      {/* ── History ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-gray-900">{t.historyTitle}</h3>
        </CardHeader>
        <CardContent>
          {!history || history.analyses.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <ScanEye className="mb-3 h-8 w-8 text-gray-300" aria-hidden="true" />
              <p className="text-sm text-gray-500">{t.historyEmpty}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                    <th className="py-2 pr-3 font-semibold">{t.colUrl}</th>
                    <th className="w-20 py-2 pr-3 text-right font-semibold">{t.colGap}</th>
                    <th className="w-40 py-2 pr-3 font-semibold">{t.colVerdict}</th>
                    <th className="w-44 py-2 pr-3 font-semibold">{t.colWhen}</th>
                    <th className="w-16 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {history.analyses.map((row) => (
                    <tr key={row.id}>
                      <td className="max-w-0 truncate py-2 pr-3 text-gray-800" title={row.url}>
                        {row.url}
                      </td>
                      <td className="py-2 pr-3 text-right font-medium text-gray-900">
                        {row.gapPercent}%
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant={VERDICT_VARIANT[row.verdict]}>
                          {verdictLabel(row.verdict, t)}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 text-gray-500">
                        {formatDateTime(row.createdAt, locale)}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => void open(row.id)}
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

function ErrorCard({
  tone,
  title,
  body,
  cta,
}: {
  tone: "amber" | "red";
  title: string;
  body: string;
  cta?: { href: string; label: string };
}) {
  const style =
    tone === "amber"
      ? { box: "border-amber-200 bg-amber-50", head: "text-amber-900", text: "text-amber-800" }
      : { box: "border-red-200 bg-red-50", head: "text-red-900", text: "text-red-800" };
  return (
    <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${style.box}`}>
      <AlertCircle className={`mt-0.5 h-4 w-4 shrink-0 ${style.head}`} aria-hidden="true" />
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${style.head}`}>{title}</p>
        <p className={`mt-1 text-sm ${style.text}`}>{body}</p>
        {cta && (
          <Link
            href={cta.href}
            className="mt-2 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            {cta.label}
          </Link>
        )}
      </div>
    </div>
  );
}
