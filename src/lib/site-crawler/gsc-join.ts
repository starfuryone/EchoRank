// src/lib/site-crawler/gsc-join.ts
//
// Phase 4d (crawl.gsc): Search Console page data joined onto a crawl, run at
// aggregation so the search_console rules see it in the same pass.
// Automatic — no opt-in, no spend — when the tenant's GSC connection is
// active and its chosen property covers the crawled host.
//
// Search Analytics, dimensions ['page'], the 28 days ending on the latest day
// GSC has data for, paged 25,000 rows at a time. Each page of rows is joined
// on urlKey (scheme, trailing slash, host case) and stored before the next is
// fetched. Rows that share a key (http and https) are merged: clicks and
// impressions summed, CTR recomputed, position weighted by impressions.

import "server-only";
import { getConnection, latestAvailableDay, withAccessToken } from "@/lib/gsc/service";
import { searchAnalytics, type SearchAnalyticsRow } from "@/lib/gsc/client";
import { joinChunkByUrl } from "./metrics";
import { urlKey, type GscMetric } from "./metrics-shared";

export const GSC_PAGE_ROWS = 25_000;
export const GSC_DAYS = 28;
/** 20 pages × 25,000 rows: far past any crawl's 25,000 URLs. */
const GSC_MAX_PAGES = 20;

export type GscJoinStatus =
  | { status: "ok"; property: string; rows: number; pages: number; startDate: string; endDate: string }
  | { status: "not_connected" | "no_property" | "not_covered" | "needs_reauth" }
  | { status: "failed"; error: string };

/**
 * Does a GSC property cover this crawl's root? "sc-domain:example.com" covers
 * the domain and every subdomain; a URL-prefix property covers URLs under it
 * (host compared without case).
 */
export function propertyCovers(siteUrl: string, rootUrl: string): boolean {
  let root: URL;
  try {
    root = new URL(rootUrl);
  } catch {
    return false;
  }
  const host = root.hostname.toLowerCase();
  if (siteUrl.startsWith("sc-domain:")) {
    const domain = siteUrl.slice("sc-domain:".length).toLowerCase();
    return host === domain || host.endsWith(`.${domain}`);
  }
  try {
    const prefix = new URL(siteUrl);
    if (prefix.protocol !== root.protocol || prefix.hostname.toLowerCase() !== host) return false;
    return `${root.pathname}`.startsWith(prefix.pathname) || `${root.pathname}/`.startsWith(prefix.pathname);
  } catch {
    return false;
  }
}

/** Merge rows that share a join key. */
export function mergeRows(rows: readonly SearchAnalyticsRow[]): Map<string, GscMetric> {
  const acc = new Map<string, { clicks: number; impressions: number; posWeight: number }>();
  for (const r of rows) {
    const k = r.keys[0] ? urlKey(r.keys[0]) : null;
    if (!k) continue;
    const a = acc.get(k) ?? { clicks: 0, impressions: 0, posWeight: 0 };
    a.clicks += r.clicks;
    a.impressions += r.impressions;
    a.posWeight += r.position * r.impressions;
    acc.set(k, a);
  }
  const out = new Map<string, GscMetric>();
  for (const [k, a] of acc) {
    out.set(k, {
      clicks: a.clicks,
      impressions: a.impressions,
      ctr: a.impressions ? Math.round((a.clicks / a.impressions) * 10_000) / 10_000 : 0,
      position: a.impressions ? Math.round((a.posWeight / a.impressions) * 10) / 10 : 0,
    });
  }
  return out;
}

export function gscWindow(now = new Date()): { startDate: string; endDate: string } {
  const endDate = latestAvailableDay(now);
  const start = new Date(`${endDate}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - (GSC_DAYS - 1));
  return { startDate: start.toISOString().slice(0, 10), endDate };
}

/** Fetch and store. Never throws: the crawl completes without GSC data and says why. */
export async function joinGsc(jobId: string, tenantId: string, rootUrl: string, now = new Date()): Promise<GscJoinStatus> {
  const conn = await getConnection(tenantId);
  if (!conn) return { status: "not_connected" };
  if (conn.status !== "ACTIVE") return { status: "needs_reauth" };
  if (!conn.siteUrl) return { status: "no_property" };
  if (!propertyCovers(conn.siteUrl, rootUrl)) return { status: "not_covered" };
  const property = conn.siteUrl;
  const { startDate, endDate } = gscWindow(now);
  try {
    return await withAccessToken(conn, async (token) => {
      let rows = 0;
      let pages = 0;
      for (let page = 0; page < GSC_MAX_PAGES; page++) {
        const chunk = await searchAnalytics(token, property, { startDate, endDate, dimensions: ["page"], rowLimit: GSC_PAGE_ROWS, startRow: page * GSC_PAGE_ROWS });
        rows += chunk.length;
        pages += await joinChunkByUrl(jobId, "gsc", mergeRows(chunk));
        if (chunk.length < GSC_PAGE_ROWS) break;
      }
      return { status: "ok" as const, property, rows, pages, startDate, endDate };
    });
  } catch (err) {
    if (err instanceof Error && err.name === "GscReauthError") return { status: "needs_reauth" };
    return { status: "failed", error: err instanceof Error ? err.message.slice(0, 200) : "unknown" };
  }
}
