'use client';

import { useCallback, useEffect, useState } from 'react';
import { COMPETITORS_PANEL_COPY, type DashLocale } from '@/lib/i18n/dashboard';

interface Deltas {
  rating: number | null;
  reviewCount: number | null;
  dRating30: number | null;
  dReviews7: number | null;
  dReviews30: number | null;
  lastSnapshotDay: string | null;
}
interface Competitor {
  id: string;
  name: string;
  placeId: string | null;
  active: boolean;
  deltas: Deltas;
}
interface Candidate {
  placeId: string;
  name: string;
  address?: string;
  rating?: number;
  reviewCount?: number;
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

  const search = async () => {
    if (query.trim().length < 3) return;
    setBusy(true);
    setError(null);
    setCandidates(null);
    try {
      const res = await fetch(`/api/competitors/search?q=${encodeURIComponent(query.trim())}`, {
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

  const add = async (payload: { name: string; placeId?: string }) => {
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
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? t.httpError(res.status));
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
    try {
      await fetch('/api/competitors/refresh', { method: 'POST', credentials: 'include' });
      await new Promise((r) => setTimeout(r, 8000));
      await load();
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
      {/* Add */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{t.trackTitle}</h2>
          <span className="font-mono text-[10px] text-gray-400">
            {t.ownPace} <span className="text-gray-700">{own7}</span>
          </span>
        </div>
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
                <button onClick={() => void add({ name: c.name, placeId: c.placeId })} disabled={busy}
                  className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                  {t.track}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Table */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            {t.tableTitle}
          </h2>
          <button onClick={() => void refresh()} disabled={busy || rows.length === 0}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            {busy ? t.refreshing : t.refreshNow}
          </button>
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
              return (
                <li key={c.id} className={`py-3 ${c.active ? '' : 'opacity-50'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-gray-900">{c.name}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-gray-400">
                        {c.placeId ? t.placesAuto : t.manualSnapshots}
                        {c.deltas.lastSnapshotDay ? ` · ${t.lastDay(c.deltas.lastSnapshotDay)}` : ` · ${t.noDataYet}`}
                      </p>
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
