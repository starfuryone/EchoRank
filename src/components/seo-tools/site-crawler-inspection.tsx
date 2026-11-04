"use client";

// Index status on the start card (Phase 4g): Search Console URL Inspection
// for the crawl's top N pages, offered only when the tenant's GSC property
// covers the host. Counts against Google's 2,000 inspections a day per
// property; the step stops at that limit and the crawl says so.

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { SiteCrawler4dCopy } from "@/lib/i18n/site-crawler-4d";
import type { SiteCrawler4gCopy } from "@/lib/i18n/site-crawler-4g";
import type { TopPages } from "@/lib/site-crawler/crawl-config";

export function InspectionSection({
  t,
  t4d,
  host,
  cap,
  value,
  segments,
  int,
  disabled,
  onChange,
}: {
  t: SiteCrawler4gCopy;
  t4d: SiteCrawler4dCopy;
  host: string | null;
  cap: number;
  value: TopPages | null;
  segments: string[];
  int: Intl.NumberFormat;
  disabled: boolean;
  onChange: (v: TopPages | null) => void;
}) {
  const [covers, setCovers] = useState<{ host: string; covers: boolean } | null>(null);
  useEffect(() => {
    if (!host) return;
    let cancelled = false;
    void fetch(`/api/seo/v1/crawl/sources?host=${encodeURIComponent(host)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { gsc?: { covers?: boolean } | null } | null) => {
        if (!cancelled) setCovers({ host, covers: Boolean(d?.gsc?.covers) });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [host]);
  const ok = Boolean(host && covers?.host === host && covers.covers);

  // The opt-in cannot outlive the coverage it needs (another host typed in).
  useEffect(() => {
    if (!ok && value) onChange(null);
  }, [ok, value, onChange]);

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm text-gray-800">
        <input
          type="checkbox"
          checked={value !== null}
          disabled={disabled || cap <= 0 || !ok}
          onChange={(e) => onChange(e.target.checked ? { pages: Math.min(50, cap), segment: null } : null)}
        />
        {t.insOn(int.format(cap))}
      </label>
      <p className="pl-6 text-xs text-gray-500">{t.insHelp}</p>
      <p className={ok ? "pl-6 text-xs text-gray-500" : "pl-6 text-xs text-amber-700"}>{ok ? t.insQuota : t.insNotCovered}</p>
      {value && (
        <div className="flex flex-wrap items-end gap-3 pl-6">
          <div className="w-24">
            <label htmlFor="ins-pages" className="mb-1 block text-xs font-medium text-gray-700">
              {t4d.pagesLabel}
            </label>
            <Input
              id="ins-pages"
              inputMode="numeric"
              value={String(value.pages)}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, pages: Math.max(1, Math.min(cap, Number(e.target.value.replace(/\D/g, "")) || 1)) })}
            />
          </div>
          <div className="w-72">
            <Select
              id="ins-by"
              label={t4d.byLabel}
              value={value.segment === null ? "" : String(value.segment)}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, segment: e.target.value === "" ? null : Number(e.target.value) })}
              options={[{ value: "", label: t4d.byInlinks }, ...segments.map((name, i) => ({ value: String(i), label: t4d.bySegment(name) }))]}
            />
          </div>
        </div>
      )}
    </div>
  );
}
