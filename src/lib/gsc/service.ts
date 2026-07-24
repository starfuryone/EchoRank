// DB-aware GSC service: connection lifecycle, access-token minting with the
// 401 → one-retry → NEEDS_REAUTH contract, live 28-day performance reads,
// and the daily query-level sync that feeds GscQueryStat.
//
// RANK TRACKER ACCESSOR (documented for the upcoming Rank Tracker v1):
//   getQueryDailyStats(tenantId, queries, days) below returns per-query,
//   per-day {date, clicks, impressions, position} from GscQueryStat rows
//   with page = "" (the query-only aggregate sentinel). Rank Tracker should
//   consume ONLY page="" rows for daily positions.
import { prisma } from "@/lib/prisma";
import { encryptToken, decryptToken } from "@/lib/gsc/crypto";
import {
  GscReauthError,
  listSites,
  mintAccessToken,
  searchAnalytics,
  type GscSite,
  type SearchAnalyticsRow,
} from "@/lib/gsc/client";
import type { GscConnection } from "@/generated/prisma";

export const SYNC_ROW_LIMIT = 1000;
const PERF_DAYS = 28;
// GSC data lags ~2 days; "yesterday" for sync purposes is D-2 to be safe.
const GSC_DATA_LAG_DAYS = 2;

function dayString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function latestAvailableDay(now = new Date()): string {
  return dayString(new Date(now.getTime() - GSC_DATA_LAG_DAYS * 86_400_000));
}

export async function getConnection(tenantId: string): Promise<GscConnection | null> {
  return prisma.gscConnection.findUnique({ where: { tenantId } });
}

export async function saveConnection(params: {
  tenantId: string;
  refreshToken: string;
  googleEmail: string | null;
  siteUrl: string | null;
}): Promise<void> {
  const refreshTokenEnc = encryptToken(params.refreshToken);
  await prisma.gscConnection.upsert({
    where: { tenantId: params.tenantId },
    update: {
      refreshTokenEnc,
      googleEmail: params.googleEmail,
      siteUrl: params.siteUrl,
      status: "ACTIVE",
      connectedAt: new Date(),
    },
    create: {
      tenantId: params.tenantId,
      refreshTokenEnc,
      googleEmail: params.googleEmail,
      siteUrl: params.siteUrl,
    },
  });
}

export async function selectSite(tenantId: string, siteUrl: string): Promise<void> {
  await prisma.gscConnection.update({ where: { tenantId }, data: { siteUrl } });
}

/** Deletes the connection (tokens). GscQueryStat history is kept. */
export async function disconnect(tenantId: string): Promise<void> {
  await prisma.gscConnection.deleteMany({ where: { tenantId } });
}

async function markNeedsReauth(tenantId: string): Promise<void> {
  await prisma.gscConnection
    .updateMany({ where: { tenantId }, data: { status: "NEEDS_REAUTH" } })
    .catch(() => {});
}

/**
 * Runs `fn` with a freshly minted access token. On a 401 from the API, mints
 * once more and retries once; a dead refresh token (invalid_grant) marks the
 * connection NEEDS_REAUTH and rethrows GscReauthError.
 */
export async function withAccessToken<T>(
  conn: GscConnection,
  fn: (accessToken: string) => Promise<T>,
): Promise<T> {
  const refreshToken = decryptToken(conn.refreshTokenEnc);
  try {
    const token = await mintAccessToken(refreshToken);
    try {
      return await fn(token);
    } catch (err) {
      if (!(err instanceof GscReauthError)) throw err;
      // One retry with a fresh token (expired/revoked access token case).
      const retryToken = await mintAccessToken(refreshToken);
      return await fn(retryToken);
    }
  } catch (err) {
    if (err instanceof GscReauthError) {
      await markNeedsReauth(conn.tenantId);
    }
    throw err;
  }
}

export async function listSitesFor(conn: GscConnection): Promise<GscSite[]> {
  return withAccessToken(conn, (t) => listSites(t));
}

export interface GscPerformance {
  startDate: string;
  endDate: string;
  totals: { clicks: number; impressions: number; ctr: number; position: number };
  daily: { date: string; clicks: number; impressions: number }[];
  topQueries: SearchAnalyticsRow[];
  topPages: SearchAnalyticsRow[];
}

/** Live 28-day performance (three searchanalytics calls on one token). */
export async function getPerformance(conn: GscConnection): Promise<GscPerformance> {
  if (!conn.siteUrl) throw new Error("No GSC property selected");
  const siteUrl = conn.siteUrl;
  const endDate = latestAvailableDay();
  const startDate = dayString(new Date(Date.parse(endDate) - (PERF_DAYS - 1) * 86_400_000));

  return withAccessToken(conn, async (token) => {
    const [daily, topQueries, topPages] = await Promise.all([
      searchAnalytics(token, siteUrl, { startDate, endDate, dimensions: ["date"], rowLimit: PERF_DAYS + 2 }),
      searchAnalytics(token, siteUrl, { startDate, endDate, dimensions: ["query"], rowLimit: 50 }),
      searchAnalytics(token, siteUrl, { startDate, endDate, dimensions: ["page"], rowLimit: 50 }),
    ]);
    const clicks = daily.reduce((a, r) => a + r.clicks, 0);
    const impressions = daily.reduce((a, r) => a + r.impressions, 0);
    // Impression-weighted averages, matching how GSC itself aggregates.
    const position =
      impressions > 0
        ? daily.reduce((a, r) => a + r.position * r.impressions, 0) / impressions
        : 0;
    return {
      startDate,
      endDate,
      totals: {
        clicks,
        impressions,
        ctr: impressions > 0 ? clicks / impressions : 0,
        position,
      },
      daily: daily
        .map((r) => ({ date: r.keys[0], clicks: r.clicks, impressions: r.impressions }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      topQueries,
      topPages,
    };
  });
}

/**
 * Idempotent daily sync: upserts query-only rows (page = "") for `day` into
 * GscQueryStat. Returns the row count. Used by the nightly worker sweep and
 * the rate-limited "Sync now" button.
 */
export async function syncDay(conn: GscConnection, day: string): Promise<number> {
  if (!conn.siteUrl) return 0;
  const siteUrl = conn.siteUrl;
  const rows = await withAccessToken(conn, (token) =>
    searchAnalytics(token, siteUrl, {
      startDate: day,
      endDate: day,
      dimensions: ["query"],
      rowLimit: SYNC_ROW_LIMIT,
    }),
  );
  const date = new Date(`${day}T00:00:00.000Z`);
  for (const r of rows) {
    const query = r.keys[0];
    await prisma.gscQueryStat.upsert({
      where: {
        tenantId_date_query_page: { tenantId: conn.tenantId, date, query, page: "" },
      },
      update: { clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position },
      create: {
        tenantId: conn.tenantId,
        siteUrl,
        date,
        query,
        page: "",
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      },
    });
  }
  await prisma.gscConnection.updateMany({
    where: { tenantId: conn.tenantId },
    data: { lastSyncAt: new Date() },
  });
  return rows.length;
}

/** Rank Tracker accessor: per-query daily series from stored page="" rows. */
export async function getQueryDailyStats(
  tenantId: string,
  queries: string[],
  days: number,
) {
  const since = new Date(Date.now() - days * 86_400_000);
  return prisma.gscQueryStat.findMany({
    where: { tenantId, page: "", query: { in: queries }, date: { gte: since } },
    orderBy: { date: "asc" },
    select: { query: true, date: true, clicks: true, impressions: true, position: true },
  });
}
