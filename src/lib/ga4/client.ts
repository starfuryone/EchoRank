// src/lib/ga4/client.ts
//
// Phase 4d (crawl.ga4): plain-REST Google Analytics 4 — the Admin API to
// list the properties the connected Google account can read, and the Data
// API for per-landing-page numbers. No SDK, same as the GSC client. The
// access token comes from the tenant's one Google connection
// (gsc_connections), once it carries analytics.readonly.
//
// fetchImpl is injectable so the tests drive a mocked API.

import { GscReauthError } from "@/lib/gsc/client";

export const ANALYTICS_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const ADMIN = "https://analyticsadmin.googleapis.com/v1beta";
const DATA = "https://analyticsdata.googleapis.com/v1beta";

/** 403: the grant lacks analytics.readonly, or the account cannot read the property. (401 throws GscReauthError.) */
export class Ga4AccessError extends Error {
  constructor() {
    super("This Google connection cannot read Google Analytics.");
    this.name = "Ga4AccessError";
  }
}

async function call(fetchImpl: typeof fetch, token: string, url: string, init: RequestInit = {}) {
  const res = await fetchImpl(url, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  if (res.status === 401) throw new GscReauthError();
  if (res.status === 403) throw new Ga4AccessError();
  if (!res.ok) throw new Error(`GA4 API ${res.status}`);
  return res.json() as Promise<Record<string, unknown>>;
}

export interface Ga4Property {
  /** "properties/123456789" */
  id: string;
  name: string;
  account: string;
}

/** Every GA4 property the account can see (accountSummaries, all pages). */
export async function listProperties(token: string, fetchImpl: typeof fetch = fetch): Promise<Ga4Property[]> {
  const out: Ga4Property[] = [];
  let pageToken = "";
  for (let i = 0; i < 20; i++) {
    const d = await call(fetchImpl, token, `${ADMIN}/accountSummaries?pageSize=200${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`);
    for (const a of (d.accountSummaries as { displayName?: string; propertySummaries?: { property: string; displayName?: string }[] }[] | undefined) ?? []) {
      for (const p of a.propertySummaries ?? []) out.push({ id: p.property, name: p.displayName ?? p.property, account: a.displayName ?? "" });
    }
    pageToken = (d.nextPageToken as string | undefined) ?? "";
    if (!pageToken) break;
  }
  return out;
}

export interface LandingPageRow {
  hostName: string;
  landingPage: string;
  sessions: number;
  totalUsers: number;
  engagementRate: number;
  keyEvents: number;
}

export const GA4_PAGE_ROWS = 25_000;

/** One page of the landing-page report for one host (case-insensitive), and the report's total row count. */
export async function landingPageReport(
  token: string,
  propertyId: string,
  q: { startDate: string; endDate: string; hostName: string; offset: number },
  fetchImpl: typeof fetch = fetch,
): Promise<{ rows: LandingPageRow[]; rowCount: number }> {
  if (!/^properties\/\d+$/.test(propertyId)) throw new Error("Not a GA4 property id");
  const d = await call(fetchImpl, token, `${DATA}/${propertyId}:runReport`, {
    method: "POST",
    body: JSON.stringify({
      dateRanges: [{ startDate: q.startDate, endDate: q.endDate }],
      dimensions: [{ name: "hostName" }, { name: "landingPagePlusQueryString" }],
      metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "engagementRate" }, { name: "keyEvents" }],
      dimensionFilter: { filter: { fieldName: "hostName", stringFilter: { matchType: "EXACT", value: q.hostName, caseSensitive: false } } },
      limit: GA4_PAGE_ROWS,
      offset: q.offset,
    }),
  });
  const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const rows = ((d.rows as { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[] | undefined) ?? []).map((r) => ({
    hostName: r.dimensionValues[0]?.value ?? "",
    landingPage: r.dimensionValues[1]?.value ?? "",
    sessions: num(r.metricValues[0]?.value),
    totalUsers: num(r.metricValues[1]?.value),
    engagementRate: num(r.metricValues[2]?.value),
    keyEvents: num(r.metricValues[3]?.value),
  }));
  return { rows, rowCount: num(d.rowCount) };
}
