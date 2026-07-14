"use client";

import { useEffect, useState } from "react";

type Point = { d: string; m: boolean; r: number | null };
type Series = { promptId: string; text: string; active: boolean; points: Point[] };

/** Mention rate (%) over the given points; null if empty. */
function rate(points: Point[]): number | null {
  if (points.length === 0) return null;
  return Math.round((points.filter((p) => p.m).length / points.length) * 100);
}

/** Hand-rolled SVG strip: one bar per day. Mentioned = green (taller = better
 *  rank), absent = short gray tick. No chart lib needed for this density. */
function Sparkline({ points, days }: { points: Point[]; days: number }) {
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
          <title>{`${d} — mentioned${p.r ? ` #${p.r}` : ""}`}</title>
        </rect>,
      );
    } else {
      bars.push(
        <rect key={d} x={x} y={H - 6} width={bw} height={6} fill="#d1d5db" rx={1}>
          <title>{`${d} — not mentioned`}</title>
        </rect>,
      );
    }
  }
  return (
    <svg width={W} height={H} className="shrink-0" aria-hidden="true">
      {bars}
    </svg>
  );
}

function TrendChip({ points }: { points: Point[] }) {
  const cut = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const recent = rate(points.filter((p) => p.d >= cut));
  const prior = rate(points.filter((p) => p.d < cut));
  if (recent === null) {
    return <span className="text-xs text-gray-400">no runs yet</span>;
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

export function PromptTrends() {
  const [data, setData] = useState<{ days: number; series: Series[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ai/visibility/prompts/history?days=90")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setData)
      .catch(() => setError("Could not load prompt history."));
  }, []);

  if (error) return null; // non-critical section; fail silent
  if (!data) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-400">
        Loading prompt trends…
      </div>
    );
  }
  const visible = data.series.filter((s) => s.active || s.points.length > 0);
  if (visible.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">
          Mention trend — last {data.days} days
        </h3>
      </div>
      <ul className="divide-y divide-gray-100">
        {visible.map((s) => (
          <li key={s.promptId} className="flex items-center gap-4 px-4 py-3">
            <span className="min-w-0 flex-1 truncate text-sm text-gray-700" title={s.text}>
              {s.text}
            </span>
            <TrendChip points={s.points} />
            <Sparkline points={s.points} days={data.days} />
          </li>
        ))}
      </ul>
    </div>
  );
}
