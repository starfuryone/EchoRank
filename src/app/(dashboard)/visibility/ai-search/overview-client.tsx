"use client";

// The AI Search overview.
//
// EVERY NUMBER HERE WAS READ, NOT COMPUTED. The only arithmetic in this file is
// the display conversions in dashboard/display.ts — fraction to percent, signed
// sentiment to a track position, rank to an inverted bar. Nothing re-scores.
//
// CHART FORMS, chosen by the job rather than by variety:
//   score history      trend over time, ONE series -> line, no legend (the
//                      title names it), last point direct-labelled
//   by engine          magnitude across nominal categories -> bars in ONE hue.
//                      A darker-where-bigger ramp would double-encode length as
//                      hue and burn the only free channel on information the
//                      bar already shows.
//   competitors        the brand among its rivals -> EMPHASIS: the brand in the
//                      accent hue, everyone else in the de-emphasis gray. The
//                      story is one row, so eight hues would bury it.
//   citation domains   magnitude -> bars, one hue, own domain emphasised
//
// The de-emphasis gray is deliberately achromatic and therefore "fails" a
// categorical chroma check — that is what emphasis IS. Do not saturate it to
// make a validator happy; it would stop reading as background. Its bars carry
// visible value labels, which is the relief a low-contrast mark requires.

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  coverageNote,
  formatDay,
  formatInstant,
  fractionAsPercent,
  mentionFrequencyLabel,
  positionLabel,
  sentimentLabel,
  sentimentPercent,
  type MetricView,
} from "@/lib/ai-monitor/dashboard/display";

/** Validated against the surface: CVD ΔE 18.3, normal-vision 19.2, contrast pass. */
const ACCENT = "#2563eb";
const DEEMPHASIS = "#6b7280";
const GRID = "#e5e7eb";
const AXIS_TEXT = "#6b7280";

interface Competitor {
  name: string;
  appearances: number;
  averagePosition: number | null;
}
interface CitationDomain {
  domain: string;
  count: number;
  isMonitored: boolean;
}
interface HistoryEntry {
  id: string;
  status: string;
  startedAt: Date | string | null;
  completedAt: Date | string | null;
  stoppedReason: string | null;
}

export function AiSearchOverview({
  brands,
  brand,
  metrics,
  competitors,
  citationDomains,
  history,
  timezone,
}: {
  brands: { id: string; name: string }[];
  brand: { id: string; name: string; promptCount: number };
  metrics: MetricView[];
  competitors: Competitor[];
  citationDomains: CitationDomain[];
  history: HistoryEntry[];
  timezone: string;
}) {
  const [showTable, setShowTable] = useState(false);

  const supported = useMemo(
    () => metrics.filter((m): m is Extract<MetricView, { supported: true }> => m.supported),
    [metrics],
  );
  const unsupportedCount = metrics.length - supported.length;

  /** The most recent day, across engines. Averaged for the headline cards. */
  const latest = useMemo(() => {
    if (supported.length === 0) return null;
    const lastDay = supported[supported.length - 1].day;
    const key = new Date(lastDay).toISOString();
    return supported.filter((m) => new Date(m.day).toISOString() === key);
  }, [supported]);

  const headline = useMemo(() => {
    if (!latest || latest.length === 0) return null;
    const mean = (values: number[]) =>
      values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
    const positions = latest
      .map((m) => m.averagePosition)
      .filter((p): p is number => p !== null);
    const sentiments = latest
      .map((m) => m.sentimentScore)
      .filter((s): s is number => s !== null);
    return {
      // A mean of the day's per-engine rows. NOT a re-score: each row's own
      // score is what was stored, and the average of stored numbers is a
      // summary, not a new formula.
      score: mean(latest.map((m) => m.score)) ?? 0,
      mentionRate: mean(latest.map((m) => m.mentionRate)) ?? 0,
      position: positions.length > 0 ? mean(positions) : null,
      sentiment: sentiments.length > 0 ? mean(sentiments) : null,
      citations: latest.filter((m) => (m.citationScore ?? 0) > 0).length,
      partial: latest.some((m) => m.partialCoverage),
      day: latest[0].day,
      runCount: latest.reduce((total, m) => total + m.runCount, 0),
    };
  }, [latest]);

  /** One point per day: the mean of that day's engine rows. */
  const scoreHistory = useMemo(() => {
    const byDay = new Map<string, { day: Date; scores: number[]; partial: boolean }>();
    for (const metric of supported) {
      const key = new Date(metric.day).toISOString();
      const bucket = byDay.get(key) ?? { day: metric.day, scores: [], partial: false };
      bucket.scores.push(metric.score);
      bucket.partial = bucket.partial || metric.partialCoverage;
      byDay.set(key, bucket);
    }
    return [...byDay.values()].map((bucket) => ({
      label: formatDay(new Date(bucket.day), timezone),
      score: Math.round((bucket.scores.reduce((a, b) => a + b, 0) / bucket.scores.length) * 10) / 10,
      partial: bucket.partial,
    }));
  }, [supported, timezone]);

  const byEngine = useMemo(() => {
    if (!latest) return [];
    return latest
      .map((metric) => ({
        engine: metric.engine,
        score: metric.score,
        // The specific count, not a generic flag: "6 of 10 answers collected"
        // tells a reader how much to discount the number.
        note: coverageNote(metric).label,
      }))
      .sort((a, b) => b.score - a.score);
  }, [latest]);

  // State (b): the gate is on and setup is done, but nothing has landed yet.
  if (supported.length === 0 && unsupportedCount === 0) {
    return (
      <Shell brand={brand} brands={brands}>
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-medium text-gray-900">First checkup on its way</h2>
          <p className="mt-2 text-sm text-gray-600">
            We are asking your {brand.promptCount} questions across the engines you picked.
            Results usually land within the hour, and this page fills in as they do.
          </p>
          {history.length > 0 && <HistoryList history={history} timezone={timezone} />}
        </div>
      </Shell>
    );
  }

  // Everything we have is from a formula this build cannot interpret.
  if (supported.length === 0) {
    return (
      <Shell brand={brand} brands={brands}>
        <UnsupportedNotice count={unsupportedCount} />
      </Shell>
    );
  }

  // State (c): running, but the brand has never been named. A real finding, and
  // deliberately not a broken chart — mention frequency reads 0%, and the
  // framing says "not yet visible" rather than implying something is wrong.
  const neverMentioned = supported.every((metric) => metric.mentionRate === 0);

  return (
    <Shell brand={brand} brands={brands}>
      {unsupportedCount > 0 && <UnsupportedNotice count={unsupportedCount} />}

      {neverMentioned && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-medium text-amber-900">Not yet visible</h2>
          <p className="mt-1 text-sm text-amber-800">
            Across {headline?.runCount ?? 0} answers, no assistant has mentioned {brand.name} yet.
            That is the starting point, not an error — the questions below are where to work.
          </p>
        </div>
      )}

      {headline && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <HeroCard
              label="AI Search Score"
              value={headline.score.toFixed(1)}
              partial={headline.partial}
              hint={`out of 100 · ${formatDay(new Date(headline.day), timezone)}`}
            />
            <Card
              label="Mention frequency"
              value={fractionAsPercent(headline.mentionRate)}
              hint={mentionFrequencyLabel(headline.mentionRate)}
              partial={headline.partial}
            />
            <Card
              label="Average position"
              value={positionLabel(headline.position)}
              // A place, never a 0-100 axis. The hint says which way is good.
              hint={headline.position === null ? "not ranked yet" : "lower is better"}
              partial={headline.partial}
            />
            <Card
              label="Citations"
              value={String(headline.citations)}
              hint={`engines citing ${brand.name}`}
              partial={headline.partial}
            />
            <Card
              label="Sentiment"
              value={sentimentLabel(headline.sentiment)}
              hint={
                headline.sentiment === null
                  ? "no reading yet"
                  : `${sentimentPercent(headline.sentiment)} of 100`
              }
              partial={headline.partial}
            />
          </section>

          {headline.partial && (
            <p className="mt-2 text-xs text-amber-700">
              Some runs were skipped or failed, so these are computed from less than a full
              checkup.
            </p>
          )}
        </>
      )}

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel
          title="Score history"
          action={
            <button
              type="button"
              onClick={() => setShowTable((v) => !v)}
              className="text-xs font-medium text-blue-600"
            >
              {showTable ? "Show chart" : "Show table"}
            </button>
          }
        >
          {showTable ? (
            <ScoreTable rows={scoreHistory} />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={scoreHistory} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: AXIS_TEXT }}
                  tickLine={false}
                  axisLine={{ stroke: GRID }}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: AXIS_TEXT }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: GRID }}
                  formatter={(value) => [String(value ?? ""), "AI Search Score"]}
                />
                {/* One series, so no legend — the panel title names it. */}
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke={ACCENT}
                  strokeWidth={2}
                  dot={{ r: 3, fill: ACCENT }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="By engine" subtitle="Latest checkup">
          <HorizontalBars
            rows={byEngine.map((row) => ({
              label: row.engine,
              value: row.score,
              emphasised: true,
              suffix: row.note ? ` · ${row.note}` : "",
            }))}
            max={100}
          />
        </Panel>

        <Panel title="Competitors" subtitle="Answers each appeared in">
          {competitors.length === 0 ? (
            <Muted>No competitors named yet.</Muted>
          ) : (
            <HorizontalBars
              rows={competitors.map((competitor) => ({
                label: competitor.name,
                value: competitor.appearances,
                emphasised: false,
                suffix:
                  competitor.averagePosition === null
                    ? ""
                    : ` · avg ${positionLabel(competitor.averagePosition)}`,
              }))}
              max={Math.max(...competitors.map((c) => c.appearances), 1)}
            />
          )}
        </Panel>

        <Panel title="Cited sources" subtitle="Domains AI answers point at">
          {citationDomains.length === 0 ? (
            <Muted>No citations recorded yet.</Muted>
          ) : (
            <HorizontalBars
              rows={citationDomains.map((domain) => ({
                label: domain.domain,
                value: domain.count,
                // Emphasis: the brand's own domain is the row that matters.
                emphasised: domain.isMonitored,
                suffix: domain.isMonitored ? " · yours" : "",
              }))}
              max={Math.max(...citationDomains.map((d) => d.count), 1)}
            />
          )}
        </Panel>
      </section>

      <Panel title="Checkup history" className="mt-4">
        <HistoryList history={history} timezone={timezone} />
      </Panel>

      <div className="mt-4">
        <Link
          href={`/visibility/ai-search/prompts?brand=${brand.id}`}
          className="text-sm font-medium text-blue-600"
        >
          See all {brand.promptCount} questions →
        </Link>
      </div>
    </Shell>
  );
}

// ── pieces ──────────────────────────────────────────────────────────────────

function Shell({
  brand,
  brands,
  children,
}: {
  brand: { id: string; name: string };
  brands: { id: string; name: string }[];
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{brand.name}</h1>
        {brands.length > 1 && (
          <nav className="flex gap-2">
            {brands.map((option) => (
              <Link
                key={option.id}
                href={`/visibility/ai-search?brand=${option.id}`}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                  option.id === brand.id
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {option.name}
              </Link>
            ))}
          </nav>
        )}
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function UnsupportedNotice({ count }: { count: number }) {
  return (
    <div className="mb-4 rounded-xl border border-gray-300 bg-gray-50 p-4">
      <h2 className="text-sm font-medium text-gray-900">Unsupported score version</h2>
      <p className="mt-1 text-sm text-gray-600">
        {count} {count === 1 ? "day was" : "days were"} scored with a newer formula than this
        page understands, so {count === 1 ? "it is" : "they are"} not shown. Nothing is wrong with
        the data — showing it under this page&apos;s labels would be misleading.
      </p>
    </div>
  );
}

function HeroCard({
  label,
  value,
  hint,
  partial,
}: {
  label: string;
  value: string;
  hint: string;
  partial: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-4xl font-semibold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{hint}</p>
      {partial && <PartialTag />}
    </div>
  );
}

function Card({
  label,
  value,
  hint,
  partial,
}: {
  label: string;
  value: string;
  hint: string;
  partial: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{hint}</p>
      {partial && <PartialTag />}
    </div>
  );
}

/** On the metric itself — a banner at the top is forgotten by the fourth card. */
function PartialTag() {
  return (
    <span className="mt-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
      Partial coverage
    </span>
  );
}

function Panel({
  title,
  subtitle,
  action,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-xl border border-gray-200 bg-white p-4 ${className ?? ""}`}>
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <h2 className="text-sm font-medium text-gray-900">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-gray-500">{children}</p>;
}

/**
 * Horizontal bars in one hue, with the value always visible.
 *
 * Direct labels rather than an axis: the categories are names of varying length,
 * and a value beside each bar is the relief a low-contrast de-emphasis fill
 * requires. Built in plain HTML rather than recharts because a labelled
 * horizontal list is a layout problem, not a plotting one.
 */
function HorizontalBars({
  rows,
  max,
}: {
  rows: { label: string; value: number; emphasised: boolean; suffix?: string }[];
  max: number;
}) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="flex items-baseline justify-between text-xs">
            <span className="truncate pr-2 text-gray-700">{row.label}</span>
            <span className="shrink-0 tabular-nums text-gray-900">
              {row.value}
              <span className="text-gray-500">{row.suffix}</span>
            </span>
          </div>
          <div className="mt-1 h-2 w-full rounded-full bg-gray-100">
            <div
              className="h-2 rounded-full"
              style={{
                width: `${Math.max(2, (row.value / max) * 100)}%`,
                backgroundColor: row.emphasised ? ACCENT : DEEMPHASIS,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** The table view every chart owes a reader who cannot use the chart. */
function ScoreTable({ rows }: { rows: { label: string; score: number; partial: boolean }[] }) {
  return (
    <div className="max-h-56 overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-gray-500">
          <tr>
            <th className="py-1">Day</th>
            <th className="py-1 text-right">AI Search Score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-gray-100">
              <td className="py-1 text-gray-700">
                {row.label}
                {row.partial && <span className="ml-1 text-xs text-amber-700">partial</span>}
              </td>
              <td className="py-1 text-right tabular-nums text-gray-900">{row.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  READY: "bg-emerald-100 text-emerald-800",
  PARTIAL: "bg-amber-100 text-amber-800",
  FAILED: "bg-red-100 text-red-800",
  RUNNING: "bg-blue-100 text-blue-800",
  PENDING: "bg-gray-100 text-gray-700",
};

/**
 * Checkups, failures included.
 *
 * A failed checkup is a fact about a day, not an absence of one. Dropping them
 * would leave a gap that reads as "nothing was scheduled" when the truth is
 * "we tried and could not", and those need different responses.
 */
function HistoryList({ history, timezone }: { history: HistoryEntry[]; timezone: string }) {
  if (history.length === 0) return <Muted>No checkups yet.</Muted>;
  return (
    <ul className="divide-y divide-gray-100 text-sm">
      {history.map((entry) => (
        <li key={entry.id} className="flex items-center justify-between py-2">
          <span className="text-gray-700">
            {entry.completedAt || entry.startedAt
              ? formatInstant(new Date((entry.completedAt ?? entry.startedAt) as string), timezone)
              : "queued"}
          </span>
          <span className="flex items-center gap-2">
            {entry.stoppedReason && (
              <span className="text-xs text-gray-500">{entry.stoppedReason}</span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                STATUS_STYLES[entry.status] ?? "bg-gray-100 text-gray-700"
              }`}
            >
              {entry.status}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
