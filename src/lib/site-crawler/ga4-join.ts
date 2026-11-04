// src/lib/site-crawler/ga4-join.ts
//
// Phase 4d (crawl.ga4): GA4 landing-page data joined onto a crawl at
// aggregation, like the GSC join. Automatic when the tenant connected Google
// Analytics and picked a property in Settings → Integrations. One report:
// hostName = the crawled host, landingPagePlusQueryString, the last 28 days,
// paged at 25,000 rows; each page joined on urlKey(https://<host><path>).
// Rows sharing a key are merged: sums, engagement rate weighted by sessions.
// "(not set)" landing pages are skipped.

import "server-only";
import { getConnection, withAccessToken } from "@/lib/gsc/service";
import { GA4_PAGE_ROWS, landingPageReport, type LandingPageRow } from "@/lib/ga4/client";
import { joinChunkByUrl } from "./metrics";
import { urlKey, type Ga4Metric } from "./metrics-shared";

const GA4_MAX_PAGES = 20;

export type Ga4JoinStatus =
  | { status: "ok"; property: string; rows: number; pages: number; startDate: string; endDate: string }
  | { status: "not_connected" | "no_property" | "needs_reauth" | "no_access" }
  | { status: "failed"; error: string };

export function mergeLandingRows(rows: readonly LandingPageRow[], host: string): Map<string, Ga4Metric> {
  const acc = new Map<string, { sessions: number; totalUsers: number; engaged: number; keyEvents: number }>();
  for (const r of rows) {
    if (!r.landingPage.startsWith("/")) continue;
    const k = urlKey(`https://${host}${r.landingPage}`);
    if (!k) continue;
    const a = acc.get(k) ?? { sessions: 0, totalUsers: 0, engaged: 0, keyEvents: 0 };
    a.sessions += r.sessions;
    a.totalUsers += r.totalUsers;
    a.engaged += r.engagementRate * r.sessions;
    a.keyEvents += r.keyEvents;
    acc.set(k, a);
  }
  const out = new Map<string, Ga4Metric>();
  for (const [k, a] of acc) {
    out.set(k, { sessions: a.sessions, totalUsers: a.totalUsers, engagementRate: a.sessions ? Math.round((a.engaged / a.sessions) * 10_000) / 10_000 : 0, keyEvents: a.keyEvents });
  }
  return out;
}

/** The 28 days ending yesterday (UTC); GA4 finishes processing a day within ~24 h. */
export function ga4Window(now = new Date()): { startDate: string; endDate: string } {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 27);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

/** Fetch and store. Never throws: the crawl completes without GA4 data and says why. */
export async function joinGa4(jobId: string, tenantId: string, rootUrl: string, now = new Date()): Promise<Ga4JoinStatus> {
  const conn = await getConnection(tenantId);
  if (!conn) return { status: "not_connected" };
  if (conn.status !== "ACTIVE") return { status: "needs_reauth" };
  if (!conn.ga4PropertyId) return { status: "no_property" };
  const property = conn.ga4PropertyId;
  const host = new URL(rootUrl).hostname;
  const { startDate, endDate } = ga4Window(now);
  try {
    return await withAccessToken(conn, async (token) => {
      let rows = 0;
      let pages = 0;
      for (let page = 0; page < GA4_MAX_PAGES; page++) {
        const r = await landingPageReport(token, property, { startDate, endDate, hostName: host, offset: page * GA4_PAGE_ROWS });
        rows += r.rows.length;
        pages += await joinChunkByUrl(jobId, "ga4", mergeLandingRows(r.rows, host));
        if (r.rows.length < GA4_PAGE_ROWS || rows >= r.rowCount) break;
      }
      return { status: "ok" as const, property, rows, pages, startDate, endDate };
    });
  } catch (err) {
    if (err instanceof Error && err.name === "GscReauthError") return { status: "needs_reauth" };
    if (err instanceof Error && err.name === "Ga4AccessError") return { status: "no_access" };
    return { status: "failed", error: err instanceof Error ? err.message.slice(0, 200) : "unknown" };
  }
}
