"use client";

// Bot Analytics — a standalone tool, two sections.
//
// WHAT CHANGED AND WHY: this page used to resolve its domain only from the
// workspace's audited site, and when there wasn't one it rendered a single button
// to /visibility. A paying customer opened a tool and got a signpost to another
// tool. The domain is now resolved from three sources with an input on this page
// as one of them, so the page always has something to do. The link to the AI
// Visibility audit survives as a secondary text link and as the fix path for a
// blocked verdict — never as a gate.
//
// Charts are hand-rolled inline SVG, matching the rest of the repo. recharts is
// in package.json but is imported nowhere on the client, and one stacked bar
// chart is not a reason to make this page the first.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Lock,
  RefreshCw,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { BOT_CATALOG, type BotCategory } from "@/lib/bot-catalog";
import { isProblem, verdictTone, type BotVerdict } from "@/lib/bot-analytics/verdict";
import { BotAnalyticsHelpButton } from "@/components/seo-tools/bot-analytics-help";
import {
  BOT_ANALYTICS_COPY,
  SEO_TOOLS_COPY,
  type DashLocale,
} from "@/lib/i18n/dashboard";

// ─── Payload shapes (mirror the GET route) ──────────────────────────────────

interface BotResult {
  token: string;
  robotsRule: "ALLOWED" | "BLOCKED";
  robotsDetail: string;
  httpStatus: number | null;
  probed: boolean;
  verdict: BotVerdict;
}

interface AccessCheck {
  domain: string;
  results: Record<string, BotResult>;
  robotsPresent: boolean;
  sitemapFound: boolean;
  llmsTxt: boolean;
  checkedAt: string;
  fresh: boolean;
  error: string | null;
}

interface BotAggregate {
  token: string;
  total: number;
  verified: number;
  unverified: number;
  verifiable: boolean;
  firstSeen: string;
  lastSeen: string;
  topPaths: Array<{ path: string; hits: number }>;
  statusSplit: Record<string, number>;
}

interface Aggregates {
  days: string[];
  perDay: Record<string, Record<string, number>>;
  bots: BotAggregate[];
  totalBotHits: number;
  otherHits: number;
  statusSplit: Record<string, number>;
  hasUnverified: boolean;
}

interface Analysis {
  id: string;
  filename: string;
  sizeBytes: number;
  status: "PENDING" | "PROCESSING" | "COMPLETE" | "FAILED";
  error: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  linesParsed: number;
  linesSkipped: number;
  botHits: number;
  aggregates: Aggregates | null;
  createdAt: string;
}

interface Payload {
  domain: string | null;
  domainSource: "manual" | "monitor" | "settings" | null;
  check: AccessCheck | null;
  checks: { used: number; limit: number };
  logs: {
    enabled: boolean;
    used: number;
    limit: number;
    analyses: Analysis[];
  };
}

const CATEGORY_ORDER: BotCategory[] = ["search", "ai_answers", "ai_training"];

/** Chart palette. Distinct hues, all readable on white at 8px wide. */
const BOT_COLORS = [
  "#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed",
  "#0891b2", "#db2777", "#65a30d", "#ea580c", "#4f46e5",
  "#0d9488", "#9333ea", "#b45309",
];

function colorForToken(token: string): string {
  const idx = BOT_CATALOG.findIndex((b) => b.token === token);
  return BOT_COLORS[(idx < 0 ? 0 : idx) % BOT_COLORS.length];
}

function toneToVariant(tone: ReturnType<typeof verdictTone>) {
  switch (tone) {
    case "good":
      return "success" as const;
    case "warn":
      return "warning" as const;
    case "bad":
      return "danger" as const;
    default:
      return "default" as const;
  }
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

// ─── Stacked hits-per-day chart ─────────────────────────────────────────────

function HitsChart({
  aggregates,
  title,
  locale,
}: {
  aggregates: Aggregates;
  title: string;
  locale: DashLocale;
}) {
  const { days, perDay } = aggregates;
  const tokens = aggregates.bots.map((b) => b.token);
  const W = 720;
  const H = 200;
  const PAD_L = 34;
  const PAD_B = 28;
  const PAD_T = 8;

  const max = Math.max(
    1,
    ...days.map((d) => Object.values(perDay[d] ?? {}).reduce((a, b) => a + b, 0)),
  );
  const plotW = W - PAD_L - 8;
  const plotH = H - PAD_T - PAD_B;
  // Bars stay legible from 1 day to ~90; past that they merge into a band, which
  // still reads correctly as a shape.
  const slot = plotW / Math.max(days.length, 1);
  const barW = Math.max(2, Math.min(28, slot * 0.7));

  // Label every day when there are few, otherwise roughly six ticks.
  const labelEvery = Math.max(1, Math.ceil(days.length / 6));

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[520px]"
        role="img"
        aria-label={title}
      >
        {/* baseline + max gridline */}
        <line x1={PAD_L} y1={PAD_T + plotH} x2={W - 8} y2={PAD_T + plotH} stroke="#e5e7eb" strokeWidth={1} />
        <line x1={PAD_L} y1={PAD_T} x2={W - 8} y2={PAD_T} stroke="#f3f4f6" strokeWidth={1} />
        <text x={PAD_L - 6} y={PAD_T + 4} textAnchor="end" fontSize={10} fill="#9ca3af">
          {max}
        </text>
        <text x={PAD_L - 6} y={PAD_T + plotH} textAnchor="end" fontSize={10} fill="#9ca3af">
          0
        </text>

        {days.map((day, i) => {
          const x = PAD_L + i * slot + (slot - barW) / 2;
          let yCursor = PAD_T + plotH;
          return (
            <g key={day}>
              {tokens.map((token) => {
                const hits = perDay[day]?.[token] ?? 0;
                if (!hits) return null;
                const h = (hits / max) * plotH;
                yCursor -= h;
                return (
                  <rect
                    key={token}
                    x={x}
                    y={yCursor}
                    width={barW}
                    height={h}
                    fill={colorForToken(token)}
                  />
                );
              })}
              {i % labelEvery === 0 && (
                <text
                  x={x + barW / 2}
                  y={PAD_T + plotH + 16}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#9ca3af"
                >
                  {day.slice(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend doubles as the per-bot total, so the chart needs no tooltip. */}
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {aggregates.bots.map((b) => (
          <li key={b.token} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: colorForToken(b.token) }}
            />
            <span className="font-medium text-gray-800">{b.token}</span>
            <span className="text-gray-400">{b.total}</span>
          </li>
        ))}
      </ul>
      <span className="sr-only">{formatDate(days[0] ?? "", locale)}</span>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export function BotAnalyticsClient({ locale }: { locale: DashLocale }) {
  const t = BOT_ANALYTICS_COPY[locale];
  const tools = SEO_TOOLS_COPY[locale];
  const it = tools.items.bot_analytics;

  const [data, setData] = useState<Payload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editingDomain, setEditingDomain] = useState(false);
  const [domainInput, setDomainInput] = useState("");
  const [domainError, setDomainError] = useState<string | null>(null);
  const [savingDomain, setSavingDomain] = useState(false);

  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/visibility/bots");
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as Payload);
      setLoadError(null);
    } catch {
      setLoadError(t.loadFailed);
    }
  }, [t]);

  // Mount fetch as a promise chain with a cancelled guard, matching the other
  // tool clients — calling an async function straight from an effect body puts a
  // setState in the effect's synchronous path and can cascade renders.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/ai/visibility/bots")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((payload) => {
        if (cancelled) return;
        setData(payload as Payload);
        setLoadError(null);
      })
      .catch(() => {
        if (!cancelled) setLoadError(t.loadFailed);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  // Poll only while something is actually in flight, and stop as soon as it is
  // not — a permanent 4s poll on a dashboard page is a needless load on both
  // ends for a job that runs once a week.
  const pending = useMemo(
    () =>
      (data?.logs.analyses ?? []).some(
        (a) => a.status === "PENDING" || a.status === "PROCESSING",
      ),
    [data],
  );
  useEffect(() => {
    if (!pending) return;
    const id = setInterval(() => void load(), 4_000);
    return () => clearInterval(id);
  }, [pending, load]);

  const runCheck = useCallback(async () => {
    setChecking(true);
    setCheckError(null);
    try {
      const res = await fetch("/api/ai/visibility/bots", { method: "POST" });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setCheckError(body.error || t.checkFailed);
        return;
      }
      await load();
    } catch {
      setCheckError(t.checkFailed);
    } finally {
      setChecking(false);
    }
  }, [t, load]);

  const saveDomain = useCallback(async () => {
    setSavingDomain(true);
    setDomainError(null);
    try {
      const res = await fetch("/api/ai/visibility/bots/domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domainInput }),
      });
      if (!res.ok) {
        setDomainError(t.domainInvalid);
        return;
      }
      setEditingDomain(false);
      setDomainInput("");
      await load();
    } catch {
      setDomainError(t.domainSaveFailed);
    } finally {
      setSavingDomain(false);
    }
  }, [domainInput, t, load]);

  const upload = useCallback(
    async (file: File) => {
      setUploading(true);
      setUploadError(null);
      try {
        const form = new FormData();
        form.set("file", file);
        const res = await fetch("/api/ai/visibility/bots/upload", {
          method: "POST",
          body: form,
        });
        const body = (await res.json()) as { error?: string; code?: string };
        if (!res.ok) {
          setUploadError(
            body.code === "TooLarge"
              ? t.uploadTooLarge
              : body.code === "BadType"
                ? t.uploadBadType
                : body.error || t.uploadFailed,
          );
          return;
        }
        await load();
      } catch {
        setUploadError(t.uploadFailed);
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [t, load],
  );

  const check = data?.check ?? null;
  const problemCount = useMemo(() => {
    if (!check) return 0;
    return Object.values(check.results).filter((r) => isProblem(r.verdict)).length;
  }, [check]);

  const newestComplete = useMemo(
    () => (data?.logs.analyses ?? []).find((a) => a.status === "COMPLETE" && a.aggregates),
    [data],
  );

  const domainSource = data?.domainSource ?? null;
  const domainSourceLabel = useMemo(() => {
    if (!domainSource) return null;
    const source =
      domainSource === "manual"
        ? t.domainSourceManual
        : domainSource === "monitor"
          ? t.domainSourceMonitor
          : t.domainSourceSettings;
    return t.domainSourceLabel(source);
  }, [domainSource, t]);

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="mb-3 h-10 w-10 text-red-400" aria-hidden="true" />
        <p className="text-sm text-gray-500">{loadError}</p>
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-gray-400">{t.loading}</p>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">
            {it.name}
          </h2>
          <p className="mt-1 text-sm text-gray-500">{it.description}</p>
        </div>
        <BotAnalyticsHelpButton locale={locale} />
      </div>

      {/* The honest framing, now covering both halves. */}
      <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        <Bot className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
        <p className="text-xs text-gray-500">{t.introNote}</p>
      </div>

      {/* ── Domain ─────────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="py-4">
          {!editingDomain && data.domain ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-gray-500">
                  {t.siteLabel}:{" "}
                  <span className="font-medium text-gray-900">{data.domain}</span>
                </p>
                {domainSourceLabel && (
                  <p className="mt-0.5 text-xs text-gray-400">{domainSourceLabel}</p>
                )}
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setDomainInput(data.domain ?? "");
                  setEditingDomain(true);
                }}
              >
                {t.domainChange}
              </Button>
            </div>
          ) : (
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{t.domainTitle}</h3>
              <p className="mt-1 text-xs text-gray-500">{t.domainIntro}</p>
              <div className="mt-3 flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <label htmlFor="bot-domain" className="sr-only">
                    {t.domainTitle}
                  </label>
                  <input
                    id="bot-domain"
                    type="text"
                    inputMode="url"
                    autoComplete="url"
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && domainInput.trim()) void saveDomain();
                    }}
                    placeholder={t.domainPlaceholder}
                    aria-invalid={domainError ? true : undefined}
                    aria-describedby={domainError ? "bot-domain-error" : undefined}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <Button onClick={() => void saveDomain()} disabled={savingDomain || !domainInput.trim()}>
                  {savingDomain ? t.domainSaving : t.domainSave}
                </Button>
                {data.domain && (
                  <Button variant="outline" onClick={() => { setEditingDomain(false); setDomainError(null); }}>
                    {t.domainCancel}
                  </Button>
                )}
              </div>
              {domainError && (
                <p id="bot-domain-error" className="mt-2 text-xs text-red-600">
                  {domainError}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section A: access check ───────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-gray-900">{t.accessTitle}</h3>
              <p className="mt-1 text-xs text-gray-500">{t.accessIntro}</p>
            </div>
            <div className="text-right">
              <Button
                onClick={() => void runCheck()}
                disabled={checking || !data.domain || data.checks.used >= data.checks.limit}
              >
                {checking ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    {t.runningCheck}
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                    {check ? t.runCheckAgain : t.runCheck}
                  </>
                )}
              </Button>
              <p className="mt-1.5 text-xs text-gray-400">
                {check ? t.checkedAt(formatDate(check.checkedAt, locale)) : t.neverChecked}
              </p>
              <p className="text-xs text-gray-400">
                {t.checksUsed(data.checks.used, data.checks.limit)}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {checkError && (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
              {checkError}
            </p>
          )}
          {data.checks.used >= data.checks.limit && !checkError && (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
              {t.capReached}
            </p>
          )}

          {!check ? (
            <p className="py-6 text-center text-sm text-gray-400">
              {data.domain ? t.neverChecked : t.domainIntro}
            </p>
          ) : (
            <>
              {!check.fresh && (
                <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
                  {t.staleNote(formatDate(check.checkedAt, locale))}
                </p>
              )}

              {/* Summary first: the number the tenant came for. */}
              <div
                className={`mb-4 flex items-start gap-2 rounded-lg border px-4 py-3 ${
                  problemCount > 0
                    ? "border-red-200 bg-red-50"
                    : "border-green-200 bg-green-50"
                }`}
              >
                {problemCount > 0 ? (
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />
                )}
                <div className="min-w-0">
                  <p
                    className={`text-sm font-medium ${
                      problemCount > 0 ? "text-red-800" : "text-green-800"
                    }`}
                  >
                    {problemCount > 0 ? t.problemSummary(problemCount) : t.allClear}
                  </p>
                  {problemCount > 0 && (
                    <Link
                      href="/visibility"
                      className="mt-1 inline-flex items-center text-xs font-medium text-red-700 underline hover:text-red-900"
                    >
                      {t.fixLink}
                      <ExternalLink className="ml-1 h-3 w-3" aria-hidden="true" />
                    </Link>
                  )}
                </div>
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
                <Badge variant={check.robotsPresent ? "default" : "info"}>
                  {check.robotsPresent ? t.robotsPresent : t.robotsMissing}
                </Badge>
                <Badge variant={check.sitemapFound ? "success" : "warning"}>
                  {check.sitemapFound ? t.sitemapFound : t.sitemapMissing}
                </Badge>
                <Badge variant={check.llmsTxt ? "success" : "default"}>
                  {check.llmsTxt ? t.llmsFound : t.llmsMissing}
                </Badge>
              </div>

              {CATEGORY_ORDER.map((cat) => {
                const bots = BOT_CATALOG.filter(
                  (b) => b.category === cat && check.results[b.token],
                );
                if (bots.length === 0) return null;
                return (
                  <div key={cat} className="mb-5 last:mb-0">
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      {t.categoryLabels[cat]}
                    </h4>
                    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                      {bots.map((b) => {
                        const r = check.results[b.token];
                        const tone = verdictTone(r.verdict);
                        return (
                          <li
                            key={b.token}
                            className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900">
                                {b.token}{" "}
                                <span className="text-xs font-normal text-gray-400">
                                  · {b.org}
                                </span>
                              </p>
                              <p className="text-xs text-gray-500">{t.botDesc[b.token]}</p>
                              <p className="mt-0.5 text-xs text-gray-400">
                                {r.probed
                                  ? r.httpStatus !== null
                                    ? t.probeStatus(r.httpStatus)
                                    : t.probeUnreachable
                                  : t.preferenceOnly}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <Badge variant={toneToVariant(tone)}>
                                {t.verdictLabels[r.verdict] ?? r.verdict}
                              </Badge>
                              <p className="mt-1 max-w-[16rem] text-xs text-gray-400">
                                {t.verdictHelp[r.verdict]}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Section B: log analysis ───────────────────────────────────────── */}
      {!data.logs.enabled ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <Lock className="h-6 w-6 text-gray-400" aria-hidden="true" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">{t.upsellTitle}</h3>
            <p className="mt-2 max-w-md text-sm text-gray-500">{t.upsellBody}</p>
            <Link
              href="/settings/billing"
              className="mt-5 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              {t.upsellCta}
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-gray-900">{t.logsTitle}</h3>
            <p className="mt-1 text-xs text-gray-500">{t.logsIntro}</p>
          </CardHeader>
          <CardContent>
            {/* The deletion promise, stated where the upload happens. */}
            <p className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-900">
              {t.piiNote}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept=".log,.txt,.gz"
                className="sr-only"
                id="bot-log-file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(f);
                }}
              />
              <Button
                onClick={() => fileRef.current?.click()}
                disabled={uploading || data.logs.used >= data.logs.limit}
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    {t.uploading}
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
                    {t.dropzoneLabel}
                  </>
                )}
              </Button>
              <span className="text-xs text-gray-400">{t.dropzoneHint}</span>
              <span className="text-xs text-gray-400">
                {t.uploadsUsed(data.logs.used, data.logs.limit)}
              </span>
            </div>

            {uploadError && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
                {uploadError}
              </p>
            )}
            {data.logs.used >= data.logs.limit && !uploadError && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
                {t.uploadCapReached}
              </p>
            )}

            {/* Newest completed analysis, rendered in full. */}
            {newestComplete?.aggregates && (
              <div className="mt-6 space-y-6">
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                  {newestComplete.aggregates.bots.length > 0 ? (
                    <p className="text-sm font-medium text-gray-800">
                      {t.aiVisitSummary(
                        newestComplete.aggregates.bots[0].token,
                        newestComplete.aggregates.bots[0].total,
                      )}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-600">{t.noAiVisits}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-400">
                    {newestComplete.periodStart && newestComplete.periodEnd
                      ? `${t.periodLabel(
                          formatDate(newestComplete.periodStart, locale),
                          formatDate(newestComplete.periodEnd, locale),
                        )} · `
                      : ""}
                    {t.linesLabel(newestComplete.linesParsed, newestComplete.linesSkipped)}
                  </p>
                </div>

                {newestComplete.aggregates.days.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-gray-900">
                      {t.hitsChartTitle}
                    </h4>
                    <HitsChart
                      aggregates={newestComplete.aggregates}
                      title={t.hitsChartTitle}
                      locale={locale}
                    />
                  </div>
                )}

                {newestComplete.aggregates.bots.length > 0 && (
                  <div className="overflow-x-auto">
                    <h4 className="mb-2 text-sm font-semibold text-gray-900">
                      {t.topPathsTitle}
                    </h4>
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                          <th className="py-2 pr-4 font-medium">{t.botHeader}</th>
                          <th className="py-2 pr-4 font-medium">{t.pathHeader}</th>
                          <th className="py-2 pr-4 text-right font-medium">{t.hitsHeader}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {newestComplete.aggregates.bots.flatMap((b) =>
                          b.topPaths.slice(0, 5).map((p, i) => (
                            <tr key={`${b.token}-${p.path}`}>
                              <td className="py-2 pr-4 align-top text-gray-500">
                                {i === 0 ? (
                                  <span className="flex items-center gap-1.5">
                                    <span
                                      aria-hidden="true"
                                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                                      style={{ backgroundColor: colorForToken(b.token) }}
                                    />
                                    <span className="font-medium text-gray-800">{b.token}</span>
                                  </span>
                                ) : null}
                              </td>
                              <td className="max-w-md truncate py-2 pr-4 font-mono text-xs text-gray-700">
                                {p.path}
                              </td>
                              <td className="py-2 pr-4 text-right tabular-nums text-gray-700">
                                {p.hits}
                              </td>
                            </tr>
                          )),
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Per-bot detail: verification status, window, response codes. */}
                {newestComplete.aggregates.bots.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-gray-900">
                      {t.statusSplitTitle}
                    </h4>
                    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                      {newestComplete.aggregates.bots.map((b) => (
                        <li key={b.token} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900">{b.token}</p>
                            <p className="text-xs text-gray-400">
                              {t.firstSeenLabel} {formatDate(b.firstSeen, locale)} ·{" "}
                              {t.lastSeenLabel} {formatDate(b.lastSeen, locale)}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {Object.entries(b.statusSplit)
                              .sort((a, c) => c[1] - a[1])
                              .slice(0, 4)
                              .map(([code, n]) => (
                                <Badge
                                  key={code}
                                  variant={code.startsWith("2") || code.startsWith("3") ? "success" : "warning"}
                                >
                                  {code} · {n}
                                </Badge>
                              ))}
                            <Badge variant={b.verifiable && b.verified > 0 ? "info" : "default"}>
                              {b.verifiable && b.verified > 0
                                ? `${t.verifiedLabel} ${b.verified}`
                                : t.unverifiedLabel}
                            </Badge>
                          </div>
                        </li>
                      ))}
                    </ul>
                    {newestComplete.aggregates.hasUnverified && (
                      <p className="mt-2 text-xs text-gray-400">{t.unverifiedNote}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* History */}
            <div className="mt-6">
              <h4 className="mb-2 text-sm font-semibold text-gray-900">{t.historyTitle}</h4>
              {data.logs.analyses.length === 0 ? (
                <p className="text-sm text-gray-400">{t.noAnalyses}</p>
              ) : (
                <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                  {data.logs.analyses.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-gray-800">{a.filename}</p>
                        <p className="text-xs text-gray-400">
                          {formatDate(a.createdAt, locale)} · {formatBytes(a.sizeBytes)}
                          {a.status === "COMPLETE" ? ` · ${t.totalBotHits(a.botHits)}` : ""}
                        </p>
                        {a.error && <p className="mt-0.5 text-xs text-red-600">{a.error}</p>}
                      </div>
                      <Badge
                        variant={
                          a.status === "COMPLETE"
                            ? "success"
                            : a.status === "FAILED"
                              ? "danger"
                              : "info"
                        }
                      >
                        {t.statusLabels[a.status] ?? a.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
              {pending && <p className="mt-2 text-xs text-gray-400">{t.processingNote}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Secondary link to the audit — a cross-link, never a gate. */}
      <p className="text-center text-xs text-gray-400">
        <Link href="/visibility" className="underline hover:text-gray-600">
          {t.auditLinkLabel}
        </Link>
      </p>
    </div>
  );
}
