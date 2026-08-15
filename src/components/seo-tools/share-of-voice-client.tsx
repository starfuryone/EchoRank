"use client";

// AI Share of Voice — stacked bars per engine, a trend line, and the headline.
//
// Charts are hand-rolled: the stacked bars are flex divs with percentage
// widths, and the trend is inline SVG. Same choice ai-attribution-client.tsx
// and rank-tracker-client.tsx made — recharts is a dependency but is imported
// nowhere on the client, and a proportion bar plus one line is not the place to
// start shipping it. The bars are HTML rather than SVG on purpose: a stacked
// proportion needs no axis or scale, and percentage widths reflow correctly at
// every viewport where a `preserveAspectRatio="none"` SVG would distort its own
// rounded corners.
//
// ── Colour ──────────────────────────────────────────────────────────────────
// The categorical ramp below is a validated palette: run
//   node scripts/validate_palette.js "#2a78d6,#eb6834,#1baf7a,#eda100,#e87ba4,#008300" --mode light
// and every gate passes (worst adjacent CVD ΔE 9.1, worst normal-vision ΔE
// 19.6). Three of the six sit below 3:1 against a white surface, which obliges
// RELIEF — so every segment's identity and value are also carried in the legend
// as text, and no reader depends on telling two fills apart.
//
// COLOUR FOLLOWS THE ENTITY, NOT ITS RANK. Slots are assigned once, from the
// union of brands across every engine ordered by pooled share, and the tracked
// brand is pinned to slot 1. Assigning per bar would repaint a rival from
// orange to green between two engines on the same screen, which reads as two
// different companies.
//
// Light mode only, deliberately: this dashboard has no dark theme — there is no
// `darkMode` in the Tailwind config and not one `dark:` class in any sibling
// tool client — so a second set of steps would be unreachable code.

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, PieChart } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  SEO_TOOLS_COPY,
  SHARE_OF_VOICE_COPY,
  type DashLocale,
} from "@/lib/i18n/dashboard";
import type { SovBrandShare, SovEngineBreakdown, SovPageData } from "@/lib/sov/read";

/** Categorical slots, in the fixed order the validator cleared. Never cycled. */
const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300"] as const;
/** The pooled remainder. Grey because it is not an entity and must not compete. */
const OTHER_COLOR = "#9ca3af";

/** BCP-47 for the three dashboard locales, for number formatting. */
const INTL_LOCALE: Record<DashLocale, string> = {
  en: "en",
  fr: "fr",
  "de-CH": "de-CH",
};

function usePercent(locale: DashLocale) {
  return useCallback(
    (value: number, digits = 1) =>
      new Intl.NumberFormat(INTL_LOCALE[locale], {
        style: "percent",
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(value / 100),
    [locale],
  );
}

function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_m, key: string) =>
    values[key] === undefined ? "" : String(values[key]),
  );
}

/**
 * One colour per brand, stable across every bar on the page.
 *
 * The brand's own row takes slot 1 wherever it ranks; rivals fill the rest in
 * pooled-share order. A brand past the last slot cannot occur — read.ts pools
 * everything after MAX_STACK_BRANDS into the "Other" row before it gets here —
 * but the fallback is grey rather than a cycled hue, because a repeated colour
 * is a wrong answer and grey is only a dull one.
 */
function buildColorMap(byEngine: readonly SovEngineBreakdown[], brandName: string | null) {
  const pooled = new Map<string, number>();
  for (const engine of byEngine) {
    for (const row of engine.brands) {
      if (row.isOther) continue;
      pooled.set(row.brand, (pooled.get(row.brand) ?? 0) + row.share);
    }
  }

  const ordered = [...pooled.entries()]
    .filter(([brand]) => brand !== brandName)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([brand]) => brand);

  const colors = new Map<string, string>();
  let slot = 0;
  if (brandName !== null) colors.set(brandName, SERIES[slot++]);
  for (const brand of ordered) {
    colors.set(brand, SERIES[slot] ?? OTHER_COLOR);
    slot += 1;
  }
  return colors;
}

// ─── Stacked bar ────────────────────────────────────────────────────────────

/**
 * One engine's answers, split by who owned them.
 *
 * A 2px gap between segments (the surface showing through) is what keeps two
 * adjacent fills readable as two segments rather than one gradient — it is the
 * secondary encoding the CVD floor asks for, alongside the legend's text.
 */
function StackedBar({
  breakdown,
  colors,
  copy,
  locale,
  brandName,
}: {
  breakdown: SovEngineBreakdown;
  colors: Map<string, string>;
  copy: (typeof SHARE_OF_VOICE_COPY)[DashLocale];
  locale: DashLocale;
  brandName: string | null;
}) {
  const percent = usePercent(locale);
  const label = (row: SovBrandShare) => (row.isOther ? copy.everyoneElse : row.brand);

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="text-sm font-semibold text-gray-900">{breakdown.engine}</h4>
        <span className="text-xs text-gray-500">
          {interpolate(copy.promptCount, { count: breakdown.promptCount })}
        </span>
      </div>

      <div
        className="flex h-6 w-full gap-0.5 overflow-hidden rounded"
        role="img"
        aria-label={`${breakdown.engine}: ${breakdown.brands
          .map((row) => `${label(row)} ${percent(row.share)}`)
          .join(", ")}`}
      >
        {breakdown.brands.map((row) => (
          <div
            key={`${breakdown.engine}-${row.brand}-${row.isOther ? "other" : "brand"}`}
            className="h-full first:rounded-l last:rounded-r"
            style={{
              width: `${row.share}%`,
              backgroundColor: row.isOther ? OTHER_COLOR : (colors.get(row.brand) ?? OTHER_COLOR),
            }}
            // The native tooltip is the hover layer here. This codebase ships no
            // tooltip primitive, and a bespoke one for a proportion bar whose
            // every value is already printed in the legend below would be more
            // surface than the chart has information.
            title={`${label(row)} — ${percent(row.share)}`}
          />
        ))}
      </div>

      {/* The relief the contrast check obliges: identity and value as text, so
          nothing on this chart is carried by fill alone. */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {breakdown.brands.map((row) => (
          <li
            key={`legend-${breakdown.engine}-${row.brand}-${row.isOther ? "other" : "brand"}`}
            className="flex items-center gap-1.5 text-xs"
          >
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{
                backgroundColor: row.isOther
                  ? OTHER_COLOR
                  : (colors.get(row.brand) ?? OTHER_COLOR),
              }}
            />
            <span
              className={
                row.brand === brandName && !row.isOther
                  ? "font-semibold text-gray-900"
                  : "text-gray-600"
              }
            >
              {label(row)}
            </span>
            <span className="tabular-nums text-gray-500">{percent(row.share)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Trend ──────────────────────────────────────────────────────────────────

/**
 * The brand's own share, one point per nightly rollup.
 *
 * ZERO BASELINE, always. This is a proportion: a line rescaled to its own
 * minimum turns 21%, 22%, 21% into a mountain range and would make the drop
 * alert look like it fires at random. The top of the scale is headroom above
 * the observed maximum rather than a fixed 100%, so a brand that owns 4% can
 * still see its own movement — the axis labels say which is which.
 */
function TrendChart({
  points,
  locale,
  label,
}: {
  points: readonly { date: string; share: number | null }[];
  locale: DashLocale;
  label: string;
}) {
  const percent = usePercent(locale);
  const W = 720;
  const H = 140;
  const PAD_B = 18;
  const PAD_T = 6;

  const values = points.map((p) => p.share ?? 0);
  const top = Math.max(10, Math.ceil(Math.max(...values, 0) * 1.25));
  const step = points.length > 1 ? W / (points.length - 1) : 0;

  const coords = points.map((p, i) => {
    const x = points.length > 1 ? i * step : W / 2;
    const y = H - PAD_B - ((p.share ?? 0) / top) * (H - PAD_B - PAD_T);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-36 w-full"
        role="img"
        aria-label={`${label}: ${points.map((p) => `${p.date} ${percent(p.share ?? 0)}`).join(", ")}`}
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
          fill={SERIES[0]}
          fillOpacity={0.08}
          stroke="none"
        />
        <polyline
          points={coords.join(" ")}
          fill="none"
          stroke={SERIES[0]}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="flex justify-between text-xs text-gray-500">
        <span className="tabular-nums">{points[0]?.date ?? ""}</span>
        <span className="tabular-nums">
          0–{percent(top, 0)}
        </span>
        <span className="tabular-nums">{points[points.length - 1]?.date ?? ""}</span>
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export function ShareOfVoiceClient({
  locale,
  data,
  locked,
  answerTrackingEnabled,
}: {
  locale: DashLocale;
  data: SovPageData;
  locked: boolean;
  /**
   * aiSearchEnabledFor(tenantId), resolved on the SERVER and passed in. The
   * client cannot compute it — the rollout is an env read plus a tenant
   * allowlist — and it must not guess, because the answer decides whether the
   * empty state offers a link that would 404.
   */
  answerTrackingEnabled: boolean;
}) {
  const copy = SHARE_OF_VOICE_COPY[locale];
  const item = SEO_TOOLS_COPY[locale].items.share_of_voice;
  const percent = usePercent(locale);
  const router = useRouter();
  const search = useSearchParams();

  // Filters drive the SERVER read, not a client-side slice: the window's rows
  // are the only thing that can answer a different prompt set, and shipping
  // every set's history to the browser to filter it there would send far more
  // data than the page renders.
  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(search?.toString() ?? "");
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
      router.push(`/visibility/tools/share-of-voice?${next.toString()}`);
    },
    [router, search],
  );

  const header = (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">{item.name}</h2>
        <p className="mt-1 text-sm text-gray-500">{item.description}</p>
      </div>
    </div>
  );

  // ── Locked (below Growth) ────────────────────────────────────────────────
  if (locked) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <CardContent>
            <div className="flex flex-col items-center py-14 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                <Lock className="h-7 w-7 text-gray-400" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">{copy.lockedTitle}</h3>
              <p className="mt-2 max-w-md text-sm text-gray-500">{copy.lockedBody}</p>
              <Link
                href="/billing"
                className="mt-6 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {copy.lockedCta}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Empty (unlocked, no rollup yet) ──────────────────────────────────────
  if (!data.hasData) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <CardContent>
            <div className="flex flex-col items-center py-14 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                <PieChart className="h-7 w-7 text-gray-400" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">{copy.emptyTitle}</h3>
              <p className="mt-2 max-w-md text-sm text-gray-500">{copy.emptyBody}</p>
              {/* ── THE CTA IS CONDITIONAL ──────────────────────────────────
                  /visibility/ai-search/setup notFound()s when the answer-
                  tracking rollout is off for this tenant, so linking to it
                  unconditionally sent every non-rolled-out tenant to a 404 —
                  the same failure the hub's rollout-HIDES rule exists to stop.

                  No fallback destination, because none would help. Share of
                  voice is computed from MentionAnalysis and CompetitorMention,
                  both written by persistRunAnalysis on the checkup path, and
                  the checkup sweep filters brands through aiSearchEnabledFor()
                  before enqueuing anything. Without the rollout this page
                  cannot fill however many prompts are added, so a CTA would be
                  a promise we cannot keep. */}
              {answerTrackingEnabled ? (
                <Link
                  href="/visibility/ai-search/setup"
                  className="mt-6 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  {copy.emptySetupCta}
                </Link>
              ) : (
                <p className="mt-6 max-w-md text-sm text-gray-400">{copy.emptyRolloutNote}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const colors = buildColorMap(data.byEngine, data.brandName);
  const { headline } = data;

  const deltaText =
    headline.delta === null || headline.deltaSpanDays === null
      ? copy.deltaUnavailable
      : interpolate(
          Math.abs(headline.delta) < 0.05
            ? copy.deltaFlat
            : headline.delta > 0
              ? copy.deltaUp
              : copy.deltaDown,
          {
            points: Math.abs(headline.delta).toFixed(1),
            days: headline.deltaSpanDays,
          },
        );

  return (
    <div className="space-y-6">
      {header}

      {/* ── Filters, one row above the charts ── */}
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600">{copy.promptSetLabel}</span>
          <select
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            value={data.selectedPromptSetId ?? ""}
            onChange={(event) => setParam("promptSet", event.target.value)}
          >
            {data.promptSets.map((set) => (
              <option key={set.id} value={set.id}>
                {set.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600">{copy.engineLabel}</span>
          <select
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            value={data.selectedEngine ?? ""}
            onChange={(event) => setParam("engine", event.target.value || null)}
          >
            <option value="">{copy.allEngines}</option>
            {data.engines.map((engine) => (
              <option key={engine} value={engine}>
                {engine}
              </option>
            ))}
          </select>
        </label>

        {data.latestDate && (
          <p className="ml-auto text-xs text-gray-500">
            {interpolate(copy.asOf, { days: data.windowDays, date: data.latestDate })}
          </p>
        )}
      </div>

      {/* ── Headline: you vs the top rival ── */}
      <Card>
        <CardContent>
          <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2 py-2">
            <p className="text-2xl font-semibold text-gray-900">
              {interpolate(copy.youOwn, { share: percent(headline.you) })}
            </p>
            {headline.topRival ? (
              <p className="text-2xl font-semibold text-gray-500">
                {interpolate(copy.rivalOwns, {
                  rival: headline.topRival.brand,
                  share: percent(headline.topRival.share),
                })}
              </p>
            ) : (
              <p className="text-sm text-gray-500">{copy.noRival}</p>
            )}
            <p className="text-sm text-gray-500">{deltaText}</p>
          </div>
        </CardContent>
      </Card>

      {/* ── Stacked bars, one per engine ── */}
      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-gray-900">{copy.stackTitle}</h3>
          <p className="mt-1 text-sm text-gray-500">
            {interpolate(copy.stackSubtitle, { days: data.windowDays })}
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {data.byEngine.map((breakdown) => (
              <StackedBar
                key={breakdown.engine}
                breakdown={breakdown}
                colors={colors}
                copy={copy}
                locale={locale}
                brandName={data.brandName}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Trend ── */}
      {data.trend.length > 1 && (
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-gray-900">{copy.trendTitle}</h3>
            <p className="mt-1 text-sm text-gray-500">
              {interpolate(copy.trendSubtitle, {
                scope: data.selectedEngine ?? copy.trendScopeAll,
              })}
            </p>
          </CardHeader>
          <CardContent>
            <TrendChart points={data.trend} locale={locale} label={copy.trendTitle} />
          </CardContent>
        </Card>
      )}

      {/* ── How the number is built. Not a footnote: a share nobody can
             reproduce is a share nobody will act on. ── */}
      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-gray-900">{copy.methodTitle}</h3>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-gray-600">{copy.methodBody}</p>
        </CardContent>
      </Card>
    </div>
  );
}
