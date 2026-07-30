"use client";

// Content Explorer — web mentions of a phrase.
//
// Replaced the FeatureScaffold placeholder. Two honesty constraints drive the
// layout:
//
// 1. SENTIMENT IS A DISTRIBUTION, NOT A LABEL. The API returns
//    {positive, negative, neutral} floats per page. The chip shows the dominant
//    one, the summary band shows the actual split as a bar, and the caveat sits
//    directly under it rather than hidden in the help modal. A single green
//    "positive" chip with no numbers behind it would overstate what this is.
//
// 2. EVERY SEARCH COSTS THE SAME whether it finds 1.5 million pages or zero.
//    So the empty state is presented as a real answer with a next action, the
//    cached notice explains why a repeat was free, and history says plainly that
//    reopening costs nothing.
//
// Charts are inline SVG, matching the rest of the repo (recharts is a dependency
// imported nowhere on the client).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Compass,
  ExternalLink,
  Info,
  Loader2,
  Lock,
  Search,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import {
  COST_PER_SEARCH_USD,
  HIGH_AUTHORITY_RANK,
  MAX_SPAM_SCORE_FOR_BADGE,
} from "@/lib/content-explorer/options";
import { SEARCH_ANGLES, type SearchAngle } from "@/lib/content-explorer/types";
import type {
  ContentExplorerUsage,
  ContentSearchDto,
  ContentSearchListItem,
  Mention,
} from "@/lib/content-explorer/types";
import { ContentExplorerHelpButton } from "@/components/seo-tools/content-explorer-help";
import {
  CONTENT_EXPLORER_COPY,
  SEO_TOOLS_COPY,
  type DashLocale,
} from "@/lib/i18n/dashboard";

type SortKey = "date" | "rank";

interface Props {
  locale: DashLocale;
  /** Tenant name, for the "My brand" preset. Prefill only. */
  brandName: string | null;
}

/** Badge rule lives here so the table and the help copy cannot disagree. */
function isHighAuthority(m: Mention): boolean {
  if (m.domainRank === null || m.domainRank < HIGH_AUTHORITY_RANK) return false;
  // A high rank on a spammy domain is not an outreach target.
  return m.spamScore === null || m.spamScore <= MAX_SPAM_SCORE_FOR_BADGE;
}

function formatCount(n: number, locale: DashLocale): string {
  return new Intl.NumberFormat(locale === "de-CH" ? "de-CH" : locale).format(n);
}

function sentimentVariant(label: string | null) {
  switch (label) {
    case "positive":
      return "success" as const;
    case "negative":
      return "danger" as const;
    case "neutral":
      return "default" as const;
    default:
      return "info" as const;
  }
}

/** Three-segment sentiment bar. Widths come straight from the distribution. */
function SentimentBar({
  positive,
  negative,
  neutral,
  labels,
}: {
  positive: number;
  negative: number;
  neutral: number;
  labels: { positive: string; negative: string; neutral: string };
}) {
  const total = positive + negative + neutral;
  // Guard a zero total: an all-zero distribution is parsed to null upstream, but
  // a division by zero here would render an invalid width attribute.
  const safe = total > 0 ? total : 1;
  const pct = (v: number) => (v / safe) * 100;
  const segments = [
    { key: "positive", value: positive, color: "#16a34a", label: labels.positive },
    { key: "neutral", value: neutral, color: "#d1d5db", label: labels.neutral },
    { key: "negative", value: negative, color: "#dc2626", label: labels.negative },
  ];

  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
        {segments.map((s) => (
          <div
            key={s.key}
            style={{ width: `${pct(s.value)}%`, backgroundColor: s.color }}
            title={`${s.label} ${Math.round(pct(s.value))}%`}
          />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: s.color }}
            />
            {s.label}
            <span className="tabular-nums text-gray-400">
              {Math.round(pct(s.value))}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ContentExplorerClient({ locale, brandName }: Props) {
  const t = CONTENT_EXPLORER_COPY[locale];
  const tools = SEO_TOOLS_COPY[locale];
  const it = tools.items.content_explorer;

  const [usage, setUsage] = useState<ContentExplorerUsage | null>(null);
  const [history, setHistory] = useState<ContentSearchListItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [angle, setAngle] = useState<SearchAngle>("brand");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [result, setResult] = useState<ContentSearchDto | null>(null);
  const [sort, setSort] = useState<SortKey>("date");
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Mount fetch as a promise chain with a cancelled guard, matching the other
  // tool clients — an async call straight from an effect body puts a setState in
  // the effect's synchronous path.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/seo/v1/content-explorer/history")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((payload: { searches: ContentSearchListItem[]; usage: ContentExplorerUsage }) => {
        if (cancelled) return;
        setHistory(payload.searches ?? []);
        setUsage(payload.usage);
        setLoadError(null);
      })
      .catch(() => {
        if (!cancelled) setLoadError(t.loadFailed);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const refreshHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/seo/v1/content-explorer/history");
      if (!res.ok) return;
      const payload = (await res.json()) as {
        searches: ContentSearchListItem[];
        usage: ContentExplorerUsage;
      };
      setHistory(payload.searches ?? []);
      setUsage(payload.usage);
    } catch {
      // A stale history list is not worth an error banner.
    }
  }, []);

  /** Presets are prefill only — one code path, one request shape. */
  const applyAngle = useCallback(
    (next: SearchAngle) => {
      setAngle(next);
      if (next === "brand" && brandName) setQuery(brandName);
      else if (next !== "brand") setQuery("");
      inputRef.current?.focus();
    },
    [brandName],
  );

  const runSearch = useCallback(async () => {
    const phrase = query.trim();
    if (phrase.length < 2) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch("/api/seo/v1/content-explorer/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: phrase, angle }),
      });
      const body = (await res.json()) as {
        search?: ContentSearchDto;
        usage?: ContentExplorerUsage;
        error?: string;
        code?: string;
      };
      if (!res.ok || !body.search) {
        setSearchError(
          body.code === "QUOTA_EXCEEDED"
            ? t.capReached
            : body.code === "RATE_LIMITED"
              ? t.rateLimited
              : body.error || t.searchFailed,
        );
        return;
      }
      setResult(body.search);
      setSort("date");
      if (body.usage) setUsage(body.usage);
      await refreshHistory();
    } catch {
      setSearchError(t.searchFailed);
    } finally {
      setSearching(false);
    }
  }, [query, angle, t, refreshHistory]);

  /** Opening a stored search — free, no quota, no upstream call. */
  const openSearch = useCallback(
    async (id: string) => {
      setSearchError(null);
      try {
        const res = await fetch(`/api/seo/v1/content-explorer/${id}`);
        if (!res.ok) return;
        const body = (await res.json()) as { search: ContentSearchDto };
        setResult(body.search);
        setQuery(body.search.query);
        setAngle(body.search.angle);
        setSort("date");
      } catch {
        setSearchError(t.loadFailed);
      }
    },
    [t],
  );

  const sortedMentions = useMemo(() => {
    const rows = [...(result?.mentions ?? [])];
    if (sort === "rank") {
      rows.sort((a, b) => (b.domainRank ?? -1) - (a.domainRank ?? -1));
    } else {
      // Undated rows sink rather than sorting as the epoch.
      rows.sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return b.date.localeCompare(a.date);
      });
    }
    return rows;
  }, [result, sort]);

  const verdict = useMemo(() => {
    if (!result) return null;
    if (result.totalCount === 0) return "empty" as const;
    const s = result.summary?.sentiment;
    if (!s) return "mixed" as const;
    if (s.positive > s.negative * 1.5) return "positive" as const;
    if (s.negative > s.positive) return "negative" as const;
    return "mixed" as const;
  }, [result]);

  const costLabel = `$${COST_PER_SEARCH_USD.toFixed(3)}`;
  const capped = usage ? usage.used >= usage.limit : false;

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="mb-3 h-10 w-10 text-red-400" aria-hidden="true" />
        <p className="text-sm text-gray-500">{loadError}</p>
      </div>
    );
  }

  if (!usage) return <p className="text-sm text-gray-400">{t.loading}</p>;

  // The tool is absent from this plan entirely.
  if (!usage.canSearch) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">
            {it.name}
          </h2>
          <p className="mt-1 text-sm text-gray-500">{it.description}</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <Lock className="h-6 w-6 text-gray-400" aria-hidden="true" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">{t.planLockedTitle}</h3>
            <p className="mt-2 max-w-md text-sm text-gray-500">{t.planLockedBody}</p>
            <Link
              href="/billing"
              className="mt-5 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              {t.upgradeCta}
            </Link>
          </CardContent>
        </Card>
      </div>
    );
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
        <ContentExplorerHelpButton
          locale={locale}
          used={usage.used}
          limit={usage.limit}
          plan={usage.plan}
        />
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
        <p className="text-xs text-gray-500">
          {t.intro} {t.mentionNote}
        </p>
      </div>

      {/* ── Search ─────────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="py-4">
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              {t.angleLabel}
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {SEARCH_ANGLES.map((a) => {
                const label =
                  a === "brand" ? t.angleBrand : a === "competitor" ? t.angleCompetitor : t.angleTopic;
                const active = angle === a;
                return (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={active}
                    onClick={() => applyAngle(a)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      active
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-gray-400">{t.angleHint}</p>
          </fieldset>

          <div className="mt-4 flex flex-wrap items-start gap-2">
            <div className="min-w-0 flex-1">
              <label htmlFor="ce-query" className="sr-only">
                {t.queryLabel}
              </label>
              <input
                ref={inputRef}
                id="ce-query"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !searching) void runSearch();
                }}
                placeholder={t.queryPlaceholder}
                maxLength={200}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <Button onClick={() => void runSearch()} disabled={searching || capped || query.trim().length < 2}>
              {searching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  {t.searching}
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t.searchBtn}
                </>
              )}
            </Button>
          </div>

          <p className="mt-2 text-xs text-gray-400">
            {t.usageLine(usage.used, usage.limit)} · {t.costNote(costLabel)}
          </p>

          {capped && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
              {t.capReached}
            </p>
          )}
          {searchError && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
              {searchError}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Result ─────────────────────────────────────────────────────────── */}
      {result && (
        <>
          {result.cached && (
            <p className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-900">
              {t.cachedNote(formatDate(result.createdAt, locale))}
            </p>
          )}

          {/* Verdict callout */}
          {verdict === "empty" ? (
            <Card>
              <CardContent className="flex flex-col items-center py-12 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                  <Compass className="h-6 w-6 text-gray-400" aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold text-gray-900">{t.emptyTitle}</h3>
                <p className="mt-2 max-w-lg text-sm text-gray-500">{t.emptyBody}</p>
                <p className="mt-3 max-w-lg text-xs text-gray-400">{t.emptyCross}</p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <Link
                    href="/campaigns"
                    className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  >
                    <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
                    {t.emptyCampaigns}
                  </Link>
                  <Link
                    href="/review-links"
                    className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {t.emptyReviewLinks}
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div
              className={`flex items-start gap-2 rounded-lg border px-4 py-3 ${
                verdict === "positive"
                  ? "border-green-200 bg-green-50"
                  : verdict === "negative"
                    ? "border-red-200 bg-red-50"
                    : "border-gray-200 bg-gray-50"
              }`}
            >
              <TrendingUp
                className={`mt-0.5 h-4 w-4 shrink-0 ${
                  verdict === "positive"
                    ? "text-green-600"
                    : verdict === "negative"
                      ? "text-red-500"
                      : "text-gray-400"
                }`}
                aria-hidden="true"
              />
              <p
                className={`text-sm ${
                  verdict === "positive"
                    ? "text-green-800"
                    : verdict === "negative"
                      ? "text-red-800"
                      : "text-gray-700"
                }`}
              >
                {verdict === "positive"
                  ? t.verdictMostlyPositive(formatCount(result.totalCount, locale))
                  : verdict === "negative"
                    ? t.verdictMostlyNegative(formatCount(result.totalCount, locale))
                    : t.verdictMixed(formatCount(result.totalCount, locale))}
              </p>
            </div>
          )}

          {/* Summary band */}
          {result.summary && result.totalCount > 0 && (
            <Card>
              <CardHeader>
                <h3 className="text-base font-semibold text-gray-900">
                  {result.totalCount === 1
                    ? t.totalMentionsOne
                    : t.totalMentions(formatCount(result.totalCount, locale))}
                </h3>
                <p className="mt-1 text-xs text-gray-400">
                  {t.showingTop(result.mentions.length)}
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                {result.summary.sentiment && (
                  <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      {t.sentimentTitle}
                    </h4>
                    <SentimentBar
                      positive={result.summary.sentiment.positive}
                      negative={result.summary.sentiment.negative}
                      neutral={result.summary.sentiment.neutral}
                      labels={{
                        positive: t.sentimentPositive,
                        negative: t.sentimentNegative,
                        neutral: t.sentimentNeutral,
                      }}
                    />
                    {/* The caveat sits with the number, not hidden in the modal. */}
                    <p className="mt-2 text-xs text-gray-400">{t.sentimentCaveat}</p>
                  </div>
                )}

                {result.summary.topDomains.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      {t.topDomainsTitle}
                    </h4>
                    <ul className="flex flex-wrap gap-2">
                      {result.summary.topDomains.slice(0, 10).map((d) => (
                        <li key={d.domain}>
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700">
                            {d.domain}
                            <span className="tabular-nums text-gray-400">
                              {formatCount(d.count, locale)}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="grid gap-5 sm:grid-cols-2">
                  {result.summary.languages.length > 0 && (
                    <div>
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                        {t.languagesTitle}
                      </h4>
                      <ul className="flex flex-wrap gap-1.5">
                        {result.summary.languages.slice(0, 6).map((l) => (
                          <li key={l.code}>
                            <Badge variant="default">
                              {l.code} · {formatCount(l.count, locale)}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.summary.countries.length > 0 && (
                    <div>
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                        {t.countriesTitle}
                      </h4>
                      <ul className="flex flex-wrap gap-1.5">
                        {result.summary.countries.slice(0, 6).map((c) => (
                          <li key={c.code}>
                            <Badge variant="default">
                              {c.code} · {formatCount(c.count, locale)}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Mentions table */}
          {result.mentions.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-gray-900">
                    {t.mentionsTitle}
                  </h3>
                  <div className="flex items-center gap-2">
                    <label htmlFor="ce-sort" className="text-xs text-gray-400">
                      {t.sortLabel}
                    </label>
                    <select
                      id="ce-sort"
                      value={sort}
                      onChange={(e) => setSort(e.target.value as SortKey)}
                      className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="date">{t.sortDate}</option>
                      <option value="rank">{t.sortRank}</option>
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                      <th className="px-6 py-2 font-medium">{t.colPage}</th>
                      <th className="px-3 py-2 font-medium">{t.colDomain}</th>
                      <th className="px-3 py-2 font-medium">{t.colDate}</th>
                      <th className="px-6 py-2 font-medium">{t.colSentiment}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sortedMentions.map((m) => (
                      <tr key={m.url} className="align-top">
                        <td className="max-w-md px-6 py-3">
                          <a
                            href={m.url}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="text-sm font-medium text-blue-700 hover:underline"
                          >
                            {m.title ?? m.url}
                            <ExternalLink
                              className="ml-1 inline h-3 w-3 align-baseline"
                              aria-hidden="true"
                            />
                            <span className="sr-only">{t.openPage}</span>
                          </a>
                          {m.snippet && (
                            <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                              {m.snippet}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <p className="text-xs text-gray-700">{m.domain}</p>
                          {m.domainRank !== null && (
                            <p className="text-xs text-gray-400">{t.rankLabel(m.domainRank)}</p>
                          )}
                          {isHighAuthority(m) && (
                            <span
                              title={t.highAuthorityTip}
                              className="mt-1 inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700"
                            >
                              {t.highAuthority}
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-500">
                          {m.date ? formatDate(m.date, locale) : t.noDate}
                          {m.dateIsCrawl && m.date && (
                            <span className="block text-[11px] text-gray-400">
                              {t.crawlDateNote}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3">
                          {m.sentimentLabel ? (
                            <Badge variant={sentimentVariant(m.sentimentLabel)}>
                              {m.sentimentLabel === "positive"
                                ? t.sentimentPositive
                                : m.sentimentLabel === "negative"
                                  ? t.sentimentNegative
                                  : t.sentimentNeutral}
                            </Badge>
                          ) : (
                            <span className="text-xs text-gray-400">{t.unknownValue}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ── History ────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-gray-900">{t.historyTitle}</h3>
          <p className="mt-1 text-xs text-gray-400">{t.freeToOpen}</p>
        </CardHeader>
        <CardContent className="p-0">
          {history.length === 0 ? (
            <p className="px-6 py-4 text-sm text-gray-400">{t.noHistory}</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-6 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{h.query}</p>
                    <p className="text-xs text-gray-400">
                      {formatDate(h.createdAt, locale)} ·{" "}
                      {h.totalCount === 0
                        ? t.historyEmptyResult
                        : t.historyMeta(h.mentionCount, formatCount(h.totalCount, locale))}
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => void openSearch(h.id)}>
                    {t.viewBtn}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
