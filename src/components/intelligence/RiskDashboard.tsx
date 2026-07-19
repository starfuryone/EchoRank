'use client';

import { useCallback, useEffect, useState } from 'react';
import { RISK_DASHBOARD_COPY, type DashLocale, type RiskDashboardCopy } from '@/lib/i18n/dashboard';

// ── Types mirrored from the APIs ────────────────────────────────────────────
interface Components {
  negativePressure: number;
  velocity: number;
  criticalRecent: number;
  visibility: number | null;
  stagnation: number;
}
interface Driver {
  signalId: string;
  source: string;
  title: string;
  occurredAt: string;
  sentiment: number;
  severity: number;
  contribution: number;
}
interface Revenue {
  monthlyRevenue: number;
  currency: string;
  elasticity: number;
  atRisk: number;
}
interface Overview {
  current: {
    score: number;
    grade: string;
    components: Components;
    drivers: Driver[];
    signalCount: number;
  };
  deltas: { d7: number | null; d30: number | null };
  history: { day: string; score: number }[];
  computedAt: string;
  revenue: Revenue | null;
}
interface Alert {
  id: string;
  kind: string;
  severity: 'warning' | 'critical';
  title: string;
  body: string | null;
  createdAt: string;
}
interface Config {
  monthlyRevenue: number | null;
  currency: string;
  riskElasticity: number;
  alertEmails: string | null;
  alertsEnabled: boolean;
}

const GRADE_COLOR: Record<string, string> = {
  A: '#34d399', B: '#a3e635', C: '#fbbf24', D: '#fb923c', F: '#fb7185',
};

const COMPONENT_KEYS: (keyof Components)[] = [
  'negativePressure', 'velocity', 'criticalRecent', 'visibility', 'stagnation',
];

function fmtMoney(n: number, currency: string, locale: DashLocale): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency', currency, maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency} ${Math.round(n).toLocaleString(locale)}`;
  }
}

function Gauge({ score, grade, t }: { score: number; grade: string; t: RiskDashboardCopy }) {
  const color = GRADE_COLOR[grade] ?? '#fbbf24';
  const start = -210;
  const sweep = 240;
  const polar = (deg: number, r: number) => {
    const rad = (deg * Math.PI) / 180;
    return [60 + r * Math.cos(rad), 60 + r * Math.sin(rad)];
  };
  const arc = (from: number, to: number, r: number) => {
    const [x1, y1] = polar(from, r);
    const [x2, y2] = polar(to, r);
    const large = to - from > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };
  const end = start + (sweep * Math.min(100, Math.max(0, score))) / 100;
  const ticks = Array.from({ length: 13 }, (_, i) => start + (sweep * i) / 12);

  return (
    <svg viewBox="0 0 120 108" className="w-full max-w-[260px]" role="img"
      aria-label={t.gaugeAria(score, grade)}>
      <path d={arc(start, start + sweep, 46)} fill="none" stroke="#27272a" strokeWidth="8" strokeLinecap="round" />
      {score > 0 && (
        <path d={arc(start, end, 46)} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          style={{ transition: 'all .6s ease' }} />
      )}
      {ticks.map((t2, i) => {
        const [x1, y1] = polar(t2, 38);
        const [x2, y2] = polar(t2, i % 3 === 0 ? 32 : 35);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#3f3f46" strokeWidth="1" />;
      })}
      <text x="60" y="60" textAnchor="middle" fill="#fafafa" fontSize="26" fontWeight="700"
        fontFamily="ui-monospace, monospace">{score}</text>
      <text x="60" y="74" textAnchor="middle" fill={color} fontSize="10" fontWeight="600"
        fontFamily="ui-monospace, monospace" letterSpacing="1">{t.gradeLabel(grade)}</text>
      <text x="60" y="100" textAnchor="middle" fill="#71717a" fontSize="7"
        letterSpacing="1.5">{t.gaugeCaption}</text>
    </svg>
  );
}

function Sparkline({ history, t }: { history: { day: string; score: number }[]; t: RiskDashboardCopy }) {
  if (history.length < 2) {
    return <p className="text-xs text-zinc-500">{t.historyEmpty}</p>;
  }
  const w = 260, h = 48;
  const xs = history.map((_, i) => (i / (history.length - 1)) * (w - 4) + 2);
  const ys = history.map((p) => h - 4 - (p.score / 100) * (h - 8));
  const points = xs.map((x, i) => `${x},${ys[i]}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label={t.sparklineAria}>
      <polyline points={points} fill="none" stroke="#2dd4bf" strokeWidth="1.5" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="2.5" fill="#2dd4bf" />
    </svg>
  );
}

function Delta({ label, value }: { label: string; value: number | null }) {
  if (value === null) {
    return (
      <div className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
        <p className="font-mono text-sm text-zinc-500">—</p>
      </div>
    );
  }
  const up = value > 0;
  const flat = value === 0;
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`font-mono text-sm font-semibold ${flat ? 'text-zinc-400' : up ? 'text-rose-400' : 'text-emerald-400'}`}>
        {flat ? '0' : `${up ? '▲ +' : '▼ '}${value}`}
      </p>
    </div>
  );
}

function ConfigPanel({ config, onSaved, t }: { config: Config; onSaved: () => void; t: RiskDashboardCopy }) {
  const [revenue, setRevenue] = useState(config.monthlyRevenue?.toString() ?? '');
  const [emails, setEmails] = useState(config.alertEmails ?? '');
  const [enabled, setEnabled] = useState(config.alertsEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/reputation/config', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          monthlyRevenue: revenue === '' ? null : Number(revenue),
          alertEmails: emails.trim() === '' ? null : emails.trim(),
          alertsEnabled: enabled,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? t.httpError(res.status));
      }
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 space-y-3 border-t border-zinc-800 pt-3">
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">{t.revenueLabel}</span>
        <input type="number" min="0" step="100" value={revenue} inputMode="numeric"
          onChange={(e) => setRevenue(e.target.value)} placeholder={t.revenuePlaceholder}
          className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 font-mono text-sm text-zinc-100 placeholder-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400" />
      </label>
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">{t.emailsLabel}</span>
        <input type="text" value={emails} onChange={(e) => setEmails(e.target.value)}
          placeholder="you@company.com, ops@company.com"
          className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400" />
      </label>
      <label className="flex items-center gap-2 text-xs text-zinc-300">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)}
          className="h-3.5 w-3.5 accent-teal-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400" />
        {t.alertsEnabled}
      </label>
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <button onClick={() => void save()} disabled={saving}
        className="rounded-md border border-teal-500/50 bg-teal-500/10 px-3 py-1.5 text-xs font-semibold text-teal-300 hover:bg-teal-500/20 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400">
        {saving ? t.saving : t.saveConfig}
      </button>
    </div>
  );
}

export default function RiskDashboard({ locale = 'en' }: { locale?: DashLocale }) {
  const t = RISK_DASHBOARD_COPY[locale];
  const [data, setData] = useState<Overview | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [showConfig, setShowConfig] = useState(false);

  const load = useCallback(async (refresh = false) => {
    setState('loading');
    try {
      const [riskRes, alertsRes, cfgRes] = await Promise.all([
        fetch(`/api/reputation/risk${refresh ? '?refresh=1' : ''}`, { credentials: 'include', cache: 'no-store' }),
        fetch('/api/reputation/alerts?days=30&limit=20', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/reputation/config', { credentials: 'include', cache: 'no-store' }),
      ]);
      if (!riskRes.ok) throw new Error(String(riskRes.status));
      setData(await riskRes.json());
      if (alertsRes.ok) setAlerts(((await alertsRes.json()) as { alerts: Alert[] }).alerts);
      if (cfgRes.ok) setConfig(((await cfgRes.json()) as { config: Config }).config);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (state === 'loading' && !data) {
    return (
      <div className="grid gap-4 lg:grid-cols-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-64 animate-pulse rounded-lg border border-zinc-800 bg-zinc-900/40" />
        ))}
      </div>
    );
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

  const d = data!;
  const empty = d.current.signalCount === 0;

  if (empty) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-10 text-center">
        <p className="font-mono text-4xl text-zinc-600">—</p>
        <p className="mt-3 text-sm text-zinc-300">{t.emptyTitle}</p>
        <p className="mt-1 text-xs text-zinc-500">{t.emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Gauge */}
        <section className="flex flex-col items-center rounded-lg border border-zinc-800 bg-zinc-900/60 p-5">
          <Gauge score={d.current.score} grade={d.current.grade} t={t} />
          <div className="mt-3 grid w-full grid-cols-2 gap-2">
            <Delta label={t.delta7} value={d.deltas.d7} />
            <Delta label={t.delta30} value={d.deltas.d30} />
          </div>
          <button onClick={() => void load(true)} disabled={state === 'loading'}
            className="mt-3 self-end rounded-md border border-zinc-800 px-3 py-1 text-xs text-zinc-400 hover:border-teal-500/60 hover:text-zinc-200 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400">
            {state === 'loading' ? t.recomputing : t.recomputeNow}
          </button>
        </section>

        {/* Components */}
        <section className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{t.componentsTitle}</h2>
          <ul className="mt-4 space-y-3">
            {COMPONENT_KEYS.map((key) => {
              const { label, hint } = t.componentLabels[key];
              const v = d.current.components[key];
              return (
                <li key={key} title={hint}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-zinc-300">{label}</span>
                    <span className="font-mono text-xs text-zinc-400">
                      {v === null ? t.noData : `${Math.round(v * 100)}`}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                    <div className="h-full rounded-full bg-teal-500/80" style={{ width: `${(v ?? 0) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-5">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{t.trendTitle}</h3>
            <div className="mt-2"><Sparkline history={d.history} t={t} /></div>
          </div>
        </section>

        {/* Drivers */}
        <section className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{t.driversTitle}</h2>
          {d.current.drivers.length === 0 ? (
            <p className="mt-4 text-xs text-zinc-500">{t.driversEmpty}</p>
          ) : (
            <ul className="mt-3 divide-y divide-zinc-800/80">
              {d.current.drivers.map((dr) => (
                <li key={dr.signalId} className="py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-zinc-400">
                      {dr.source}
                    </span>
                    <span className="font-mono text-[10px] text-rose-400">
                      {t.pctOfPressure(Math.round(dr.contribution * 100))}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-200">{dr.title}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-zinc-500">
                    {new Date(dr.occurredAt).toLocaleDateString(locale)} · {t.sev(dr.severity.toFixed(2))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Revenue at risk + config */}
        <section className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{t.revenueAtRiskTitle}</h2>
            <button onClick={() => setShowConfig((v) => !v)}
              className="rounded-md border border-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400 hover:border-teal-500/60 hover:text-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400">
              {showConfig ? t.close : t.configure}
            </button>
          </div>
          {d.revenue ? (
            <div className="mt-3"
              title={t.formulaTitle(d.revenue.elasticity)}>
              <p className="font-mono text-3xl font-bold text-rose-400">
                {fmtMoney(d.revenue.atRisk, d.revenue.currency, locale)}
                <span className="text-sm font-normal text-zinc-500"> {t.perMonthAbbrev}</span>
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {t.exposureSummary(d.current.score, fmtMoney(d.revenue.monthlyRevenue, d.revenue.currency, locale))}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-xs text-zinc-500">{t.revenueUnset}</p>
          )}
          {showConfig && config && <ConfigPanel config={config} onSaved={() => { setShowConfig(false); void load(); }} t={t} />}
        </section>

        {/* Alerts feed */}
        <section className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5 lg:col-span-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{t.alertsTitle}</h2>
          {alerts.length === 0 ? (
            <p className="mt-3 text-xs text-zinc-500">{t.alertsEmpty}</p>
          ) : (
            <ul className="mt-3 divide-y divide-zinc-800/80">
              {alerts.map((a) => (
                <li key={a.id} className="flex items-start gap-3 py-2.5">
                  <span className={`mt-0.5 rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${
                    a.severity === 'critical' ? 'bg-rose-950 text-rose-300' : 'bg-amber-950 text-amber-300'
                  }`}>
                    {a.severity}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-zinc-200">{a.title}</p>
                    {a.body && <p className="mt-0.5 line-clamp-1 text-[11px] text-zinc-500">{a.body}</p>}
                  </div>
                  <span className="shrink-0 font-mono text-[10px] text-zinc-600">
                    {new Date(a.createdAt).toLocaleDateString(locale)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="text-right font-mono text-[10px] text-zinc-600">
        {t.signalsInWindow(d.current.signalCount)} · {t.computedAtTime(new Date(d.computedAt).toLocaleTimeString(locale))}
      </p>
    </div>
  );
}
