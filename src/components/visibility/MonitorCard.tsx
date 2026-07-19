"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Lock, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MONITOR_CARD_COPY, type DashLocale } from "@/lib/i18n/dashboard";

/**
 * Scheduled monitoring panel for the AI Visibility page (GROWTH+).
 * Self-contained: fetches its own data, renders locked state on 403.
 */

type Cadence = "WEEKLY" | "DAILY";

interface Monitor {
  id: string;
  url: string;
  cadence: Cadence;
  active: boolean;
  lastRunAt: string | null;
  lastScore: number | null;
  lastGrade: string | null;
  nextRunAt: string;
}

interface AuditPoint {
  id: string;
  monitorId: string | null;
  url: string;
  score: number;
  grade: string;
  createdAt: string;
}

function canon(u: string): string {
  return u.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

function Sparkline({ points, hint }: { points: number[]; hint: string }) {
  if (points.length < 2) {
    return <span className="text-xs text-gray-400">{hint}</span>;
  }
  const w = 120;
  const h = 28;
  const step = w / (points.length - 1);
  const y = (s: number) => h - (Math.max(0, Math.min(100, s)) / 100) * h;
  const d = points.map((s, i) => `${i * step},${y(s).toFixed(1)}`).join(" ");
  const rising = points[points.length - 1] >= points[0];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-7 w-[120px]" aria-hidden="true">
      <polyline
        points={d}
        fill="none"
        stroke={rising ? "#059669" : "#dc2626"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MonitorCard({
  suggestedUrl,
  locale = "en",
}: {
  suggestedUrl: string | null;
  locale?: DashLocale;
}) {
  const t = MONITOR_CARD_COPY[locale];
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [audits, setAudits] = useState<AuditPoint[]>([]);
  const [cadence, setCadence] = useState<Cadence>("WEEKLY");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/visibility/monitor", { cache: "no-store" });
      if (res.status === 403) {
        setLocked(true);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.requestFailed(res.status));
      setMonitors(data.monitors ?? []);
      setAudits(data.audits ?? []);
      setLocked(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addMonitor() {
    if (!suggestedUrl) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/ai/visibility/monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: suggestedUrl, cadence }),
      });
      const data = await res.json();
      if (res.status === 403) {
        setErr(data.error || t.dailyRequiresAgency);
        return;
      }
      if (!res.ok) throw new Error(data.error || t.requestFailed(res.status));
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setErr(null);
    const res = await fetch("/api/ai/visibility/monitor", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(data.error || t.updateFailed);
      return;
    }
    await load();
  }

  async function remove(id: string) {
    setErr(null);
    const res = await fetch("/api/ai/visibility/monitor", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) await load();
  }

  if (loading) return null;

  if (locked) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-5">
          <Lock className="h-5 w-5 shrink-0 text-gray-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">{t.title}</p>
            <p className="text-sm text-gray-500">{t.lockedDescription}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => (window.location.href = "/billing")}>
            {t.upgrade}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const suggestedCanon = suggestedUrl ? canon(suggestedUrl) : null;
  const alreadyMonitored =
    suggestedCanon !== null && monitors.some((m) => canon(m.url) === suggestedCanon);

  const pointsFor = (m: Monitor): number[] =>
    audits
      .filter((a) => a.monitorId === m.id)
      .slice(0, 12)
      .reverse()
      .map((a) => a.score);

  return (
    <Card>
      <CardContent className="space-y-4 py-5">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-900">{t.title}</h3>
        </div>

        {monitors.length === 0 && <p className="text-sm text-gray-500">{t.empty}</p>}

        {monitors.map((m) => (
          <div
            key={m.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{m.url}</p>
              <p className="text-xs text-gray-500">
                {m.lastScore !== null ? (
                  <>
                    {t.lastScore(m.lastScore, m.lastGrade ?? "")} ·{" "}
                  </>
                ) : null}
                {t.nextRun(new Date(m.nextRunAt).toLocaleDateString(locale))}
              </p>
            </div>
            <Sparkline points={pointsFor(m)} hint={t.sparklineHint} />
            <select
              value={m.cadence}
              onChange={(e) => void patch(m.id, { cadence: e.target.value })}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-700"
            >
              <option value="WEEKLY">{t.weekly}</option>
              <option value="DAILY">{t.daily}</option>
            </select>
            <Button variant="outline" size="sm" onClick={() => void patch(m.id, { active: !m.active })}>
              {m.active ? t.pause : t.resume}
            </Button>
            <button
              type="button"
              aria-label={t.deleteMonitor}
              onClick={() => void remove(m.id)}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}

        {suggestedUrl && !alreadyMonitored && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-blue-50 px-4 py-3">
            <p className="min-w-0 flex-1 truncate text-sm text-blue-900">
              {t.monitorPromptBefore}
              <span className="font-medium">{suggestedUrl}</span>
              {t.monitorPromptAfter}
            </p>
            <select
              value={cadence}
              onChange={(e) => setCadence(e.target.value as Cadence)}
              className="rounded-lg border border-blue-200 bg-white px-2 py-1.5 text-sm text-gray-700"
            >
              <option value="WEEKLY">{t.weekly}</option>
              <option value="DAILY">{t.daily}</option>
            </select>
            <Button size="sm" onClick={() => void addMonitor()} disabled={saving}>
              {saving ? t.saving : t.startMonitoring}
            </Button>
          </div>
        )}

        {err && <p className="text-sm text-red-600">{err}</p>}
      </CardContent>
    </Card>
  );
}
