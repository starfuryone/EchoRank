// @vitest-environment jsdom
//
// tests/site-crawler-ga4.test.tsx — Phase 4d GA4, built behind crawl.ga4
// (off): the Admin / Data API client against a mocked API, the join, the
// OAuth state purpose and callback, the Settings → Integrations routes and
// card, and that nothing shows publicly while the flag is off.
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const flags = vi.hoisted(() => ({ on: new Set<string>(["crawl.ga4"]) }));
vi.mock("@/lib/flags", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/flags")>();
  return { ...real, flag: (n: string) => flags.on.has(n) };
});
const requirePaidPlan = vi.fn();
vi.mock("@/lib/paid-plan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paid-plan")>()),
  requirePaidPlan: () => requirePaidPlan(),
}));
const gscConnection = { findUnique: vi.fn(), update: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() };
vi.mock("@/lib/prisma", () => ({ prisma: { gscConnection } }));
const joinChunkByUrl = vi.fn(async (_j: string, _s: string, m: Map<string, unknown>) => m.size);
vi.mock("@/lib/site-crawler/metrics", () => ({ joinChunkByUrl: (...a: [string, string, Map<string, unknown>]) => joinChunkByUrl(...a) }));

process.env.GOOGLE_OAUTH_CLIENT_ID = "cid";
process.env.GOOGLE_OAUTH_CLIENT_SECRET = "csecret";
process.env.GSC_TOKEN_ENCRYPTION_KEY = "test-key-not-a-secret";

const ga4 = await import("@/lib/ga4/client");
const join = await import("@/lib/site-crawler/ga4-join");
const state = await import("@/lib/gsc/state");
const { encryptToken } = await import("@/lib/gsc/crypto");
const connectRoute = await import("@/app/api/seo/v1/ga4/connect/route");
const propertiesRoute = await import("@/app/api/seo/v1/ga4/properties/route");
const propertyRoute = await import("@/app/api/seo/v1/ga4/property/route");
const { Ga4Integration } = await import("@/components/settings/ga4-integration");
const callback = await import("@/app/api/ai/visibility/gsc/callback/route");
const { INTEGRATIONS_COPY } = await import("@/lib/i18n/integrations");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const conn = (over: Record<string, unknown> = {}) => ({ tenantId: "t1", status: "ACTIVE", siteUrl: null, ga4PropertyId: "properties/42", ga4PropertyName: "Shop", refreshTokenEnc: encryptToken("rt"), ...over });

/** A mocked Google: token endpoint, Admin API, Data API. */
function google(report: { rows: unknown[]; rowCount: number }[] = []) {
  const reports = [...report];
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "https://oauth2.googleapis.com/token") return json({ access_token: "at" });
    if (url.startsWith("https://analyticsadmin.googleapis.com/v1beta/accountSummaries")) {
      return url.includes("pageToken")
        ? json({ accountSummaries: [{ displayName: "B", propertySummaries: [{ property: "properties/7", displayName: "Blog" }] }] })
        : json({ accountSummaries: [{ displayName: "A", propertySummaries: [{ property: "properties/42", displayName: "Shop" }] }], nextPageToken: "n" });
    }
    if (url.includes(":runReport")) return json({ ...(reports.shift() ?? { rows: [], rowCount: 0 }), _body: init?.body });
    return json({}, 404);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  requirePaidPlan.mockResolvedValue({ tenantId: "t1", tenant: { planType: "GROWTH" } });
});

describe("client (mocked API)", () => {
  it("lists properties across Admin API pages", async () => {
    expect(await ga4.listProperties("at", google() as unknown as typeof fetch)).toEqual([
      { id: "properties/42", name: "Shop", account: "A" },
      { id: "properties/7", name: "Blog", account: "B" },
    ]);
  });

  it("asks the Data API for host + landing page, the four metrics, one host, paged", async () => {
    const f = vi.fn<(u: string, i?: RequestInit) => Promise<Response>>(async () => json({ rows: [{ dimensionValues: [{ value: "x.com" }, { value: "/a" }], metricValues: [{ value: "5" }, { value: "4" }, { value: "0.6" }, { value: "1" }] }], rowCount: 1 }));
    const out = await ga4.landingPageReport("at", "properties/42", { startDate: "2026-10-06", endDate: "2026-11-02", hostName: "x.com", offset: 0 }, f as unknown as typeof fetch);
    expect(out).toEqual({ rows: [{ hostName: "x.com", landingPage: "/a", sessions: 5, totalUsers: 4, engagementRate: 0.6, keyEvents: 1 }], rowCount: 1 });
    expect(f.mock.calls[0]![0]).toBe("https://analyticsdata.googleapis.com/v1beta/properties/42:runReport");
    const body = JSON.parse(f.mock.calls[0]![1]!.body as string);
    expect(body.dimensions).toEqual([{ name: "hostName" }, { name: "landingPagePlusQueryString" }]);
    expect(body.metrics.map((m: { name: string }) => m.name)).toEqual(["sessions", "totalUsers", "engagementRate", "keyEvents"]);
    expect(body.dimensionFilter.filter).toMatchObject({ fieldName: "hostName", stringFilter: { value: "x.com", caseSensitive: false } });
    expect(body).toMatchObject({ limit: 25_000, offset: 0 });
  });

  it.each([
    [401, "GscReauthError"],
    [403, "Ga4AccessError"],
  ])("HTTP %i → %s", async (status, name) => {
    await expect(ga4.listProperties("at", (async () => json({}, status)) as unknown as typeof fetch)).rejects.toMatchObject({ name });
  });

  it("refuses a malformed property id before any request", async () => {
    const f = vi.fn();
    await expect(ga4.landingPageReport("at", "properties/1/../x", { startDate: "a", endDate: "b", hostName: "x", offset: 0 }, f as never)).rejects.toThrow();
    expect(f).not.toHaveBeenCalled();
  });
});

describe("join", () => {
  it("merges rows per key (sums, sessions-weighted engagement), skips (not set)", () => {
    const row = (landingPage: string, sessions: number, engagementRate: number, keyEvents = 0) => ({ hostName: "x.com", landingPage, sessions, totalUsers: sessions, engagementRate, keyEvents });
    const m = join.mergeLandingRows([row("/a/", 10, 0.5, 1), row("/a", 30, 0.9, 2), row("(not set)", 99, 1)], "x.com");
    expect([...m.keys()]).toEqual(["x.com/a"]);
    expect(m.get("x.com/a")).toEqual({ sessions: 40, totalUsers: 40, engagementRate: 0.8, keyEvents: 3 });
  });

  it("the window is the 28 days ending yesterday", () => {
    expect(join.ga4Window(new Date("2026-11-04T10:00:00Z"))).toEqual({ startDate: "2026-10-07", endDate: "2026-11-03" });
  });

  it("joins the picked property for the crawled host; says why when it cannot", async () => {
    vi.stubGlobal("fetch", google([{ rows: [{ dimensionValues: [{ value: "x.com" }, { value: "/a" }], metricValues: [{ value: "1" }, { value: "1" }, { value: "1" }, { value: "0" }] }], rowCount: 1 }]));
    gscConnection.findUnique.mockResolvedValueOnce(conn());
    expect(await join.joinGa4("j1", "t1", "https://x.com/")).toMatchObject({ status: "ok", property: "properties/42", rows: 1, pages: 1 });
    gscConnection.findUnique.mockResolvedValueOnce(null);
    expect(await join.joinGa4("j1", "t1", "https://x.com/")).toEqual({ status: "not_connected" });
    gscConnection.findUnique.mockResolvedValueOnce(conn({ ga4PropertyId: null }));
    expect(await join.joinGa4("j1", "t1", "https://x.com/")).toEqual({ status: "no_property" });
    vi.stubGlobal("fetch", vi.fn(async (u: string) => (u.includes("oauth2") ? json({ access_token: "at" }) : json({}, 403))));
    gscConnection.findUnique.mockResolvedValueOnce(conn());
    expect(await join.joinGa4("j1", "t1", "https://x.com/")).toEqual({ status: "no_access" });
  });
});

describe("OAuth and routes", () => {
  it("connect asks for Search Console + analytics.readonly with a ga4-purpose state", async () => {
    const u = new URL((await connectRoute.GET()).headers.get("location")!);
    expect(u.searchParams.get("scope")).toBe(`https://www.googleapis.com/auth/webmasters.readonly ${ga4.ANALYTICS_SCOPE}`);
    expect(u.searchParams.get("include_granted_scopes")).toBe("true");
    expect(state.verifyStatePurpose(u.searchParams.get("state")!)).toEqual({ tenantId: "t1", purpose: "ga4" });
  });

  it("properties are read from the tenant's own connection", async () => {
    vi.stubGlobal("fetch", google());
    gscConnection.findUnique.mockResolvedValue(conn());
    const body = await (await propertiesRoute.GET()).json();
    expect(body).toMatchObject({ connected: true, selected: { id: "properties/42", name: "Shop" } });
    expect(body.properties).toHaveLength(2);
    expect(gscConnection.findUnique).toHaveBeenCalledWith({ where: { tenantId: "t1" } });
    gscConnection.findUnique.mockResolvedValue(null);
    expect(await (await propertiesRoute.GET()).json()).toEqual({ connected: false, connectHref: "/api/seo/v1/ga4/connect" });
  });

  it("PUT saves only a property the connection lists; DELETE clears it", async () => {
    vi.stubGlobal("fetch", google());
    gscConnection.findUnique.mockResolvedValue(conn());
    const put = (propertyId: string) => propertyRoute.PUT(new Request("https://app.test/x", { method: "PUT", body: JSON.stringify({ propertyId }) }));
    expect((await put("properties/7")).status).toBe(200);
    expect(gscConnection.update).toHaveBeenCalledWith({ where: { tenantId: "t1" }, data: { ga4PropertyId: "properties/7", ga4PropertyName: "Blog" } });
    expect((await put("properties/999")).status).toBe(400);
    expect((await put("nope")).status).toBe(400);
    expect((await propertyRoute.DELETE()).status).toBe(204);
    expect(gscConnection.update).toHaveBeenLastCalledWith({ where: { tenantId: "t1" }, data: { ga4PropertyId: null, ga4PropertyName: null } });
  });

  it("the shared callback stores the widened token, keeps the GSC property, returns to Settings", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ access_token: "at", refresh_token: "rt2" })));
    gscConnection.findUnique.mockResolvedValue(conn({ siteUrl: "sc-domain:x.com" }));
    const st = state.signState("t1", undefined, undefined, "ga4");
    const res = await callback.GET(new (await import("next/server")).NextRequest(`https://app.test/api/ai/visibility/gsc/callback?code=c&state=${encodeURIComponent(st)}`));
    expect(res.headers.get("location")).toMatch(/\/settings\?ga4=connected$/);
    expect(gscConnection.upsert.mock.calls[0]![0]).toMatchObject({ where: { tenantId: "t1" }, update: { siteUrl: "sc-domain:x.com" } });
    const denied = await callback.GET(new (await import("next/server")).NextRequest(`https://app.test/x?error=access_denied&state=${encodeURIComponent(st)}`));
    expect(denied.headers.get("location")).toMatch(/\/settings\?ga4_error=denied$/);
  });

  it("everything is a 404 while crawl.ga4 is off", async () => {
    flags.on.delete("crawl.ga4");
    expect((await connectRoute.GET()).status).toBe(404);
    expect((await propertiesRoute.GET()).status).toBe(404);
    expect((await propertyRoute.DELETE()).status).toBe(404);
    flags.on.add("crawl.ga4");
  });
});

describe("Settings → Integrations card", () => {
  it.each(["en", "fr", "de-CH"] as const)("%s: not connected → connect link; connected → property picker", async (l) => {
    const t = INTEGRATIONS_COPY[l];
    for (const [listing, want] of [
      [{ connected: false, connectHref: "/api/seo/v1/ga4/connect" }, t.ga4Connect],
      [{ connected: true, properties: [{ id: "properties/42", name: "Shop", account: "A" }], selected: null }, t.ga4Save],
    ] as const) {
      vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => listing })));
      const host = document.createElement("div");
      document.body.appendChild(host);
      await act(async () => createRoot(host).render(<Ga4Integration t={t} />));
      await act(async () => {});
      expect(host.textContent).toContain(want);
      expect(host.textContent).not.toMatch(/undefined|NaN/);
      host.remove();
    }
  });
});
