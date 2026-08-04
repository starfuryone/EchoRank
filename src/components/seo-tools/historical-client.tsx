"use client";

// Historical — SERP movement and page snapshots over time.
//
// EMPTY STATES ARE OPERATIVE. A tenant with no history does not get a picture
// of a chart; they get the capture form (which works immediately) and a link to
// run their first SERP check. The whole tool is worthless on day one unless the
// day-one screen does something, so the empty state IS the primary UI for a new
// tenant rather than a placeholder pointing at a future.
//
// The position chart is inline SVG, matching the rest of the repo — recharts is
// a dependency imported nowhere on the client.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Archive,
  ArrowDown,
  ArrowUp,
  Camera,
  Check,
  History as HistoryIcon,
  Loader2,
  Minus,
  Search,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { diffSerpChecks, type SerpDelta } from "@/lib/historical/serp-delta";
import type { WordDiff } from "@/lib/historical/diff";
import type { HistoricalCheck, HistoricalPageData } from "@/lib/historical/page-data";
import type { SnapshotListItem } from "@/lib/historical/snapshots";
import { MAX_WAYBACK_IMPORT } from "@/lib/historical/options";
import { normalizeSnapshotUrl, rejectionCopyKey } from "@/lib/historical/url";
import { HISTORICAL_COPY, type DashLocale } from "@/lib/i18n/dashboard";

const CTA_CLASS =
  "inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2";

interface Props {
  locale: DashLocale;
  data: HistoricalPageData;
}

interface ApiError {
  error?: string;
  code?: string;
  reason?: string;
}

type Busy = null | "timeline" | "capture" | "compare" | "wayback" | "import";

export function HistoricalClient({ locale, data }: Props) {
  const t = HISTORICAL_COPY[locale];

  const [keywordIdx, setKeywordIdx] = useState<number | null>(data.keywords.length ? 0 : null);
  const [checks, setChecks] = useState<HistoricalCheck[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [domain, setDomain] = useState<string>("");

  const [captureUrl, setCaptureUrl] = useState("");
  const [snapshotUrls, setSnapshotUrls] = useState(data.snapshotUrls);
  const [activeUrl, setActiveUrl] = useState<string | null>(data.snapshotUrls[0]?.url ?? null);
  const [snapshots, setSnapshots] = useState<SnapshotListItem[]>([]);
  const [olderId, setOlderId] = useState("");
  const [newerId, setNewerId] = useState("");
  const [diff, setDiff] = useState<WordDiff | null>(null);

  const [waybackCaptures, setWaybackCaptures] = useState<Array<{ timestamp: string; capturedAt: string }>>([]);
  const [waybackPicked, setWaybackPicked] = useState<string[]>([]);
  const [waybackLookedUp, setWaybackLookedUp] = useState(false);

  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedKeyword = keywordIdx !== null ? data.keywords[keywordIdx] : null;

  const messageFor = useCallback(
    (payload: ApiError): string => {
      switch (payload.code) {
        case "RATE_LIMITED": return t.errRateLimited;
        case "INVALID_URL": {
          const key = rejectionCopyKey(payload.reason as never) as keyof typeof t;
          const copy = t[key];
          return typeof copy === "string" ? copy : t.errInvalidUrl;
        }
        case "SNAPSHOT_TOO_LARGE": return t.errTooLarge;
        case "CAPTURE_BLOCKED": return t.errCaptureBlocked;
        case "ARCHIVE_UNREACHABLE": return t.waybackUnreachable;
        case "CAPTURE_FAILED": return payload.error ?? t.errCapture;
        case "STORAGE_UNAVAILABLE": return t.storageUnavailable;
        case "STORAGE_NOT_CONFIGURED": return t.storageNotConfigured;
        default: return t.errGeneric;
      }
    },
    [t],
  );

  const call = useCallback(
    async <T,>(url: string, body?: unknown): Promise<T | null> => {
      setError(null);
      try {
        const res = await fetch(url, {
          method: body === undefined ? "GET" : "POST",
          ...(body === undefined
            ? {}
            : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
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

  // ── SERP timeline ─────────────────────────────────────────────────────────

  const loadTimeline = useCallback(
    async (idx: number) => {
      const kw = data.keywords[idx];
      if (!kw) return;
      setKeywordIdx(idx);
      setBusy("timeline");
      const params = new URLSearchParams({
        keyword: kw.keyword,
        locationCode: String(kw.locationCode),
        languageCode: kw.languageCode,
        device: kw.device,
      });
      const payload = await call<{ checks: HistoricalCheck[]; domains: string[] }>(
        `/api/ai/visibility/historical/timeline?${params}`,
      );
      if (payload) {
        setChecks(payload.checks);
        setDomains(payload.domains);
        setDomain(payload.domains[0] ?? "");
      }
      setBusy(null);
    },
    [call, data.keywords],
  );

  // Load the first keyword's timeline on mount. Without this the page arrives
  // with a keyword already selected in the dropdown but no chart and no delta
  // table, and the only way to see either is to re-pick the option that is
  // already chosen — which reads as "the tool is broken", not "click here".
  const autoLoaded = useRef(false);
  useEffect(() => {
    if (autoLoaded.current || data.keywords.length === 0) return;
    autoLoaded.current = true;
    void loadTimeline(0);
  }, [data.keywords.length, loadTimeline]);

  const delta: SerpDelta | null = useMemo(() => {
    if (checks.length < 2) return null;
    const older = checks[checks.length - 2];
    const newer = checks[checks.length - 1];
    const toItems = (c: HistoricalCheck) =>
      c.top.map((r) => ({ domain: r.domain, url: r.url, title: r.title, position: r.position, snippet: "" }));
    return diffSerpChecks(toItems(older), toItems(newer));
  }, [checks]);

  const series = useMemo(() => {
    if (!domain) return [];
    return checks.map((c) => ({
      at: c.createdAt,
      position: c.top.find((r) => r.domain === domain)?.position ?? null,
    }));
  }, [checks, domain]);

  // ── Snapshots ─────────────────────────────────────────────────────────────

  const loadSnapshots = useCallback(
    async (url: string) => {
      setActiveUrl(url);
      setDiff(null);
      setOlderId("");
      setNewerId("");
      const payload = await call<{ snapshots: SnapshotListItem[] }>(
        `/api/ai/visibility/historical/list?url=${encodeURIComponent(url)}`,
      );
      if (payload) setSnapshots(payload.snapshots);
    },
    [call],
  );

  const capture = useCallback(async () => {
    const raw = captureUrl.trim();
    if (!raw) return;

    // Same normalizer the route uses, so "cnn.com" is accepted here rather than
    // making a round trip to be told about a scheme the user never typed.
    const normalized = normalizeSnapshotUrl(raw);
    if (!normalized.ok || !normalized.url) {
      const key = rejectionCopyKey(normalized.reason) as keyof typeof t;
      const copy = t[key];
      setError(typeof copy === "string" ? copy : t.errInvalidUrl);
      return;
    }

    setBusy("capture");
    setNotice(null);
    setError(null);
    const payload = await call<{ created: boolean; url: string }>(
      "/api/ai/visibility/historical/capture",
      { url: normalized.url },
    );
    if (payload) {
      const base = payload.created ? t.captureStored : t.captureDuplicate;
      // Only worth saying when we changed what they typed.
      setNotice(payload.url !== raw ? `${base} ${t.captureNormalized(payload.url)}` : base);
      const listed = await call<{ urls: HistoricalPageData["snapshotUrls"] }>(
        "/api/ai/visibility/historical/list",
      );
      if (listed) setSnapshotUrls(listed.urls);
      await loadSnapshots(payload.url);
    }
    setBusy(null);
  }, [call, captureUrl, loadSnapshots, t]);

  const compare = useCallback(async () => {
    if (!olderId || !newerId || olderId === newerId) {
      setError(t.pickTwo);
      return;
    }
    setBusy("compare");
    const payload = await call<{ diff: WordDiff }>(
      `/api/ai/visibility/historical/snapshot/${newerId}?against=${olderId}`,
    );
    if (payload) setDiff(payload.diff);
    setBusy(null);
  }, [call, newerId, olderId, t]);

  // ── Wayback ───────────────────────────────────────────────────────────────

  const lookupWayback = useCallback(async () => {
    const typed = (activeUrl ?? captureUrl).trim();
    if (!typed) return;
    const normalized = normalizeSnapshotUrl(typed);
    if (!normalized.ok || !normalized.url) {
      const key = rejectionCopyKey(normalized.reason) as keyof typeof t;
      const copy = t[key];
      setError(typeof copy === "string" ? copy : t.errInvalidUrl);
      return;
    }
    const url = normalized.url;
    setBusy("wayback");
    setWaybackLookedUp(false);
    const payload = await call<{ captures: Array<{ timestamp: string; capturedAt: string }> }>(
      "/api/ai/visibility/historical/wayback",
      { url },
    );
    if (payload) {
      setWaybackCaptures(payload.captures);
      setWaybackPicked(payload.captures.slice(0, MAX_WAYBACK_IMPORT).map((c) => c.timestamp));
      // Only a real answer flips this. On an outage `call` already set the
      // error banner and returned null, so "never archived" is never shown for
      // a lookup that did not actually complete.
      setWaybackLookedUp(true);
    }
    setBusy(null);
  }, [activeUrl, call, captureUrl]);

  const importWayback = useCallback(async () => {
    const typed = (activeUrl ?? captureUrl).trim();
    if (!typed || waybackPicked.length === 0) return;
    const normalized = normalizeSnapshotUrl(typed);
    if (!normalized.ok || !normalized.url) return;
    const url = normalized.url;
    setBusy("import");
    const payload = await call<{ imported: number; duplicates: number; failed: number }>(
      "/api/ai/visibility/historical/wayback/import",
      { url, timestamps: waybackPicked.slice(0, MAX_WAYBACK_IMPORT) },
    );
    if (payload) {
      setNotice(t.waybackResult(payload.imported, payload.duplicates, payload.failed));
      const listed = await call<{ urls: HistoricalPageData["snapshotUrls"] }>(
        "/api/ai/visibility/historical/list",
      );
      if (listed) setSnapshotUrls(listed.urls);
      await loadSnapshots(url);
    }
    setBusy(null);
  }, [activeUrl, call, captureUrl, loadSnapshots, t, waybackPicked]);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === "de-CH" ? "de-CH" : locale, {
      year: "numeric", month: "short", day: "numeric",
    });

  const sourceLabel = (source: string) =>
    source === "ai_lens" ? t.sourceAiLens : source === "wayback" ? t.sourceWayback : t.sourceManual;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-gray-900">
          <HistoryIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
          {t.title}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-600">{t.intro}</p>
      </header>

      {error ? (
        <Card>
          <CardContent className="flex items-start gap-2 py-4 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </CardContent>
        </Card>
      ) : null}
      {notice ? (
        <Card>
          <CardContent className="flex items-start gap-2 py-4 text-sm text-green-700">
            <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{notice}</span>
          </CardContent>
        </Card>
      ) : null}

      {/* ── SERP history ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <span className="text-sm font-medium text-gray-900">{t.serpTitle}</span>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-gray-600">{t.serpIntro}</p>

          {data.keywords.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center">
              <p className="text-sm font-medium text-gray-900">{t.noSerpTitle}</p>
              <p className="mx-auto mt-1 max-w-md text-xs text-gray-600">{t.noSerpBody}</p>
              <Link href="/visibility/tools/serp-checker" className={`${CTA_CLASS} mt-4`}>
                <Search className="mr-1.5 h-4 w-4" aria-hidden="true" />
                {t.runFirstCheck}
              </Link>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="hist-kw" className="block text-xs font-medium text-gray-700">
                    {t.keywordLabel}
                  </label>
                  <select
                    id="hist-kw"
                    value={keywordIdx ?? 0}
                    onChange={(e) => loadTimeline(Number(e.target.value))}
                    className="mt-1 rounded-md border border-gray-300 p-2 text-sm"
                  >
                    {data.keywords.map((k, i) => (
                      <option key={`${k.keyword}-${i}`} value={i}>
                        {k.keyword} — {t.checksCounted(k.checkCount)}
                      </option>
                    ))}
                  </select>
                </div>
                {domains.length > 0 ? (
                  <div>
                    <label htmlFor="hist-domain" className="block text-xs font-medium text-gray-700">
                      {t.domainLabel}
                    </label>
                    <select
                      id="hist-domain"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      className="mt-1 rounded-md border border-gray-300 p-2 text-sm"
                    >
                      {domains.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                ) : null}
                {busy === "timeline" ? (
                  <span className="flex items-center gap-1.5 pb-2 text-xs text-gray-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    {t.loading}
                  </span>
                ) : null}
              </div>

              {selectedKeyword && selectedKeyword.checkCount < 2 && checks.length < 2 ? (
                <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-900">
                  {t.needTwoChecks}{" "}
                  <Link href="/visibility/tools/serp-checker" className="font-medium underline">
                    {t.runFresh}
                  </Link>
                </div>
              ) : null}

              {series.length > 1 && domain ? (
                <PositionChart series={series} label={t.positionChartTitle} axis={t.positionAxis} fmtDate={fmtDate} />
              ) : null}

              {delta ? (
                <DeltaTable
                  delta={delta}
                  t={t}
                  older={fmtDate(checks[checks.length - 2].createdAt)}
                  newer={fmtDate(checks[checks.length - 1].createdAt)}
                />
              ) : null}

              <p className="text-xs text-gray-500">{t.freshNote}</p>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Snapshots ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <span className="text-sm font-medium text-gray-900">{t.snapshotsTitle}</span>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-gray-600">{t.snapshotsIntro}</p>

          {!data.storageConfigured ? (
            <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-900">{t.storageNotConfigured}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[18rem] flex-1">
                  <label htmlFor="hist-url" className="block text-xs font-medium text-gray-700">
                    {t.captureLabel}
                  </label>
                  <input
                    id="hist-url"
                    type="url"
                    value={captureUrl}
                    onChange={(e) => setCaptureUrl(e.target.value)}
                    placeholder={t.capturePlaceholder}
                    className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">{t.captureAnyUrlNote}</p>
                </div>
                <Button onClick={capture} disabled={busy !== null || !captureUrl.trim()}>
                  {busy === "capture" ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Camera className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  )}
                  {busy === "capture" ? t.capturing : t.captureBtn}
                </Button>
              </div>

              {snapshotUrls.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center">
                  <p className="text-sm font-medium text-gray-900">{t.noSnapshotsTitle}</p>
                  <p className="mx-auto mt-1 max-w-md text-xs text-gray-600">{t.noSnapshotsBody}</p>
                </div>
              ) : (
                <>
                  <ul className="flex flex-wrap gap-2">
                    {snapshotUrls.map((u) => (
                      <li key={u.url}>
                        <button
                          type="button"
                          onClick={() => loadSnapshots(u.url)}
                          className={`rounded-full border px-3 py-1 text-xs ${
                            activeUrl === u.url
                              ? "border-blue-600 bg-blue-50 text-blue-800"
                              : "border-gray-300 text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          {u.url.replace(/^https?:\/\//, "").slice(0, 48)} · {t.snapshotCount(u.count)}
                        </button>
                      </li>
                    ))}
                  </ul>

                  {snapshots.length > 0 ? (
                    <div className="space-y-3">
                      <table className="w-full text-xs">
                        <tbody>
                          {snapshots.map((s) => (
                            <tr key={s.id} className="border-b border-gray-100">
                              <td className="py-1.5 tabular-nums text-gray-700">{fmtDate(s.capturedAt)}</td>
                              <td className="py-1.5 text-gray-500">{sourceLabel(s.source)}</td>
                              <td className="py-1.5 text-right tabular-nums text-gray-400">
                                {Math.round(s.sizeBytes / 1024)} KB
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      <div className="flex flex-wrap items-end gap-2 border-t border-gray-100 pt-3">
                        <div>
                          <label htmlFor="hist-older" className="block text-xs font-medium text-gray-700">
                            {t.compareOlder}
                          </label>
                          <select
                            id="hist-older"
                            value={olderId}
                            onChange={(e) => setOlderId(e.target.value)}
                            className="mt-1 rounded-md border border-gray-300 p-2 text-xs"
                          >
                            <option value="">—</option>
                            {snapshots.map((s) => (
                              <option key={s.id} value={s.id}>{fmtDate(s.capturedAt)}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label htmlFor="hist-newer" className="block text-xs font-medium text-gray-700">
                            {t.compareNewer}
                          </label>
                          <select
                            id="hist-newer"
                            value={newerId}
                            onChange={(e) => setNewerId(e.target.value)}
                            className="mt-1 rounded-md border border-gray-300 p-2 text-xs"
                          >
                            <option value="">—</option>
                            {snapshots.map((s) => (
                              <option key={s.id} value={s.id}>{fmtDate(s.capturedAt)}</option>
                            ))}
                          </select>
                        </div>
                        <Button onClick={compare} disabled={busy !== null} variant="outline">
                          {busy === "compare" ? (
                            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
                          ) : null}
                          {busy === "compare" ? t.comparing : t.compareBtn}
                        </Button>
                      </div>

                      {diff ? <DiffView diff={diff} t={t} /> : null}
                    </div>
                  ) : null}
                </>
              )}

              {/* Wayback */}
              <div className="border-t border-gray-100 pt-4">
                <p className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                  <Archive className="h-4 w-4 text-gray-400" aria-hidden="true" />
                  {t.waybackTitle}
                </p>
                <p className="mt-0.5 text-xs text-gray-600">{t.waybackIntro}</p>
                <p className="mt-0.5 text-xs text-gray-500">{t.waybackNote}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button
                    onClick={lookupWayback}
                    disabled={busy !== null || !(activeUrl ?? captureUrl).trim()}
                    variant="outline"
                  >
                    {busy === "wayback" ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : null}
                    {busy === "wayback" ? t.waybackLooking : t.waybackLookupBtn}
                  </Button>
                  {waybackCaptures.length > 0 ? (
                    <>
                      <span className="text-xs text-gray-600">
                        {t.waybackFound(waybackCaptures.length)} · {t.waybackMax(MAX_WAYBACK_IMPORT)}
                      </span>
                      <Button onClick={importWayback} disabled={busy !== null || waybackPicked.length === 0}>
                        {busy === "import" ? (
                          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : null}
                        {busy === "import" ? t.waybackImporting : t.waybackImportBtn(waybackPicked.length)}
                      </Button>
                    </>
                  ) : null}
                </div>
                {waybackLookedUp && waybackCaptures.length === 0 ? (
                  <p className="mt-2 text-xs text-gray-500">{t.waybackNone}</p>
                ) : null}
                {waybackCaptures.length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {waybackCaptures.slice(0, 30).map((c) => {
                      const picked = waybackPicked.includes(c.timestamp);
                      return (
                        <li key={c.timestamp}>
                          <button
                            type="button"
                            onClick={() =>
                              setWaybackPicked((prev) =>
                                prev.includes(c.timestamp)
                                  ? prev.filter((x) => x !== c.timestamp)
                                  : prev.length < MAX_WAYBACK_IMPORT
                                    ? [...prev, c.timestamp]
                                    : prev,
                              )
                            }
                            className={`rounded border px-2 py-0.5 text-[11px] tabular-nums ${
                              picked ? "border-blue-600 bg-blue-50 text-blue-800" : "border-gray-300 text-gray-600"
                            }`}
                          >
                            {fmtDate(c.capturedAt)}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Inline SVG position chart ───────────────────────────────────────────────

function PositionChart({
  series,
  label,
  axis,
  fmtDate,
}: {
  series: Array<{ at: string; position: number | null }>;
  label: string;
  axis: string;
  fmtDate: (iso: string) => string;
}) {
  const W = 640;
  const H = 180;
  const PAD = 30;
  const points = series.map((p, i) => ({
    x: PAD + (i * (W - PAD * 2)) / Math.max(series.length - 1, 1),
    // Position 1 at the TOP: a rank chart that climbs when you fall is a lie.
    y: p.position === null ? null : PAD + ((p.position - 1) / 99) * (H - PAD * 2),
    ...p,
  }));
  const drawn = points.filter((p): p is typeof p & { y: number } => p.y !== null);

  return (
    <figure className="overflow-x-auto">
      <figcaption className="mb-1 text-xs font-medium text-gray-700">{label}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full min-w-[420px]" role="img" aria-label={label}>
        <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#e5e7eb" />
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#e5e7eb" />
        <text x={4} y={PAD + 4} className="fill-gray-400 text-[9px]">1</text>
        <text x={2} y={H - PAD} className="fill-gray-400 text-[9px]">100</text>
        <text x={W / 2} y={12} textAnchor="middle" className="fill-gray-400 text-[9px]">{axis}</text>
        {drawn.length > 1 ? (
          <polyline
            fill="none"
            stroke="#2563eb"
            strokeWidth="2"
            points={drawn.map((p) => `${p.x},${p.y}`).join(" ")}
          />
        ) : null}
        {drawn.map((p) => (
          <circle key={p.at} cx={p.x} cy={p.y} r="3.5" fill="#2563eb">
            <title>{`${fmtDate(p.at)} — #${p.position}`}</title>
          </circle>
        ))}
      </svg>
    </figure>
  );
}

// ── Delta table ─────────────────────────────────────────────────────────────

function DeltaTable({
  delta,
  t,
  older,
  newer,
}: {
  delta: SerpDelta;
  t: (typeof HISTORICAL_COPY)["en"];
  older: string;
  newer: string;
}) {
  const empty =
    delta.entered.length === 0 && delta.dropped.length === 0 && delta.moved.length === 0;

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-gray-700">{t.deltaTitle(older, newer)}</p>
      {empty ? (
        <p className="text-xs text-gray-500">{t.noChange}</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="py-1 font-medium">{t.colDomain}</th>
              <th className="py-1 font-medium">{t.colWas}</th>
              <th className="py-1 font-medium">{t.colNow}</th>
              <th className="py-1 font-medium">{t.colChange}</th>
            </tr>
          </thead>
          <tbody>
            {delta.rows.map((r) => (
              <tr key={r.domain} className="border-b border-gray-100">
                <td className="py-1.5 text-gray-800">{r.domain}</td>
                <td className="py-1.5 tabular-nums text-gray-500">{r.from ?? "—"}</td>
                <td className="py-1.5 tabular-nums text-gray-500">{r.to ?? "—"}</td>
                <td className="py-1.5">
                  {r.kind === "entered" ? (
                    <span className="inline-flex items-center gap-1 rounded bg-green-50 px-1.5 py-0.5 text-green-800">
                      <ArrowUp className="h-3 w-3" aria-hidden="true" />{t.entered}
                    </span>
                  ) : r.kind === "dropped" ? (
                    <span className="inline-flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-red-800">
                      <ArrowDown className="h-3 w-3" aria-hidden="true" />{t.dropped}
                    </span>
                  ) : r.kind === "held" ? (
                    <span className="inline-flex items-center gap-1 text-gray-400">
                      <Minus className="h-3 w-3" aria-hidden="true" />{t.held}
                    </span>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1 tabular-nums ${
                        (r.change ?? 0) > 0 ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {(r.change ?? 0) > 0 ? (
                        <ArrowUp className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <ArrowDown className="h-3 w-3" aria-hidden="true" />
                      )}
                      {(r.change ?? 0) > 0 ? "+" : ""}{r.change}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Word diff ───────────────────────────────────────────────────────────────

function DiffView({ diff, t }: { diff: WordDiff; t: (typeof HISTORICAL_COPY)["en"] }) {
  if (diff.addedWords === 0 && diff.removedWords === 0) {
    return <p className="text-xs text-gray-500">{t.noTextChange}</p>;
  }
  return (
    <div>
      <p className="mb-1 flex flex-wrap gap-3 text-xs">
        <span className="text-green-700">{t.wordsAdded(diff.addedWords)}</span>
        <span className="text-red-700">{t.wordsRemoved(diff.removedWords)}</span>
      </p>
      {diff.truncated ? <p className="mb-1 text-xs text-gray-500">{t.diffTruncated}</p> : null}
      <div className="max-h-96 overflow-auto rounded bg-gray-50 p-3 text-xs leading-relaxed">
        {diff.tokens.map((token, i) => (
          <span
            key={i}
            className={
              token.op === "added"
                ? "bg-green-100 text-green-900"
                : token.op === "removed"
                  ? "bg-red-100 text-red-900 line-through"
                  : "text-gray-700"
            }
          >
            {token.text}
          </span>
        ))}
      </div>
    </div>
  );
}
