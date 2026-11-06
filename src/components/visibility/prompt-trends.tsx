"use client";

import { useEffect, useState } from "react";
import {
  PROMPT_TRENDS_COPY,
  type DashLocale,
  type PromptTrendsCopy,
} from "@/lib/i18n/dashboard";

type Point = { d: string; m: boolean; r: number | null };
type ModelChange = { d: string; from: string; to: string };
type Series = {
  promptId: string;
  text: string;
  active: boolean;
  points: Point[];
  /** Days a Claude answer came from a different model than the run before. */
  modelChanges?: ModelChange[];
};

/** Mention rate (%) over the given points; null if empty. */
function rate(points: Point[]): number | null {
  if (points.length === 0) return null;
  return Math.round((points.filter((p) => p.m).length / points.length) * 100);
}

/** Hand-rolled SVG strip: one bar per day. Mentioned = green (taller = better
 *  rank), absent = short gray tick. No chart lib needed for this density. */
function Sparkline({
  points,
  modelChanges = [],
  days,
  t,
}: {
  points: Point[];
  modelChanges?: ModelChange[];
  days: number;
  t: PromptTrendsCopy;
}) {
  const W = 180;
  const H = 28;
  const bw = Math.max(1, Math.floor(W / days) - 1);
  const byDay = new Map(points.map((p) => [p.d, p]));
  const today = new Date();
  const bars = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const p = byDay.get(d);
    const x = ((days - 1 - i) / days) * W;
    if (!p) {
      bars.push(<rect key={d} x={x} y={H - 2} width={bw} height={2} fill="#e5e7eb" />);
    } else if (p.m) {
      // rank 1 → full height; rank ≥6 or unknown → 40%
      const h = p.r ? Math.max(0.4, 1 - (Math.min(p.r, 6) - 1) * 0.12) * H : 0.6 * H;
      bars.push(
        <rect key={d} x={x} y={H - h} width={bw} height={h} fill="#10b981" rx={1}>
          <title>{t.mentionedTooltip(d, p.r)}</title>
        </rect>,
      );
    } else {
      bars.push(
        <rect key={d} x={x} y={H - 6} width={bw} height={6} fill="#d1d5db" rx={1}>
          <title>{t.notMentionedTooltip(d)}</title>
        </rect>,
      );
    }
  }
  // A dashed rule at the start of each day the Claude model changed, so a
  // step in the bars is not read as the market moving.
  const markers = modelChanges.flatMap((change) => {
    const i = Math.round((Date.parse(today.toISOString().slice(0, 10)) - Date.parse(change.d)) / 86_400_000);
    if (i < 0 || i >= days) return [];
    const x = ((days - 1 - i) / days) * W;
    return [
      <line
        key={`model-${change.d}`}
        data-testid="model-change-marker"
        x1={x}
        x2={x}
        y1={0}
        y2={H}
        stroke="#6366f1"
        strokeWidth={1}
        strokeDasharray="2 2"
      >
        <title>{t.modelChangedTooltip(change.d, change.from, change.to)}</title>
      </line>,
    ];
  });
  return (
    <svg width={W} height={H} className="shrink-0" aria-hidden="true">
      {bars}
      {markers}
    </svg>
  );
}

/** The text half of the marker: the sparkline itself is aria-hidden. */
function ModelChangedNote({ changes, t }: { changes?: ModelChange[]; t: PromptTrendsCopy }) {
  const last = changes?.[changes.length - 1];
  if (!last) return null;
  return (
    <span className="text-xs text-indigo-600" title={t.modelChangedTooltip(last.d, last.from, last.to)}>
      {t.modelChanged}
    </span>
  );
}

function TrendChip({ points, t }: { points: Point[]; t: PromptTrendsCopy }) {
  const cut = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const recent = rate(points.filter((p) => p.d >= cut));
  const prior = rate(points.filter((p) => p.d < cut));
  if (recent === null) {
    return <span className="text-xs text-gray-400">{t.noRunsYet}</span>;
  }
  const delta = prior === null ? 0 : recent - prior;
  const cls =
    delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-600" : "text-gray-500";
  const arrow = delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
  return (
    <span className={`text-xs font-medium ${cls}`}>
      {recent}% {arrow}
      {prior !== null && delta !== 0 ? ` ${Math.abs(delta)}` : ""}
    </span>
  );
}

export function PromptTrends({ locale = "en" }: { locale?: DashLocale }) {
  const t = PROMPT_TRENDS_COPY[locale];
  const [data, setData] = useState<{ days: number; series: Series[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ai/visibility/prompts/history?days=90")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setData)
      .catch(() => setError(t.loadFailed));
  }, [t]);

  if (error) return null; // non-critical section; fail silent
  if (!data) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-400">
        {t.loading}
      </div>
    );
  }
  const visible = data.series.filter((s) => s.active || s.points.length > 0);
  if (visible.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">{t.title(data.days)}</h3>
      </div>
      <ul className="divide-y divide-gray-100">
        {visible.map((s) => (
          <li key={s.promptId} className="flex items-center gap-4 px-4 py-3">
            <span className="min-w-0 flex-1 truncate text-sm text-gray-700" title={s.text}>
              {s.text}
            </span>
            <TrendChip points={s.points} t={t} />
            <ModelChangedNote changes={s.modelChanges} t={t} />
            <Sparkline points={s.points} modelChanges={s.modelChanges} days={data.days} t={t} />
          </li>
        ))}
      </ul>
    </div>
  );
}
