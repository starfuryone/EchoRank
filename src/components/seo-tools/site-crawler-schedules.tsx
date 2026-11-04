"use client";

// Scheduled crawls (Phase 4c) on /crawler/schedules: the create / edit form
// and the saved list. The form takes the URL (the site's saved defaults are
// what a schedule runs with), a frequency limited to the plan's cadences
// (others shown disabled with the plan that unlocks them), a time in the
// workspace's timezone with its UTC equivalent, and export targets. The list
// shows each schedule's host, cadence · next run (local), last health with the
// delta on the run before, export targets, an on/off switch, Run now, edit and
// delete (confirmed). Everything goes through the schedule endpoints; nothing
// is kept in the browser.

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, FileSpreadsheet, Mail, Pencil, Play, Trash2 } from "lucide-react";
import { flag } from "@/lib/flags";
import type { DashLocale } from "@/lib/i18n/dashboard";
import type { SiteCrawler4cCopy } from "@/lib/i18n/site-crawler-4c";
import type { SiteCrawlerUxCopy } from "@/lib/i18n/site-crawler-ux";
import type { CrawlConfigInput } from "@/lib/site-crawler/crawl-config";
import type { RenderMode } from "@/lib/site-crawler/types";
import { CRAWLER_ROUTES } from "./site-crawler-nav";

export type Cadence = "daily" | "weekly" | "monthly";
const CADENCES: Cadence[] = ["daily", "weekly", "monthly"];

export interface ScheduleDto {
  id: string;
  host: string;
  rootUrl: string;
  cadence: Cadence;
  hourUtc: number;
  enabled: boolean;
  nextRunAt: string;
  exportTo: { email?: boolean; sheets?: { spreadsheetId: string | null } | null } | null;
  lastJobId?: string | null;
  /** Health of the last completed run (GET only); null before one. */
  lastHealth?: number | null;
  /** Health of the run before it; null when there is none. */
  prevHealth?: number | null;
}

export interface SchedulesResponse {
  schedules: ScheduleDto[];
  cap: number;
  cadences: Cadence[];
  /** Cadences this plan lacks → the plan that has them. */
  cadenceUnlocks?: Partial<Record<Cadence, string>>;
  /** The workspace's IANA timezone (tenant settings). */
  timezone?: string;
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

/** Where a schedule's runs go, as one line. */
export function exportTargets(s: Pick<ScheduleDto, "exportTo">, ux: SiteCrawlerUxCopy): string {
  const out = [s.exportTo?.email ? ux.schToEmail : null, s.exportTo?.sheets ? ux.schToSheets : null].filter(Boolean);
  return out.length ? out.join(", ") : ux.schToNone;
}

/** A timezone the browser knows, else UTC. */
export function safeZone(tz: string | undefined): string {
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

/**
 * The 24 UTC hours as options labelled in the workspace's timezone, sorted by
 * local time (today's offset: a DST change moves the local time, the UTC hour
 * stays). Half-hour zones show their minutes.
 */
export function timeOptions(tz: string, locale: string, now: Date = new Date()): { hourUtc: number; local: string; utc: string }[] {
  const zone = safeZone(tz);
  const fmt = new Intl.DateTimeFormat(locale, { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return Array.from({ length: 24 }, (_, h) => {
    const at = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h));
    const [hh, mm] = parts.format(at).split(":").map(Number);
    return { hourUtc: h, local: fmt.format(at), utc: `${String(h).padStart(2, "0")}:00`, sortKey: (hh ?? 0) * 60 + (mm ?? 0) };
  })
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(({ hourUtc, local, utc }) => ({ hourUtc, local, utc }));
}

/** Last run's health minus the run before's; null without both. */
export function healthDelta(s: Pick<ScheduleDto, "lastHealth" | "prevHealth">): number | null {
  return typeof s.lastHealth === "number" && typeof s.prevHealth === "number" ? s.lastHealth - s.prevHealth : null;
}

const FIELD =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";
const LABEL = "mb-1 block text-sm font-medium text-gray-700";
const ICON_BTN =
  "inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50";

// ── Form ─────────────────────────────────────────────────────────────────────

export interface ScheduleDraft {
  cadence: Cadence;
  hourUtc: number;
  email: boolean;
  sheets: boolean;
}

export function ScheduleForm({
  t,
  ux,
  locale,
  url,
  onUrl,
  urlLabel,
  urlPlaceholder,
  renderMode,
  renderSelect,
  config,
  configLine,
  data,
  editing,
  onCancelEdit,
  onSaved,
  waiting,
}: {
  t: SiteCrawler4cCopy;
  ux: SiteCrawlerUxCopy;
  locale: DashLocale;
  url: string;
  onUrl: (v: string) => void;
  urlLabel: string;
  urlPlaceholder: string;
  renderMode: RenderMode;
  /** The render-mode field, when the plan renders (rendered by the view). */
  renderSelect?: React.ReactNode;
  config: CrawlConfigInput | null;
  /** "Uses this site's saved configuration · Edit", or the no-defaults line. */
  configLine?: React.ReactNode;
  data: SchedulesResponse;
  /** The schedule being edited; null = create. */
  editing: ScheduleDto | null;
  onCancelEdit: () => void;
  onSaved: (s: ScheduleDto, created: boolean) => void;
  /** The host's saved defaults are still loading: saving now would miss them. */
  waiting: boolean;
}) {
  const allowed = data.cadences;
  const initial = (): ScheduleDraft =>
    editing
      ? { cadence: editing.cadence, hourUtc: editing.hourUtc, email: Boolean(editing.exportTo?.email), sheets: Boolean(editing.exportTo?.sheets) }
      : { cadence: allowed[allowed.length - 1] ?? "monthly", hourUtc: 3, email: true, sheets: false };
  const [draft, setDraft] = useState<ScheduleDraft>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const zone = safeZone(data.timezone);
  const times = useMemo(() => timeOptions(zone, locale), [zone, locale]);
  const chosen = times.find((o) => o.hourUtc === draft.hourUtc);
  const used = data.schedules.length;
  const full = !editing && used >= data.cap;
  const reports = flag("crawl.reports");
  const sheetsOn = flag("crawl.sheets");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const exportTo = {
      email: reports && draft.email,
      sheets: sheetsOn && draft.sheets ? { spreadsheetId: editing?.exportTo?.sheets?.spreadsheetId ?? null } : null,
    };
    try {
      const res = editing
        ? await fetch(`/api/seo/v1/crawl/schedules/${editing.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ cadence: draft.cadence, hourUtc: draft.hourUtc, exportTo }),
          })
        : await fetch("/api/seo/v1/crawl/schedules", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ rootUrl: url, renderMode, config, cadence: draft.cadence, hourUtc: draft.hourUtc, exportTo }),
          });
      const body = await res.json().catch(() => null);
      if (!res.ok) return setMsg({ ok: false, text: scheduleError(body, t) });
      onSaved(body as ScheduleDto, !editing);
      setMsg({ ok: true, text: t.schSaved });
    } catch {
      setMsg({ ok: false, text: t.schErrGeneric });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4" data-testid="schedule-form" aria-labelledby="schedule-form-title">
      <h2 id="schedule-form-title" className="text-base font-semibold text-gray-900">
        {editing ? ux.schEditTitle : ux.schCreateTitle}
      </h2>

      <div>
        <label htmlFor="schedule-url" className={LABEL}>
          {urlLabel}
        </label>
        <input
          id="schedule-url"
          className={`${FIELD} read-only:bg-gray-50`}
          value={editing ? editing.rootUrl : url}
          readOnly={Boolean(editing)}
          onChange={(e) => onUrl(e.target.value)}
          placeholder={urlPlaceholder}
        />
        {!editing && configLine}
      </div>

      {!editing && renderSelect}

      <div>
        <label htmlFor="schedule-cadence" className={LABEL}>
          {ux.schFrequency}
        </label>
        <select id="schedule-cadence" className={FIELD} value={draft.cadence} onChange={(e) => setDraft((d) => ({ ...d, cadence: e.target.value as Cadence }))}>
          {CADENCES.map((c) => {
            const ok = allowed.includes(c);
            const plan = data.cadenceUnlocks?.[c];
            return (
              <option key={c} value={c} disabled={!ok}>
                {ok || !plan ? cadenceLabel(c, t) : ux.schCadenceLocked(cadenceLabel(c, t), plan)}
              </option>
            );
          })}
        </select>
      </div>

      <div>
        <label htmlFor="schedule-hour" className={LABEL}>
          {ux.schTime(zone)}
        </label>
        <select
          id="schedule-hour"
          className={FIELD}
          value={String(draft.hourUtc)}
          onChange={(e) => setDraft((d) => ({ ...d, hourUtc: Number(e.target.value) }))}
          aria-describedby="schedule-hour-utc"
        >
          {times.map((o) => (
            <option key={o.hourUtc} value={String(o.hourUtc)}>
              {o.local}
            </option>
          ))}
        </select>
        <p id="schedule-hour-utc" className="mt-1 text-xs text-gray-600" data-testid="schedule-utc">
          {ux.schTimeUtc(chosen?.utc ?? "")}
        </p>
      </div>

      <fieldset>
        <legend className={LABEL}>{ux.schExports}</legend>
        <div className="space-y-1.5">
          {reports ? (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.checked }))} />
              {ux.schEmailOwner}
            </label>
          ) : (
            <p className="text-sm text-gray-600">{ux.schEmailComing}</p>
          )}
          {sheetsOn ? (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={draft.sheets} onChange={(e) => setDraft((d) => ({ ...d, sheets: e.target.checked }))} />
              {ux.schSheets}
            </label>
          ) : (
            <p className="text-sm text-gray-600" data-testid="sheets-coming">
              {ux.schSheetsComing}
            </p>
          )}
        </div>
      </fieldset>

      <p className="text-xs text-gray-600" data-testid="schedule-used">
        {ux.schUsed(String(used), String(data.cap))}
      </p>
      {full && <p className="text-sm text-gray-700">{t.schErrCap}</p>}
      {!editing && !full && !url.trim() && <p className="text-xs text-gray-600">{t.schNeedUrl}</p>}
      {msg && (
        <p role="status" className={msg.ok ? "text-sm text-green-700" : "text-sm text-red-700"}>
          {msg.text}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={busy || full || (!editing && (!url.trim() || waiting))}
          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50"
        >
          {busy ? t.schSaving : editing ? ux.schUpdateCta : ux.schSaveCta}
          <span aria-hidden="true">→</span>
        </button>
        {editing && (
          <button type="button" onClick={onCancelEdit} className={ICON_BTN}>
            {ux.schCancelEdit}
          </button>
        )}
      </div>
    </form>
  );
}

// ── Saved list ───────────────────────────────────────────────────────────────

function DeltaBadge({ d, ux, int }: { d: number; ux: SiteCrawlerUxCopy; int: Intl.NumberFormat }) {
  const tone = d > 0 ? "text-green-800" : d < 0 ? "text-red-700" : "text-gray-600";
  const sym = d > 0 ? "▲" : d < 0 ? "▼" : "=";
  const text = d > 0 ? ux.schDeltaUp(int.format(d)) : d < 0 ? ux.schDeltaDown(int.format(-d)) : ux.schDeltaSame;
  return (
    <span className={`ml-1 text-xs font-medium ${tone}`} data-delta={d}>
      <span aria-hidden="true">
        {sym}
        {d !== 0 ? ` ${int.format(Math.abs(d))}` : ""}
      </span>
      <span className="sr-only"> ({text})</span>
    </span>
  );
}

export function SavedSchedules({
  t,
  ux,
  locale,
  data,
  onChange,
  onRemove,
  onEdit,
  editingId,
}: {
  t: SiteCrawler4cCopy;
  ux: SiteCrawlerUxCopy;
  locale: DashLocale;
  data: SchedulesResponse;
  onChange: (s: ScheduleDto) => void;
  onRemove: (id: string) => void;
  onEdit: (s: ScheduleDto) => void;
  editingId: string | null;
}) {
  const int = useMemo(() => new Intl.NumberFormat(locale === "en" ? "en-US" : locale), [locale]);
  const zone = safeZone(data.timezone);
  const when = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: zone }), [locale, zone]);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [note, setNote] = useState<{ id: string; ok: boolean; text: string } | null>(null);

  async function toggle(s: ScheduleDto) {
    setBusy(s.id);
    const res = await fetch(`/api/seo/v1/crawl/schedules/${s.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: !s.enabled }),
    }).catch(() => null);
    if (res?.ok) onChange({ ...s, ...((await res.json()) as ScheduleDto), lastHealth: s.lastHealth, prevHealth: s.prevHealth });
    setBusy(null);
  }

  async function runNow(s: ScheduleDto) {
    setBusy(s.id);
    setNote(null);
    const res = await fetch(`/api/seo/v1/crawl/schedules/${s.id}/run`, { method: "POST" }).catch(() => null);
    const body = res ? await res.json().catch(() => null) : null;
    if (res?.ok) setNote({ id: s.id, ok: true, text: ux.schRunStarted });
    else setNote({ id: s.id, ok: false, text: (body?.reason && ux.schRunSkipped[body.reason]) || ux.schRunFailed });
    setBusy(null);
  }

  async function remove(s: ScheduleDto) {
    setBusy(s.id);
    const res = await fetch(`/api/seo/v1/crawl/schedules/${s.id}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) onRemove(s.id);
    setConfirming(null);
    setBusy(null);
  }

  return (
    <section className="space-y-3" aria-labelledby="saved-schedules-title" data-testid="saved-schedules">
      <div className="flex items-center gap-2">
        <h2 id="saved-schedules-title" className="text-base font-semibold text-gray-900">
          {ux.schSavedTitle}
        </h2>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium tabular-nums text-gray-700" data-testid="schedule-count">
          {int.format(data.schedules.length)}
        </span>
      </div>

      {data.schedules.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center" data-testid="schedules-empty">
          <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <CalendarDays className="h-6 w-6" focusable="false" />
          </span>
          <p className="text-sm font-semibold text-gray-900">{ux.schEmptyTitle}</p>
          <p className="text-sm text-gray-600">{ux.schEmptyBody}</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100" data-testid="schedule-rows">
          {data.schedules.map((s) => {
            const delta = healthDelta(s);
            return (
              <li key={s.id} data-schedule={s.id} className={`space-y-2 py-3 ${editingId === s.id ? "rounded-lg bg-blue-50 px-2" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900">{s.host}</p>
                    <p className="text-xs text-gray-600" data-next>
                      {cadenceLabel(s.cadence, t)} · {s.enabled ? ux.schNextRun(when.format(new Date(s.nextRunAt))) : ux.schPausedLabel}
                    </p>
                    <p className="text-xs text-gray-700" data-last-health>
                      {ux.schLastHealth}:{" "}
                      {typeof s.lastHealth === "number" ? (
                        <>
                          <span className="font-semibold">{ux.healthScore(int.format(s.lastHealth))}</span>
                          {delta !== null && <DeltaBadge d={delta} ux={ux} int={int} />}
                        </>
                      ) : (
                        ux.schNoRunYet
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={s.enabled}
                    aria-label={ux.schEnabledAria(s.host)}
                    disabled={busy === s.id}
                    onClick={() => void toggle(s)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50 ${
                      s.enabled ? "bg-emerald-600" : "bg-gray-400"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${s.enabled ? "translate-x-5" : "translate-x-0.5"}`}
                    />
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-gray-700" data-exports>
                    {s.exportTo?.email && (
                      <span title={ux.schToEmail}>
                        <Mail className="h-4 w-4" aria-hidden="true" focusable="false" />
                        <span className="sr-only">{ux.schToEmail}</span>
                      </span>
                    )}
                    {s.exportTo?.sheets && (
                      <span title={ux.schToSheets}>
                        <FileSpreadsheet className="h-4 w-4" aria-hidden="true" focusable="false" />
                        <span className="sr-only">{ux.schToSheets}</span>
                      </span>
                    )}
                    {!s.exportTo?.email && !s.exportTo?.sheets && <span className="text-xs text-gray-600">{ux.schToNone}</span>}
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <button type="button" className={ICON_BTN} disabled={busy === s.id} onClick={() => void runNow(s)} data-run-now>
                      <Play className="h-3.5 w-3.5" aria-hidden="true" focusable="false" />
                      {ux.schRunNow}
                      {/* The visible text stays the start of the name (WCAG 2.5.3); the host tells rows apart. */}
                      <span className="sr-only"> — {s.host}</span>
                    </button>
                    <button type="button" className={ICON_BTN} onClick={() => onEdit(s)} aria-label={ux.schEditAria(s.host)}>
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" focusable="false" />
                    </button>
                    <button type="button" className={ICON_BTN} onClick={() => setConfirming(s.id)} aria-label={ux.schDeleteAria(s.host)}>
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" focusable="false" />
                    </button>
                  </span>
                </div>

                {confirming === s.id && (
                  <div
                    role="alertdialog"
                    aria-label={ux.schDeleteConfirm(s.host)}
                    className="flex flex-wrap items-center gap-2 rounded-lg bg-red-50 p-2 text-sm text-red-800"
                    data-confirm
                  >
                    <span>{ux.schDeleteConfirm(s.host)}</span>
                    <button
                      type="button"
                      onClick={() => void remove(s)}
                      disabled={busy === s.id}
                      className="rounded-lg bg-red-700 px-3 py-1 text-sm font-medium text-white hover:bg-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                      {ux.schDeleteYes}
                    </button>
                    <button type="button" onClick={() => setConfirming(null)} className={ICON_BTN}>
                      {ux.schDeleteNo}
                    </button>
                  </div>
                )}
                {note?.id === s.id && (
                  <p role="status" className={note.ok ? "text-sm text-green-700" : "text-sm text-red-700"}>
                    {note.text}
                    {note.ok && " "}
                    {note.ok && (
                      <Link href={CRAWLER_ROUTES.history} className="font-medium text-blue-700 hover:underline">
                        {ux.navHistory}
                      </Link>
                    )}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-gray-600">
        {ux.integrationsHelp}{" "}
        <Link href="/settings" className="font-medium text-blue-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          {ux.integrations}
        </Link>
      </p>
    </section>
  );
}
