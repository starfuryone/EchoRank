'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { COMPETITORS_PANEL_COPY, type DashLocale } from '@/lib/i18n/dashboard';

interface Deltas {
  rating: number | null;
  reviewCount: number | null;
  dRating30: number | null;
  dReviews7: number | null;
  dReviews30: number | null;
  lastSnapshotDay: string | null;
}
interface SnapshotPoint {
  day: string;
  rating: number | null;
  reviewCount: number | null;
}
interface Competitor {
  id: string;
  name: string;
  placeId: string | null;
  address: string | null;
  active: boolean;
  deltas: Deltas;
  history: SnapshotPoint[];
}
interface Candidate {
  placeId: string;
  name: string;
  address?: string;
  rating?: number;
  reviewCount?: number;
}
interface RefreshRow {
  id: string;
  name: string;
  status: 'ok' | 'error' | 'manual' | 'paused';
  rating?: number | null;
  reviewCount?: number | null;
  error?: string;
}

function mapsUrl(placeId: string): string {
  return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`;
}

function DeltaTag({ v, suffix = '' }: { v: number | null; suffix?: string }) {
  if (v === null) return <span className="font-mono text-[10px] text-gray-400">—</span>;
  if (v === 0) return <span className="font-mono text-[10px] text-gray-400">0{suffix}</span>;
  const up = v > 0;
  return (
    <span className={`font-mono text-[10px] ${up ? 'text-red-600' : 'text-green-600'}`}>
      {up ? '+' : ''}{Number.isInteger(v) ? v : v.toFixed(1)}{suffix}
    </span>
  );
}

function MiniSpark({ values, stroke, label }: { values: number[]; stroke: string; label: string }) {
  if (values.length < 2) return null;
  const w = 72, h = 18;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const xs = values.map((_, i) => (i / (values.length - 1)) * (w - 6) + 3);
  const ys = values.map((v) => h - 3 - ((v - min) / span) * (h - 6));
  const points = xs.map((x, i) => `${x},${ys[i]}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[18px] w-[72px]" role="img" aria-label={label}>
      <title>{label}</title>
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="1.5" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="2" fill={stroke} />
    </svg>
  );
}

export default function CompetitorsPanel({ locale = 'en' }: { locale?: DashLocale }) {
  const t = COMPETITORS_PANEL_COPY[locale];
  const [rows, setRows] = useState<Competitor[]>([]);
  const [own7, setOwn7] = useState(0);
  const [placesOn, setPlacesOn] = useState(false);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkTarget, setLinkTarget] = useState<{ id: string; name: string } | null>(null);
  const [refreshReport, setRefreshReport] = useState<Record<string, RefreshRow> | null>(null);
  const [refreshMsg, setRefreshMsg] = useState<{ text: string; failed: boolean } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/competitors', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const j = (await res.json()) as { competitors: Competitor[]; own7: number; placesConfigured: boolean };
      setRows(j.competitors);
      setOwn7(j.own7);
      setPlacesOn(j.placesConfigured);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const apiError = (j: { error?: string; limit?: number } | null, status: number): string => {
    switch (j?.error) {
      case 'duplicate_place':
      case 'duplicate_name':
        return t.alreadyTracked;
      case 'duplicate_manual_name':
        return t.alreadyTrackedManual;
      case 'limit_reached':
        return t.limitReached(j?.limit ?? 20);
      default:
        return j?.error ?? t.httpError(status);
    }
  };

  const search = async (raw?: string) => {
    const q = (raw ?? query).trim();
    if (q.length < 3) return;
    setBusy(true);
    setError(null);
    setCandidates(null);
    try {
      const res = await fetch(`/api/competitors/search?q=${encodeURIComponent(q)}`, {
        credentials: 'include',
      });
      const j = (await res.json()) as { candidates: Candidate[]; error?: string };
      if (j.error === 'places_not_configured') setError(t.placesUnavailable);
      setCandidates(j.candidates ?? []);
    } catch {
      setError(t.searchFailed);
    } finally {
      setBusy(false);
    }
  };

  const add = async (payload: { name: string; placeId?: string; address?: string; rating?: number; reviewCount?: number }) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/competitors', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string; limit?: number } | null;
        throw new Error(apiError(j, res.status));
      }
      setQuery('');
      setCandidates(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /** "Upgrade to Places" on a manual row: reuse the search, then PATCH the placeId on. */
  const startLink = (c: Competitor) => {
    setLinkTarget({ id: c.id, name: c.name });
    setQuery(c.name);
    setCandidates(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    void search(c.name);
  };

  const cancelLink = () => {
    setLinkTarget(null);
    setQuery('');
    setCandidates(null);
  };

  const linkPlace = async (id: string, c: Candidate) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/competitors/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          placeId: c.placeId,
          address: c.address ?? null,
          rating: c.rating,
          reviewCount: c.reviewCount,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(apiError(j, res.status));
      }
      setLinkTarget(null);
      setQuery('');
      setCandidates(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    await fetch(`/api/competitors/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    await load();
  };

  const remove = async (id: string, name: string) => {
    if (!window.confirm(t.removeConfirm(name))) return;
    await fetch(`/api/competitors/${id}`, { method: 'DELETE', credentials: 'include' });
    await load();
  };

  const refresh = async () => {
    setBusy(true);
    setRefreshMsg(null);
    try {
      const res = await fetch('/api/competitors/refresh', { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error(String(res.status));
      const j = (await res.json()) as { results: RefreshRow[] };
      const byId: Record<string, RefreshRow> = {};
      let ok = 0, failed = 0;
      for (const r of j.results) {
        byId[r.id] = r;
        if (r.status === 'ok') ok++;
        else if (r.status === 'error') failed++;
      }
      setRefreshReport(byId);
      setRefreshMsg({ text: t.refreshSummary(ok, failed), failed: failed > 0 });
      await load();
    } catch {
      setRefreshMsg({ text: t.refreshFailed, failed: true });
    } finally {
      setBusy(false);
    }
  };

  if (state === 'loading' && !rows.length) {
    return <div className="h-72 animate-pulse rounded-xl bg-gray-200" aria-busy="true" />;
  }
  if (state === 'error') {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-gray-700">{t.loadFailed}</p>
        <button onClick={() => void load()}
          className="mt-3 rounded-lg border border-gray-300 bg-white px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          {t.retry}
        </button>
      </div>
    );
  }

  const momentumDenominator = Math.max(5, 2 * Math.max(own7, 1));

  return (
    <div className="space-y-4">
      {/* Add / link */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{t.trackTitle}</h2>
          <span className="font-mono text-[10px] text-gray-400">
            {t.ownPace} <span className="text-gray-700">{own7}</span>
          </span>
        </div>
        {own7 === 0 && (
          <p className="mt-1 text-right text-[11px] text-gray-400">
            {t.paceHint}{' '}
            <Link href="/imports" className="text-blue-600 hover:underline">{t.paceHintLink}</Link>
          </p>
        )}
        {linkTarget && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
            <p className="text-xs text-blue-800">{t.linkingNotice(linkTarget.name)}</p>
            <button onClick={cancelLink}
              className="shrink-0 rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-[11px] text-blue-700 hover:bg-blue-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              {t.cancel}
            </button>
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void (placesOn ? search() : add({ name: query.trim() })); }}
            placeholder={placesOn ? t.searchPlaceholderPlaces : t.searchPlaceholderManual}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" />
          {placesOn ? (
            <button onClick={() => void search()} disabled={busy || query.trim().length < 3}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              {busy ? t.searching : t.search}
            </button>
          ) : (
            <button onClick={() => void add({ name: query.trim() })} disabled={busy || query.trim().length < 2}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              {t.add}
            </button>
          )}
        </div>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        {candidates && (
          <ul className="mt-3 divide-y divide-gray-100 rounded-md border border-gray-200">
            {candidates.length === 0 && <li className="p-3 text-xs text-gray-400">{t.noMatches}</li>}
            {candidates.map((c) => (
              <li key={c.placeId} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-xs text-gray-900">{c.name}</p>
                  <p className="truncate font-mono text-[10px] text-gray-400">
                    {c.address ?? c.placeId}
                    {c.rating !== undefined && ` · ★${c.rating.toFixed(1)}`}
                    {c.reviewCount !== undefined && ` · ${t.reviewsCount(c.reviewCount)}`}
                  </p>
                </div>
                <button
                  onClick={() =>
                    void (linkTarget
                      ? linkPlace(linkTarget.id, c)
                      : add({ name: c.name, placeId: c.placeId, address: c.address, rating: c.rating, reviewCount: c.reviewCount }))
                  }
                  disabled={busy}
                  className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                  {linkTarget ? t.linkAction : t.track}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Table */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            {t.tableTitle}
          </h2>
          <div className="flex items-center gap-2">
            {refreshMsg && (
              <span className={`font-mono text-[10px] ${refreshMsg.failed ? 'text-red-600' : 'text-green-600'}`}>
                {refreshMsg.text}
              </span>
            )}
            <button onClick={() => void refresh()} disabled={busy || rows.length === 0}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              {busy ? t.refreshing : t.refreshNow}
            </button>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="mt-4 text-xs text-gray-400">
            {t.emptyTable}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100">
            {rows.map((c) => {
              const gained = c.deltas.dReviews7 ?? 0;
              const momentum = Math.min(1, Math.max(0, gained / momentumDenominator));
              const report = refreshReport?.[c.id];
              const ratings = c.history.map((h) => h.rating).filter((v): v is number => v !== null);
              const reviews = c.history.map((h) => h.reviewCount).filter((v): v is number => v !== null);
              return (
                <li key={c.id} className={`py-3 ${c.active ? '' : 'opacity-50'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {c.placeId ? (
                        <a href={mapsUrl(c.placeId)} target="_blank" rel="noopener noreferrer"
                          title={t.mapsLinkTitle}
                          className="block truncate text-sm text-gray-900 hover:text-blue-700 hover:underline">
                          {c.name}
                        </a>
                      ) : (
                        <p className="truncate text-sm text-gray-900">{c.name}</p>
                      )}
                      {c.address && (
                        <p className="truncate text-[11px] text-gray-500">{c.address}</p>
                      )}
                      <p className="mt-0.5 truncate font-mono text-[10px] text-gray-400">
                        {c.placeId ? t.placesAuto : t.manualSnapshots}
                        {c.deltas.lastSnapshotDay ? ` · ${t.lastDay(c.deltas.lastSnapshotDay)}` : ` · ${t.noDataYet}`}
                        {report?.status === 'ok' && (
                          <span className="text-green-600"> · {t.updatedTag}</span>
                        )}
                        {report?.status === 'error' && (
                          <span className="text-red-600"> · {t.placesErrorTag(report.error ?? '?')}</span>
                        )}
                      </p>
                    </div>
                    <div className="hidden w-20 shrink-0 flex-col items-end gap-1 md:flex">
                      <MiniSpark values={ratings} stroke="#93c5fd" label={t.sparkRatingLabel} />
                      <MiniSpark values={reviews} stroke="#3b82f6" label={t.sparkReviewsLabel} />
                    </div>
                    <div className="w-24 text-right">
                      <p className="font-mono text-sm text-gray-900">
                        {c.deltas.rating !== null ? `★${c.deltas.rating.toFixed(1)}` : '—'}
                      </p>
                      <DeltaTag v={c.deltas.dRating30} suffix={t.suffix30d} />
                    </div>
                    <div className="w-28 text-right">
                      <p className="font-mono text-sm text-gray-900">
                        {c.deltas.reviewCount !== null ? c.deltas.reviewCount.toLocaleString(locale) : '—'}
                        <span className="text-[10px] text-gray-400"> {t.revAbbrev}</span>
                      </p>
                      <p className="space-x-2">
                        <DeltaTag v={c.deltas.dReviews7} suffix={t.suffix7d} />
                        <DeltaTag v={c.deltas.dReviews30} suffix={t.suffix30d} />
                      </p>
                    </div>
                    <div className="hidden w-28 sm:block" title={t.momentumTitle(momentumDenominator)}>
                      <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                        <div className={`h-full rounded-full ${momentum >= 1 ? 'bg-red-500' : 'bg-blue-500'}`}
                          style={{ width: `${momentum * 100}%` }} />
                      </div>
                      <p className="mt-1 text-right font-mono text-[9px] text-gray-400">{t.momentum}</p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      {!c.placeId && placesOn && (
                        <button onClick={() => startLink(c)}
                          className="rounded-lg border border-blue-200 bg-white px-2 py-1 text-[10px] text-blue-700 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                          {t.linkToPlaces}
                        </button>
                      )}
                      <button onClick={() => void patch(c.id, { active: !c.active })}
                        className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-[10px] text-gray-600 hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                        {c.active ? t.pause : t.resume}
                      </button>
                      <button onClick={() => void remove(c.id, c.name)}
                        className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-[10px] text-gray-500 hover:border-red-300 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500">
                        {t.remove}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
