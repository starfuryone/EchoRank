"use client";

// Phase 4b segment UI for a finished crawl: the segment picker that filters
// every tab, total and CSV, and the Overview's per-segment table.

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import type { SiteCrawlerCopy } from "@/lib/i18n/dashboard";
import type { SegmentOverviewDto } from "@/lib/site-crawler/types";

/** "" = every page; otherwise a segment index. */
export function SegmentPicker({
  names,
  value,
  onChange,
  t,
}: {
  names: string[];
  value: string;
  onChange: (v: string) => void;
  t: SiteCrawlerCopy;
}) {
  if (names.length === 0) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-gray-600">{t.p4b.segFilter}</span>
      <Select
        aria-label={t.p4b.segFilter}
        className="w-auto"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        options={[{ value: "", label: t.p4b.segAll }, ...names.map((n, i) => ({ value: String(i), label: n }))]}
      />
    </div>
  );
}

export function SegmentOverview({
  segments,
  segment,
  onPick,
  t,
  int,
}: {
  segments?: SegmentOverviewDto[];
  segment?: { name: string; pages: number };
  onPick: (index: string) => void;
  t: SiteCrawlerCopy;
  int: Intl.NumberFormat;
}) {
  if (segment) return <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{t.p4b.segShowing(segment.name, int.format(segment.pages))}</p>;
  if (!segments?.length) return null;
  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-semibold text-gray-900">{t.p4b.segOverviewTitle}</h3>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-gray-400">
            <tr>
              <th className="py-2 pr-3">{t.p4b.segFilter}</th>
              <th className="py-2 pr-3 text-right">{t.p4b.segColPages}</th>
              <th className="py-2 pr-3 text-right">{t.summaryErrors}</th>
              <th className="py-2 pr-3 text-right">{t.summaryWarnings}</th>
              <th className="py-2 text-right">{t.summaryNotices}</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((s) => (
              <tr key={s.index} className="border-t border-gray-100">
                <td className="py-2 pr-3">
                  <button type="button" className="font-medium text-blue-700 hover:underline" onClick={() => onPick(String(s.index))}>
                    {s.name}
                  </button>
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{int.format(s.pages)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{int.format(s.totals.ERROR)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{int.format(s.totals.WARNING)}</td>
                <td className="py-2 text-right tabular-nums">{int.format(s.totals.NOTICE)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
