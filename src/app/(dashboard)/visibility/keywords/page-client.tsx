"use client";

import { useState, type ChangeEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import {
  Search,
  Copy,
  Lock,
  Sparkles,
  AlertCircle,
  KeyRound,
  Wrench,
} from "lucide-react";
import { BackLink, BackLinkRow } from "@/components/ui/back-link";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KEYWORDS_COPY, dashNav, type DashLocale, type KeywordsCopy } from "@/lib/i18n/dashboard";

// ─── Types (the sidecar's /keywords response shape) ─────────────────────────
interface KeywordItem {
  kw: string;
  score: number;
  difficulty: "low" | "medium" | "high";
  source: "heuristic" | "ai";
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

const DIFF_VARIANT: Record<string, "success" | "warning" | "danger"> = {
  low: "success",
  medium: "warning",
  high: "danger",
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

  async function runScan(ai: boolean) {
    const target = (ai ? result?.url : url.trim()) || url.trim();
    if (!target) return;
    const setBusy = ai ? setAiLoading : setLoading;
    setBusy(true);
    setError(null);
    setLocked(false);
    if (!ai) setResult(null);
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

  async function copyKw(kw: string) {
    try {
      await navigator.clipboard.writeText(kw);
      setCopiedKw(kw);
      setTimeout(() => setCopiedKw(null), 1400);
    } catch {
      /* clipboard unavailable */
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "seeds", label: t.tabSeeds },
    { key: "content", label: t.tabContent },
    { key: "prompts", label: t.tabPrompts },
    { key: "technical", label: t.tabTechnical },
  ];

  return (
    <div className="space-y-6">
      {/* Back navigation (shared BackLink pattern, above the heading) */}
      <BackLinkRow>
        <BackLink href="/visibility">{t.backToVisibility}</BackLink>
        <BackLink href="/visibility/tools" icon={Wrench}>
          {dashNav[locale]["/visibility/tools"]}
        </BackLink>
      </BackLinkRow>

      {/* Title */}
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">
          {t.title}
        </h2>
        <p className="mt-1 text-sm text-gray-500">{t.subtitle}</p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={url}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key === "Enter") runScan(false);
              }}
              placeholder={t.urlPlaceholder}
              className="pl-9"
            />
          </div>
          <Button onClick={() => runScan(false)} disabled={loading || aiLoading}>
            {loading ? t.scanning : t.runScan}
          </Button>
          {result && (
            <Button
              variant="outline"
              onClick={() => runScan(true)}
              disabled={loading || aiLoading}
            >
              <Sparkles className="mr-1.5 h-4 w-4" />
              {aiLoading ? t.regeneratingAi : t.regenerateAi}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Locked (feature not on plan) */}
      {locked && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 py-10 text-center">
          <Lock className="h-6 w-6 text-gray-400" />
          <p className="max-w-md text-sm text-gray-500">{t.lockedPage}</p>
          <Link href="/billing">
            <Button>{t.upgradePlan}</Button>
          </Link>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          <div className="h-10 w-2/3 animate-pulse rounded-lg bg-gray-200" />
          <div className="h-72 animate-pulse rounded-xl bg-gray-200" />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="mb-3 h-10 w-10 text-red-400" />
          <h3 className="text-base font-semibold text-gray-900">{t.scanFailed}</h3>
          <p className="mt-1 text-sm text-gray-500">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && !error && !locked && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <KeyRound className="mb-3 h-10 w-10 text-gray-300" />
          <h3 className="text-base font-semibold text-gray-900">{t.emptyTitle}</h3>
          <p className="mt-1 text-sm text-gray-500">{t.emptyDescription}</p>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-gray-500">
              {result.url} · {t.pagesCrawled(result.meta.pages_crawled)}
            </p>
            {result.meta.ai_used && <Badge variant="info">{t.aiBadge}</Badge>}
            {result.meta.ai_error && (
              <p className="text-xs text-amber-600">
                {t.aiUnavailable(result.meta.ai_error)}
              </p>
            )}
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-1 border-b border-gray-200">
            {tabs.map((tb) => (
              <button
                key={tb.key}
                onClick={() => setTab(tb.key)}
                className={
                  tab === tb.key
                    ? "border-b-2 border-gray-900 px-4 py-2 text-sm font-semibold text-gray-900"
                    : "px-4 py-2 text-sm text-gray-500 hover:text-gray-800"
                }
              >
                {tb.label}
              </button>
            ))}
          </div>

          {/* Keywords tab */}
          {tab === "seeds" && (
            <Card>
              <CardHeader>
                <p className="text-sm text-gray-500">{t.seedsIntro}</p>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-gray-100">
                  {result.seed_keywords.map((k) => (
                    <li
                      key={k.kw}
                      className="flex items-center justify-between gap-3 px-6 py-2.5"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="truncate text-sm font-medium text-gray-800">
                          {k.kw}
                        </span>
                        {k.source === "ai" && (
                          <Badge variant="info">{t.sourceLabels.ai}</Badge>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <Badge variant={DIFF_VARIANT[k.difficulty] ?? "warning"}>
                          {t.diffLabels[k.difficulty] ?? k.difficulty}
                        </Badge>
                        <Button variant="outline" size="sm" onClick={() => copyKw(k.kw)}>
                          <Copy className="mr-1.5 h-3.5 w-3.5" />
                          {copiedKw === k.kw ? t.copied : t.copy}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
                {result.question_keywords.length > 0 && (
                  <>
                    <p className="border-t border-gray-200 px-6 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      {t.questionHeading}
                    </p>
                    <ul className="divide-y divide-gray-100">
                      {result.question_keywords.map((k) => (
                        <li
                          key={k.kw}
                          className="flex items-center justify-between gap-3 px-6 py-2.5"
                        >
                          <span className="truncate text-sm text-gray-800">{k.kw}</span>
                          <Button variant="outline" size="sm" onClick={() => copyKw(k.kw)}>
                            <Copy className="mr-1.5 h-3.5 w-3.5" />
                            {copiedKw === k.kw ? t.copied : t.copy}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Content-optimization tab */}
          {tab === "content" && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <h3 className="text-base font-semibold text-gray-900">
                    {t.presentTitle}
                  </h3>
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
                  <h3 className="text-base font-semibold text-gray-900">
                    {t.missingTitle}
                  </h3>
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
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                copyKw(result.content_optimization.title_suggestion)
                              }
                            >
                              <Copy className="mr-1.5 h-3.5 w-3.5" />
                              {copiedKw === result.content_optimization.title_suggestion
                                ? t.copied
                                : t.copy}
                            </Button>
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
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                copyKw(result.content_optimization.meta_suggestion)
                              }
                            >
                              <Copy className="mr-1.5 h-3.5 w-3.5" />
                              {copiedKw === result.content_optimization.meta_suggestion
                                ? t.copied
                                : t.copy}
                            </Button>
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

          {/* AI-visibility prompts tab */}
          {tab === "prompts" && (
            <Card>
              <CardHeader>
                <p className="text-sm text-gray-500">{t.promptsIntro}</p>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-gray-100">
                  {result.ai_visibility_prompts.map((p) => (
                    <li
                      key={p}
                      className="flex items-center justify-between gap-3 px-6 py-2.5"
                    >
                      <span className="truncate text-sm text-gray-800">“{p}”</span>
                      <div className="flex shrink-0 items-center gap-3">
                        <Button variant="outline" size="sm" onClick={() => copyKw(p)}>
                          <Copy className="mr-1.5 h-3.5 w-3.5" />
                          {copiedKw === p ? t.copied : t.copy}
                        </Button>
                        <Link
                          href="/visibility#prompts"
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
          )}

          {/* Technical tab */}
          {tab === "technical" && (
            <Card>
              <CardHeader>
                <p className="text-sm text-gray-500">{t.techIntro}</p>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-gray-100">
                  {result.technical.map((c) => (
                    <li
                      key={c.check}
                      className="flex items-center justify-between gap-3 px-6 py-3"
                    >
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
          )}
        </div>
      )}
    </div>
  );
}
