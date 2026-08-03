"use client";

// One brief: the form, the analysis, and the draft.
//
// THE TWO-BUTTON SHAPE. `generate` categories have one button. `hybrid` and
// `heuristic` categories show ANALYSE first, and the analysis is the complete
// answer for category 08 and a genuinely useful answer for 05, 09 and 12 on its
// own. Only after seeing it does a second button appear to spend tokens writing
// it up. That ordering is the cost doctrine made visible: the free step runs
// first and most people will stop there.
//
// The analysis response carries the exact payload the write-up step would send,
// and it is rendered verbatim under "Exactly what would be sent". Claiming the
// pasted corpus stays local is cheap; showing the alternative is not.

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Check, Copy, Loader2, Lock, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  categoryVariables,
  findMarketingCategory,
  type MarketingVariable,
} from "@/lib/marketing-templates";
import type {
  MarketingComputeResult,
  MarketingResult,
  MarketingUsage,
} from "@/lib/marketing/types";
import {
  MARKETING_COPY,
  marketingLabel,
  marketingVarHint,
  type DashLocale,
} from "@/lib/i18n/dashboard";
import { CTA_LINK_CLASS } from "@/components/seo-tools/marketing-studio-client";

const STUDIO_BASE = "/visibility/tools/ai-content-helper";

interface Props {
  locale: DashLocale;
  categoryId: string;
  usage: MarketingUsage | null;
  voiceGuide: string | null;
  hasVoiceGuide: boolean;
}

interface ApiError {
  error?: string;
  code?: string;
}

export function MarketingBriefClient({
  locale,
  categoryId,
  usage: initialUsage,
  voiceGuide,
  hasVoiceGuide,
}: Props) {
  const t = MARKETING_COPY[locale];
  const category = useMemo(() => findMarketingCategory(categoryId), [categoryId]);

  const [values, setValues] = useState<Record<string, string>>({});
  const [computed, setComputed] = useState<MarketingComputeResult | null>(null);
  const [result, setResult] = useState<MarketingResult | null>(null);
  const [usage, setUsage] = useState<MarketingUsage | null>(initialUsage);
  const [busy, setBusy] = useState<null | "compute" | "generate" | "voice">(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  // Only the voice page edits this; it starts from whatever is saved.
  const [guideDraft, setGuideDraft] = useState(voiceGuide ?? "");

  const unlocked = usage?.unlocked ?? false;
  const variables = category ? categoryVariables(category) : [];

  /** Map an API error code onto catalog copy — never render a server string. */
  const messageFor = useCallback(
    (payload: ApiError): string => {
      switch (payload.code) {
        case "RATE_LIMITED":
          return t.errRateLimited;
        case "BUDGET_EXCEEDED":
          return t.errBudget;
        case "NOT_CONFIGURED":
          return t.errNotConfigured;
        case "UPSTREAM_FAILED":
          return t.errUpstream;
        case "PLAN_LOCKED":
          return t.lockedBody;
        case "INVALID_REQUEST":
          // The only server text shown to the user, and only here: these are
          // field-level messages ("Missing required fields: PRODUCT") that the
          // catalog cannot enumerate without duplicating the config.
          return payload.error ?? t.errGeneric;
        default:
          return t.errGeneric;
      }
    },
    [t],
  );

  const post = useCallback(
    async <T,>(url: string, body: unknown): Promise<T | null> => {
      setError(null);
      try {
        const res = await fetch(url, {
          method: url.endsWith("/voice") ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(messageFor(payload as ApiError));
          return null;
        }
        return payload as T;
      } catch {
        setError(t.errGeneric);
        return null;
      }
    },
    [messageFor, t],
  );

  const runCompute = useCallback(async () => {
    setBusy("compute");
    setResult(null);
    const payload = await post<MarketingComputeResult>(
      "/api/ai/visibility/marketing/compute",
      { categoryId, values },
    );
    if (payload) setComputed(payload);
    setBusy(null);
  }, [categoryId, post, values]);

  const runGenerate = useCallback(async () => {
    setBusy("generate");
    const payload = await post<MarketingResult>("/api/ai/visibility/marketing/generate", {
      categoryId,
      values,
      locale,
    });
    if (payload) {
      setResult(payload);
      setUsage(payload.usage);
    }
    setBusy(null);
  }, [categoryId, locale, post, values]);

  const saveVoice = useCallback(
    async (guide: string) => {
      setBusy("voice");
      const payload = await post<{ guide: string | null }>(
        "/api/ai/visibility/marketing/voice",
        { guide },
      );
      if (payload) setVoiceNote(payload.guide ? t.voiceSaved : t.voiceCleared);
      setBusy(null);
    },
    [post, t],
  );

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard denied (insecure context, or the user said no). The text is
      // already on screen and selectable, so this is not worth an error banner.
    }
  }, []);

  if (!category) return null;

  const isVoice = category.id === "voice";
  const showsAnalyseFirst = category.mode !== "generate";
  const num = (n: number) => n.toLocaleString(locale === "de-CH" ? "de-CH" : locale);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={STUDIO_BASE}
          className="text-sm text-gray-500 hover:text-gray-900 hover:underline"
        >
          {t.backToStudio}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-gray-900">
          {marketingLabel(t, category.nameKey)}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-600">
          {marketingLabel(t, category.roleKey)}
        </p>
        <p className="mt-2 text-xs text-gray-500">
          {category.mode === "heuristic"
            ? t.modeHeuristicNote
            : category.mode === "hybrid"
              ? t.modeHybridNote
              : hasVoiceGuide
                ? t.voiceActive
                : ""}
        </p>
      </div>

      {!unlocked ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 py-6">
            <Badge className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              {t.lockedTitle}
            </Badge>
            <p className="max-w-2xl text-sm text-gray-600">{t.lockedBody}</p>
            <Link href="/billing" className={CTA_LINK_CLASS}>
              {t.upgradeCta}
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="space-y-4 py-5">
              {variables.map((variable: MarketingVariable) => {
                const hint = marketingVarHint(t, variable.labelKey);
                const id = `mk-${variable.k}`;
                return (
                  <div key={variable.k}>
                    <label htmlFor={id} className="block text-sm font-medium text-gray-800">
                      {marketingLabel(t, variable.labelKey)}
                    </label>
                    {hint ? (
                      <p id={`${id}-hint`} className="mt-0.5 text-xs text-gray-500">
                        {hint}
                      </p>
                    ) : null}
                    {variable.multiline ? (
                      <textarea
                        id={id}
                        aria-describedby={hint ? `${id}-hint` : undefined}
                        rows={8}
                        value={values[variable.k] ?? ""}
                        onChange={(e) =>
                          setValues((prev) => ({ ...prev, [variable.k]: e.target.value }))
                        }
                        className="mt-1.5 w-full rounded-md border border-gray-300 p-2 font-mono text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    ) : (
                      <input
                        id={id}
                        type="text"
                        aria-describedby={hint ? `${id}-hint` : undefined}
                        value={values[variable.k] ?? ""}
                        onChange={(e) =>
                          setValues((prev) => ({ ...prev, [variable.k]: e.target.value }))
                        }
                        className="mt-1.5 w-full rounded-md border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    )}
                  </div>
                );
              })}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {showsAnalyseFirst ? (
                  <Button onClick={runCompute} disabled={busy !== null}>
                    {busy === "compute" ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : null}
                    {busy === "compute" ? t.computing : t.computeBtn}
                  </Button>
                ) : (
                  <Button onClick={runGenerate} disabled={busy !== null}>
                    {busy === "generate" ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Sparkles className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    )}
                    {busy === "generate" ? t.generating : t.generateBtn}
                  </Button>
                )}

                {usage ? (
                  <span className="text-xs tabular-nums text-gray-500">
                    {usage.limit === null
                      ? t.usageUnlimited(num(usage.used))
                      : t.usageLine(num(usage.used), num(usage.limit))}
                  </span>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {error ? (
            <Card>
              <CardContent className="flex items-start gap-2 py-4 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </CardContent>
            </Card>
          ) : null}

          {computed ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <span className="text-sm font-medium text-gray-900">{t.computedTitle}</span>
                <Button variant="ghost" size="sm" onClick={() => copy(computed.computed)}>
                  {copied ? (
                    <Check className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Copy className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {copied ? t.copied : t.copyBtn}
                </Button>
              </CardHeader>
              <CardContent>
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs leading-relaxed text-gray-800">
                  {computed.computed}
                </pre>

                {isVoice ? (
                  <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
                    <label htmlFor="mk-guide" className="block text-sm font-medium text-gray-800">
                      {t.voiceTitle}
                    </label>
                    <p className="text-xs text-gray-500">{t.voiceEditHint}</p>
                    <textarea
                      id="mk-guide"
                      rows={10}
                      value={guideDraft || computed.computed}
                      onChange={(e) => setGuideDraft(e.target.value)}
                      className="w-full rounded-md border border-gray-300 p-2 font-mono text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        onClick={() => saveVoice(guideDraft || computed.computed)}
                        disabled={busy !== null}
                      >
                        {busy === "voice" ? (
                          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : null}
                        {t.voiceSaveBtn}
                      </Button>
                      {hasVoiceGuide ? (
                        <Button
                          variant="outline"
                          onClick={() => saveVoice("")}
                          disabled={busy !== null}
                        >
                          {t.voiceClearBtn}
                        </Button>
                      ) : null}
                      {voiceNote ? (
                        <span className="text-xs text-green-700">{voiceNote}</span>
                      ) : null}
                    </div>
                    <p className="text-xs text-gray-500">{t.voiceSamplesNotStored}</p>
                  </div>
                ) : null}

                {/* The hybrids only. Category 08 has no AI half to offer. */}
                {!isVoice && computed.aiPayloadPreview ? (
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <p className="text-sm font-medium text-gray-900">{t.payloadTitle}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{t.payloadNote}</p>
                    <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs text-gray-700">
                      {computed.aiPayloadPreview}
                    </pre>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button onClick={runGenerate} disabled={busy !== null}>
                        {busy === "generate" ? (
                          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Sparkles className="mr-1.5 h-4 w-4" aria-hidden="true" />
                        )}
                        {busy === "generate" ? t.generating : t.writeUpBtn}
                      </Button>
                      <span className="text-xs text-gray-500">{t.writeUpHint}</span>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {result ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <span className="text-sm font-medium text-gray-900">{t.resultTitle}</span>
                <Button variant="ghost" size="sm" onClick={() => copy(result.output)}>
                  {copied ? (
                    <Check className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Copy className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {copied ? t.copied : t.copyBtn}
                </Button>
              </CardHeader>
              <CardContent>
                {result.cached ? (
                  <p className="mb-3 text-xs text-gray-500">{t.cachedNote}</p>
                ) : null}
                <pre className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
                  {result.output}
                </pre>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
