"use client";

// src/components/seo-tools/competitor-explain.tsx
//
// "Why are they winning?" — the rival picker, the confirm dialog that states
// the cost BEFORE the first run, and the report view.
//
// ── The confirm dialog is not a courtesy ───────────────────────────────────
// A run spends real money on the customer's monthly data budget. The estimate
// it shows comes from the route, which prices what the run will ACTUALLY buy
// (one domain or two, Places or not) rather than quoting a fixed number — see
// estimateRunCost in src/lib/explain/cost.ts. Nothing is bought until the
// customer clicks through it.
//
// ── Every factor renders, including the unmeasured ones ────────────────────
// An unmeasured factor is shown with its reason, in its own section, never
// hidden. "We did not measure this" and "you are level here" are opposite
// findings and a reader must be able to tell them apart. See the note in
// src/lib/explain/types.ts.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Search, FileDown, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EXPLAIN_COPY, type DashLocale } from "@/lib/i18n/dashboard";
// window.ts, NOT store.ts: store.ts imports Prisma and this is a client
// component. See the note at the top of window.ts.
import { EXPLAIN_RERUN_DAYS } from "@/lib/explain/window";
import { FACTOR_UNIT, fixHref } from "@/lib/explain/labels";
import type { ExplainFactor, ExplainReportView, FactorKey } from "@/lib/explain/types";

interface Rival {
  name: string;
  suggestedDomain: string | null;
  citations: number;
}

interface Probe {
  available: boolean;
  brandProfileId?: string;
  brandName?: string;
  rivals: Rival[];
  estimate?: { totalUsd: number; meteredUsd: number };
}

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in values ? String(values[key]) : match,
  );
}

/** The factor's own unit, formatted. Mirrors the PDF builder's `_fmt` so the
 *  two renderings of one stored report cannot disagree about a number. */
function formatValue(value: number | null, factor: FactorKey, locale: string): string {
  if (value === null) return "—";
  const unit = FACTOR_UNIT[factor];
  if (unit === "stars") return value.toFixed(1);
  if (unit === "points") return `${value.toFixed(1)}%`;
  return Math.round(value).toLocaleString(locale);
}

export function CompetitorExplain({
  locale,
  brandProfileId,
}: {
  locale: DashLocale;
  brandProfileId: string | null;
}) {
  const t = EXPLAIN_COPY[locale];
  const intlLocale = locale === "de-CH" ? "de-CH" : locale;

  const [probe, setProbe] = useState<Probe | null>(null);
  const [selected, setSelected] = useState<Rival | null>(null);
  const [domain, setDomain] = useState("");
  const [report, setReport] = useState<ExplainReportView | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "error">("idle");

  useEffect(() => {
    let alive = true;
    const query = brandProfileId ? `?brandProfileId=${encodeURIComponent(brandProfileId)}` : "";
    fetch(`/api/intelligence/explain${query}`)
      .then((res) => (res.ok ? res.json() : { available: false, rivals: [] }))
      // A 401/403 here is the ordinary answer for a tenant below GROWTH: the
      // section simply does not render, and the page's own upgrade state has
      // already said why.
      .catch(() => ({ available: false, rivals: [] }))
      .then((data) => alive && setProbe(data as Probe));
    return () => {
      alive = false;
    };
  }, [brandProfileId]);

  const open = useCallback((rival: Rival) => {
    setSelected(rival);
    setDomain(rival.suggestedDomain ?? "");
    setStatus("idle");
  }, []);

  // Read off `probe` once, outside the callback: depending on
  // `probe?.brandProfileId` inside it makes the React Compiler infer `probe`
  // as the dependency, which it then refuses to memoize.
  const profileId = probe?.brandProfileId;

  const run = useCallback(async () => {
    if (!selected || !domain.trim()) return;
    setStatus("running");
    try {
      const res = await fetch("/api/intelligence/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandProfileId: profileId,
          rivalName: selected.name,
          rivalDomain: domain.trim(),
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { report: ExplainReportView };
      setReport(data.report);
      setSelected(null);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }, [selected, domain, profileId]);

  const measured = useMemo(
    () => (report?.factors ?? []).filter((factor) => !factor.unavailable),
    [report],
  );
  const unmeasured = useMemo(
    () => (report?.factors ?? []).filter((factor) => factor.unavailable),
    [report],
  );
  const behind = measured.filter((factor) => (factor.gap ?? 0) > 0);

  if (!probe?.available) return null;

  // ── Report view ──────────────────────────────────────────────────────────
  if (report) {
    return (
      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => setReport(null)}
              className="mb-2 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
            >
              <ArrowLeft className="h-3 w-3" aria-hidden="true" focusable="false" />
              {t.buttonLabel}
            </button>
            <h2 className="text-base font-semibold text-gray-900">
              {fill(t.reportTitle, { rival: report.rivalName })}
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              {report.cached
                ? fill(t.cachedNote, {
                    date: new Date(report.createdAt).toLocaleDateString(intlLocale),
                    rerun: new Date(report.rerunAllowedAt).toLocaleDateString(intlLocale),
                  })
                : fill(t.freshNote, { cost: `$${report.costUsd.toFixed(4)}` })}
            </p>
          </div>
          <PdfButton label={t.downloadPdf} rivalDomain={report.rivalDomain} />
        </div>

        <p className="mb-4 text-sm text-gray-700">
          {measured.length === 0
            ? t.verdictNothing
            : behind.length === 0
              ? t.verdictLevel
              : fill(t.verdictBehind, { behind: behind.length, measured: measured.length })}
        </p>

        {measured.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="py-2 pr-3 font-medium">{t.columnFactor}</th>
                  <th className="py-2 pr-3 text-right font-medium">{t.columnThem}</th>
                  <th className="py-2 pr-3 text-right font-medium">{t.columnYou}</th>
                  <th className="py-2 text-right font-medium">{t.columnGap}</th>
                </tr>
              </thead>
              <tbody>
                {measured.map((factor) => (
                  <FactorRow
                    key={factor.factor}
                    factor={factor}
                    t={t}
                    intlLocale={intlLocale}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {unmeasured.length > 0 && (
          <div className="mt-6 border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-gray-900">{t.notMeasuredTitle}</h3>
            <p className="mt-1 text-xs text-gray-500">{t.notMeasuredBody}</p>
            <ul className="mt-3 space-y-2">
              {unmeasured.map((factor) => (
                <li key={factor.factor} className="text-sm">
                  <span className="font-medium text-gray-700">{t.factor[factor.factor]}</span>
                  <span className="text-gray-500">
                    {" — "}
                    {factor.unavailable ? t.unavailable[factor.unavailable] : factor.detail}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    );
  }

  // ── Picker + confirm ─────────────────────────────────────────────────────
  return (
    <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="text-base font-semibold text-gray-900">{t.buttonLabel}</h2>

      <ul className="mt-3 divide-y divide-gray-100">
        {probe.rivals.map((rival) => (
          <li key={rival.name} className="flex items-center justify-between gap-4 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">{rival.name}</p>
              {rival.suggestedDomain && (
                <p className="truncate font-mono text-[11px] text-gray-400">
                  {rival.suggestedDomain}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="flex-none"
              onClick={() => open(rival)}
              aria-label={fill(t.buttonHint, { rival: rival.name })}
            >
              <Search className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" focusable="false" />
              {t.buttonLabel}
            </Button>
          </li>
        ))}
      </ul>

      {selected && (
        <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4">
          <h3 className="text-sm font-semibold text-gray-900">
            {fill(t.confirmTitle, { rival: selected.name })}
          </h3>
          <p className="mt-1 text-xs text-gray-600">{t.confirmBody}</p>

          <label className="mt-3 block text-xs font-medium text-gray-700" htmlFor="explain-domain">
            {t.confirmDomainLabel}
          </label>
          <input
            id="explain-domain"
            type="text"
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            placeholder="example.com"
            className="mt-1 w-full rounded border border-gray-300 px-2.5 py-1.5 font-mono text-sm"
          />
          <p className="mt-1 text-[11px] text-gray-500">{t.confirmDomainHint}</p>

          <p className="mt-3 text-xs text-gray-700">
            <span className="font-medium">{t.confirmCostLabel}:</span>{" "}
            {/* The number the route priced for THIS run, not a fixed quote. */}
            <span className="font-mono">${(probe.estimate?.totalUsd ?? 0).toFixed(4)}</span>
          </p>
          <p className="mt-1 text-[11px] text-gray-500">
            {fill(t.confirmCostNote, { days: EXPLAIN_RERUN_DAYS })}
          </p>

          {status === "error" && <p className="mt-2 text-xs text-red-600">{t.error}</p>}

          <div className="mt-4 flex items-center gap-2">
            <Button size="sm" onClick={run} disabled={status === "running" || !domain.trim()}>
              {status === "running" && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" focusable="false" />
              )}
              {status === "running" ? t.running : t.confirmRun}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected(null)}
              disabled={status === "running"}
            >
              {t.confirmCancel}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function FactorRow({
  factor,
  t,
  intlLocale,
}: {
  factor: ExplainFactor;
  t: (typeof EXPLAIN_COPY)[DashLocale];
  intlLocale: string;
}) {
  const href = fixHref(factor.linkedFix);
  const ahead = (factor.gap ?? 0) > 0;

  return (
    <tr className="border-b border-gray-100 align-top">
      <td className="py-2.5 pr-3">
        <span className="font-medium text-gray-900">{t.factor[factor.factor]}</span>
        <span className="mt-0.5 block text-xs text-gray-500">{factor.detail}</span>
        {ahead && href && (
          <Link
            href={href}
            className="mt-1 inline-block text-xs font-medium text-blue-600 hover:underline"
          >
            {t.fixLabel}
          </Link>
        )}
      </td>
      <td className="py-2.5 pr-3 text-right font-mono text-gray-900">
        {formatValue(factor.them, factor.factor, intlLocale)}
      </td>
      <td className="py-2.5 pr-3 text-right font-mono text-gray-500">
        {formatValue(factor.you, factor.factor, intlLocale)}
      </td>
      <td
        className={`py-2.5 text-right font-mono ${ahead ? "text-red-600" : "text-gray-400"}`}
      >
        {formatValue(factor.gap, factor.factor, intlLocale)}
      </td>
    </tr>
  );
}

/** POSTs the stored report to the PDF route and hands the browser the blob.
 *  Separate from ReportDownloadButton because that component probes an
 *  endpoint for {available} on mount; this one already knows a report exists,
 *  and needs to send which rival. */
function PdfButton({ label, rivalDomain }: { label: string; rivalDomain: string }) {
  const [busy, setBusy] = useState(false);

  const download = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/intelligence/explain/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rivalDomain }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `explain-${rivalDomain}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }, [rivalDomain]);

  return (
    <Button variant="outline" size="sm" className="flex-none" onClick={download} disabled={busy}>
      {busy ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" focusable="false" />
      ) : (
        <FileDown className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" focusable="false" />
      )}
      {label}
    </Button>
  );
}
