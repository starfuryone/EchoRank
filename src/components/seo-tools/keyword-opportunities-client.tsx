"use client";

// Keyword Opportunity Finder — the results table and its detail panel.
//
// A TABLE, NOT CARDS, and that is the opposite of the call Citation
// Opportunities made next door. That tool is a worklist: each row carries a
// paragraph somebody has to read and act on, and a paragraph in a table cell is
// a paragraph nobody reads. This one is a COMPARISON — seven numbers you scan
// down and re-sort — and the whole product is deciding which keyword to work
// first. The instructions still exist; they live in the detail panel, which is
// where a single row's paragraph belongs.
//
// SORT IS THE CLIENT'S, unlike Citation Finder's server sort. There is no
// pagination and no query behind this: an analysis is at most a few dozen rows
// and they all arrive at once, so a round trip per column click would add
// latency to something that is already in memory. Default is opportunity score,
// descending — the answer to "what should I do first" should not need a click.
//
// THE ANSWER SNAPSHOT IS RENDERED AS TEXT, in a <p>. It was written by another
// vendor's model and is untrusted input; there is no dangerouslySetInnerHTML in
// this file and there must not be one. Same posture as ai-monitor's analysis
// passes, which fence the answer and treat it as data throughout.
//
// COLOUR IS NEVER THE ONLY SIGNAL. Every severity badge and every trend arrow
// carries its word or its sign as well as its colour.
//
// Light mode only, deliberately: this dashboard has no dark theme — no
// `darkMode` in the Tailwind config and not one `dark:` class in any sibling
// tool client — so a second palette would be unreachable code.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Info,
  Loader2,
  Lock,
  Minus,
  Target,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KEYWORD_OPPORTUNITY_COPY, type DashLocale } from "@/lib/i18n/dashboard";
import { fundingFor } from "@/lib/keyword-opportunity/entitlement";
import {
  COMPONENT_SOURCES,
  OPPORTUNITY_WEIGHTS_V1,
  type OpportunityComponents,
} from "@/lib/keyword-opportunity/score";
import {
  ANALYSIS_STEPS,
  type AnalysisStep,
  type KeywordOpportunityPageData,
  type OpportunityRow,
  type RecommendedActionId,
} from "@/lib/keyword-opportunity/types";

type Copy = (typeof KEYWORD_OPPORTUNITY_COPY)[DashLocale];

/** BCP-47 for the three dashboard locales, for number formatting. */
const INTL_LOCALE: Record<DashLocale, string> = {
  en: "en",
  fr: "fr",
  "de-CH": "de-CH",
};

function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_m, key: string) =>
    values[key] === undefined ? "" : String(values[key]),
  );
}

/** How long each simulated step is shown while the fixture "runs". */
const DEMO_STEP_MS = 900;

/**
 * Live poll interval while an analysis is QUEUED or RUNNING.
 *
 * Four seconds. A domain analysis takes minutes, so a tighter poll buys nothing
 * but load on an endpoint that reads a hundred rows and their answers; a looser
 * one makes the step list feel stuck.
 */
const POLL_INTERVAL_MS = 4_000;

type SortKey = "keyword" | "monthlyVolume" | "cpcUsd" | "trendPercent" | "rank" | "ai" | "score";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: keyof Copy; align?: "right" }[] = [
  { key: "keyword", label: "colKeyword" },
  { key: "monthlyVolume", label: "colVolume", align: "right" },
  { key: "cpcUsd", label: "colCpc", align: "right" },
  { key: "trendPercent", label: "colTrend", align: "right" },
  { key: "rank", label: "colRank", align: "right" },
  { key: "ai", label: "colAi" },
  { key: "score", label: "colScore", align: "right" },
];

const SEVERITY_CLASS: Record<string, string> = {
  HIGH: "bg-rose-50 text-rose-900 ring-1 ring-rose-200",
  MEDIUM: "bg-amber-50 text-amber-900 ring-1 ring-amber-200",
  LOW: "bg-gray-100 text-gray-700 ring-1 ring-gray-200",
};

const STEP_LABEL: Record<AnalysisStep, keyof Copy> = {
  discover: "stepDiscover",
  demand: "stepDemand",
  rankings: "stepRankings",
  ai: "stepAi",
  score: "stepScore",
};

const COMPONENT_LABEL: Record<keyof OpportunityComponents, keyof Copy> = {
  volume: "componentVolume",
  cpc: "componentCpc",
  trend: "componentTrend",
  intent: "componentIntent",
  seoGap: "componentSeoGap",
  aiGap: "componentAiGap",
};

const ACTION_LABEL: Record<RecommendedActionId, keyof Copy> = {
  landing_page: "actionLandingPage",
  competitor_comparison: "actionCompetitorComparison",
  pricing_proof: "actionPricingProof",
  external_citations: "actionExternalCitations",
  rerun: "actionRerun",
};

/**
 * Sort value for a column.
 *
 * NULLS SORT LAST IN BOTH DIRECTIONS, which is why rank and AI visibility get
 * sentinels rather than being compared raw. "Not tracked" is not a rank of 0 —
 * putting it at the top of an ascending rank sort would claim the keywords we
 * know least about are the ones we rank best for.
 */
function sortValue(row: OpportunityRow, key: SortKey): number | string {
  switch (key) {
    case "keyword":
      return row.keyword.toLowerCase();
    case "monthlyVolume":
      return row.monthlyVolume;
    case "cpcUsd":
      return row.cpcUsd;
    case "trendPercent":
      return row.trendPercent;
    case "rank":
      return row.googleRank ?? Number.POSITIVE_INFINITY;
    case "ai":
      // Untested last, then absent, then by how well we placed.
      if (!row.aiTested) return Number.POSITIVE_INFINITY;
      if (!row.ai?.mentioned) return 1_000;
      return row.ai.averagePosition ?? 999;
    case "score":
      return row.opportunityScore;
  }
}

function TrendCell({ percent, locale }: { percent: number; locale: DashLocale }) {
  const rounded = Math.round(percent);
  const Icon = rounded > 0 ? TrendingUp : rounded < 0 ? TrendingDown : Minus;
  const tone = rounded > 0 ? "text-green-700" : rounded < 0 ? "text-rose-700" : "text-gray-500";
  // The sign is spelled out beside the arrow: colour and glyph both fail for
  // some readers, the "+" does not.
  const signed = new Intl.NumberFormat(INTL_LOCALE[locale], {
    signDisplay: "exceptZero",
  }).format(rounded);
  return (
    <span className={`inline-flex items-center justify-end gap-1 tabular-nums ${tone}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" focusable="false" />
      {signed}%
    </span>
  );
}

function AiCell({ row, copy }: { row: OpportunityRow; copy: Copy }) {
  if (!row.aiTested) {
    return (
      <span className="inline-flex items-center gap-1 text-gray-500" title={copy.aiNotTestedHint}>
        <Minus className="h-3.5 w-3.5" aria-hidden="true" focusable="false" />
        {copy.aiNotTested}
      </span>
    );
  }
  if (!row.ai?.mentioned) {
    return <span className="font-medium text-rose-700">{copy.aiNotMentioned}</span>;
  }
  if (row.ai.averagePosition === null) {
    return <span className="text-amber-800">{copy.aiMentionedUnranked}</span>;
  }
  return (
    <span className="text-gray-900">
      {interpolate(copy.aiMentionedAt, { position: row.ai.averagePosition })}
    </span>
  );
}

/** The five steps, with the one in flight marked. */
function StepList({
  copy,
  current,
  done,
}: {
  copy: Copy;
  current: AnalysisStep | null;
  done: ReadonlySet<AnalysisStep>;
}) {
  return (
    <ol className="mt-6 space-y-3">
      {ANALYSIS_STEPS.map((step) => {
        const isDone = done.has(step);
        const isCurrent = step === current;
        return (
          <li key={step} className="flex items-center gap-3 text-sm">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                isDone
                  ? "bg-green-100 text-green-700"
                  : isCurrent
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-400"
              }`}
            >
              {isDone ? (
                <Check className="h-3.5 w-3.5" aria-hidden="true" focusable="false" />
              ) : isCurrent ? (
                <Loader2
                  className="h-3.5 w-3.5 animate-spin"
                  aria-hidden="true"
                  focusable="false"
                />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
              )}
            </span>
            <span className={isDone || isCurrent ? "text-gray-900" : "text-gray-400"}>
              {copy[STEP_LABEL[step]]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function KeywordOpportunitiesClient({
  locale,
  data,
  preview = false,
  live = false,
}: {
  locale: DashLocale;
  data: KeywordOpportunityPageData;
  /** The page is a worked example and says so at the top. */
  preview?: boolean;
  /**
   * The tenant is allowlisted for real runs.
   *
   * TWO PATHS, ONE RENDER TREE. Live and demo differ only in where the states
   * come from — a POST and a poll, or a timer walking the same five steps —
   * and everything below this line is identical for both. That is deliberate:
   * a separate live component would be a second place for the table, the
   * detail panel and the empty states to drift.
   */
  live?: boolean;
}) {
  const copy = KEYWORD_OPPORTUNITY_COPY[locale];
  const intl = INTL_LOCALE[locale];

  const [sort, setSort] = useState<SortKey>("score");
  const [dir, setDir] = useState<SortDir>("desc");
  const [openId, setOpenId] = useState<string | null>(null);
  /** Non-null while the demo run is walking the steps. */
  const [runningStep, setRunningStep] = useState<AnalysisStep | null>(null);
  /** Live mode: the server's view, replacing the prop once a run starts. */
  const [livePage, setLivePage] = useState<KeywordOpportunityPageData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const page = livePage ?? data;
  const analysis = page.analysis;
  const funding = fundingFor(page.entitlement);

  const rows = useMemo(() => {
    const source = analysis?.rows ?? [];
    return [...source].sort((a, b) => {
      const left = sortValue(a, sort);
      const right = sortValue(b, sort);
      const order =
        typeof left === "string" && typeof right === "string"
          ? left.localeCompare(right)
          : Number(left) - Number(right);
      // A stable secondary key, so equal scores do not reshuffle on re-sort.
      return (dir === "asc" ? order : -order) || a.keyword.localeCompare(b.keyword);
    });
  }, [analysis, sort, dir]);

  const open = rows.find((row) => row.id === openId) ?? null;

  const toggleSort = useCallback(
    (key: SortKey) => {
      if (key === sort) {
        setDir((current) => (current === "asc" ? "desc" : "asc"));
        return;
      }
      setSort(key);
      // A new column starts where that column is most useful: text ascending,
      // numbers descending. Carrying the previous direction over means the
      // first click on "Volume" often shows the smallest keywords.
      setDir(key === "keyword" ? "asc" : "desc");
    },
    [sort],
  );

  // The DEMO run: walk the five steps on a timer, then stop. Live runs never
  // reach this — their steps come off the analysis row's `currentStep`, which
  // is the same vocabulary (ANALYSIS_STEPS) reported by the worker.
  useEffect(() => {
    if (live || runningStep === null) return;
    const index = ANALYSIS_STEPS.indexOf(runningStep);
    const timer = setTimeout(() => {
      const next = ANALYSIS_STEPS[index + 1];
      setRunningStep(next ?? null);
    }, DEMO_STEP_MS);
    return () => clearTimeout(timer);
  }, [live, runningStep]);

  /**
   * Live mode: poll while the analysis is in flight.
   *
   * STOPS THE MOMENT IT IS TERMINAL. A poll that keeps running against a
   * COMPLETED row is a request every few seconds for the life of the tab, and
   * this endpoint reads a hundred opportunity rows and their answers.
   */
  const status = runningStep !== null ? "RUNNING" : (analysis?.status ?? null);
  const inFlight = live && (status === "QUEUED" || status === "RUNNING");

  useEffect(() => {
    if (!inFlight) return;
    let cancelled = false;

    const timer = setInterval(async () => {
      try {
        const response = await fetch("/api/keyword-opportunities", { cache: "no-store" });
        if (!response.ok) return;
        const body = (await response.json()) as {
          live?: boolean;
          brandProfileId?: string;
          brandName?: string;
          domain?: string;
          entitlement?: KeywordOpportunityPageData["entitlement"];
          analysis?: KeywordOpportunityPageData["analysis"];
        };
        if (cancelled || !body.live || !body.entitlement) return;
        setLivePage({
          brandProfileId: body.brandProfileId ?? page.brandProfileId,
          brandName: body.brandName ?? page.brandName,
          domain: body.domain ?? page.domain,
          entitlement: body.entitlement,
          analysis: body.analysis ?? null,
        });
      } catch {
        // A dropped poll is not an error worth showing — the next tick
        // recovers, and the run is happening on the server either way.
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inFlight]);

  /**
   * Start a run.
   *
   * In demo mode this walks the fixture steps. Live, it POSTs and lets the poll
   * above take over — the button never waits for the analysis, because the
   * whole design is that the customer can leave and come back.
   */
  const startRun = useCallback(async () => {
    setSubmitError(null);

    if (!live) {
      setRunningStep(ANALYSIS_STEPS[0]);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/keyword-opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandProfileId: page.brandProfileId }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        // 402 is "you have run out" and already has its own panel; anything
        // else is worth a line the customer can read.
        if (response.status !== 402) setSubmitError(body.error ?? copy.errorTitle);
        return;
      }
      // Pull the new QUEUED row straight away so the progress view appears
      // without waiting a full poll interval.
      const refreshed = await fetch("/api/keyword-opportunities", { cache: "no-store" });
      if (refreshed.ok) {
        const next = (await refreshed.json()) as {
          entitlement?: KeywordOpportunityPageData["entitlement"];
          analysis?: KeywordOpportunityPageData["analysis"];
        };
        if (next.entitlement) {
          setLivePage({
            brandProfileId: page.brandProfileId,
            brandName: page.brandName,
            domain: page.domain,
            entitlement: next.entitlement,
            analysis: next.analysis ?? null,
          });
        }
      }
    } catch {
      setSubmitError(copy.errorTitle);
    } finally {
      setSubmitting(false);
    }
  }, [live, page.brandProfileId, page.brandName, page.domain, copy.errorTitle]);

  const currentStep = runningStep ?? analysis?.currentStep ?? null;
  const doneSteps = useMemo(() => {
    if (currentStep === null) return new Set<AnalysisStep>();
    return new Set(ANALYSIS_STEPS.slice(0, ANALYSIS_STEPS.indexOf(currentStep)));
  }, [currentStep]);

  const allowanceLine =
    page.entitlement.allowanceTotal === null
      ? copy.allowanceUnlimited
      : interpolate(copy.allowanceTemplate, {
          remaining: page.entitlement.allowanceRemaining ?? 0,
          total: page.entitlement.allowanceTotal,
        });

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-gray-900">
          <Target className="h-6 w-6 text-blue-600" aria-hidden="true" focusable="false" />
          {copy.title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-600">{copy.intro}</p>
      </div>

      {preview && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="flex gap-3">
            <Info
              className="mt-0.5 h-5 w-5 shrink-0 text-blue-600"
              aria-hidden="true"
              focusable="false"
            />
            <div>
              <p className="text-sm font-medium text-blue-900">{copy.previewTitle}</p>
              <p className="mt-1 text-sm text-blue-800">{copy.previewBody}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Run bar ── */}
      <Card>
        <CardContent className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="block text-xs font-medium uppercase tracking-wide text-gray-500">
              {copy.domainLabel}
            </span>
            <span className="mt-1 block text-lg font-medium text-gray-900">{page.domain}</span>
            <span className="mt-1 block text-sm text-gray-500">{allowanceLine}</span>
          </div>
          <Button
            onClick={startRun}
            loading={status === "RUNNING" || submitting}
            disabled={!funding.canRun || submitting || status === "RUNNING" || status === "QUEUED"}
          >
            {status === "RUNNING" ? copy.runningCta : copy.runCta}
          </Button>
        </CardContent>
      </Card>

      {submitError !== null && (
        <p className="flex items-start gap-2 text-sm text-rose-700" role="alert">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0"
            aria-hidden="true"
            focusable="false"
          />
          {submitError}
        </p>
      )}

      {page.entitlement.cacheHit && (
        <p className="flex items-start gap-2 text-sm text-gray-600">
          <Info
            className="mt-0.5 h-4 w-4 shrink-0 text-gray-400"
            aria-hidden="true"
            focusable="false"
          />
          {copy.cacheNotice}
        </p>
      )}

      {/* ── Insufficient allowance ── */}
      {funding.funding === "denied" && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex gap-3">
            <Lock
              className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"
              aria-hidden="true"
              focusable="false"
            />
            <div>
              <p className="text-sm font-medium text-amber-900">{copy.allowanceNoneTitle}</p>
              <p className="mt-1 text-sm text-amber-800">{copy.allowanceNoneBody}</p>
              <Link
                href="/billing"
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-amber-900 underline underline-offset-2"
              >
                {copy.allowanceNoneCta}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" focusable="false" />
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Queued ── */}
      {status === "QUEUED" && (
        <Card>
          <CardContent className="py-10 text-center">
            <Loader2
              className="mx-auto h-6 w-6 animate-spin text-gray-400"
              aria-hidden="true"
              focusable="false"
            />
            <h2 className="mt-4 text-lg font-medium text-gray-900">{copy.queuedTitle}</h2>
            <p className="mt-1 text-sm text-gray-500">{copy.queuedBody}</p>
          </CardContent>
        </Card>
      )}

      {/* ── Running ── */}
      {status === "RUNNING" && (
        <Card>
          <CardContent className="py-8">
            <h2 className="text-lg font-medium text-gray-900">
              {interpolate(copy.progressTitle, { domain: page.domain })}
            </h2>
            <p className="mt-1 max-w-xl text-sm text-gray-500">{copy.progressBody}</p>
            <StepList copy={copy} current={currentStep} done={doneSteps} />
          </CardContent>
        </Card>
      )}

      {/* ── Failed ── */}
      {status === "FAILED" && (
        <Card className="border-rose-200">
          <CardContent className="py-8 text-center">
            <AlertTriangle
              className="mx-auto h-6 w-6 text-rose-600"
              aria-hidden="true"
              focusable="false"
            />
            <h2 className="mt-4 text-lg font-medium text-gray-900">{copy.errorTitle}</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">{copy.errorBody}</p>
            {analysis?.error && (
              <p className="mt-3 font-mono text-xs text-gray-400">{analysis.error}</p>
            )}
            <div className="mt-6">
              <Button variant="outline" onClick={startRun} loading={submitting}>
                {copy.errorCta}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Empty ── */}
      {analysis === null && status !== "RUNNING" && (
        <Card>
          <CardContent className="py-12 text-center">
            <Target
              className="mx-auto h-8 w-8 text-gray-300"
              aria-hidden="true"
              focusable="false"
            />
            <h2 className="mt-4 text-lg font-medium text-gray-900">{copy.emptyTitle}</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">{copy.emptyBody}</p>
          </CardContent>
        </Card>
      )}

      {/* ── Results ── */}
      {status === "COMPLETED" && rows.length > 0 && analysis !== null && (
        <>
          <p className="text-sm text-gray-500">
            {interpolate(copy.summaryTemplate, {
              keywords: analysis.keywordCount,
              tested: analysis.aiTestedCount,
              date: new Intl.DateTimeFormat(intl, { dateStyle: "medium" }).format(
                new Date(analysis.completedAt ?? analysis.requestedAt),
              ),
            })}
          </p>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">{copy.sortedByScore}</caption>
                  <thead>
                    <tr className="border-b border-gray-200 text-left">
                      {COLUMNS.map((column) => {
                        const isActive = sort === column.key;
                        return (
                          <th
                            key={column.key}
                            scope="col"
                            aria-sort={
                              isActive
                                ? dir === "asc"
                                  ? "ascending"
                                  : "descending"
                                : "none"
                            }
                            className={`px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 ${
                              column.align === "right" ? "text-right" : ""
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => toggleSort(column.key)}
                              className={`inline-flex items-center gap-1 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                                isActive ? "text-gray-900" : ""
                              }`}
                            >
                              {copy[column.label]}
                              {isActive && (
                                <span aria-hidden="true">{dir === "asc" ? "↑" : "↓"}</span>
                              )}
                            </button>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        className={`cursor-pointer border-b border-gray-100 last:border-0 hover:bg-gray-50 ${
                          openId === row.id ? "bg-blue-50" : ""
                        }`}
                        onClick={() => setOpenId(row.id)}
                      >
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            // The row is clickable for a mouse; this is what
                            // makes it reachable by keyboard and announced as
                            // the control that opens the panel.
                            aria-expanded={openId === row.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              setOpenId(row.id);
                            }}
                            className="text-left font-medium text-gray-900 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                          >
                            {row.keyword}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                          {new Intl.NumberFormat(intl, { notation: "compact" }).format(
                            row.monthlyVolume,
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                          {new Intl.NumberFormat(intl, {
                            style: "currency",
                            currency: "USD",
                            maximumFractionDigits: 0,
                          }).format(row.cpcUsd)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <TrendCell percent={row.trendPercent} locale={locale} />
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {row.googleRank === null ? (
                            <span className="text-gray-400" title={copy.rankUntrackedHint}>
                              {copy.rankUntracked}
                            </span>
                          ) : (
                            <span className="text-gray-700">{row.googleRank}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <AiCell row={row} copy={copy} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums ${
                              SEVERITY_CLASS[row.severity]
                            }`}
                          >
                            {row.opportunityScore}
                            <span className="font-normal">
                              {row.severity === "HIGH"
                                ? copy.severityHigh
                                : row.severity === "MEDIUM"
                                  ? copy.severityMedium
                                  : copy.severityLow}
                            </span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* ── Methodology. Not behind a link: the numbers are estimates and
                 the sentence that says so has to travel with them. ── */}
          <Card className="bg-gray-50">
            <CardContent>
              <h2 className="text-sm font-medium text-gray-900">{copy.methodologyTitle}</h2>
              <p className="mt-1 text-sm text-gray-600">{copy.methodologyBody}</p>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── Detail panel ── */}
      {open && analysis !== null && (
        <DetailPanel
          row={open}
          copy={copy}
          locale={locale}
          competitors={analysis.competitors}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

function DetailPanel({
  row,
  copy,
  locale,
  competitors,
  onClose,
}: {
  row: OpportunityRow;
  copy: Copy;
  locale: DashLocale;
  competitors: KeywordOpportunityPageData["analysis"] extends null
    ? never
    : NonNullable<KeywordOpportunityPageData["analysis"]>["competitors"];
  onClose: () => void;
}) {
  const intl = INTL_LOCALE[locale];

  // Escape closes it. A panel that can only be dismissed with the mouse is a
  // panel keyboard users get stuck in.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const severityHeadline =
    row.severity === "HIGH"
      ? copy.severityHigh
      : row.severity === "MEDIUM"
        ? copy.severityMedium
        : copy.severityLow;
  const severityExplain =
    row.severity === "HIGH"
      ? copy.severityHighExplain
      : row.severity === "MEDIUM"
        ? copy.severityMediumExplain
        : copy.severityLowExplain;

  // Only the rivals this keyword's own answer named, in the analysis-wide
  // order. Showing every rival from every answer here would attribute to one
  // keyword a competitive picture it did not produce.
  const named = new Set((row.result?.competitors ?? []).map((c) => c.name.toLowerCase()));
  const relevant = competitors.filter((c) => named.has(c.name.toLowerCase()));

  return (
    <Card>
      <CardContent className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{row.keyword}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  SEVERITY_CLASS[row.severity]
                }`}
              >
                {severityHeadline} · {row.opportunityScore}
              </span>
              <span className="text-gray-600">{severityExplain}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.closePanel}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <X className="h-5 w-5" aria-hidden="true" focusable="false" />
          </button>
        </div>

        {/* ── Score breakdown ── */}
        <section>
          <h3 className="text-sm font-medium text-gray-900">{copy.detailBreakdown}</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th
                    scope="col"
                    className="py-2 text-xs font-medium uppercase tracking-wide text-gray-500"
                  >
                    {copy.detailComponent}
                  </th>
                  <th
                    scope="col"
                    className="py-2 text-right text-xs font-medium uppercase tracking-wide text-gray-500"
                  >
                    {copy.detailValue}
                  </th>
                  <th
                    scope="col"
                    className="py-2 text-right text-xs font-medium uppercase tracking-wide text-gray-500"
                  >
                    {copy.detailWeight}
                  </th>
                  <th
                    scope="col"
                    className="py-2 text-right text-xs font-medium uppercase tracking-wide text-gray-500"
                  >
                    {copy.detailSource}
                  </th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(OPPORTUNITY_WEIGHTS_V1) as (keyof OpportunityComponents)[]).map(
                  (key) => {
                    const value = row.components[key];
                    return (
                      <tr key={key} className="border-b border-gray-100 last:border-0">
                        <td className="py-2 text-gray-700">{copy[COMPONENT_LABEL[key]]}</td>
                        <td className="py-2 text-right tabular-nums text-gray-900">
                          {value === null ? (
                            <span className="text-gray-400">{copy.componentNotMeasured}</span>
                          ) : (
                            Math.round(value)
                          )}
                        </td>
                        <td className="py-2 text-right tabular-nums text-gray-500">
                          {new Intl.NumberFormat(intl, { style: "percent" }).format(
                            OPPORTUNITY_WEIGHTS_V1[key],
                          )}
                        </td>
                        <td className="py-2 text-right text-xs text-gray-500">
                          {COMPONENT_SOURCES[key] === "provider"
                            ? copy.sourceProvider
                            : copy.sourceEchorank}
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
          {!row.aiTested && <p className="mt-2 text-xs text-gray-500">{copy.aiNotTestedHint}</p>}
        </section>

        {/* ── Competitors ── */}
        {relevant.length > 0 && (
          <section>
            <h3 className="text-sm font-medium text-gray-900">{copy.detailCompetitors}</h3>
            <p className="mt-1 text-xs text-gray-500">{copy.detailCompetitorsBody}</p>
            <ul className="mt-3 space-y-2">
              {relevant.map((competitor) => (
                <li key={competitor.name} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 truncate text-sm text-gray-900">
                    {competitor.name}
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <span
                      className="block h-full rounded-full bg-blue-500"
                      style={{ width: `${competitor.sharePercent}%` }}
                    />
                  </span>
                  <span className="w-28 shrink-0 text-right text-xs tabular-nums text-gray-600">
                    {interpolate(copy.competitorShare, { share: competitor.sharePercent })}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── The prompt and the answer ── */}
        {row.prompt && row.result && (
          <section>
            <h3 className="text-sm font-medium text-gray-900">{copy.detailPrompt}</h3>
            <p className="mt-1 text-xs text-gray-500">{copy.detailPromptBody}</p>
            <blockquote className="mt-2 border-l-2 border-gray-200 pl-3 text-sm italic text-gray-700">
              {row.prompt.text}
            </blockquote>

            <h3 className="mt-4 text-sm font-medium text-gray-900">{copy.detailAnswer}</h3>
            {/* Text, in a <p>. Never dangerouslySetInnerHTML — see the header. */}
            <p className="mt-2 whitespace-pre-line rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
              {row.result.answerSnapshot}
            </p>
          </section>
        )}

        {/* ── Actions ── */}
        <section>
          <h3 className="text-sm font-medium text-gray-900">{copy.detailActions}</h3>
          <ul className="mt-2 space-y-2">
            {row.actions.map((action) => (
              <li key={action} className="flex gap-2 text-sm text-gray-700">
                <ArrowRight
                  className="mt-0.5 h-4 w-4 shrink-0 text-blue-600"
                  aria-hidden="true"
                  focusable="false"
                />
                {copy[ACTION_LABEL[action]]}
              </li>
            ))}
          </ul>
        </section>

        {/* ── The bridge out. A link only; nothing is wired in this phase. ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4">
          <p className="text-sm text-gray-600">{copy.watcherBridge}</p>
          <Link
            href="/visibility/tools/custom-prompts"
            className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900"
          >
            {copy.watcherBridgeCta}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" focusable="false" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
