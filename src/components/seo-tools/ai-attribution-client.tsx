"use client";

// AI Attribution — which assistants sent visitors, and where they landed.
//
// PHASE 1 IS ARRIVALS ONLY. There is no conversion column, no revenue column
// and no placeholder for either, deliberately: an empty "Revenue" header is a
// promise, and the model behind this page has no field that could fill one.
// Conversions are P2 and revenue is P3.
//
// Charts are hand-rolled inline SVG, matching rank-tracker-client.tsx and
// prompt-trends.tsx — recharts is a dependency but is imported nowhere on the
// client, and one sparkline plus one bar list is not the place to change that.
//
// The results half renders from data the server already fetched; only the site
// keys are loaded client-side, because they change in response to buttons here.

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Copy, KeyRound, MousePointerClick, Plus } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import type { AttributionPageData, TrendPoint } from "@/lib/attribution/page-data";
import type { AiVisitSource } from "@/lib/attribution/sources";
import {
  AI_ATTRIBUTION_COPY,
  SEO_TOOLS_COPY,
  type AiAttributionCopy,
  type DashLocale,
} from "@/lib/i18n/dashboard";

const KEYS_API = "/api/ai/visibility/attribution-keys";

interface KeyRow {
  id: string;
  label: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

/**
 * One colour per source, used by both the bar list and the legend so a reader
 * can carry a colour from one to the other. `dark_ai` is deliberately grey: it
 * is the residual bucket and should not compete visually with a named assistant.
 */
const SOURCE_COLOR: Record<AiVisitSource, string> = {
  chatgpt: "#10a37f",
  perplexity: "#20808d",
  gemini: "#4285f4",
  copilot: "#7c3aed",
  claude: "#d97757",
  dark_ai: "#9ca3af",
};

/**
 * The tag the customer pastes. `siteUrl` arrives as a prop from the server page
 * rather than being imported here: @/lib/seo/constants pulls in the whole plan
 * config, and none of that belongs in a client bundle for one string.
 */
function tagFor(siteUrl: string, key: string): string {
  return `<script async src="${siteUrl}/api/public/attribution.js?key=${key}"></script>`;
}

// ─── Trend (inline SVG) ─────────────────────────────────────────────────────

/**
 * New AI-referred visitors per day.
 *
 * The y-axis starts at zero and the baseline is drawn, because this is a count:
 * a sparkline that silently rescales to its own minimum turns "3, 4, 3" into a
 * dramatic mountain range. A window with no traffic at all draws a flat line on
 * the baseline rather than nothing, so "we measured and it was zero" is
 * distinguishable from "we did not measure".
 */
function TrendChart({ points, label }: { points: TrendPoint[]; label: string }) {
  const W = 720;
  const H = 120;
  const PAD_B = 16;

  const max = Math.max(1, ...points.map((p) => p.visitors));
  const step = points.length > 1 ? W / (points.length - 1) : 0;

  const coords = points.map((p, i) => {
    const x = points.length > 1 ? i * step : W / 2;
    const y = H - PAD_B - (p.visitors / max) * (H - PAD_B - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-32 w-full"
      role="img"
      aria-label={`${label}: ${points.map((p) => `${p.day} ${p.visitors}`).join(", ")}`}
      preserveAspectRatio="none"
    >
      <line
        x1={0}
        y1={H - PAD_B}
        x2={W}
        y2={H - PAD_B}
        stroke="#e5e7eb"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={`0,${H - PAD_B} ${coords.join(" ")} ${W},${H - PAD_B}`}
        fill="#3b82f6"
        fillOpacity={0.08}
        stroke="none"
      />
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke="#3b82f6"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// ─── Install panel ──────────────────────────────────────────────────────────

function InstallPanel({
  t,
  locale,
  siteUrl,
  onInstalledChange,
}: {
  t: AiAttributionCopy;
  locale: DashLocale;
  siteUrl: string;
  onInstalledChange: (installed: boolean) => void;
}) {
  const [keys, setKeys] = useState<KeyRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(KEYS_API)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { keys: KeyRow[] }) => {
        setKeys(d.keys);
        onInstalledChange(d.keys.some((k) => !k.revokedAt));
      })
      .catch(() => setError(t.loadFailed));
  }, [t, onInstalledChange]);

  useEffect(load, [load]);

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(KEYS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const issued = (await res.json()) as { key: string };
      setFreshKey(issued.key);
      setLabel("");
      load();
    } catch {
      setError(t.actionFailed);
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    if (!window.confirm(t.revokeConfirm)) return;
    try {
      const res = await fetch(`${KEYS_API}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error(String(res.status));
      load();
    } catch {
      setError(t.actionFailed);
    }
  }

  async function copyText(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1400);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="flex items-center gap-2 text-sm text-red-500">
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
      )}

      {/* The tag, with the key in it — shown exactly once. */}
      {freshKey && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">{t.keyOnce}</p>
          <code className="mt-2 block break-all rounded bg-white px-3 py-2 font-mono text-xs text-gray-800">
            {tagFor(siteUrl, freshKey)}
          </code>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => copyText("fresh", tagFor(siteUrl, freshKey))}>
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              {copied === "fresh" ? t.copied : t.copyTag}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setFreshKey(null)}>
              {t.done}
            </Button>
          </div>
          <p className="mt-3 text-xs text-amber-800">{t.publishableNote}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-gray-900">{t.installTitle}</h3>
          <p className="mt-1 text-sm text-gray-500">{t.installIntro}</p>
        </CardHeader>
        <CardContent>
          <code className="block break-all rounded bg-gray-50 px-3 py-2 font-mono text-xs text-gray-500">
            {tagFor(siteUrl, "er_pub_…")}
          </code>
          <p className="mt-2 text-xs text-gray-400">{t.installNoKey}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-gray-900">{t.createTitle}</h3>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t.labelPlaceholder}
            aria-label={t.labelLabel}
            className="sm:max-w-xs"
          />
          <Button onClick={create} disabled={creating}>
            <Plus className="mr-1.5 h-4 w-4" />
            {creating ? t.creating : t.createButton}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-gray-900">{t.yourKeys}</h3>
        </CardHeader>
        <CardContent className="p-0">
          {!keys && !error && <p className="px-6 pb-5 text-sm text-gray-400">{t.loading}</p>}
          {keys && keys.length === 0 && (
            <p className="px-6 pb-5 text-sm text-gray-500">{t.emptyKeys}</p>
          )}
          {keys && keys.length > 0 && (
            <ul className="divide-y divide-gray-100">
              {keys.map((k) => (
                <li key={k.id} className="flex items-center justify-between gap-3 px-6 py-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium text-gray-900">
                      <KeyRound className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                      {k.label}
                      <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-500">
                        er_pub_{k.prefix}…
                      </code>
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {t.createdLabel} {formatDate(k.createdAt, locale)} · {t.lastUsedLabel}{" "}
                      {k.lastUsedAt ? formatDate(k.lastUsedAt, locale) : t.neverUsed}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge variant={k.revokedAt ? "default" : "success"}>
                      {k.revokedAt ? t.statusRevoked : t.statusActive}
                    </Badge>
                    {!k.revokedAt && (
                      <Button variant="outline" size="sm" onClick={() => revoke(k.id)}>
                        {t.revoke}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export function AiAttributionClient({
  locale,
  data,
  siteUrl,
}: {
  locale: DashLocale;
  data: AttributionPageData;
  /** Public origin the snippet is served from. Server-supplied — see tagFor(). */
  siteUrl: string;
}) {
  const t = AI_ATTRIBUTION_COPY[locale];
  const it = SEO_TOOLS_COPY[locale].items.ai_attribution;

  // Seeded from the server so the first paint is right; the install panel
  // corrects it after it loads, so creating the first key reveals the results
  // section without a reload.
  const [installed, setInstalled] = useState(data.installed);

  const maxSourceVisitors = useMemo(
    () => Math.max(1, ...data.bySource.map((s) => s.visitors)),
    [data.bySource],
  );

  const showDarkAiHint = data.bySource.some((s) => s.source === "dark_ai");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">{it.name}</h2>
        <p className="mt-1 max-w-3xl text-sm text-gray-500">{t.intro}</p>
      </div>

      {/* Results. Hidden entirely until a key exists — an all-zero dashboard
          before install reads as "the product found nothing", which is a
          different and much worse message than "you have not installed it". */}
      {installed && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-6 sm:col-span-1">
              <p className="text-sm font-medium text-gray-500">{t.totalTitle}</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">{data.totalVisitors}</p>
              <p className="mt-1 text-xs text-gray-400">{t.windowLabel(data.windowDays)}</p>
              <p className="mt-2 text-xs text-gray-400">{t.totalHint}</p>
            </Card>

            <Card className="p-6 sm:col-span-2">
              <p className="text-sm font-medium text-gray-500">{t.bySourceTitle}</p>
              {data.bySource.length === 0 ? (
                <p className="mt-3 text-sm text-gray-400">{t.emptyWindow(data.windowDays)}</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {data.bySource.map((s) => (
                    <li key={s.source} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-xs text-gray-600">
                        {t.sourceNames[s.source] ?? s.source}
                      </span>
                      <span className="h-2 flex-1 overflow-hidden rounded bg-gray-100">
                        <span
                          className="block h-full rounded"
                          style={{
                            width: `${(s.visitors / maxSourceVisitors) * 100}%`,
                            backgroundColor: SOURCE_COLOR[s.source],
                          }}
                        />
                      </span>
                      <span className="w-10 shrink-0 text-right text-xs font-medium text-gray-900">
                        {s.visitors}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {showDarkAiHint && <p className="mt-3 text-xs text-gray-400">{t.darkAiHint}</p>}
            </Card>
          </div>

          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-gray-900">{t.trendTitle}</h3>
              <p className="mt-1 text-sm text-gray-500">{t.windowLabel(data.windowDays)}</p>
            </CardHeader>
            <CardContent>
              <TrendChart points={data.trend} label={t.trendTitle} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-gray-900">{t.landingTitle}</h3>
            </CardHeader>
            <CardContent className="p-0">
              {data.landingPages.length === 0 ? (
                <p className="px-6 pb-5 text-sm text-gray-500">
                  {data.hasData ? t.emptyWindow(data.windowDays) : t.emptyResults}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                        <th className="px-6 py-2 font-medium">{t.colPage}</th>
                        <th className="px-6 py-2 font-medium">{t.colSources}</th>
                        <th className="px-6 py-2 text-right font-medium">{t.colVisitors}</th>
                        <th className="px-6 py-2 text-right font-medium">{t.colRepeat}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.landingPages.map((row) => (
                        <tr key={row.landingPath}>
                          <td className="max-w-md truncate px-6 py-2.5 font-mono text-xs text-gray-800">
                            {row.landingPath}
                          </td>
                          <td className="px-6 py-2.5">
                            <span className="flex flex-wrap gap-1">
                              {row.sources.map((s) => (
                                <span
                                  key={s}
                                  className="rounded px-1.5 py-0.5 text-xs text-white"
                                  style={{ backgroundColor: SOURCE_COLOR[s] }}
                                >
                                  {t.sourceNames[s] ?? s}
                                </span>
                              ))}
                            </span>
                          </td>
                          <td className="px-6 py-2.5 text-right font-medium text-gray-900">
                            {row.visitors}
                          </td>
                          {/* hits - visitors: arrivals beyond the first. Kept
                              separate from the visitor count on purpose. */}
                          <td className="px-6 py-2.5 text-right text-gray-500">
                            {Math.max(0, row.hits - row.visitors)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!installed && (
        <Card className="border-dashed">
          <CardContent className="flex items-start gap-3 py-6">
            <MousePointerClick className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
            <p className="text-sm text-gray-500">{t.emptyResults}</p>
          </CardContent>
        </Card>
      )}

      <InstallPanel t={t} locale={locale} siteUrl={siteUrl} onInstalledChange={setInstalled} />
    </div>
  );
}
