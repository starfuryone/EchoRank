"use client";

// Phase 4d in the crawl's tabs: one Overview tile per joined source (pages
// with data / pages crawled, and what the source did), and the Pages tab's
// column groups — a toggle per source, each metric column sortable.

import { METRIC_COLUMNS, type MetricSource } from "@/lib/site-crawler/metrics-shared";
import type { SiteCrawler4dCopy } from "@/lib/i18n/site-crawler-4d";

export interface MetricOverview {
  coverage: Partial<Record<MetricSource, number>>;
  total: number;
  /** summary.metrics: what each source did (absent = not attempted). */
  status: Partial<Record<MetricSource, { status: string; stoppedReason?: string; targets?: number; completed?: number }>>;
}

export function sourceLabel(s: MetricSource, t: SiteCrawler4dCopy): string {
  return { gsc: t.srcGsc, psi: t.srcPsi, ga4: t.srcGa4, backlinks: t.srcBacklinks, gsc_inspection: t.srcInspection }[s];
}

/** The tile's note: why there is no data, or how far a post-crawl source got. */
export function statusNote(s: MetricSource, st: MetricOverview["status"][MetricSource], t: SiteCrawler4dCopy, int: Intl.NumberFormat): string | null {
  if (!st) return null;
  switch (st.status) {
    case "ok":
    case "done":
      return null;
    case "not_connected":
      return s === "ga4" ? t.stGa4NotConnected : t.stGscNotConnected;
    case "no_property":
      return s === "ga4" ? t.stGa4NoProperty : t.stGscNoProperty;
    case "not_covered":
      return t.stGscNotCovered;
    case "needs_reauth":
      return t.stReauth;
    case "no_access":
      return t.stGa4NoAccess;
    case "running":
      return t.stRunning(int.format(st.completed ?? 0), int.format((st.targets ?? 0) * (s === "psi" ? 2 : 1)));
    case "waiting_quota":
      return t.stWaitingQuota(int.format(st.completed ?? 0), int.format((st.targets ?? 0) * 2));
    case "stopped":
      if (st.stoppedReason === "daily_quota") return t.stInspectQuota;
      return st.stoppedReason === "usd_cap" ? t.stUsdCap : t.stFailed;
    default:
      return t.stFailed;
  }
}

/** Tiles for the sources this crawl attempted or has data from. */
export function MetricTiles({ data, t, int }: { data: MetricOverview; t: SiteCrawler4dCopy; int: Intl.NumberFormat }) {
  const sources = (["gsc", "psi", "ga4", "backlinks", "gsc_inspection"] as const).filter((s) => data.status[s] || (data.coverage[s] ?? 0) > 0);
  if (sources.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {sources.map((s) => {
        const note = statusNote(s, data.status[s], t, int);
        return (
          <div key={s} className="rounded-lg border border-gray-200 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{sourceLabel(s, t)}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-gray-900">
              {t.tilePages(int.format(data.coverage[s] ?? 0), int.format(data.total))}
            </p>
            {note && <p className="mt-1 text-xs text-gray-500">{note}</p>}
          </div>
        );
      })}
    </div>
  );
}

/** Sources with data on at least one row of this page of results, in display order. */
export function sourcesIn(rows: readonly { metrics?: Partial<Record<MetricSource, unknown>> }[]): MetricSource[] {
  return (["gsc", "psi", "ga4", "backlinks", "gsc_inspection"] as const).filter((s) => rows.some((r) => r.metrics?.[s] !== undefined));
}

export const columnsOf = (shown: readonly MetricSource[]) => METRIC_COLUMNS.filter((c) => shown.includes(c.source));

/** A metric cell: CTR and engagement as %, position to one decimal, the rest as integers (CLS three decimals). */
export function formatMetric(key: string, v: number | null, int: Intl.NumberFormat): string {
  if (v === null) return "—";
  if (key === "gsc.ctr" || key === "ga4.engagementRate") return `${(v * 100).toFixed(1)}%`;
  if (key === "gsc.position") return v.toFixed(1);
  if (key.endsWith(".cls")) return v.toFixed(3);
  return int.format(Math.round(v));
}

export function MetricGroupToggles({
  available,
  shown,
  onToggle,
  t,
}: {
  available: readonly MetricSource[];
  shown: readonly MetricSource[];
  onToggle: (s: MetricSource) => void;
  t: SiteCrawler4dCopy;
}) {
  if (available.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t.columnsLabel}>
      <span className="text-xs text-gray-500">{t.columnsLabel}</span>
      {available.map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={shown.includes(s)}
          onClick={() => onToggle(s)}
          className={
            shown.includes(s)
              ? "rounded-full bg-gray-900 px-3 py-1 text-xs font-medium text-white"
              : "rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:border-gray-300"
          }
        >
          {sourceLabel(s, t)}
        </button>
      ))}
    </div>
  );
}

/** A sortable metric header: click sorts descending, again ascending. */
export function MetricHeader({
  colKey,
  label,
  sort,
  dir,
  onSort,
}: {
  colKey: string;
  label: string;
  sort?: string;
  dir?: "asc" | "desc";
  onSort: (key: string, dir: "asc" | "desc") => void;
}) {
  const active = sort === colKey;
  return (
    <th scope="col" className="py-2 pr-3" aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className="uppercase tracking-wide hover:text-gray-700" onClick={() => onSort(colKey, active && dir === "desc" ? "asc" : "desc")}>
        {label}
        {active ? (dir === "asc" ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );
}
