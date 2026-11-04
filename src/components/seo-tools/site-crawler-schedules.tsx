"use client";

// "Run this crawl on a schedule" (Phase 4c), inside the Configuration
// section: saves the start URL, render mode and the settings above as a
// crawl_schedules row, lists the tenant's schedules with pause / delete.
// Cadences offered are the plan's (plan-config crawlScheduleCadences); the
// route refuses anything else anyway.

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { flag } from "@/lib/flags";
import { formatDateTime } from "@/lib/utils";
import type { DashLocale } from "@/lib/i18n/dashboard";
import type { SiteCrawler4cCopy } from "@/lib/i18n/site-crawler-4c";
import type { CrawlConfigInput } from "@/lib/site-crawler/crawl-config";
import type { RenderMode } from "@/lib/site-crawler/types";

type Cadence = "daily" | "weekly" | "monthly";
export interface ScheduleDto {
  id: string;
  host: string;
  rootUrl: string;
  cadence: Cadence;
  hourUtc: number;
  enabled: boolean;
  nextRunAt: string;
  exportTo: { email?: boolean; sheets?: { spreadsheetId: string | null } | null } | null;
}

export function cadenceLabel(c: Cadence, t: SiteCrawler4cCopy): string {
  return c === "daily" ? t.cadenceDaily : c === "weekly" ? t.cadenceWeekly : t.cadenceMonthly;
}

/** The route's refusal as copy. */
export function scheduleError(body: { code?: string; reason?: string } | null, t: SiteCrawler4cCopy): string {
  if (body?.code === "SCHEDULE_REFUSED") return body.reason === "over_plan_cap" ? t.schErrCap : t.schErrCadence;
  if (body?.code === "INVALID_CONFIG") return t.schErrConfig;
  if (body?.code === "INVALID_REQUEST") return t.schErrUrl;
  return t.schErrGeneric;
}

export function CrawlSchedules({
  t,
  locale,
  rootUrl,
  renderMode,
  config,
  cap,
  cadences,
  disabled = false,
}: {
  t: SiteCrawler4cCopy;
  locale: DashLocale;
  rootUrl: string;
  renderMode: RenderMode;
  config: CrawlConfigInput | null;
  cap: number;
  cadences: readonly Cadence[];
  disabled?: boolean;
}) {
  const [list, setList] = useState<ScheduleDto[] | null>(null);
  const [cadence, setCadence] = useState<Cadence>(cadences[cadences.length - 1] ?? "monthly");
  const [hour, setHour] = useState(3);
  const [email, setEmail] = useState(true);
  const [sheets, setSheets] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/seo/v1/crawl/schedules")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { schedules: ScheduleDto[] } | null) => {
        if (!cancelled) setList(d?.schedules ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/seo/v1/crawl/schedules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rootUrl,
          renderMode,
          config,
          cadence,
          hourUtc: hour,
          exportTo: { email: flag("crawl.reports") && email, sheets: flag("crawl.sheets") && sheets ? { spreadsheetId: null } : null },
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) return setMsg({ ok: false, text: scheduleError(body, t) });
      setList((l) => [...(l ?? []), body as ScheduleDto]);
      setMsg({ ok: true, text: t.schSaved });
    } catch {
      setMsg({ ok: false, text: t.schErrGeneric });
    } finally {
      setBusy(false);
    }
  }

  async function patch(s: ScheduleDto, body: Partial<ScheduleDto>) {
    const res = await fetch(`/api/seo/v1/crawl/schedules/${s.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      const next = (await res.json()) as ScheduleDto;
      setList((l) => (l ?? []).map((x) => (x.id === s.id ? next : x)));
    }
  }

  async function remove(s: ScheduleDto) {
    const res = await fetch(`/api/seo/v1/crawl/schedules/${s.id}`, { method: "DELETE" });
    if (res.ok) setList((l) => (l ?? []).filter((x) => x.id !== s.id));
  }

  const used = list?.length ?? 0;
  const full = used >= cap;

  return (
    <section className="mt-4 space-y-3 rounded-lg border border-gray-100 p-3" aria-labelledby="crawl-schedules-title">
      <h4 id="crawl-schedules-title" className="text-sm font-semibold text-gray-900">
        {t.schTitle}
      </h4>
      <p className="text-xs text-gray-500">{t.schHelp}</p>
      <p className="text-xs text-gray-500">{t.schCapNote(String(used), String(cap))}</p>

      {!full && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-56">
            <Select
              id="schedule-cadence"
              label={t.schCadence}
              value={cadence}
              onChange={(e) => setCadence(e.target.value as Cadence)}
              options={cadences.map((c) => ({ value: c, label: cadenceLabel(c, t) }))}
            />
          </div>
          <div className="w-36">
            <Select
              id="schedule-hour"
              label={t.schHour}
              value={String(hour)}
              onChange={(e) => setHour(Number(e.target.value))}
              options={Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: t.schHourOption(String(h).padStart(2, "0")) }))}
            />
          </div>
          <Button size="sm" onClick={() => void save()} disabled={busy || disabled || !rootUrl.trim()}>
            {busy ? t.schSaving : t.schSave}
          </Button>
        </div>
      )}
      {!full && flag("crawl.reports") && (
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} /> {t.schEmail}
        </label>
      )}
      {!full && flag("crawl.sheets") && (
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={sheets} onChange={(e) => setSheets(e.target.checked)} /> {t.schSheets}
        </label>
      )}
      {!full && !rootUrl.trim() && <p className="text-xs text-gray-500">{t.schNeedUrl}</p>}
      {msg && <p className={msg.ok ? "text-sm text-green-700" : "text-sm text-red-600"}>{msg.text}</p>}

      <div>
        <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t.schList}</h5>
        {list !== null && list.length === 0 ? (
          <p className="mt-1 text-xs text-gray-500">{t.schNone}</p>
        ) : (
          <ul className="mt-1 divide-y divide-gray-100">
            {(list ?? []).map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-gray-900">{s.rootUrl}</span>
                  <span className="text-xs text-gray-500">
                    {cadenceLabel(s.cadence, t)} · {t.schHourOption(String(s.hourUtc).padStart(2, "0"))} ·{" "}
                    {s.enabled ? t.schNext(formatDateTime(s.nextRunAt, locale)) : t.schPaused}
                  </span>
                </span>
                <span className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => void patch(s, { enabled: !s.enabled })}>
                    {s.enabled ? t.schPause : t.schResume}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void remove(s)}>
                    {t.schDelete}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
