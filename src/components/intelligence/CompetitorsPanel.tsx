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
  if (v === null) return <span className="font-mono text-[10px] text-zinc-600">—</span>;
  if (v === 0) return <span className="font-mono text-[10px] text-zinc-500">0{suffix}</span>;
  const up = v > 0;
  return (
    <span className={`font-mono text-[10px] ${up ? 'text-rose-400' : 'text-emerald-400'}`}>
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
    return <div className="h-72 animate-pulse rounded-lg border border-zinc-800 bg-zinc-900/40" aria-busy="true" />;
  }
  if (state === 'error') {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-8 text-center">
        <p className="text-sm text-zinc-300">{t.loadFailed}</p>
        <button onClick={() => void load()}
          className="mt-3 rounded-md border border-zinc-700 px-4 py-1.5 text-sm text-zinc-200 hover:border-teal-500/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400">
          {t.retry}
        </button>
      </div>
    );
  }

  const momentumDenominator = Math.max(5, 2 * Math.max(own7, 1));

  return (
    <div className="space-y-4">
      {/* Add */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{t.trackTitle}</h2>
          <span className="font-mono text-[10px] text-zinc-500">
            {t.ownPace} <span className="text-zinc-300">{own7}</span>
          </span>
        </div>
        <div className="mt-3 flex gap-2">
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void (placesOn ? search() : add({ name: query.trim() })); }}
            placeholder={placesOn ? t.searchPlaceholderPlaces : t.searchPlaceholderManual}
            className="flex-1 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400" />
          {placesOn ? (
            <button onClick={() => void search()} disabled={busy || query.trim().length < 3}
              className="rounded-md border border-teal-500/50 bg-teal-500/10 px-4 py-1.5 text-xs font-semibold text-teal-300 hover:bg-teal-500/20 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400">
              {busy ? t.searching : t.search}
            </button>
          ) : (
            <button onClick={() => void add({ name: query.trim() })} disabled={busy || query.trim().length < 2}
              className="rounded-md border border-teal-500/50 bg-teal-500/10 px-4 py-1.5 text-xs font-semibold text-teal-300 hover:bg-teal-500/20 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400">
              {t.add}
            </button>
          )}
        </div>
        {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
        {candidates && (
          <ul className="mt-3 divide-y divide-zinc-800/80 rounded-md border border-zinc-800">
            {candidates.length === 0 && <li className="p-3 text-xs text-zinc-500">{t.noMatches}</li>}
            {candidates.map((c) => (
              <li key={c.placeId} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-xs text-zinc-200">{c.name}</p>
                  <p className="truncate font-mono text-[10px] text-zinc-500">
                    {c.address ?? c.placeId}
                    {c.rating !== undefined && ` · ★${c.rating.toFixed(1)}`}
                    {c.reviewCount !== undefined && ` · ${t.reviewsCount(c.reviewCount)}`}
                  </p>
                </div>
                <button onClick={() => void add({ name: c.name, placeId: c.placeId })} disabled={busy}
                  className="shrink-0 rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-200 hover:border-teal-500/60 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400">
                  {t.track}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Table */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            {t.tableTitle}
          </h2>
          <button onClick={() => void refresh()} disabled={busy || rows.length === 0}
            className="rounded-md border border-zinc-800 px-3 py-1 text-xs text-zinc-400 hover:border-teal-500/60 hover:text-zinc-200 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400">
            {busy ? t.refreshing : t.refreshNow}
          </button>
        </div>

        {rows.length === 0 ? (
          <p className="mt-4 text-xs text-zinc-500">
            {t.emptyTable}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-800/80">
            {rows.map((c) => {
              const gained = c.deltas.dReviews7 ?? 0;
              const momentum = Math.min(1, Math.max(0, gained / momentumDenominator));
              return (
                <li key={c.id} className={`py-3 ${c.active ? '' : 'opacity-50'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-zinc-200">{c.name}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-zinc-500">
                        {c.placeId ? t.placesAuto : t.manualSnapshots}
                        {c.deltas.lastSnapshotDay ? ` · ${t.lastDay(c.deltas.lastSnapshotDay)}` : ` · ${t.noDataYet}`}
                      </p>
                    </div>
                    <div className="w-24 text-right">
                      <p className="font-mono text-sm text-zinc-200">
                        {c.deltas.rating !== null ? `★${c.deltas.rating.toFixed(1)}` : '—'}
                      </p>
                      <DeltaTag v={c.deltas.dRating30} suffix={t.suffix30d} />
                    </div>
                    <div className="w-28 text-right">
                      <p className="font-mono text-sm text-zinc-200">
                        {c.deltas.reviewCount !== null ? c.deltas.reviewCount.toLocaleString(locale) : '—'}
                        <span className="text-[10px] text-zinc-500"> {t.revAbbrev}</span>
                      </p>
                      <p className="space-x-2">
                        <DeltaTag v={c.deltas.dReviews7} suffix={t.suffix7d} />
                        <DeltaTag v={c.deltas.dReviews30} suffix={t.suffix30d} />
                      </p>
                    </div>
                    <div className="hidden w-28 sm:block" title={t.momentumTitle(momentumDenominator)}>
                      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                        <div className={`h-full rounded-full ${momentum >= 1 ? 'bg-rose-500' : 'bg-teal-500/80'}`}
                          style={{ width: `${momentum * 100}%` }} />
                      </div>
                      <p className="mt-1 text-right font-mono text-[9px] text-zinc-600">{t.momentum}</p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button onClick={() => void patch(c.id, { active: !c.active })}
                        className="rounded-md border border-zinc-800 px-2 py-1 text-[10px] text-zinc-400 hover:border-teal-500/60 hover:text-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400">
                        {c.active ? t.pause : t.resume}
                      </button>
                      <button onClick={() => void remove(c.id, c.name)}
                        className="rounded-md border border-zinc-800 px-2 py-1 text-[10px] text-zinc-500 hover:border-rose-500/60 hover:text-rose-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400">
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
