"use client";

// "Add data" on the start card (Phase 4d): the post-crawl opt-ins, each on
// the crawl's top N pages by inlinks (optionally inside one saved segment),
// N capped by the plan. Their cost is shown here and again in the confirm
// step before the crawl starts.

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { flag } from "@/lib/flags";
import type { SiteCrawler4dCopy } from "@/lib/i18n/site-crawler-4d";
import type { AddData, TopPages } from "@/lib/site-crawler/crawl-config";

export interface AddDataQuota {
  psiCap: number;
  lighthouseUsed: number;
  lighthouseLimit: number;
  backlinkCap: number;
  backlinkUnitUsd: number;
  seoBudgetLeftUsd: number;
}

const usd = (n: number, digits = 2) => `$${n.toFixed(digits)}`;
/** N × the last metered unit cost. */
export const backlinkCost = (top: TopPages | null, unit: number) => (top ? top.pages * unit : 0);

/** Lighthouse runs a PSI opt-in takes: mobile + desktop per page. */
export const psiRuns = (top: TopPages | null) => (top ? top.pages * 2 : 0);

/** The value with one source replaced; null once neither is on. */
export function withSource(value: AddData | null, key: keyof AddData, top: TopPages | null): AddData | null {
  const next: AddData = { psi: value?.psi ?? null, backlinks: value?.backlinks ?? null, [key]: top };
  return next.psi || next.backlinks ? next : null;
}

function TopPicker({
  id,
  t,
  label,
  cap,
  value,
  segments,
  disabled,
  onChange,
}: {
  id: string;
  t: SiteCrawler4dCopy;
  label: string;
  cap: number;
  value: TopPages | null;
  segments: string[];
  disabled: boolean;
  onChange: (v: TopPages | null) => void;
}) {
  const on = value !== null;
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm text-gray-800">
        <input
          type="checkbox"
          checked={on}
          disabled={disabled || cap <= 0}
          onChange={(e) => onChange(e.target.checked ? { pages: Math.min(10, cap), segment: null } : null)}
        />
        {label}
      </label>
      {on && (
        <div className="flex flex-wrap items-end gap-3 pl-6">
          <div className="w-24">
            <label htmlFor={`${id}-pages`} className="mb-1 block text-xs font-medium text-gray-700">
              {t.pagesLabel}
            </label>
            <Input
              id={`${id}-pages`}
              inputMode="numeric"
              value={String(value.pages)}
              disabled={disabled}
              onChange={(e) => {
                const n = Math.max(1, Math.min(cap, Number(e.target.value.replace(/\D/g, "")) || 1));
                onChange({ ...value, pages: n });
              }}
            />
          </div>
          <div className="w-72">
            <Select
              id={`${id}-by`}
              label={t.byLabel}
              value={value.segment === null ? "" : String(value.segment)}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, segment: e.target.value === "" ? null : Number(e.target.value) })}
              options={[{ value: "", label: t.byInlinks }, ...segments.map((name, i) => ({ value: String(i), label: t.bySegment(name) }))]}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function AddDataSection({
  t,
  host,
  quota,
  value,
  onChange,
  disabled = false,
  children,
}: {
  t: SiteCrawler4dCopy;
  /** The start URL's host, for its saved segments. */
  host: string | null;
  quota: AddDataQuota;
  value: AddData | null;
  onChange: (v: AddData | null) => void;
  disabled?: boolean;
  /** Later opt-ins and the source status lines. */
  children?: React.ReactNode;
}) {
  const [segments, setSegments] = useState<{ host: string; names: string[] } | null>(null);
  useEffect(() => {
    if (!host || !flag("crawl.segments")) return;
    let cancelled = false;
    void fetch(`/api/seo/v1/crawl/segments?host=${encodeURIComponent(host)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { segments?: { name: string }[] } | null) => {
        if (!cancelled) setSegments({ host, names: (d?.segments ?? []).map((s) => s.name) });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [host]);
  const names = segments?.host === host ? segments.names : [];
  const left = Math.max(0, quota.lighthouseLimit - quota.lighthouseUsed);

  return (
    <section className="mt-4 space-y-3 rounded-lg border border-gray-100 p-3" aria-labelledby="crawl-add-data-title">
      <h4 id="crawl-add-data-title" className="text-sm font-semibold text-gray-900">
        {t.addTitle}
      </h4>
      <p className="text-xs text-gray-500">{t.addHelp}</p>
      {children}
      {flag("crawl.psi") && (
        <div className="space-y-1">
          <TopPicker
            id="add-psi"
            t={t}
            label={t.psiLabel(String(quota.psiCap))}
            cap={quota.psiCap}
            value={value?.psi ?? null}
            segments={names}
            disabled={disabled}
            onChange={(v) => onChange(withSource(value, "psi", v))}
          />
          <p className="pl-6 text-xs text-gray-500">{t.psiQuota(String(left), String(quota.lighthouseLimit))}</p>
          {value?.psi && <p className="pl-6 text-xs text-gray-500">{t.psiNeeds(String(psiRuns(value.psi)))}</p>}
        </div>
      )}
      {flag("crawl.backlinks") && (
        <div className="space-y-1">
          <TopPicker
            id="add-backlinks"
            t={t}
            label={t.blLabel(String(quota.backlinkCap))}
            cap={quota.backlinkCap}
            value={value?.backlinks ?? null}
            segments={names}
            disabled={disabled}
            onChange={(v) => onChange(withSource(value, "backlinks", v))}
          />
          {value?.backlinks && (
            <p className="pl-6 text-xs text-gray-500">
              {t.blEstimate(usd(backlinkCost(value.backlinks, quota.backlinkUnitUsd)), usd(quota.backlinkUnitUsd, 3), usd(quota.seoBudgetLeftUsd))}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/** The confirm step's lines, one per opt-in. */
export function confirmLines(t: SiteCrawler4dCopy, value: AddData, quota: AddDataQuota): string[] {
  const left = Math.max(0, quota.lighthouseLimit - quota.lighthouseUsed);
  return [
    ...(value.psi ? [t.confirmPsi(String(value.psi.pages), String(psiRuns(value.psi)), String(left), String(quota.lighthouseLimit))] : []),
    ...(value.backlinks
      ? [t.confirmBacklinks(String(value.backlinks.pages), usd(backlinkCost(value.backlinks, quota.backlinkUnitUsd)), usd(quota.seoBudgetLeftUsd))]
      : []),
  ];
}
