"use client";

// Rank Tracker — projects that check keyword positions on a schedule.
//
// Two views in one component (list / detail) because they share the usage
// header, the modal and the reload plumbing; splitting them would mean lifting
// all three into a parent that does nothing else.
//
// Charts are hand-rolled inline SVG, matching src/components/visibility/
// prompt-trends.tsx — this repo ships no chart library on the client (recharts
// is a dependency but is imported nowhere), and adding one for two sparklines
// would be the largest bundle change in the feature.
//
// Position semantics, applied everywhere below: LOWER IS BETTER. A delta is
// stored as (earlier - latest), so positive = improved, and the arrow/colour
// follow that, not the sign of the raw position change.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  LineChart,
  Loader2,
  Lock,
  Pencil,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDateTime } from "@/lib/utils";
import { isValidDomain } from "@/lib/site-explorer/domain";
import { SCAFFOLD_RELATED } from "@/lib/seo-tools";
import { parseKeywords } from "@/lib/rank-tracker/keywords";
import { RankTrackerHelpButton } from "@/components/seo-tools/rank-tracker-help";
import {
  RANK_DEVICES,
  RANK_LANGUAGE_CODES,
  RANK_LOCATION_CODES,
  DEFAULT_DEVICE,
  DEFAULT_LANGUAGE_CODE,
  DEFAULT_LOCATION_CODE,
  type RankDevice,
  type RankFrequency,
} from "@/lib/rank-tracker/options";
import type {
  RankKeywordRow,
  RankPoint,
  RankProjectDetail,
  RankProjectSummary,
  RankUsage,
} from "@/lib/rank-tracker/types";
import {
  RANK_TRACKER_COPY,
  SEO_TOOLS_COPY,
  SERP_CHECKER_COPY,
  type DashLocale,
  type RankTrackerCopy,
} from "@/lib/i18n/dashboard";

const API = "/api/seo/v1/rank-tracker/projects";
/** While a run is in flight the detail view re-fetches on this cadence. */
const POLL_INTERVAL_MS = 10_000;

interface ListResponse {
  projects: RankProjectSummary[];
  usage: RankUsage;
}

// ─── Charts (inline SVG, matching prompt-trends.tsx) ────────────────────────

/**
 * Position sparkline. The y-axis is INVERTED — position 1 draws at the top —
 * because a line that rises when rankings improve is the only version anyone
 * reads correctly.
 *
 * Unranked runs (position null) break the line rather than being drawn at the
 * bottom: a plotted point would assert a position we never measured.
 */
function Sparkline({ points }: { points: RankPoint[] }) {
  const W = 120;
  const H = 24;
  const ranked = points.filter((p) => p.position !== null);
  if (ranked.length < 2) {
    return <span className="text-xs text-gray-300">—</span>;
  }

  const values = ranked.map((p) => p.position as number);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const segments: string[][] = [];
  let current: string[] = [];
  points.forEach((point, i) => {
    if (point.position === null) {
      if (current.length) segments.push(current);
      current = [];
      return;
    }
    const x = points.length > 1 ? (i / (points.length - 1)) * W : W / 2;
    // Invert: the smallest position number sits at y = 2 (the top).
    const y = 2 + ((point.position - min) / span) * (H - 4);
    current.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  });
  if (current.length) segments.push(current);

  const last = ranked[ranked.length - 1].position as number;
  const first = ranked[0].position as number;
  const stroke = last < first ? "#10b981" : last > first ? "#ef4444" : "#9ca3af";

  return (
    <svg width={W} height={H} className="shrink-0" aria-hidden="true">
      {segments
        .filter((s) => s.length > 1)
        .map((seg, i) => (
          <polyline
            key={i}
            points={seg.join(" ")}
            fill="none"
            stroke={stroke}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
    </svg>
  );
}

/** Project-wide average-position chart. Same inverted axis as the sparkline. */
function PositionChart({ points, t }: { points: RankPoint[]; t: RankTrackerCopy }) {
  const W = 720;
  const H = 200;
  const PAD_L = 34;
  const PAD_B = 22;

  const ranked = points.filter((p) => p.position !== null);
  if (ranked.length < 2) {
    return <p className="text-sm text-gray-500">{t.chartEmpty}</p>;
  }

  const values = ranked.map((p) => p.position as number);
  const min = Math.max(1, Math.floor(Math.min(...values)) - 1);
  const max = Math.ceil(Math.max(...values)) + 1;
  const span = max - min || 1;
  const plotW = W - PAD_L - 8;
  const plotH = H - PAD_B - 8;

  const xOf = (i: number) =>
    PAD_L + (points.length > 1 ? (i / (points.length - 1)) * plotW : plotW / 2);
  const yOf = (position: number) => 8 + ((position - min) / span) * plotH;

  const line = points
    .map((p, i) => (p.position === null ? null : `${xOf(i)},${yOf(p.position)}`))
    .filter(Boolean)
    .join(" ");

  // Three gridlines: best, middle, worst position in view.
  const ticks = [min, Math.round((min + max) / 2), max];

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[480px]"
          role="img"
          aria-label={t.chartTitle}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD_L}
                x2={W - 8}
                y1={yOf(tick)}
                y2={yOf(tick)}
                stroke="#f3f4f6"
                strokeWidth={1}
              />
              <text x={4} y={yOf(tick) + 4} className="fill-gray-400" fontSize={11}>
                {tick}
              </text>
            </g>
          ))}
          <polyline
            points={line}
            fill="none"
            stroke="#2563eb"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {points.map((p, i) =>
            p.position === null ? null : (
              <circle key={p.date} cx={xOf(i)} cy={yOf(p.position)} r={2.5} fill="#2563eb">
                <title>{`${p.date} · ${p.position.toFixed(1)}`}</title>
              </circle>
            ),
          )}
          <text x={PAD_L} y={H - 4} className="fill-gray-400" fontSize={11}>
            {points[0].date}
          </text>
          <text x={W - 8} y={H - 4} textAnchor="end" className="fill-gray-400" fontSize={11}>
            {points[points.length - 1].date}
          </text>
        </svg>
      </div>
      <p className="text-xs text-gray-400">{t.chartAxisNote}</p>
    </div>
  );
}

/** Delta cell. Positive delta = moved toward #1 = green. */
function DeltaCell({ value, t }: { value: number | null; t: RankTrackerCopy }) {
  if (value === null) return <span className="text-gray-300">{t.noData}</span>;
  if (value === 0) return <span className="text-xs text-gray-400">{t.unchanged}</span>;
  const improved = value > 0;
  return (
    <span
      className={`text-xs font-medium ${improved ? "text-emerald-600" : "text-red-600"}`}
    >
      {improved ? "↑" : "↓"} {improved ? t.improvedBy(value) : t.droppedBy(Math.abs(value))}
    </span>
  );
}

// ─── Create / edit modal ────────────────────────────────────────────────────

interface ProjectFormState {
  name: string;
  domain: string;
  keywordsText: string;
  locationCode: string;
  languageCode: string;
  device: RankDevice;
  frequency: RankFrequency;
}

function ProjectModal({
  t,
  serp,
  usage,
  initial,
  editingId,
  onClose,
  onSaved,
}: {
  t: RankTrackerCopy;
  serp: (typeof SERP_CHECKER_COPY)[DashLocale];
  usage: RankUsage;
  initial: ProjectFormState;
  editingId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ProjectFormState>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => parseKeywords(form.keywordsText), [form.keywordsText]);

  // Editing replaces this project's keywords, so its own count is not spent
  // against the cap — mirrors checkKeywordCap(excludeProjectId) on the server.
  const otherKeywords = editingId
    ? Math.max(usage.trackedKeywords - (initial.keywordsText.split("\n").filter(Boolean).length), 0)
    : usage.trackedKeywords;
  const total = otherKeywords + parsed.keywords.length;
  const overLimit = total > usage.trackedKeywordLimit;

  const domainValid = form.domain.trim().length > 0 && isValidDomain(form.domain.trim());
  const canSave =
    domainValid && parsed.keywords.length > 0 && !overLimit && !saving;

  const set = <K extends keyof ProjectFormState>(key: K, value: ProjectFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(editingId ? `${API}/${editingId}` : API, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          domain: form.domain.trim(),
          keywords: parsed.keywords,
          locationCode: Number(form.locationCode),
          languageCode: form.languageCode,
          device: form.device,
          frequency: form.frequency,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error || t.saveFailed);
        return;
      }
      onSaved();
    } catch {
      setError(t.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-900/40 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={editingId ? t.editTitle : t.createTitle}
    >
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="text-base font-semibold text-gray-900">
            {editingId ? t.editTitle : t.createTitle}
          </h3>
        </div>

        <form onSubmit={submit} className="space-y-4 px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="rank-name"
              label={t.nameLabel}
              placeholder={t.namePlaceholder}
              value={form.name}
              maxLength={120}
              onChange={(e) => set("name", e.target.value)}
            />
            <Input
              id="rank-domain"
              label={t.domainLabel}
              placeholder={t.domainPlaceholder}
              value={form.domain}
              maxLength={253}
              autoComplete="off"
              spellCheck={false}
              error={form.domain.trim() && !domainValid ? t.invalidDomain : undefined}
              onChange={(e) => set("domain", e.target.value)}
            />
          </div>
          <p className="-mt-2 text-xs text-gray-400">{t.nameHint}</p>

          <div>
            <label
              htmlFor="rank-keywords"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              {t.keywordsLabel}
            </label>
            <textarea
              id="rank-keywords"
              rows={8}
              value={form.keywordsText}
              placeholder={t.keywordsPlaceholder}
              spellCheck={false}
              onChange={(e) => set("keywordsText", e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span className={overLimit ? "font-medium text-red-600" : "text-gray-500"}>
                {t.keywordCounter(total, usage.trackedKeywordLimit)}
              </span>
              {parsed.duplicates > 0 && (
                <span className="text-gray-400">{t.duplicatesIgnored(parsed.duplicates)}</span>
              )}
              <span className="text-gray-400">{t.keywordsHint}</span>
            </div>
            {overLimit && (
              <p className="mt-1 text-xs font-medium text-red-600">
                {t.overLimit(total, usage.trackedKeywordLimit)}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              id="rank-location"
              label={t.locationLabel}
              value={form.locationCode}
              onChange={(e) => set("locationCode", e.target.value)}
              options={RANK_LOCATION_CODES.map((code) => ({
                value: String(code),
                label: serp.locationLabels[code],
              }))}
            />
            <Select
              id="rank-language"
              label={t.languageLabel}
              value={form.languageCode}
              onChange={(e) => set("languageCode", e.target.value)}
              options={RANK_LANGUAGE_CODES.map((code) => ({
                value: code,
                label: serp.languageLabels[code],
              }))}
            />
            <Select
              id="rank-device"
              label={t.deviceLabel}
              value={form.device}
              onChange={(e) => set("device", e.target.value as RankDevice)}
              options={RANK_DEVICES.map((device) => ({
                value: device,
                label: device === "mobile" ? t.deviceMobile : t.deviceDesktop,
              }))}
            />
            <Select
              id="rank-frequency"
              label={t.frequencyLabel}
              value={form.frequency}
              onChange={(e) => set("frequency", e.target.value as RankFrequency)}
              // Only the plan's own frequencies are offered, so the server's
              // 403 is a backstop rather than something users can trip.
              options={usage.allowedFrequencies.map((frequency) => ({
                value: frequency,
                label: frequency === "daily" ? t.freqDaily : t.freqWeekly,
              }))}
            />
          </div>
          {!usage.allowedFrequencies.includes("daily") && (
            <p className="text-xs text-gray-400">{t.frequencyLockedNote}</p>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-medium text-gray-600 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {t.cancel}
            </button>
            <Button type="submit" loading={saving} disabled={!canSave}>
              {saving ? t.saving : t.save}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

function frequencyLabel(project: RankProjectSummary, t: RankTrackerCopy, locale: DashLocale) {
  if (project.frequency === "daily") return t.freqDaily;
  const weekday = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(project.createdAt));
  return t.weeklyAnchor(weekday);
}

export function RankTrackerClient({ locale }: { locale: DashLocale }) {
  const t = RANK_TRACKER_COPY[locale];
  const serp = SERP_CHECKER_COPY[locale];
  const tools = SEO_TOOLS_COPY[locale];
  const it = tools.items.rank_tracker;
  const scaffold = tools.scaffolds.rank_tracker;

  const [list, setList] = useState<ListResponse | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RankProjectDetail | null>(null);
  const [modal, setModal] = useState<{ initial: ProjectFormState; editingId: string | null } | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);
  /** Closing the detail view clears its data here rather than in an effect. */
  const closeDetail = useCallback(() => {
    setOpenId(null);
    setDetail(null);
  }, []);

  // ── Project list ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    fetch(API)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => {
        if (!cancelled) setList(data as ListResponse);
      })
      .catch(() => {
        if (!cancelled) setError(t.loadFailed);
      });
    return () => {
      cancelled = true;
    };
  }, [t, reloadToken]);

  // ── Open project detail, re-polling while a run is in flight ────────────
  useEffect(() => {
    // No setState on the !openId path: `detail` is cleared by whoever closes
    // the view (closeDetail), so this effect only ever fetches.
    if (!openId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = () => {
      fetch(`${API}/${openId}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((data) => {
          if (cancelled) return;
          const next = data.project as RankProjectDetail;
          setDetail(next);
          // Only poll while something is actually running.
          if (next.pendingCount > 0) timer = setTimeout(load, POLL_INTERVAL_MS);
        })
        .catch(() => {
          if (!cancelled) setError(t.loadFailed);
        });
    };
    load();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [openId, t, reloadToken]);

  const usage = list?.usage;

  async function runNow(projectId: string) {
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`${API}/${projectId}/run`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error || t.runFailed);
        return;
      }
      setNotice(t.runQueued);
      reload();
    } catch {
      setError(t.runFailed);
    }
  }

  async function remove(projectId: string) {
    if (!window.confirm(t.deleteConfirm)) return;
    try {
      const res = await fetch(`${API}/${projectId}`, { method: "DELETE" });
      if (!res.ok) return;
      closeDetail();
      reload();
    } catch {
      // Leave the view as-is; the list reload will reflect reality.
    }
  }

  function openCreate() {
    if (!usage) return;
    setModal({
      editingId: null,
      initial: {
        name: "",
        domain: "",
        keywordsText: "",
        locationCode: String(DEFAULT_LOCATION_CODE),
        languageCode: DEFAULT_LANGUAGE_CODE,
        device: DEFAULT_DEVICE,
        frequency: usage.allowedFrequencies[0] ?? "weekly",
      },
    });
  }

  function openEdit(project: RankProjectDetail) {
    setModal({
      editingId: project.id,
      initial: {
        name: project.name,
        domain: project.domain,
        keywordsText: project.keywords.map((k) => k.keyword).join("\n"),
        locationCode: String(project.locationCode),
        languageCode: project.languageCode,
        device: project.device,
        frequency: project.frequency,
      },
    });
  }

  // Page header carries Help on the right (the Review Links pattern), so it is
  // reachable from every view — including the locked card, where a STARTER
  // tenant most needs to know what the tool actually does before upgrading.
  const header = (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">{it.name}</h2>
        <p className="mt-1 text-sm text-gray-500">{it.description}</p>
      </div>
      <div className="shrink-0">
        <RankTrackerHelpButton locale={locale} />
      </div>
    </div>
  );

  // ── Locked plan (STARTER / AI_VISIBILITY) ───────────────────────────────
  if (usage && !usage.canTrack) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <CardContent>
            <div className="flex flex-col items-center py-14 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                <Lock className="h-7 w-7 text-gray-400" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">{t.lockedTitle}</h3>
              <p className="mt-2 max-w-md text-sm text-gray-500">{t.lockedBody}</p>
              <Link
                href="/billing"
                className="mt-6 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {t.lockedCta}
              </Link>
              {SCAFFOLD_RELATED.rank_tracker && scaffold.related && (
                <Link
                  href={SCAFFOLD_RELATED.rank_tracker}
                  className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  {scaffold.related}
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const banners = (
    <>
      {notice && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-sm text-blue-800">{notice}</p>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
    </>
  );

  // ── Project detail ──────────────────────────────────────────────────────
  if (openId && detail) {
    return (
      <div className="space-y-6">
        {header}

        <button
          type="button"
          onClick={closeDetail}
          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t.backToList}
        </button>

        {banners}

        <Card>
          <CardHeader className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900">{detail.name}</h3>
              <p className="mt-1 text-xs text-gray-500">
                {detail.domain}
                {" · "}
                {serp.locationLabels[detail.locationCode as (typeof RANK_LOCATION_CODES)[number]] ??
                  detail.locationCode}
                {" · "}
                {detail.device === "mobile" ? t.deviceMobile : t.deviceDesktop}
                {" · "}
                {frequencyLabel(detail, t, locale)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={() => void runNow(detail.id)}
                disabled={detail.pendingCount > 0 || detail.overCap}
              >
                {detail.pendingCount > 0 ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Play className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                {detail.pendingCount > 0 ? t.running : t.runNow}
              </Button>
              <button
                type="button"
                onClick={() => openEdit(detail)}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                {t.editProject}
              </button>
              <button
                type="button"
                onClick={() => void remove(detail.id)}
                aria-label={t.deleteProject}
                className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {detail.overCap && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm font-semibold text-amber-900">{t.overCapTitle}</p>
                <p className="mt-1 text-sm text-amber-800">{t.overCapBody}</p>
              </div>
            )}
            {detail.pendingCount > 0 && (
              <p className="text-sm text-gray-500">{t.pendingNote(detail.pendingCount)}</p>
            )}
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
              <span>
                {t.colLastRun}:{" "}
                {detail.lastRunAt ? formatDateTime(detail.lastRunAt, locale) : t.neverRun}
              </span>
              {detail.totalCostUsd > 0 && <span>{t.spend(detail.totalCostUsd.toFixed(4))}</span>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-gray-900">{t.chartTitle}</h3>
          </CardHeader>
          <CardContent>
            <PositionChart points={detail.chart} t={t} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-gray-900">{t.keywordsTitle}</h3>
          </CardHeader>
          <CardContent>
            {detail.keywords.length === 0 ? (
              <p className="text-sm text-gray-500">{t.keywordsEmpty}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                      <th className="py-2 pr-3 font-semibold">{t.colKeyword}</th>
                      <th className="w-28 py-2 pr-3 font-semibold">{t.colPosition}</th>
                      <th className="w-32 py-2 pr-3 font-semibold">{t.colChange}</th>
                      <th className="w-32 py-2 pr-3 font-semibold">{t.col30d}</th>
                      <th className="w-36 py-2 pr-3 font-semibold">{t.colTrend}</th>
                      <th className="w-64 py-2 pr-3 font-semibold">{t.colBestUrl}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {detail.keywords.map((row: RankKeywordRow) => (
                      <tr key={row.id}>
                        <td className="max-w-0 truncate py-2 pr-3 text-gray-800" title={row.keyword}>
                          {row.keyword}
                        </td>
                        <td className="py-2 pr-3">
                          {row.pending ? (
                            <Badge variant="info">{t.running}</Badge>
                          ) : row.position === null ? (
                            <span className="text-xs text-gray-400">{t.notRanked}</span>
                          ) : (
                            <span className="font-medium text-gray-900">{row.position}</span>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          <DeltaCell value={row.deltaPrevious} t={t} />
                        </td>
                        <td className="py-2 pr-3">
                          <DeltaCell value={row.delta30d} t={t} />
                        </td>
                        <td className="py-2 pr-3">
                          <Sparkline points={row.history} />
                        </td>
                        <td className="max-w-0 py-2 pr-3">
                          {row.url ? (
                            <a
                              href={row.url}
                              target="_blank"
                              rel="noopener noreferrer nofollow"
                              className="block truncate text-blue-600 hover:text-blue-700"
                              title={row.url}
                            >
                              {row.url}
                            </a>
                          ) : (
                            <span className="text-gray-300">{t.noData}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {modal && usage && (
          <ProjectModal
            t={t}
            serp={serp}
            usage={usage}
            initial={modal.initial}
            editingId={modal.editingId}
            onClose={() => setModal(null)}
            onSaved={() => {
              setModal(null);
              reload();
            }}
          />
        )}
      </div>
    );
  }

  // ── Project list ────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {header}
      {banners}

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{t.listTitle}</h3>
            {usage && (
              <p className="mt-1 text-xs text-gray-500">
                {t.usageKeywords(usage.trackedKeywords, usage.trackedKeywordLimit)}
                {" · "}
                {t.usageChecks(usage.checksUsed, usage.checksLimit)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            {SCAFFOLD_RELATED.rank_tracker && scaffold.related && (
              <Link
                href={SCAFFOLD_RELATED.rank_tracker}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {scaffold.related}
              </Link>
            )}
            <Button type="button" onClick={openCreate} disabled={!usage}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              {t.newProject}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-gray-500">{t.listIntro}</p>

          {!list ? (
            <div className="animate-pulse space-y-3" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-5 rounded bg-gray-100" style={{ width: `${92 - i * 9}%` }} />
              ))}
            </div>
          ) : list.projects.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <LineChart className="mb-3 h-8 w-8 text-gray-300" aria-hidden="true" />
              <p className="text-sm font-medium text-gray-900">{t.emptyTitle}</p>
              <p className="mt-1 max-w-md text-sm text-gray-500">{t.emptyBody}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                    <th className="py-2 pr-3 font-semibold">{t.colProject}</th>
                    <th className="py-2 pr-3 font-semibold">{t.colDomain}</th>
                    <th className="w-24 py-2 pr-3 text-right font-semibold">{t.colKeywords}</th>
                    <th className="w-32 py-2 pr-3 text-right font-semibold">{t.colAvgPosition}</th>
                    <th className="w-44 py-2 pr-3 font-semibold">{t.colFrequency}</th>
                    <th className="w-44 py-2 pr-3 font-semibold">{t.colLastRun}</th>
                    <th className="w-20 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {list.projects.map((project) => (
                    <tr key={project.id}>
                      <td className="max-w-0 truncate py-2 pr-3 font-medium text-gray-900" title={project.name}>
                        {project.name}
                        {project.overCap && (
                          <Badge variant="warning" className="ml-2">
                            {t.overCapTitle}
                          </Badge>
                        )}
                      </td>
                      <td className="max-w-0 truncate py-2 pr-3 text-gray-600" title={project.domain}>
                        {project.domain}
                      </td>
                      <td className="py-2 pr-3 text-right text-gray-600">{project.keywordCount}</td>
                      <td className="py-2 pr-3 text-right text-gray-600">
                        {project.averagePosition === null
                          ? t.noData
                          : project.averagePosition.toFixed(1)}
                      </td>
                      <td className="py-2 pr-3 text-gray-500">
                        {frequencyLabel(project, t, locale)}
                      </td>
                      <td className="py-2 pr-3 text-gray-500">
                        {project.lastRunAt
                          ? formatDateTime(project.lastRunAt, locale)
                          : t.neverRun}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => setOpenId(project.id)}
                          className="text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                          {t.open}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {modal && usage && (
        <ProjectModal
          t={t}
          serp={serp}
          usage={usage}
          initial={modal.initial}
          editingId={modal.editingId}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
