"use client";

// Keyword Explorer — crawl-based keyword discovery.
//
// NOT the Keyword Opportunity Finder (/visibility/tools/keyword-opportunities).
// This tool answers "what does my site already signal"; that one answers "what
// is worth winning". They share a noun and nothing else: this page never buys
// demand data and never asks a model where the brand ranks.
//
// ── WHAT THE PAYLOAD ACTUALLY CARRIES ──────────────────────────────────────
//
// The sidecar (/opt/echorank/av-service/keyword_suggest.py) returns per
// keyword: { kw, score, difficulty, source }.
//
//   score       REAL. 0..1, normalised against the top candidate — position-
//               weighted n-gram frequency blended with RAKE. This is the
//               Relevance column. NOTE the one hole: AI-enhanced rows are
//               stamped a flat 0.5 by the sidecar rather than scored, so they
//               render "—" instead of a number. Showing 0.5 as a measurement
//               would be inventing one.
//   difficulty  REAL. low | medium | high.
//   source      PROVENANCE, NOT PLACE: "heuristic" | "ai". It is NOT the
//               title/H1/H2/body origin.
//
// There is therefore NO Source column. The sidecar computes exactly that
// signal — FIELD_WEIGHTS gives title 4.0, h1 3.0, h2 2.0, body 1.0 — and then
// SUMS it into the single `score` scalar, discarding which field won. The
// per-field breakdown is one dict away upstream and impossible down here, so
// the column is omitted rather than half-built. See the report's backend
// recommendations.

import { useMemo, useState, type ChangeEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import {
  Search,
  Copy,
  Check,
  Lock,
  Sparkles,
  AlertCircle,
  KeyRound,
  Wrench,
  MoreHorizontal,
  RotateCw,
  Radar,
  Download,
} from "lucide-react";
import { BackLink, BackLinkRow } from "@/components/ui/back-link";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeywordsExplorerHelpButton } from "@/components/seo-tools/keywords-explorer-help";
import { KEYWORDS_COPY, dashNav, type DashLocale, type KeywordsCopy } from "@/lib/i18n/dashboard";

// ─── Types (the sidecar's /keywords response shape) ─────────────────────────
interface KeywordItem {
  kw: string;
  /** Null on an AI-proposed row: nothing measured its relevance. */
  score: number | null;
  difficulty: "low" | "medium" | "high";
  /** Provenance, NOT place. See `fields` for where on the page it appeared. */
  source: "heuristic" | "ai";
  /**
   * Which page fields carried this phrase, and the weight each contributed.
   *
   * OPTIONAL, AND THAT IS LOAD-BEARING. AI rows never have it, and neither do
   * the responses already sitting in the 24h cache from before the extraction
   * fix shipped. Every read of it is guarded; the Source column disappears for
   * a result that predates it rather than rendering a column of blanks.
   */
  fields?: Record<string, number>;
  /** Occurrences across the scanned pages. Optional for the same reason. */
  count?: number;
}
interface TechnicalCheck {
  check: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}
interface KeywordResult {
  url: string;
  language: string;
  seed_keywords: KeywordItem[];
  question_keywords: KeywordItem[];
  content_optimization: {
    present_terms: string[];
    missing_terms: string[];
    title_suggestion: string;
    meta_suggestion: string;
    flags: string[];
  };
  ai_visibility_prompts: string[];
  /** SERP-feature names detected in the scanned page's own copy. */
  serp_features?: string[];
  technical: TechnicalCheck[];
  meta: {
    pages_crawled: number;
    ai_used: boolean;
    elapsed_ms: number;
    ai_error?: string;
  };
  error?: string;
}

type Tab = "seeds" | "content" | "prompts" | "technical";
type Group = "all" | "topics" | "questions";
type Sort = "relevance" | "alpha" | "difficulty";

/** A row plus which list it came from — the only reliable Topic/Question split. */
interface Row extends KeywordItem {
  kind: "topic" | "question";
}

// ── EXTRACTION ARTIFACTS: FIXED UPSTREAM, NOT HERE ─────────────────────────
//
// SERP-feature chrome ("stories image pack", "sitelinks shopping ads") and
// bare low-signal unigrams ("see", "use", "across", "pages") used to arrive as
// ordinary keyword rows. Both are now handled in av-service where the evidence
// is — serp_feature_of() classifies the first into `serp_features`, and a
// min-signal floor drops the second on the grounds that a single word absent
// from every title, heading, meta and alt attribute is not a keyword the site
// signals. Neither is a string match in this file, and neither should become
// one: a blocklist here would delete a real keyword the first time a customer
// sells packaging or greeting cards.
//
// This component stays version-tolerant on purpose. Responses cached before
// that shipped carry no `fields` and no `serp_features`, and must still render.
//
// ── PIPELINE TODO (same file, question_keywords()) ─────────────────────────
//
// Questions are template-stamped: the generator wraps top candidates in fixed
// frames, which is where "best ahrefs", "cheapest search" and "search vs
// alternatives" come from. Promoting Questions to a first-class filter (below)
// puts that squarely on screen. The fix is LLM-generated questions, and the
// prompt generator in src/lib/keyword-opportunity/prompts.ts is directly
// reusable — it already turns a keyword plus an intent into a buyer-phrased
// question and drops any that name the brand. Out of scope here.

/**
 * The strongest field a phrase appears in, by PRIORITY rather than by weight.
 *
 * `fields` accumulates weight per occurrence, so a phrase in the title once and
 * the body six times has more body weight than title weight — and "it is in
 * your body" is not the sentence anybody needs. The useful answer is the most
 * prominent place it reached, so this walks the priority order and takes the
 * first hit. Returns null for a row that carries no field data at all.
 */
const FIELD_PRIORITY = ["title", "h1", "h2", "h3", "meta", "alt", "anchor", "body"] as const;

function strongestField(fields?: Record<string, number>): string | null {
  if (!fields) return null;
  for (const field of FIELD_PRIORITY) {
    if (fields[field] !== undefined) return field;
  }
  const [first] = Object.keys(fields);
  return first ?? null;
}

const DIFF_DOT: Record<string, string> = {
  low: "bg-emerald-500",
  medium: "bg-amber-500",
  high: "bg-rose-500",
};
const STATUS_VARIANT: Record<string, "success" | "warning" | "danger"> = {
  pass: "success",
  warn: "warning",
  fail: "danger",
};

function flagLabel(flag: string, t: KeywordsCopy): string {
  if (flag.startsWith("keyword_stuffing:")) {
    return t.stuffingFlag(flag.split(":")[1] ?? "");
  }
  return t.flagLabels[flag] ?? flag;
}

/**
 * Difficulty, quietly.
 *
 * A dot plus a word, never the dot alone — the label carries the meaning for
 * anyone who cannot separate the hues, and the tint is a hint rather than the
 * message. The old saturated success/warning/danger badges made a page of
 * ordinary keywords read like a page of alarms.
 */
function DifficultyCell({ level, label }: { level: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-gray-700">
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${DIFF_DOT[level] ?? "bg-gray-400"}`}
      />
      <span className="capitalize">{label}</span>
    </span>
  );
}

export function KeywordsPageClient({ locale }: { locale: DashLocale }) {
  const t = KEYWORDS_COPY[locale];
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [result, setResult] = useState<KeywordResult | null>(null);
  const [tab, setTab] = useState<Tab>("seeds");
  const [copiedKw, setCopiedKw] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Keywords-tab controls.
  const [group, setGroup] = useState<Group>("all");
  const [query, setQuery] = useState("");
  const [diffFilter, setDiffFilter] = useState<string>("all");
  const [sort, setSort] = useState<Sort>("relevance");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function runScan(ai: boolean) {
    const target = (ai ? result?.url : url.trim()) || url.trim();
    if (!target) return;
    const setBusy = ai ? setAiLoading : setLoading;
    setBusy(true);
    setError(null);
    setLocked(false);
    setMenuOpen(false);
    if (!ai) {
      setResult(null);
      setSelected(new Set());
    }
    try {
      const res = await fetch("/api/ai/visibility/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target, ai }),
      });
      if (res.status === 403) {
        setLocked(true);
        return;
      }
      const data: KeywordResult = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || t.requestFailed(res.status));
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.somethingWrong);
    } finally {
      setBusy(false);
    }
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKw(text);
      setTimeout(() => setCopiedKw(null), 1400);
    } catch {
      /* clipboard unavailable */
    }
  }

  /** Both lists as one, tagged with the split the payload already makes. */
  const rows: Row[] = useMemo(() => {
    if (!result) return [];
    return [
      ...result.seed_keywords.map((k) => ({ ...k, kind: "topic" as const })),
      ...result.question_keywords.map((k) => ({ ...k, kind: "question" as const })),
    ];
  }, [result]);

  const visible: Row[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      if (group === "topics" && r.kind !== "topic") return false;
      if (group === "questions" && r.kind !== "question") return false;
      if (diffFilter !== "all" && r.difficulty !== diffFilter) return false;
      if (q && !r.kw.toLowerCase().includes(q)) return false;
      return true;
    });
    const order: Record<string, number> = { low: 0, medium: 1, high: 2 };
    // NULLS SORT LAST, in both directions — an unscored AI row is not a row
    // that scored zero, and floating it to the top of a relevance sort would
    // claim the keywords we measured least are the ones we rate highest.
    const rank = (r: Row) => (r.score === null || r.score === undefined ? -1 : r.score);
    return [...filtered].sort((a, b) => {
      if (sort === "alpha") return a.kw.localeCompare(b.kw);
      if (sort === "difficulty") {
        return (order[a.difficulty] ?? 3) - (order[b.difficulty] ?? 3) || rank(b) - rank(a);
      }
      return rank(b) - rank(a) || a.kw.localeCompare(b.kw);
    });
  }, [rows, group, diffFilter, query, sort]);

  /**
   * The summary metrics. EVERY ONE IS DERIVED — nothing here is a placeholder.
   * "Issues" is technical checks that did not pass plus content flags, which
   * is exactly what the other two tabs render.
   */
  const metrics = useMemo(() => {
    if (!result) return null;
    return {
      keywords: result.seed_keywords.length,
      questions: result.question_keywords.length,
      easyWins: rows.filter((r) => r.difficulty === "low").length,
      issues:
        result.technical.filter((c) => c.status !== "pass").length +
        result.content_optimization.flags.length,
    };
  }, [result, rows]);

  /**
   * Whether this response carries field origin at all.
   *
   * One check for the whole table rather than per row: a result either came
   * from a pipeline that retains `fields` or it did not, and a column that
   * appeared for some rows and not others would read as missing data rather
   * than as an older scan. Cached pre-fix responses simply have no column.
   */
  const hasFieldOrigin = useMemo(() => rows.some((r) => r.fields !== undefined), [rows]);

  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.kw));

  function toggleRow(kw: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(kw)) next.delete(kw);
      else next.add(kw);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      if (visible.every((r) => prev.has(r.kw))) {
        const next = new Set(prev);
        for (const r of visible) next.delete(r.kw);
        return next;
      }
      const next = new Set(prev);
      for (const r of visible) next.add(r.kw);
      return next;
    });
  }

  const selectedList = useMemo(
    () => visible.filter((r) => selected.has(r.kw)).map((r) => r.kw),
    [visible, selected],
  );

  /** CSV of the current selection, or of everything visible when none is picked. */
  function exportCsv() {
    const source = selectedList.length > 0 ? visible.filter((r) => selected.has(r.kw)) : visible;
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = [t.colKeyword, t.colDifficulty, t.colRelevance, "Type"].map(esc).join(",");
    const body = source
      .map((r) =>
        [
          esc(r.kw),
          esc(t.diffLabels[r.difficulty] ?? r.difficulty),
          // An unscored row exports as empty rather than as a number: the
          // spreadsheet must not imply a measurement nobody made.
          esc(r.score === null || r.score === undefined ? "" : String(r.score)),
          esc(r.kind),
        ].join(","),
      )
      .join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `keywords-${result?.url.replace(/[^a-z0-9]+/gi, "-").toLowerCase() ?? "export"}.csv`;
    a.click();
    URL.revokeObjectURL(href);
  }

  const tabs: { key: Tab; label: string; count: number | null }[] = [
    { key: "seeds", label: t.tabSeeds, count: rows.length },
    {
      key: "content",
      label: t.tabContent,
      count: result
        ? result.content_optimization.present_terms.length +
          result.content_optimization.missing_terms.length
        : null,
    },
    { key: "prompts", label: t.tabPrompts, count: result?.ai_visibility_prompts.length ?? null },
    { key: "technical", label: t.tabTechnical, count: result?.technical.length ?? null },
  ];

  return (
    <div className="space-y-8">
      {/* Breadcrumb — navigation, deliberately lighter than the heading. */}
      <BackLinkRow>
        <BackLink href="/visibility/tools" icon={Wrench}>
          {dashNav[locale]["/visibility/tools"]}
        </BackLink>
        <BackLink href="/visibility">{t.backToVisibility}</BackLink>
      </BackLinkRow>

      {/* ONE title. The uppercase "Keyword Suggester" eyebrow is gone — it
          competed with the page header for the same job. */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{t.heading}</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-gray-500">{t.headingDescription}</p>
        </div>
        <div className="shrink-0">
          <KeywordsExplorerHelpButton locale={locale} />
        </div>
      </div>

      {/* ── Scan card ──────────────────────────────────────────────────────
          Two states. Before a result it is the page's centre of gravity;
          after one it collapses to a status line with a secondary action, so
          the results own the page. "Regenerate with AI" moves into the
          overflow: it is a re-run of work already done and must not read as
          the equal of Analyze. */}
      {!result ? (
        <Card>
          <CardContent className="space-y-3 py-5">
            <div>
              <label
                htmlFor="kw-url"
                className="text-sm font-medium text-gray-900"
              >
                {t.analyzeLabel}
              </label>
              <p className="mt-1 text-sm text-gray-500">{t.analyzeBlurb}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                />
                <Input
                  id="kw-url"
                  value={url}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
                  onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === "Enter") runScan(false);
                  }}
                  placeholder={t.urlPlaceholder}
                  className="pl-9"
                />
              </div>
              <Button
                onClick={() => runScan(false)}
                disabled={loading || aiLoading || !url.trim()}
                className="sm:w-auto"
              >
                {loading ? t.scanning : t.analyzeCta}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-sm font-medium text-gray-900">{result.url}</span>
            <span aria-hidden="true" className="text-gray-300">
              ·
            </span>
            <span className="text-sm text-gray-500">
              {t.pagesScanned(result.meta.pages_crawled)}
            </span>
            {result.meta.ai_used && <Badge variant="info">{t.aiBadge}</Badge>}
          </div>
          <div className="relative flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => runScan(false)}
              disabled={loading || aiLoading}
            >
              <RotateCw aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
              {loading ? t.scanning : t.scanAgain}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label={t.moreActions}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() => setMenuOpen((o) => !o)}
              disabled={loading || aiLoading}
            >
              <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
            </Button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-10 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => runScan(true)}
                  disabled={aiLoading}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none disabled:opacity-50"
                >
                  <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-gray-400" />
                  {aiLoading ? t.regeneratingAi : t.regenerateAi}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {result?.meta.ai_error && (
        <p className="text-xs text-amber-600">{t.aiUnavailable(result.meta.ai_error)}</p>
      )}

      {/* Locked (feature not on plan) */}
      {locked && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 py-10 text-center">
          <Lock aria-hidden="true" className="h-6 w-6 text-gray-400" />
          <p className="max-w-md text-sm text-gray-500">{t.lockedPage}</p>
          <Link href="/billing">
            <Button>{t.upgradePlan}</Button>
          </Link>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-4" role="status" aria-live="polite" aria-busy="true">
          <span className="sr-only">{t.scanning}</span>
          <div className="h-10 w-2/3 animate-pulse rounded-lg bg-gray-100" />
          <div className="h-72 animate-pulse rounded-xl bg-gray-100" />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center" role="alert">
          <AlertCircle aria-hidden="true" className="mb-3 h-10 w-10 text-rose-400" />
          <h3 className="text-base font-semibold text-gray-900">{t.scanFailed}</h3>
          <p className="mt-1 text-sm text-gray-500">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && !error && !locked && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <KeyRound aria-hidden="true" className="mb-3 h-10 w-10 text-gray-300" />
          <h3 className="text-base font-semibold text-gray-900">{t.emptyTitle}</h3>
          <p className="mt-1 text-sm text-gray-500">{t.emptyDescription}</p>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-5">
          {/* Compact metric row — one surface, numbers louder than labels. */}
          {metrics && (
            <div className="rounded-lg border border-gray-200 bg-white">
              <dl className="grid grid-cols-2 divide-x divide-y divide-gray-100 sm:grid-cols-4 sm:divide-y-0">
                {[
                  { label: t.metricKeywords, value: metrics.keywords },
                  { label: t.metricQuestions, value: metrics.questions },
                  { label: t.metricEasyWins, value: metrics.easyWins },
                  { label: t.metricIssues, value: metrics.issues },
                ].map((m) => (
                  <div key={m.label} className="px-4 py-3">
                    <dd className="text-xl font-semibold tabular-nums text-gray-900">{m.value}</dd>
                    <dt className="mt-0.5 text-xs text-gray-500">{m.label}</dt>
                  </div>
                ))}
              </dl>
              <p className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">
                {t.analysisComplete} · {t.pagesScanned(result.meta.pages_crawled)}
              </p>
            </div>
          )}

          {/* Tabs — horizontally scrollable on narrow screens. */}
          {/* role="tablist" promises arrow-key navigation, so it provides it —
              Left/Right move, Home/End jump. Tab still reaches the list and
              leaves it, which is what a keyboard user who ignores the arrows
              expects. aria-controls is deliberately absent: only the selected
              panel is in the DOM, and pointing three tabs at ids that do not
              exist is a worse lie than saying nothing. */}
          <div
            role="tablist"
            aria-label={t.heading}
            onKeyDown={(e) => {
              const order = tabs.map((x) => x.key);
              const at = order.indexOf(tab);
              let next: Tab | null = null;
              if (e.key === "ArrowRight") next = order[(at + 1) % order.length];
              if (e.key === "ArrowLeft") next = order[(at - 1 + order.length) % order.length];
              if (e.key === "Home") next = order[0];
              if (e.key === "End") next = order[order.length - 1];
              if (!next) return;
              e.preventDefault();
              setTab(next);
              document.getElementById(`kwtab-${next}`)?.focus();
            }}
            className="-mx-1 flex gap-1 overflow-x-auto border-b border-gray-200 px-1"
          >
            {tabs.map((tb) => {
              const active = tab === tb.key;
              return (
                <button
                  key={tb.key}
                  role="tab"
                  id={`kwtab-${tb.key}`}
                  aria-selected={active}
                  tabIndex={active ? 0 : -1}
                  onClick={() => setTab(tb.key)}
                  className={
                    "-mb-px shrink-0 whitespace-nowrap rounded-t-md border-b-2 px-3 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 " +
                    (active
                      ? "border-blue-600 bg-blue-50/60 font-semibold text-blue-700"
                      : "border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-800")
                  }
                >
                  {tb.label}
                  {tb.count !== null && (
                    <span
                      className={
                        "ml-1.5 tabular-nums " + (active ? "text-blue-500" : "text-gray-400")
                      }
                    >
                      {tb.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Keywords tab ── */}
          {tab === "seeds" && (
            <div id="kwpanel-seeds" role="tabpanel" aria-labelledby="kwtab-seeds" className="space-y-3">
              {/* Group + toolbar. Questions is a first-class filter now, not a
                  sub-heading buried under a forty-row list. */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg bg-gray-100 p-0.5">
                  {(
                    [
                      ["all", t.filterAll, rows.length],
                      ["topics", t.filterTopics, result.seed_keywords.length],
                      ["questions", t.filterQuestions, result.question_keywords.length],
                    ] as const
                  ).map(([key, label, count]) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={group === key}
                      onClick={() => setGroup(key)}
                      className={
                        "rounded-md px-3 py-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 " +
                        (group === key
                          ? "bg-white font-medium text-gray-900 shadow-sm"
                          : "text-gray-600 hover:text-gray-900")
                      }
                    >
                      {label}
                      <span className="ml-1.5 tabular-nums text-gray-400">{count}</span>
                    </button>
                  ))}
                </div>

                <div className="relative min-w-[10rem] flex-1">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                  />
                  <Input
                    value={query}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                    placeholder={t.searchPlaceholder}
                    aria-label={t.searchPlaceholder}
                    className="pl-9"
                  />
                </div>

                <select
                  value={diffFilter}
                  onChange={(e) => setDiffFilter(e.target.value)}
                  aria-label={t.filterDifficulty}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <option value="all">{t.filterAllDifficulties}</option>
                  <option value="low">{t.diffLabels.low}</option>
                  <option value="medium">{t.diffLabels.medium}</option>
                  <option value="high">{t.diffLabels.high}</option>
                </select>

                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                  aria-label={t.sortBy}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <option value="relevance">{t.sortRelevance}</option>
                  <option value="alpha">{t.sortAlpha}</option>
                  <option value="difficulty">{t.sortDifficulty}</option>
                </select>

                <Button variant="outline" size="sm" onClick={exportCsv} disabled={visible.length === 0}>
                  <Download aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                  {t.exportCsv}
                </Button>
              </div>

              {/* Bulk bar — only when there is a selection to act on. */}
              {selectedList.length > 0 && (
                <div
                  role="region"
                  aria-live="polite"
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2"
                >
                  <span className="text-sm font-medium text-blue-900">
                    {t.selectedCount(selectedList.length)}
                  </span>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyText(selectedList.join("\n"))}
                    >
                      <Copy aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                      {copiedKw === selectedList.join("\n") ? t.copied : t.copySelected}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                      {t.clearSelection}
                    </Button>
                  </div>
                </div>
              )}

              <Card>
                <CardContent className="p-0">
                  {visible.length === 0 ? (
                    <div className="px-6 py-12 text-center">
                      <p className="text-sm text-gray-500">{t.noMatches}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          setQuery("");
                          setDiffFilter("all");
                          setGroup("all");
                        }}
                      >
                        {t.clearFilters}
                      </Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <caption className="sr-only">{t.tabSeeds}</caption>
                        <thead>
                          <tr className="border-b border-gray-200 text-left">
                            <th scope="col" className="w-10 py-2.5 pl-4 pr-2">
                              <input
                                type="checkbox"
                                checked={allVisibleSelected}
                                onChange={toggleAll}
                                aria-label={t.selectAll}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                            </th>
                            <th
                              scope="col"
                              className="py-2.5 pr-3 text-xs font-medium uppercase tracking-wide text-gray-500"
                            >
                              {t.colKeyword}
                            </th>
                            <th
                              scope="col"
                              className="w-32 py-2.5 pr-3 text-xs font-medium uppercase tracking-wide text-gray-500"
                            >
                              {t.colDifficulty}
                            </th>
                            <th
                              scope="col"
                              title={t.relevanceTitle}
                              className="hidden w-40 py-2.5 pr-3 text-xs font-medium uppercase tracking-wide text-gray-500 sm:table-cell"
                            >
                              {t.colRelevance}
                            </th>
                            {hasFieldOrigin && (
                              <th
                                scope="col"
                                title={t.sourceTitle}
                                className="hidden w-28 py-2.5 pr-3 text-xs font-medium uppercase tracking-wide text-gray-500 lg:table-cell"
                              >
                                {t.colSource}
                              </th>
                            )}
                            <th scope="col" className="w-24 py-2.5 pr-4 text-right">
                              <span className="sr-only">{t.colActions}</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {visible.map((k) => {
                            const isSelected = selected.has(k.kw);
                            return (
                              <tr
                                key={`${k.kind}-${k.kw}`}
                                className={
                                  "border-b border-gray-100 last:border-0 transition-colors " +
                                  (isSelected ? "bg-blue-50/40" : "hover:bg-gray-50")
                                }
                              >
                                <td className="py-2 pl-4 pr-2">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleRow(k.kw)}
                                    aria-label={t.selectRow(k.kw)}
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                </td>
                                <td className="py-2 pr-3">
                                  <span className="flex min-w-0 items-center gap-2">
                                    <span className="truncate font-medium text-gray-800">
                                      {k.kw}
                                    </span>
                                    {k.source === "ai" && (
                                      <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                                        {t.aiRow}
                                      </span>
                                    )}
                                  </span>
                                </td>
                                <td className="py-2 pr-3">
                                  <DifficultyCell
                                    level={k.difficulty}
                                    label={t.diffLabels[k.difficulty] ?? k.difficulty}
                                  />
                                </td>
                                {/* Relevance. Null on an AI row — the model
                                    proposed the keyword, nothing weighed it —
                                    so it shows a dash rather than a number
                                    somebody could sort by. The `=== null`
                                    check also covers the pre-fix responses
                                    that stamped a flat 0.5, because those are
                                    numbers and render as before. */}
                                <td className="hidden py-2 pr-3 sm:table-cell">
                                  {k.score === null || k.score === undefined ? (
                                    <span className="text-gray-400">{t.relevanceNa}</span>
                                  ) : (
                                    <span className="flex items-center gap-2">
                                      <span
                                        aria-hidden="true"
                                        className="h-1 w-16 overflow-hidden rounded-full bg-gray-100"
                                      >
                                        <span
                                          className="block h-full rounded-full bg-blue-400"
                                          style={{ width: `${Math.round(k.score * 100)}%` }}
                                        />
                                      </span>
                                      <span className="tabular-nums text-xs text-gray-500">
                                        {Math.round(k.score * 100)}
                                      </span>
                                    </span>
                                  )}
                                </td>
                                {hasFieldOrigin && (
                                  <td className="hidden py-2 pr-3 lg:table-cell">
                                    {(() => {
                                      const field = strongestField(k.fields);
                                      return field ? (
                                        <span className="text-xs text-gray-500">
                                          {t.fieldLabels[field] ?? field}
                                        </span>
                                      ) : (
                                        <span className="text-gray-400">{t.relevanceNa}</span>
                                      );
                                    })()}
                                  </td>
                                )}
                                <td className="py-2 pr-4">
                                  <span className="flex items-center justify-end gap-1">
                                    <Link
                                      href={`/visibility/tools/custom-prompts?prompt=${encodeURIComponent(k.kw)}`}
                                      title={t.trackInAiVisibility}
                                      aria-label={`${t.trackInAiVisibility}: ${k.kw}`}
                                      className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                    >
                                      <Radar aria-hidden="true" className="h-4 w-4" />
                                    </Link>
                                    <button
                                      type="button"
                                      onClick={() => copyText(k.kw)}
                                      title={t.copyKeyword}
                                      aria-label={`${t.copyKeyword}: ${k.kw}`}
                                      className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                    >
                                      {copiedKw === k.kw ? (
                                        <Check aria-hidden="true" className="h-4 w-4 text-emerald-600" />
                                      ) : (
                                        <Copy aria-hidden="true" className="h-4 w-4" />
                                      )}
                                    </button>
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
              <p aria-live="polite" className="sr-only">
                {copiedKw ? t.copied : ""}
              </p>
            </div>
          )}

          {/* ── Content-optimization tab ── */}
          {tab === "content" && (
            <div
              id="kwpanel-content"
              role="tabpanel"
              aria-labelledby="kwtab-content"
              className="grid grid-cols-1 gap-6 lg:grid-cols-2"
            >
              <Card>
                <CardHeader>
                  <h3 className="text-base font-semibold text-gray-900">{t.presentTitle}</h3>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {result.content_optimization.present_terms.map((term) => (
                      <Badge key={term} variant="success">
                        {term}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <h3 className="text-base font-semibold text-gray-900">{t.missingTitle}</h3>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {result.content_optimization.missing_terms.map((term) => (
                      <Badge key={term} variant="warning">
                        {term}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardContent className="space-y-4 py-5">
                  {result.content_optimization.title_suggestion ||
                  result.content_optimization.meta_suggestion ? (
                    <>
                      {result.content_optimization.title_suggestion && (
                        <div>
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                            {t.titleSuggestion}
                          </p>
                          <div className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-4 py-2.5">
                            <span className="text-sm text-gray-800">
                              {result.content_optimization.title_suggestion}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyText(result.content_optimization.title_suggestion)}
                              title={t.copy}
                              aria-label={t.copy}
                              className="shrink-0 rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            >
                              {copiedKw === result.content_optimization.title_suggestion ? (
                                <Check aria-hidden="true" className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <Copy aria-hidden="true" className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                      {result.content_optimization.meta_suggestion && (
                        <div>
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                            {t.metaSuggestion}
                          </p>
                          <div className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-4 py-2.5">
                            <span className="text-sm text-gray-800">
                              {result.content_optimization.meta_suggestion}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyText(result.content_optimization.meta_suggestion)}
                              title={t.copy}
                              aria-label={t.copy}
                              className="shrink-0 rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            >
                              {copiedKw === result.content_optimization.meta_suggestion ? (
                                <Check aria-hidden="true" className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <Copy aria-hidden="true" className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">{t.noSuggestions}</p>
                  )}
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      {t.flagsTitle}
                    </p>
                    {result.content_optimization.flags.length === 0 ? (
                      <p className="text-sm text-gray-500">{t.noFlags}</p>
                    ) : (
                      <ul className="list-disc space-y-1 pl-5 text-sm text-gray-600">
                        {result.content_optimization.flags.map((f) => (
                          <li key={f}>{flagLabel(f, t)}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── AI-visibility prompts tab ── */}
          {tab === "prompts" && (
            <div id="kwpanel-prompts" role="tabpanel" aria-labelledby="kwtab-prompts">
              <Card>
                <CardHeader>
                  <p className="text-sm text-gray-500">{t.promptsIntro}</p>
                </CardHeader>
                <CardContent className="p-0">
                  <ul className="divide-y divide-gray-100">
                    {result.ai_visibility_prompts.map((p) => (
                      <li key={p} className="flex items-center justify-between gap-3 px-6 py-2.5">
                        <span className="truncate text-sm text-gray-800">“{p}”</span>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => copyText(p)}
                            title={t.copy}
                            aria-label={t.copy}
                            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                          >
                            {copiedKw === p ? (
                              <Check aria-hidden="true" className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <Copy aria-hidden="true" className="h-4 w-4" />
                            )}
                          </button>
                          <Link
                            href={`/visibility/tools/custom-prompts?prompt=${encodeURIComponent(p)}`}
                            className="text-xs font-medium text-gray-500 hover:text-gray-800"
                          >
                            {t.trackPrompt}
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── Technical tab ── */}
          {tab === "technical" && (
            <div id="kwpanel-technical" role="tabpanel" aria-labelledby="kwtab-technical">
              <Card>
                <CardHeader>
                  <p className="text-sm text-gray-500">{t.techIntro}</p>
                </CardHeader>
                <CardContent className="p-0">
                  <ul className="divide-y divide-gray-100">
                    {result.technical.map((c) => (
                      <li key={c.check} className="flex items-center justify-between gap-3 px-6 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">{c.check}</p>
                          <p className="truncate text-xs text-gray-400">{c.detail}</p>
                        </div>
                        <Badge variant={STATUS_VARIANT[c.status] ?? "warning"}>
                          {t.statusLabels[c.status] ?? c.status}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
