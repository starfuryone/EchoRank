"use client";

// Site Audit — the tenant starts a crawl, the worker runs it for minutes, and
// this page polls until it settles.
//
// The defining constraint is that a crawl OUTLIVES the page view. Everything
// here is built for leaving and coming back: the POST returns a queued row
// immediately, the history list shows in-flight audits, and opening one
// resumes polling. Nothing depends on the tab staying open.
//
// Distinct from the audit on /visibility, which measures AI-engine
// readability. The copy says so in three places (form note, help modal, and
// the link below) because the two are genuinely easy to confuse.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Info, Loader2, ScanSearch, XCircle } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/utils";
import { SiteAuditHelpButton } from "@/components/seo-tools/site-audit-help";
import { isValidDomain } from "@/lib/site-explorer/domain";
import { SEVERITY_ORDER, type IssueSeverity } from "@/lib/site-audit/checks";
import { IN_FLIGHT_STATUSES } from "@/lib/site-audit/types";
import type {
  IssueRow,
  SiteAuditDto,
  SiteAuditHistoryRow,
  SiteAuditStatus,
  SiteAuditUsage,
} from "@/lib/site-audit/types";
import {
  SEO_TOOLS_COPY,
  SITE_AUDIT_COPY,
  type DashLocale,
  type SiteAuditCopy,
} from "@/lib/i18n/dashboard";

const API = "/api/seo/v1/site-audit";
/** Crawls take minutes; 10 s is responsive without hammering the row. */
const POLL_INTERVAL_MS = 10_000;

interface HistoryResponse {
  audits: SiteAuditHistoryRow[];
  usage: SiteAuditUsage;
}

/** "3 hours ago", module scope so Date.now() is not called during render. */
function timeAgo(iso: string, relative: Intl.RelativeTimeFormat): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 60) return relative.format(-Math.max(minutes, 1), "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return relative.format(-hours, "hour");
  return relative.format(-Math.round(hours / 24), "day");
}

const SEVERITY_STYLE: Record<IssueSeverity, { text: string; bg: string; ring: string }> = {
  error: { text: "text-red-700", bg: "bg-red-50", ring: "border-red-200" },
  warning: { text: "text-amber-700", bg: "bg-amber-50", ring: "border-amber-200" },
  notice: { text: "text-gray-600", bg: "bg-gray-50", ring: "border-gray-200" },
};

function severityLabel(severity: IssueSeverity, t: SiteAuditCopy): string {
  return severity === "error" ? t.severityError : severity === "warning" ? t.severityWarning : t.severityNotice;
}

function severityHint(severity: IssueSeverity, t: SiteAuditCopy): string {
  return severity === "error"
    ? t.severityErrorHint
    : severity === "warning"
      ? t.severityWarningHint
      : t.severityNoticeHint;
}

function groupLabel(group: string, t: SiteAuditCopy): string {
  const map: Record<string, string> = {
    availability: t.groupAvailability,
    links: t.groupLinks,
    content: t.groupContent,
    meta: t.groupMeta,
    performance: t.groupPerformance,
    canonical: t.groupCanonical,
    security: t.groupSecurity,
  };
  return map[group] ?? group;
}

/**
 * OnPage check keys are shown verbatim, humanised only by replacing
 * underscores. They are stable identifiers a user can search for in
 * DataForSEO's or any SEO tool's documentation — translating or renaming them
 * would make that impossible.
 */
function checkLabel(key: string): string {
  return key.replace(/_/g, " ");
}

function statusBadge(status: SiteAuditStatus, t: SiteAuditCopy) {
  if (status === "completed") return <Badge variant="success">{t.statusCompleted}</Badge>;
  if (status === "failed") return <Badge variant="danger">{t.statusFailed}</Badge>;
  if (status === "crawling") return <Badge variant="info">{t.statusCrawling}</Badge>;
  return <Badge>{t.statusQueued}</Badge>;
}

// ─── Score ring ─────────────────────────────────────────────────────────────

function ScoreRing({ score, t }: { score: number | null; t: SiteAuditCopy }) {
  const SIZE = 128;
  const STROKE = 10;
  const radius = (SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  // OnPage scores cluster high, so the bands are tighter than Lighthouse's.
  const color = score === null ? "#d1d5db" : score >= 90 ? "#16a34a" : score >= 70 ? "#d97706" : "#dc2626";
  const filled = score === null ? 0 : (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width={SIZE} height={SIZE} role="img" aria-label={`${t.scoreTitle}: ${score ?? "—"}`}>
          <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
            <circle cx={SIZE / 2} cy={SIZE / 2} r={radius} fill="none" stroke="#f3f4f6" strokeWidth={STROKE} />
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
        <span className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-semibold text-gray-900">
            {score === null ? "—" : score.toFixed(0)}
          </span>
          <span className="text-xs text-gray-400">{t.scoreUnit}</span>
        </span>
      </div>
      <p className="mt-2 text-sm font-medium text-gray-700">{t.scoreTitle}</p>
    </div>
  );
}

// ─── Issue group ────────────────────────────────────────────────────────────

function IssueGroup({
  severity,
  rows,
  audit,
  t,
  int,
}: {
  severity: IssueSeverity;
  rows: IssueRow[];
  audit: SiteAuditDto;
  t: SiteAuditCopy;
  int: Intl.NumberFormat;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const style = SEVERITY_STYLE[severity];
  if (rows.length === 0) return null;

  /** Pages from the stored table that failed this specific check. */
  const affected = (key: string) =>
    (audit.pages?.items ?? []).filter((page) => page.failedChecks.includes(key));

  return (
    <section>
      <div className="mb-2 flex items-baseline gap-2">
        <h4 className={`text-sm font-semibold ${style.text}`}>
          {severityLabel(severity, t)}
        </h4>
        <span className="text-xs text-gray-400">{severityHint(severity, t)}</span>
      </div>
      <ul className="space-y-2">
        {rows.map((row) => {
          const pages = affected(row.key);
          const isOpen = expanded === row.key;
          return (
            <li key={row.key} className={`rounded-lg border ${style.ring} ${style.bg} px-3 py-2`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{checkLabel(row.key)}</p>
                  <p className="text-xs text-gray-500">{groupLabel(row.group, t)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className={`text-sm font-semibold ${style.text}`}>
                    {t.affectedPages(row.count)}
                  </span>
                  {pages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : row.key)}
                      aria-expanded={isOpen}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      {isOpen ? t.hideAffected : t.showAffected}
                    </button>
                  )}
                </div>
              </div>
              {isOpen && (
                <ul className="mt-2 space-y-1 border-t border-gray-200 pt-2">
                  {pages.map((page) => (
                    <li key={page.url} className="truncate text-xs">
                      <a
                        href={page.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="text-blue-600 hover:text-blue-700"
                        title={page.url}
                      >
                        {page.url}
                      </a>
                    </li>
                  ))}
                  {/* A check counted at the site level can affect more pages
                      than the stored table holds — say so rather than imply
                      the list is complete. */}
                  {row.count > pages.length && (
                    <li className="text-xs text-gray-400">
                      {t.affectedPages(row.count - pages.length)} — {t.noAffectedListed}
                    </li>
                  )}
                </ul>
              )}
              {isOpen && pages.length === 0 && (
                <p className="mt-2 text-xs text-gray-400">{t.noAffectedListed}</p>
              )}
            </li>
          );
        })}
      </ul>
      <span className="sr-only">{int.format(rows.length)}</span>
    </section>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export function SiteAuditClient({ locale }: { locale: DashLocale }) {
  const t = SITE_AUDIT_COPY[locale];
  const tools = SEO_TOOLS_COPY[locale];
  const it = tools.items.site_audit;

  const { int, relative } = useMemo(
    () => ({
      int: new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }),
      relative: new Intl.RelativeTimeFormat(locale, { numeric: "auto" }),
    }),
    [locale],
  );

  const [domain, setDomain] = useState("");
  const [audit, setAudit] = useState<SiteAuditDto | null>(null);
  const [starting, setStarting] = useState(false);
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

  // ── Poll the open audit while its crawl is in flight ────────────────────
  const openId = audit && IN_FLIGHT_STATUSES.includes(audit.status) ? audit.id : null;

  useEffect(() => {
    if (!openId) return;
    let cancelled = false;

    const timer = setInterval(() => {
      fetch(`${API}/${openId}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((next: SiteAuditDto) => {
          if (cancelled) return;
          setAudit(next);
          // A finished crawl changes the history row's score and status.
          if (!IN_FLIGHT_STATUSES.includes(next.status)) reloadHistory();
        })
        .catch(() => {
          // Transient — the next tick retries.
        });
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [openId, reloadHistory]);

  const trimmed = domain.trim();
  const valid = trimmed.length > 0 && isValidDomain(trimmed);
  const showInvalid = trimmed.length > 0 && !valid;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || starting) return;

    setStarting(true);
    setError(null);
    setQuotaLimit(null);

    try {
      const res = await fetch(`${API}/start`, {
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
        setError(body?.code === "INVALID_REQUEST" ? t.invalidDomain : t.startFailed);
        return;
      }

      setAudit(body.audit as SiteAuditDto);
      if (body.usage) setHistory((prev) => (prev ? { ...prev, usage: body.usage } : prev));
      reloadHistory();
    } catch {
      setError(t.startFailed);
    } finally {
      setStarting(false);
    }
  }

  /** Opening a stored audit is a read — it never starts a crawl. */
  async function openAudit(id: string) {
    setError(null);
    try {
      const res = await fetch(`${API}/${id}`);
      if (!res.ok) return;
      setAudit((await res.json()) as SiteAuditDto);
    } catch {
      // Leave the current view in place.
    }
  }

  const usage = history?.usage;
  const inFlight = audit !== null && IN_FLIGHT_STATUSES.includes(audit.status);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">{it.name}</h2>
          <p className="mt-1 text-sm text-gray-500">{it.description}</p>
        </div>
        <div className="shrink-0">
          <SiteAuditHelpButton locale={locale} />
        </div>
      </div>

      {/* ── Form ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-4">
          <h3 className="text-base font-semibold text-gray-900">{t.formTitle}</h3>
          {usage && usage.limit > 0 && (
            <span className="text-xs text-gray-500">{t.usage(usage.used, usage.limit)}</span>
          )}
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-gray-500">{t.formIntro}</p>

          {/* The two audits are easy to confuse; the distinction is on the
              form itself, not only in the help modal. */}
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" aria-hidden="true" />
            <p className="text-xs leading-relaxed text-blue-800">
              {t.vsVisibilityNote}{" "}
              <Link href="/visibility" className="font-medium underline hover:text-blue-900">
                {t.vsVisibilityLink}
              </Link>
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                id="site-audit-domain"
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
            {usage && <p className="text-xs text-gray-400">{t.pageCapNote(usage.maxPages)}</p>}
            <Button type="submit" loading={starting} disabled={!valid}>
              {!starting && <ScanSearch className="mr-2 h-4 w-4" aria-hidden="true" />}
              {starting ? t.starting : t.start}
            </Button>
          </form>
        </CardContent>
      </Card>

      {quotaLimit !== null && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">{t.quotaTitle}</p>
          <p className="mt-1 text-sm text-amber-800">{t.quotaBody(quotaLimit)}</p>
          <Link href="/billing" className="mt-2 inline-block text-sm font-medium text-blue-600 hover:text-blue-700">
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

      {/* ── Crawl in flight ──────────────────────────────────────────── */}
      {audit && inFlight && (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center py-10 text-center">
              <Loader2 className="mb-3 h-8 w-8 animate-spin text-blue-500" aria-hidden="true" />
              <p className="text-sm font-medium text-gray-900">{t.crawlingTitle}</p>
              <p className="mt-1 max-w-md text-sm text-gray-500">{t.crawlingBody}</p>
              <p className="mt-3 text-sm font-medium text-gray-700">
                {t.progress(audit.pagesCrawled, audit.maxPages)}
              </p>
              <div
                className="mt-2 h-2 w-full max-w-sm overflow-hidden rounded bg-gray-100"
                role="progressbar"
                aria-valuenow={audit.pagesCrawled}
                aria-valuemin={0}
                aria-valuemax={audit.maxPages}
              >
                <div
                  className="h-full rounded bg-blue-600 transition-all"
                  style={{
                    width: `${Math.min((audit.pagesCrawled / Math.max(audit.maxPages, 1)) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Failed ───────────────────────────────────────────────────── */}
      {audit?.status === "failed" && (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center py-10 text-center">
              <XCircle className="mb-3 h-8 w-8 text-red-400" aria-hidden="true" />
              <p className="text-sm font-medium text-gray-900">{t.failedTitle}</p>
              <p className="mt-1 max-w-md text-sm text-gray-500">{audit.error || t.failedBody}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Results ──────────────────────────────────────────────────── */}
      {audit?.status === "completed" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="text-lg font-semibold text-gray-900">{audit.domain}</h3>
            {statusBadge(audit.status, t)}
            {audit.cached && (
              <span className="text-xs text-gray-500">
                {t.auditedAgo(timeAgo(audit.createdAt, relative))}
                {" · "}
                {t.reRunIn(Math.ceil((audit.reRunAvailableInMs ?? 0) / 3_600_000))}
              </span>
            )}
          </div>
          {audit.cached && <p className="text-sm text-gray-500">{t.cachedIntro}</p>}

          {/* Score + summary */}
          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-gray-900">{t.summaryTitle}</h3>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-8 lg:flex-row lg:items-center">
                <ScoreRing score={audit.summary?.onPageScore ?? null} t={t} />
                <dl className="grid flex-1 gap-6 sm:grid-cols-3 lg:grid-cols-4">
                  {(
                    [
                      [t.metricPagesCrawled, audit.pagesCrawled],
                      [t.metricBrokenLinks, audit.summary?.brokenLinks ?? 0],
                      [t.metricBrokenResources, audit.summary?.brokenResources ?? 0],
                      [t.metricDuplicateTitles, audit.summary?.duplicateTitles ?? 0],
                      [t.metricDuplicateDescriptions, audit.summary?.duplicateDescriptions ?? 0],
                      [t.metric4xx, audit.summary?.responses4xx ?? 0],
                      [t.metric5xx, audit.summary?.responses5xx ?? 0],
                      [t.metricRedirects, audit.summary?.redirects ?? 0],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
                        {label}
                      </dt>
                      <dd className="mt-1 text-xl font-semibold text-gray-900">
                        {int.format(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </CardContent>
          </Card>

          {/* Issues */}
          <Card>
            <CardHeader className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-gray-900">{t.issuesTitle}</h3>
              {audit.issues && (
                <div className="flex gap-2">
                  {SEVERITY_ORDER.map((severity) => (
                    <span
                      key={severity}
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${SEVERITY_STYLE[severity].bg} ${SEVERITY_STYLE[severity].text}`}
                    >
                      {int.format(audit.issues!.totals[severity])} {severityLabel(severity, t)}
                    </span>
                  ))}
                </div>
              )}
            </CardHeader>
            <CardContent>
              {!audit.issues || audit.issues.items.length === 0 ? (
                <div className="flex items-center gap-2 py-4">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden="true" />
                  <p className="text-sm text-gray-600">{t.issuesEmpty}</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {SEVERITY_ORDER.map((severity) => (
                    <IssueGroup
                      key={severity}
                      severity={severity}
                      rows={audit.issues!.items.filter((row) => row.severity === severity)}
                      audit={audit}
                      t={t}
                      int={int}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top problem pages */}
          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-gray-900">{t.pagesTitle}</h3>
              {audit.pages && (
                <p className="mt-1 text-xs text-gray-500">
                  {t.pagesSubtitle(audit.pages.items.length, audit.pages.totalCount)}
                </p>
              )}
            </CardHeader>
            <CardContent>
              {!audit.pages || audit.pages.items.length === 0 ? (
                <p className="text-sm text-gray-500">{t.pagesEmpty}</p>
              ) : (
                <div className="max-h-[32rem] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                        <th className="py-2 pr-3 font-semibold">{t.colPage}</th>
                        <th className="w-20 py-2 pr-3 font-semibold">{t.colIssues}</th>
                        <th className="w-20 py-2 pr-3 font-semibold">{t.colScore}</th>
                        <th className="w-20 py-2 pr-3 font-semibold">{t.colStatusCode}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {audit.pages.items.map((page) => (
                        <tr key={page.url}>
                          <td className="max-w-0 py-2 pr-3">
                            <a
                              href={page.url}
                              target="_blank"
                              rel="noopener noreferrer nofollow"
                              className="block truncate text-blue-600 hover:text-blue-700"
                              title={page.url}
                            >
                              {page.url}
                            </a>
                            {page.failedChecks.length > 0 && (
                              <span className="block truncate text-xs text-gray-400">
                                {page.failedChecks.map(checkLabel).join(", ")}
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-3 font-medium text-gray-900">{page.issueCount}</td>
                          <td className="py-2 pr-3 text-gray-600">
                            {page.onPageScore === null ? "—" : page.onPageScore.toFixed(0)}
                          </td>
                          <td className="py-2 pr-3 text-gray-500">{page.statusCode ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
              <ScanSearch className="mb-3 h-8 w-8 text-gray-300" aria-hidden="true" />
              <p className="text-sm text-gray-500">{t.recentEmpty}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                    <th className="py-2 pr-3 font-semibold">{t.colDomain}</th>
                    <th className="w-28 py-2 pr-3 font-semibold">{t.colStatusCode}</th>
                    <th className="w-20 py-2 pr-3 text-right font-semibold">{t.colScore}</th>
                    <th className="w-24 py-2 pr-3 text-right font-semibold">{t.colPagesCol}</th>
                    <th className="w-44 py-2 pr-3 font-semibold">{t.colWhen}</th>
                    <th className="w-16 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {history.audits.map((row) => (
                    <tr key={row.id}>
                      <td className="max-w-0 truncate py-2 pr-3 text-gray-800" title={row.domain}>
                        {row.domain}
                      </td>
                      <td className="py-2 pr-3">{statusBadge(row.status, t)}</td>
                      <td className="py-2 pr-3 text-right text-gray-600">
                        {row.onPageScore === null ? "—" : row.onPageScore.toFixed(0)}
                      </td>
                      <td className="py-2 pr-3 text-right text-gray-600">
                        {/* Shows progress for in-flight rows, so the history
                            list doubles as the "did my crawl finish?" view. */}
                        {row.pagesCrawled}/{row.maxPages}
                      </td>
                      <td className="py-2 pr-3 text-gray-500">
                        {formatDateTime(row.createdAt, locale)}
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
