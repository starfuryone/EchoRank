"use client";

// Agency Opportunity Scanner — the submit form, the batch list, and one
// batch's graded table.
//
// ── A TABLE, not cards ──────────────────────────────────────────────────────
// Citation Opportunities next door is cards because each row carries a
// paragraph somebody has to read. This is the opposite job: a thousand rows a
// salesperson scans down, sorts by, and exports. Six short columns in a table
// is what that wants, and the long-form advice lives in the PDF where it is
// read one prospect at a time.
//
// ── The order comes from the server and is never re-sorted here ─────────────
// listRows() returns F first, then D, C, B, A, then unreachable — see the sort
// note in store.ts. That order IS the product; a client-side sort control would
// let someone put A at the top, which is a list of prospects with nothing to
// sell them.
//
// ── Polling, not websockets ─────────────────────────────────────────────────
// A running batch is polled every POLL_MS while the tab is open and the batch
// is not complete. The interval stops on completion, on unmount, and it never
// starts for a batch that was already complete when it loaded. This is a page
// an agency leaves open on a second monitor while a thousand domains scan, so
// a poll that never stops is a poll that runs all afternoon.
//
// Light mode only, deliberately: this dashboard has no dark theme — there is no
// `darkMode` in the Tailwind config and not one `dark:` class in any sibling
// tool client — so a second set of styles would be unreachable code.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Crosshair, Download, FileText, Loader2, Lock, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  SEO_TOOLS_COPY,
  OPPORTUNITY_SCANNER_COPY,
  type DashLocale,
} from "@/lib/i18n/dashboard";
import { OpportunityScannerHelpButton } from "@/components/seo-tools/opportunity-scanner-help";

type Copy = (typeof OPPORTUNITY_SCANNER_COPY)[DashLocale];

const INTL_LOCALE: Record<DashLocale, string> = {
  en: "en",
  fr: "fr",
  "de-CH": "de-CH",
};

/** Poll cadence for a running batch. */
const POLL_MS = 4_000;

function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_m, key: string) =>
    values[key] === undefined ? "" : String(values[key]),
  );
}

interface Batch {
  id: string;
  status: "running" | "complete";
  total: number;
  done: number;
  placesEnabled: boolean;
  createdAt: string;
  completedAt: string | null;
}

interface Gap {
  category: string;
  status: string;
  recommendation: string;
  lost: number;
}

interface Row {
  id: string;
  domain: string;
  score: number | null;
  grade: string | null;
  topGaps: Gap[];
  place: { name: string; rating: number | null; reviewCount: number | null } | null;
  status: "queued" | "running" | "done" | "failed";
  error: string | null;
}

interface Rejection {
  input: string;
  reason: string;
}

/**
 * Grade colour. NEVER COLOUR ALONE — the letter is always present beside it,
 * so a red F and an amber D are still distinguishable to a reader who cannot
 * tell them apart by hue.
 */
const GRADE_CLASS: Record<string, string> = {
  F: "bg-red-100 text-red-800 ring-red-200",
  D: "bg-orange-100 text-orange-900 ring-orange-200",
  C: "bg-amber-100 text-amber-900 ring-amber-200",
  B: "bg-lime-100 text-lime-900 ring-lime-200",
  A: "bg-green-100 text-green-800 ring-green-200",
};

export function OpportunityScannerClient({
  locale,
  locked,
  maxRows,
}: {
  locale: DashLocale;
  locked: boolean;
  maxRows: number;
}) {
  const copy: Copy = OPPORTUNITY_SCANNER_COPY[locale];
  const item = SEO_TOOLS_COPY[locale].items.opportunity_scanner;
  const nf = new Intl.NumberFormat(INTL_LOCALE[locale]);
  const cf = new Intl.NumberFormat(INTL_LOCALE[locale], { style: "currency", currency: "USD" });

  const [batches, setBatches] = useState<Batch[]>([]);
  const [quota, setQuota] = useState<{ used: number; limit: number } | null>(null);
  const [placesUnitUsd, setPlacesUnitUsd] = useState(0);

  const [openId, setOpenId] = useState<string | null>(null);
  const [openBatch, setOpenBatch] = useState<Batch | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  const [text, setText] = useState("");
  const [placesEnabled, setPlacesEnabled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rejected, setRejected] = useState<Rejection[]>([]);
  const [showRejected, setShowRejected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfFor, setPdfFor] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  // Rough count for the estimate line, computed the cheap way. The server's
  // parse is authoritative and its accepted count comes back on submit; this is
  // only here so the dollar figure moves as you type.
  const approxRows = text
    .split(/[\r\n,;\t|]+/)
    .map((t) => t.trim())
    .filter((t) => t.includes(".")).length;
  const estimate = placesEnabled ? approxRows * placesUnitUsd : 0;

  // ── Fetchers are PURE of state ─────────────────────────────────────────
  // They return data or throw; nothing here calls setState. The effects below
  // own every write, each behind a `cancelled` guard.
  //
  // That split is not lint appeasement. Both of these are raced by design — the
  // poll fires every few seconds and the agency can switch batches mid-flight —
  // so without the guard a slow response for batch A lands after the user has
  // opened batch B and paints A's rows under B's header. The guard is what
  // makes "last request wins" true rather than "last response wins".
  const fetchBatches = useCallback(async () => {
    const res = await fetch("/api/agency/scan", { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }, []);

  const fetchBatch = useCallback(async (id: string) => {
    const res = await fetch(`/api/agency/scan/${id}`, { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }, []);

  // Bumped to force a refresh from outside the effects (after a submit, and on
  // every poll tick). A counter rather than a callback so the effects stay the
  // only writers.
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (locked) return;
    let cancelled = false;
    void (async () => {
      try {
        const json = await fetchBatches();
        if (cancelled) return;
        setBatches(json.batches ?? []);
        setQuota(json.quota ?? null);
        setPlacesUnitUsd(json.placesUnitUsd ?? 0);
      } catch {
        if (!cancelled) setError(copy.errorLoad);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locked, refreshKey, fetchBatches, copy.errorLoad]);

  useEffect(() => {
    if (!openId) return;
    let cancelled = false;
    void (async () => {
      try {
        const json = await fetchBatch(openId);
        if (cancelled) return;
        setOpenBatch(json.batch ?? null);
        setRows(json.rows ?? []);
      } catch {
        if (!cancelled) setError(copy.errorLoad);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [openId, refreshKey, fetchBatch, copy.errorLoad]);

  // The poll. Runs only while the open batch is still running, and clears
  // itself the moment it is not — including on unmount. This page is left open
  // on a second monitor while a thousand domains scan, so a poll that never
  // stops is a poll that runs all afternoon.
  useEffect(() => {
    if (!openId || openBatch?.status !== "running") return;
    const timer = setInterval(() => setRefreshKey((k) => k + 1), POLL_MS);
    return () => clearInterval(timer);
  }, [openId, openBatch?.status]);

  const submit = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    setRejected([]);
    try {
      const res = await fetch("/api/agency/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domains: text, placesEnabled }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? copy.errorSubmit);
        setRejected(json.rejected ?? []);
        return;
      }
      setText("");
      setRejected(json.rejected ?? []);
      setOpenId(json.batch.id);
      setRefreshKey((k) => k + 1);
    } catch {
      setError(copy.errorSubmit);
    } finally {
      setSubmitting(false);
    }
  }, [text, placesEnabled, copy.errorSubmit]);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    // Read to text and drop it in the same box a paste goes into. The server
    // tokenises both identically (parse.ts), so there is no second format to
    // validate and the agency can see and edit what was read.
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ""));
    reader.readAsText(file);
  }, []);

  const downloadPdf = useCallback(async (batchId: string, rowId: string) => {
    setPdfFor(rowId);
    setError(null);
    try {
      const res = await fetch(`/api/agency/scan/${batchId}/rows/${rowId}/report`);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      // Filename from the server's Content-Disposition — it is the one built
      // without a house-brand prefix (see the report route).
      const disposition = res.headers.get("content-disposition") ?? "";
      const match = /filename="?([^"]+)"?/.exec(disposition);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = match?.[1] ?? "ai-visibility-snapshot.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError(copy.errorPdf);
    } finally {
      setPdfFor(null);
    }
  }, [copy.errorPdf]);

  const header = (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">{item.name}</h2>
        <p className="mt-1 text-sm text-gray-500">{item.description}</p>
      </div>
      {!locked && <OpportunityScannerHelpButton locale={locale} />}
    </div>
  );

  // ── Locked (below Agency) ──────────────────────────────────────────────────
  if (locked) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <CardContent>
            <div className="flex flex-col items-center py-14 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                <Lock className="h-7 w-7 text-gray-400" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">{copy.lockedTitle}</h3>
              <p className="mt-2 max-w-md text-sm text-gray-500">{copy.lockedBody}</p>
              <Link
                href="/billing"
                className="mt-6 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {copy.lockedCta}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const quotaExhausted = quota !== null && quota.used >= quota.limit;

  return (
    <div className="space-y-6">
      {header}

      {error && (
        <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
          {error}
        </div>
      )}

      {/* ── Submit ───────────────────────────────────────────────────────── */}
      <Card>
        <CardContent>
          <h3 className="text-base font-semibold text-gray-900">{copy.submitTitle}</h3>

          <label htmlFor="scan-domains" className="mt-4 block text-sm font-medium text-gray-700">
            {copy.submitLabel}
          </label>
          <textarea
            id="scan-domains"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder={copy.submitPlaceholder}
            aria-describedby="scan-help"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <p id="scan-help" className="mt-1 text-xs text-gray-500">
            {copy.submitHelp}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="sr-only"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              {copy.uploadCta}
            </button>
            {approxRows > 0 && (
              <span className="text-xs text-gray-500">
                {approxRows > maxRows
                  ? interpolate(copy.rowCountOver, { count: nf.format(approxRows), max: nf.format(maxRows) })
                  : interpolate(copy.rowCount, { count: nf.format(approxRows) })}
              </span>
            )}
          </div>

          {/* Places opt-in. Unchecked by default; the estimate sits directly
              beneath it so the price and the switch are never separated. */}
          <div className="mt-5 rounded-lg bg-gray-50 p-3 ring-1 ring-gray-200">
            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={placesEnabled}
                onChange={(e) => setPlacesEnabled(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-gray-900">{copy.placesLabel}</span>
                <span className="mt-0.5 block text-xs text-gray-500">{copy.placesHelp}</span>
              </span>
            </label>
            <p className="mt-2.5 text-sm text-gray-700">
              <span className="font-medium">{copy.estimatePrefix}</span>{" "}
              {placesEnabled ? (
                <>
                  <span className="font-semibold text-gray-900">{cf.format(estimate)}</span>{" "}
                  <span className="text-xs text-gray-500">{copy.estimateNote}</span>
                </>
              ) : (
                <span className="text-gray-600">{copy.estimateFree}</span>
              )}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={submitting || approxRows === 0 || quotaExhausted}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Crosshair className="h-4 w-4" aria-hidden="true" />
              )}
              {submitting ? copy.submitting : copy.submitCta}
            </button>
            {/* Read from the API, never hardcoded — the plan number lives in
                quota.ts and nowhere else. */}
            {quota && (
              <span className="text-xs text-gray-500">
                {quotaExhausted
                  ? interpolate(copy.quotaExhausted, { limit: nf.format(quota.limit) })
                  : interpolate(copy.quotaLine, {
                      used: nf.format(quota.used),
                      limit: nf.format(quota.limit),
                    })}
              </span>
            )}
          </div>

          {/* Rejections. Reported, never silently dropped. */}
          {rejected.length > 0 && (
            <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm ring-1 ring-amber-200">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-amber-900">
                  {interpolate(copy.rejectedTitle, { count: nf.format(rejected.length) })}
                </span>
                <button
                  type="button"
                  onClick={() => setShowRejected((v) => !v)}
                  className="text-xs font-medium text-amber-900 underline hover:no-underline"
                >
                  {showRejected ? copy.rejectedHide : copy.rejectedShowAll}
                </button>
              </div>
              {showRejected && (
                <ul className="mt-2 space-y-1">
                  {rejected.map((r, i) => (
                    <li key={`${r.input}-${i}`} className="flex gap-2 text-xs text-amber-900">
                      <code className="min-w-0 truncate font-mono">{r.input || "—"}</code>
                      <span className="shrink-0 text-amber-700">
                        {interpolate(
                          copy.reasons[r.reason as keyof Copy["reasons"]] ?? r.reason,
                          { max: nf.format(maxRows) },
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Batch list ───────────────────────────────────────────────────── */}
      {batches.length === 0 ? (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center py-14 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                <Crosshair className="h-7 w-7 text-gray-400" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">{copy.emptyTitle}</h3>
              <p className="mt-2 max-w-md text-sm text-gray-500">
                {interpolate(copy.emptyBody, { max: nf.format(maxRows) })}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <h3 className="text-base font-semibold text-gray-900">{copy.batchesTitle}</h3>
            <ul className="mt-3 divide-y divide-gray-100">
              {batches.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <span className="text-sm font-medium text-gray-900">
                    {new Date(b.createdAt).toLocaleString(INTL_LOCALE[locale])}
                  </span>
                  <span className="text-sm text-gray-500">
                    {interpolate(copy.batchProgress, {
                      done: nf.format(b.done),
                      total: nf.format(b.total),
                    })}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      b.status === "running" ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-800"
                    }`}
                  >
                    {b.status === "running" ? copy.batchRunning : copy.batchComplete}
                  </span>
                  {b.placesEnabled && (
                    <span className="text-xs text-gray-400">{copy.batchPlaces}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpenId(b.id === openId ? null : b.id)}
                    className="ml-auto text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    {copy.openBatch}
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ── One batch's rows ─────────────────────────────────────────────── */}
      {openId && openBatch && (
        <Card>
          <CardContent>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-gray-500">
                {interpolate(copy.batchProgress, {
                  done: nf.format(openBatch.done),
                  total: nf.format(openBatch.total),
                })}
              </span>
              <a
                href={`/api/agency/scan/${openId}/export`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                {copy.exportCsv}
              </a>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[46rem] text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th scope="col" className="py-2 pr-3 font-medium">{copy.colDomain}</th>
                    <th scope="col" className="py-2 pr-3 font-medium">{copy.colGrade}</th>
                    <th scope="col" className="py-2 pr-3 font-medium">{copy.colScore}</th>
                    <th scope="col" className="py-2 pr-3 font-medium">{copy.colGaps}</th>
                    <th scope="col" className="py-2 pr-3 font-medium">{copy.colGoogle}</th>
                    <th scope="col" className="py-2 font-medium">
                      <span className="sr-only">{copy.outreachPdf}</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2 pr-3 font-medium text-gray-900">{r.domain}</td>
                      <td className="py-2 pr-3">
                        {r.grade ? (
                          <span
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ring-1 ${
                              GRADE_CLASS[r.grade] ?? "bg-gray-100 text-gray-600 ring-gray-200"
                            }`}
                          >
                            {r.grade}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">
                            {r.status === "failed" ? copy.rowFailed : copy.rowPending}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3 tabular-nums text-gray-700">
                        {r.score === null ? "—" : nf.format(r.score)}
                      </td>
                      <td className="py-2 pr-3 text-gray-600">
                        {r.topGaps.map((g) => g.category).join(", ") || "—"}
                      </td>
                      <td className="py-2 pr-3 text-gray-600">
                        {r.place?.rating != null ? (
                          <>
                            {nf.format(r.place.rating)}★
                            {r.place.reviewCount != null && (
                              <span className="ml-1 text-xs text-gray-400">
                                {nf.format(r.place.reviewCount)} {copy.reviewsSuffix}
                              </span>
                            )}
                          </>
                        ) : (
                          copy.noGoogleListing
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => void downloadPdf(openId, r.id)}
                          disabled={r.status !== "done" || pdfFor === r.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                          {pdfFor === r.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                          ) : (
                            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          {pdfFor === r.id ? copy.buildingPdf : copy.outreachPdf}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-gray-500">{copy.methodNote}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
