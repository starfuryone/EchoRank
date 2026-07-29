"use client";

// The AI Lens result, shared by the tool page and the compact panel inside the
// /visibility audit. `compact` drops the fetch detail and trims the missing list
// — the /visibility placement is a teaser for the full tool, not a second copy
// of it.
//
// Zero invented numbers: every figure is a field of the stored analysis.

import Link from "next/link";
import { AlertCircle, CheckCircle2, FileText, ScanEye } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AI_LENS_COPY, type AiLensCopy, type DashLocale } from "@/lib/i18n/dashboard";
import type { AiLensVerdict } from "@/lib/ai-lens/options";
import type { AiLensAnalysisDto } from "@/lib/ai-lens/types";

/** Verdict -> the three colour treatments. Tailwind needs literal classes. */
const VERDICT_STYLE: Record<
  AiLensVerdict,
  { band: string; text: string; ring: string; bar: string }
> = {
  readable: {
    band: "border-emerald-200 bg-emerald-50",
    text: "text-emerald-800",
    ring: "text-emerald-600",
    bar: "bg-emerald-500",
  },
  partial: {
    band: "border-amber-200 bg-amber-50",
    text: "text-amber-900",
    ring: "text-amber-600",
    bar: "bg-amber-500",
  },
  substantial: {
    band: "border-red-200 bg-red-50",
    text: "text-red-900",
    ring: "text-red-600",
    bar: "bg-red-500",
  },
};

function verdictCopy(verdict: AiLensVerdict, t: AiLensCopy) {
  if (verdict === "substantial") {
    return { label: t.verdictSubstantial, body: t.verdictSubstantialBody };
  }
  if (verdict === "partial") return { label: t.verdictPartial, body: t.verdictPartialBody };
  return { label: t.verdictReadable, body: t.verdictReadableBody };
}

/** Gap gauge: an arc filled to the gap, so 0% reads as an empty ring. */
function GapGauge({ gap, verdict }: { gap: number; verdict: AiLensVerdict }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const filled = Math.min(Math.max(gap, 0), 100) / 100;
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
        <g transform="rotate(-90 50 50)">
          <circle cx={50} cy={50} r={r} fill="none" stroke="#f3f4f6" strokeWidth={9} />
          <circle
            cx={50}
            cy={50}
            r={r}
            fill="none"
            className={VERDICT_STYLE[verdict].ring}
            stroke="currentColor"
            strokeWidth={9}
            strokeLinecap="round"
            strokeDasharray={`${(c * filled).toFixed(1)} ${c.toFixed(1)}`}
          />
        </g>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-2xl font-bold ${VERDICT_STYLE[verdict].ring}`}>
          {formatGap(gap)}%
        </span>
      </div>
    </div>
  );
}

/** One decimal, but never "0.0" — a clean page should read as a flat 0. */
function formatGap(gap: number): string {
  return Number.isInteger(gap) ? String(gap) : gap.toFixed(1);
}

function WordCounts({ analysis, t }: { analysis: AiLensAnalysisDto; t: AiLensCopy }) {
  // The sidecar's own count, not renderedWordCount - rawWordCount: a raw fetch
  // can carry content the browser drops, so the subtraction understates the gap
  // and would contradict the headline percentage.
  const missing = analysis.missingWordCount;
  const cells = [
    { label: t.wordsRaw, value: analysis.rawWordCount, tone: "text-gray-900" },
    { label: t.wordsRendered, value: analysis.renderedWordCount, tone: "text-gray-900" },
    { label: t.wordsMissing, value: missing, tone: missing > 0 ? "text-red-600" : "text-gray-400" },
  ];
  return (
    <dl className="grid grid-cols-3 gap-3">
      {cells.map((cell) => (
        <div key={cell.label} className="rounded-lg border border-gray-200 px-3 py-2">
          <dt className="text-xs text-gray-500">{cell.label}</dt>
          <dd className={`mt-0.5 text-lg font-semibold ${cell.tone}`}>
            {cell.value.toLocaleString()}
            <span className="ml-1 text-xs font-normal text-gray-400">{t.wordsUnit}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function AiLensResult({
  analysis,
  locale,
  compact = false,
  cached = false,
}: {
  analysis: AiLensAnalysisDto;
  locale: DashLocale;
  compact?: boolean;
  cached?: boolean;
}) {
  const t = AI_LENS_COPY[locale];
  const style = VERDICT_STYLE[analysis.verdict];
  const { label, body } = verdictCopy(analysis.verdict, t);
  const blocks = compact ? analysis.missingBlocks.slice(0, 3) : analysis.missingBlocks;
  const hidden =
    analysis.missingBlocksTruncated + (compact ? Math.max(analysis.missingBlocks.length - 3, 0) : 0);

  return (
    <div className="space-y-4">
      {/* Headline */}
      <div className={`flex flex-wrap items-center gap-5 rounded-xl border px-5 py-4 ${style.band}`}>
        <GapGauge gap={analysis.gapPercent} verdict={analysis.verdict} />
        <div className="min-w-0 flex-1">
          <p className={`text-base font-semibold ${style.text}`}>
            {analysis.gapPercent === 0
              ? t.gapHeadlineClean
              : t.gapHeadline(formatGap(analysis.gapPercent))}
          </p>
          <p className={`mt-1 text-sm font-medium ${style.text}`}>{label}</p>
          <p className="mt-1 text-sm text-gray-600">{body}</p>
        </div>
      </div>

      {cached && <p className="text-xs text-gray-500">{t.cachedNote}</p>}

      <WordCounts analysis={analysis} t={t} />

      {/* Missing content */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            {analysis.missingBlocks.length === 0 ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-500" aria-hidden="true" />
            )}
            <h3 className="text-base font-semibold text-gray-900">{t.missingTitle}</h3>
          </div>
          {analysis.missingBlocks.length > 0 && (
            <p className="mt-1 text-sm text-gray-500">{t.missingIntro}</p>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {analysis.missingBlocks.length === 0 ? (
            <p className="px-6 pb-5 text-sm text-gray-600">{t.missingEmpty}</p>
          ) : (
            <>
              <ul className="divide-y divide-gray-100">
                {blocks.map((block, i) => (
                  <li key={`${block.approx_location}-${i}`} className="px-6 py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-xs font-medium text-gray-500">
                        {t.missingUnder(block.approx_location)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {t.missingWords(block.word_count)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-gray-800">
                      {block.text_excerpt}
                    </p>
                  </li>
                ))}
              </ul>
              {hidden > 0 && (
                <p className="px-6 py-3 text-xs text-gray-500">{t.missingTruncated(hidden)}</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Fetch detail — full page only */}
      {!compact && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-400" aria-hidden="true" />
              <h3 className="text-base font-semibold text-gray-900">{t.metaTitle}</h3>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Detail label={t.metaRawStatus} value={String(analysis.meta.raw_status)} />
              <Detail label={t.metaRenderStatus} value={String(analysis.meta.rendered_status)} />
              <Detail
                label={t.metaRenderTime}
                value={t.seconds((analysis.meta.rendered_ms / 1000).toFixed(1))}
              />
              <Detail label={t.metaCrawler} value="GPTBot" />
            </dl>
            {analysis.meta.raw_flags?.noindex && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {t.metaNoindex}
              </p>
            )}
            {analysis.meta.redirects?.length > 0 && (
              <p className="text-xs text-gray-500">
                {t.metaRedirected(analysis.meta.redirects[analysis.meta.redirects.length - 1])}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {compact && (
        <Link
          href="/visibility/tools/ai-lens"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          <ScanEye className="h-4 w-4" aria-hidden="true" />
          {AI_LENS_COPY[locale].formTitle}
        </Link>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5 font-mono text-sm text-gray-800">{value}</dd>
    </div>
  );
}
