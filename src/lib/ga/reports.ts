// src/lib/ga/reports.ts
//
// The five panels, as GA4 runReport calls plus the parsing of their responses.
//
// Pure with respect to auth: every function takes an already-minted access
// token, so the whole module is testable by stubbing lib/ga/client.
//
// GA4 returns every metric value as a STRING, including integers, so nothing
// here trusts a raw value — each one goes through num(). A missing metric is
// distinguished from a zero, because "no conversions configured" and "zero
// conversions" are different answers.

import {
  isUnknownFieldError,
  runReport,
  type RunReportResponse,
} from "./client";
import {
  CHANNELS_LIMIT,
  TOP_PAGES_LIMIT,
  TOP_REFERRERS_LIMIT,
  percentChange,
  type DateWindow,
} from "./options";
import {
  HEADLINE_METRICS,
  type ChannelRow,
  type HeadlineMetric,
  type HeadlineMetricKey,
  type PageRow,
  type ReferrerRow,
  type TrafficPoint,
} from "./types";

function num(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(n) ? n : 0;
}

function dim(row: { dimensionValues?: { value?: string }[] } | undefined, i: number): string {
  return row?.dimensionValues?.[i]?.value ?? "";
}

/** GA4 date dimension is "20260729"; the UI and charts want "2026-07-29". */
function isoDate(compact: string): string {
  return /^\d{8}$/.test(compact)
    ? `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`
    : compact;
}

/** metricHeaders order is authoritative — never assume the request order. */
function metricIndex(res: RunReportResponse, name: string): number {
  return (res.metricHeaders ?? []).findIndex((h) => h?.name === name);
}

function metricAt(
  row: { metricValues?: { value?: string }[] } | undefined,
  index: number,
): number {
  return index < 0 ? 0 : num(row?.metricValues?.[index]?.value);
}

// ─── Headline ───────────────────────────────────────────────────────────────

/**
 * GA4 metric name per headline key.
 *
 * `conversions` is the sharp edge: Google renamed it to `keyEvents` in 2024
 * and older properties still expose only the old name. Rather than guess, the
 * request tries `keyEvents` and retries once without it if GA4 rejects the
 * field — the panel then reports the metric as unavailable instead of
 * inventing a zero.
 */
const HEADLINE_GA_METRIC: Record<HeadlineMetricKey, string> = {
  sessions: "sessions",
  totalUsers: "totalUsers",
  newUsers: "newUsers",
  engagementRate: "engagementRate",
  avgEngagementTime: "averageSessionDuration",
  conversions: "keyEvents",
};

/** Metrics every GA4 property is guaranteed to have. */
const CORE_METRICS: HeadlineMetricKey[] = [
  "sessions",
  "totalUsers",
  "newUsers",
  "engagementRate",
  "avgEngagementTime",
];

async function headlineTotals(
  accessToken: string,
  propertyId: string,
  window: DateWindow,
): Promise<{ values: Partial<Record<HeadlineMetricKey, number>>; unavailable: Set<HeadlineMetricKey> }> {
  const keys: HeadlineMetricKey[] = [...CORE_METRICS, "conversions"];
  const unavailable = new Set<HeadlineMetricKey>();

  const request = (withConversions: boolean) => ({
    dateRanges: [window],
    metrics: (withConversions ? keys : CORE_METRICS).map((k) => ({
      name: HEADLINE_GA_METRIC[k],
    })),
  });

  let res: RunReportResponse;
  try {
    res = await runReport(accessToken, propertyId, request(true));
  } catch (err) {
    // A property on the old schema rejects `keyEvents` outright. Retry without
    // it rather than failing the whole headline panel.
    if (!isUnknownFieldError(err)) throw err;
    unavailable.add("conversions");
    res = await runReport(accessToken, propertyId, request(false));
  }

  const totals = res.totals?.[0];
  const values: Partial<Record<HeadlineMetricKey, number>> = {};
  for (const key of keys) {
    if (unavailable.has(key)) continue;
    const index = metricIndex(res, HEADLINE_GA_METRIC[key]);
    if (index < 0) {
      unavailable.add(key);
      continue;
    }
    // `totals` is absent when the property has no data at all; fall back to
    // the first row, and to 0 only when there is genuinely nothing.
    values[key] = metricAt(totals ?? res.rows?.[0], index);
  }
  return { values, unavailable };
}

export async function buildHeadline(
  accessToken: string,
  propertyId: string,
  current: DateWindow,
  previous: DateWindow,
): Promise<HeadlineMetric[]> {
  const [now, before] = await Promise.all([
    headlineTotals(accessToken, propertyId, current),
    headlineTotals(accessToken, propertyId, previous),
  ]);

  return HEADLINE_METRICS.map((key): HeadlineMetric => {
    const unavailable = now.unavailable.has(key);
    const value = now.values[key] ?? 0;
    const prev = before.values[key] ?? 0;
    return {
      key,
      value,
      previous: prev,
      change: unavailable ? null : percentChange(value, prev),
      ...(unavailable ? { unavailable: true } : {}),
    };
  });
}

// ─── Traffic over time ──────────────────────────────────────────────────────

export async function buildTraffic(
  accessToken: string,
  propertyId: string,
  window: DateWindow,
): Promise<TrafficPoint[]> {
  const res = await runReport(accessToken, propertyId, {
    dateRanges: [window],
    dimensions: [{ name: "date" }],
    metrics: [{ name: "sessions" }, { name: "totalUsers" }],
    orderBys: [{ dimension: { dimensionName: "date" } }],
    // Days with no traffic must appear as zeros, or the chart silently closes
    // the gap and implies continuous traffic.
    keepEmptyRows: true,
    limit: 400,
  });

  const sessions = metricIndex(res, "sessions");
  const users = metricIndex(res, "totalUsers");

  return (res.rows ?? [])
    .map((row): TrafficPoint => ({
      date: isoDate(dim(row, 0)),
      sessions: metricAt(row, sessions),
      users: metricAt(row, users),
    }))
    .filter((point) => /^\d{4}-\d{2}-\d{2}$/.test(point.date))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Acquisition channels ───────────────────────────────────────────────────

export async function buildChannels(
  accessToken: string,
  propertyId: string,
  window: DateWindow,
): Promise<ChannelRow[]> {
  const res = await runReport(accessToken, propertyId, {
    dateRanges: [window],
    dimensions: [{ name: "sessionDefaultChannelGroup" }],
    metrics: [{ name: "sessions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: CHANNELS_LIMIT,
  });

  const sessions = metricIndex(res, "sessions");
  const rows = (res.rows ?? [])
    .map((row) => ({ channel: dim(row, 0) || "Unassigned", sessions: metricAt(row, sessions) }))
    .filter((row) => row.sessions > 0);

  // Share is computed against the rows we show, so the bars always add to the
  // visible total rather than to a number that is not on screen.
  const total = rows.reduce((sum, row) => sum + row.sessions, 0);
  return rows.map((row): ChannelRow => ({
    ...row,
    share: total > 0 ? row.sessions / total : 0,
  }));
}

// ─── Top pages ──────────────────────────────────────────────────────────────

export async function buildPages(
  accessToken: string,
  propertyId: string,
  window: DateWindow,
): Promise<PageRow[]> {
  const res = await runReport(accessToken, propertyId, {
    dateRanges: [window],
    dimensions: [{ name: "pagePath" }],
    metrics: [{ name: "screenPageViews" }, { name: "sessions" }, { name: "engagementRate" }],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit: TOP_PAGES_LIMIT,
  });

  const views = metricIndex(res, "screenPageViews");
  const sessions = metricIndex(res, "sessions");
  const engagement = metricIndex(res, "engagementRate");

  return (res.rows ?? [])
    .map((row): PageRow => ({
      path: dim(row, 0),
      views: metricAt(row, views),
      sessions: metricAt(row, sessions),
      engagementRate: metricAt(row, engagement),
    }))
    .filter((row) => row.path.length > 0);
}

// ─── Top referrers ──────────────────────────────────────────────────────────

export async function buildReferrers(
  accessToken: string,
  propertyId: string,
  window: DateWindow,
): Promise<ReferrerRow[]> {
  const res = await runReport(accessToken, propertyId, {
    dateRanges: [window],
    dimensions: [{ name: "sessionSource" }],
    metrics: [{ name: "sessions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    // Referral traffic only — without this the list is dominated by "google"
    // and "(direct)", which the acquisition panel already covers.
    dimensionFilter: {
      filter: {
        fieldName: "sessionDefaultChannelGroup",
        stringFilter: { matchType: "EXACT", value: "Referral" },
      },
    },
    limit: TOP_REFERRERS_LIMIT,
  });

  const sessions = metricIndex(res, "sessions");
  return (res.rows ?? [])
    .map((row): ReferrerRow => ({ source: dim(row, 0), sessions: metricAt(row, sessions) }))
    .filter((row) => row.source.length > 0 && row.sessions > 0);
}
