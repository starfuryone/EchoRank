// Web Analytics routes — auth, tenant isolation on both the connection and
// the reports, the 1 h cache, the disconnected/reauth states, and the quota
// and rate-limit paths.
//
// Prisma, the session guard, the GA4 HTTP boundary and Redis are stubbed;
// everything else (range validation, connection gating, cache keying, error
// mapping) is the real code path. No network call is ever made.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaidPlanRequiredError } from "@/lib/paid-plan";
import type { PlanType } from "@/generated/prisma";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const requirePaidPlan = vi.fn();
vi.mock("@/lib/paid-plan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paid-plan")>()),
  requirePaidPlan: () => requirePaidPlan(),
}));

const gaConnection = {
  findUnique: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  deleteMany: vi.fn(),
};
vi.mock("@/lib/prisma", () => ({ prisma: { gaConnection } }));

/** Token crypto is shared with GSC; stubbed so no key is needed in tests. */
vi.mock("@/lib/gsc/crypto", () => ({
  encryptToken: (s: string) => `enc:${s}`,
  decryptToken: (s: string) => s.replace(/^enc:/, ""),
}));

const mintAccessToken = vi.fn(async () => "ya29.fake");
const listProperties = vi.fn();
const runReport = vi.fn();
vi.mock("@/lib/ga/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ga/client")>()),
  mintAccessToken: (...a: unknown[]) => mintAccessToken(...(a as [])),
  listProperties: (...a: unknown[]) => listProperties(...a),
  runReport: (...a: unknown[]) => runReport(...a),
}));

const rateLimit = vi.fn(async (..._a: unknown[]) => ({ success: true, remaining: 9 }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: (...a: unknown[]) => rateLimit(...a) }));

/** In-memory stand-in for the ioredis singleton the report cache uses. */
const redisStore = new Map<string, string>();
const redis = {
  get: vi.fn(async (k: string) => redisStore.get(k) ?? null),
  set: vi.fn(async (k: string, v: string) => {
    redisStore.set(k, v);
    return "OK";
  }),
  del: vi.fn(async (...keys: string[]) => {
    for (const k of keys) redisStore.delete(k);
    return keys.length;
  }),
  scan: vi.fn(async () => ["0", [...redisStore.keys()]]),
};
vi.mock("@/infrastructure/redis/connection", () => ({ getRedisConnection: () => redis }));

// Imported after the mocks so the route modules pick them up.
const { GET: STATUS } = await import("@/app/api/seo/v1/web-analytics/status/route");
const { GET: REPORT } = await import("@/app/api/seo/v1/web-analytics/report/route");
const { POST: SELECT } = await import("@/app/api/seo/v1/web-analytics/select/route");
const { POST: DISCONNECT } = await import("@/app/api/seo/v1/web-analytics/disconnect/route");
const { GaQuotaError, GaReauthError, GaScopeError } = await import("@/lib/ga/client");
const { REPORTS_PER_HOUR } = await import("@/lib/ga/options");

// ─── Helpers ────────────────────────────────────────────────────────────────

const TENANT = "tenant_a";

function membership(planType: PlanType = "STARTER", tenantId = TENANT) {
  return { tenantId, tenant: { planType } };
}

function conn(overrides: Record<string, unknown> = {}) {
  return {
    id: "ga_1",
    tenantId: TENANT,
    refreshTokenEnc: "enc:refresh-token",
    propertyId: "properties/300000001",
    propertyName: "echorank360.com — Web",
    status: "ACTIVE",
    connectedAt: new Date("2026-07-29T12:00:00Z"),
    updatedAt: new Date("2026-07-29T12:00:00Z"),
    ...overrides,
  };
}

function reportRequest(query = ""): Request {
  return new Request(`http://localhost/api/seo/v1/web-analytics/report${query}`);
}

/** A runReport response good enough for every panel. */
const OK_REPORT = {
  metricHeaders: [
    { name: "sessions" },
    { name: "totalUsers" },
    { name: "newUsers" },
    { name: "engagementRate" },
    { name: "averageSessionDuration" },
    { name: "keyEvents" },
  ],
  totals: [
    {
      metricValues: [
        { value: "100" },
        { value: "80" },
        { value: "50" },
        { value: "0.6" },
        { value: "90" },
        { value: "3" },
      ],
    },
  ],
  rows: [
    {
      dimensionValues: [{ value: "20260728" }],
      metricValues: [{ value: "100" }, { value: "80" }],
    },
  ],
};

beforeEach(() => {
  redisStore.clear();
  requirePaidPlan.mockResolvedValue(membership());
  gaConnection.findUnique.mockResolvedValue(null);
  gaConnection.deleteMany.mockResolvedValue({ count: 1 });
  gaConnection.update.mockResolvedValue(conn());
  gaConnection.updateMany.mockResolvedValue({ count: 1 });
  mintAccessToken.mockResolvedValue("ya29.fake");
  listProperties.mockResolvedValue([
    { propertyId: "properties/300000001", displayName: "echorank360.com — Web", accountName: "Echorank360" },
  ]);
  runReport.mockResolvedValue(OK_REPORT);
  rateLimit.mockResolvedValue({ success: true, remaining: 9 });
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── Auth ───────────────────────────────────────────────────────────────────

describe("auth is required", () => {
  it("status returns 401 without a session", async () => {
    requirePaidPlan.mockRejectedValue(new Error("Not authenticated or no tenant access"));
    expect((await STATUS()).status).toBe(401);
    expect(gaConnection.findUnique).not.toHaveBeenCalled();
  });

  it("report returns 401 without a session", async () => {
    requirePaidPlan.mockRejectedValue(new Error("Not authenticated or no tenant access"));
    expect((await REPORT(reportRequest())).status).toBe(401);
    expect(runReport).not.toHaveBeenCalled();
  });

  it("report returns 403 without an active subscription", async () => {
    requirePaidPlan.mockRejectedValue(new PaidPlanRequiredError("TRIALING"));
    expect((await REPORT(reportRequest())).status).toBe(403);
  });

  it("every paid plan may use it — this is the tenant's own data", async () => {
    for (const plan of ["STARTER", "AI_VISIBILITY", "GROWTH", "AGENCY"] as const) {
      vi.clearAllMocks();
      requirePaidPlan.mockResolvedValue(membership(plan));
      gaConnection.findUnique.mockResolvedValue(conn());
      mintAccessToken.mockResolvedValue("ya29.fake");
      runReport.mockResolvedValue(OK_REPORT);
      rateLimit.mockResolvedValue({ success: true, remaining: 9 });
      redisStore.clear();
      expect((await REPORT(reportRequest())).status).toBe(200);
    }
  });
});

// ─── Tenant isolation ───────────────────────────────────────────────────────

describe("tenant isolation", () => {
  it("status only ever looks up the caller's own connection", async () => {
    gaConnection.findUnique.mockResolvedValue(conn());
    await STATUS();
    expect(gaConnection.findUnique).toHaveBeenCalledWith({ where: { tenantId: TENANT } });
  });

  it("another workspace's connection is never reachable", async () => {
    requirePaidPlan.mockResolvedValue(membership("STARTER", "tenant_b"));
    gaConnection.findUnique.mockResolvedValue(null);

    const body = await (await STATUS()).json();

    expect(body.connected).toBe(false);
    expect(gaConnection.findUnique.mock.calls[0][0].where.tenantId).toBe("tenant_b");
  });

  it("reports are keyed per tenant, so two tenants never share a cache entry", async () => {
    gaConnection.findUnique.mockResolvedValue(conn());
    await REPORT(reportRequest("?range=7"));

    requirePaidPlan.mockResolvedValue(membership("STARTER", "tenant_b"));
    gaConnection.findUnique.mockResolvedValue(conn({ tenantId: "tenant_b" }));
    await REPORT(reportRequest("?range=7"));

    const keys = [...redisStore.keys()];
    expect(keys.some((k) => k.includes(`:${TENANT}:`))).toBe(true);
    expect(keys.some((k) => k.includes(":tenant_b:"))).toBe(true);
    expect(new Set(keys).size).toBe(2);
  });

  it("never returns token material", async () => {
    gaConnection.findUnique.mockResolvedValue(conn());
    const body = await (await STATUS()).json();
    expect(JSON.stringify(body)).not.toContain("refresh");
    expect(JSON.stringify(body)).not.toContain("enc:");
  });

  it("disconnect only deletes the caller's row", async () => {
    await DISCONNECT();
    expect(gaConnection.deleteMany).toHaveBeenCalledWith({ where: { tenantId: TENANT } });
  });
});

// ─── Disconnected / picker / reauth ─────────────────────────────────────────

describe("connection states", () => {
  it("reports not-connected when there is no row", async () => {
    const body = await (await STATUS()).json();
    expect(body).toEqual({ connected: false });
  });

  it("409s a report request with no connection, so the UI shows the connect card", async () => {
    const res = await REPORT(reportRequest());
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({ code: "NOT_CONNECTED" });
    expect(runReport).not.toHaveBeenCalled();
  });

  it("lists properties only while none is selected", async () => {
    gaConnection.findUnique.mockResolvedValue(conn({ propertyId: null, propertyName: null }));
    const body = await (await STATUS()).json();
    expect(body.properties).toHaveLength(1);
    expect(listProperties).toHaveBeenCalled();
  });

  it("does not re-list properties once one is chosen", async () => {
    gaConnection.findUnique.mockResolvedValue(conn());
    const body = await (await STATUS()).json();
    expect(body.properties).toBeUndefined();
    expect(listProperties).not.toHaveBeenCalled();
  });

  it("400s a report when connected but no property is picked", async () => {
    gaConnection.findUnique.mockResolvedValue(conn({ propertyId: null }));
    const res = await REPORT(reportRequest());
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ code: "NO_PROPERTY" });
  });

  it("409s NEEDS_REAUTH so the UI swaps in the reconnect card", async () => {
    gaConnection.findUnique.mockResolvedValue(conn({ status: "NEEDS_REAUTH" }));
    const res = await REPORT(reportRequest());
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({ code: "NEEDS_REAUTH" });
    expect(runReport).not.toHaveBeenCalled();
  });

  it("marks the connection NEEDS_REAUTH when the refresh token is dead", async () => {
    gaConnection.findUnique.mockResolvedValue(conn());
    mintAccessToken.mockRejectedValue(new GaReauthError());

    const res = await REPORT(reportRequest());

    expect(res.status).toBe(409);
    expect(gaConnection.updateMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT },
      data: { status: "NEEDS_REAUTH" },
    });
  });

  it("degrades to the reconnect state when the picker's token is dead", async () => {
    gaConnection.findUnique.mockResolvedValue(conn({ propertyId: null }));
    listProperties.mockRejectedValue(new GaReauthError());
    const body = await (await STATUS()).json();
    expect(body).toMatchObject({ connected: true, status: "NEEDS_REAUTH" });
  });
});

// ─── Property selection ─────────────────────────────────────────────────────

describe("property selection", () => {
  function selectRequest(body: unknown): Request {
    return new Request("http://localhost/api/seo/v1/web-analytics/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("stores the property with the name from the live list", async () => {
    gaConnection.findUnique.mockResolvedValue(conn({ propertyId: null }));
    const res = await SELECT(selectRequest({ propertyId: "properties/300000001" }));

    expect(res.status).toBe(200);
    expect(gaConnection.update).toHaveBeenCalledWith({
      where: { tenantId: TENANT },
      data: { propertyId: "properties/300000001", propertyName: "echorank360.com — Web" },
    });
  });

  it("refuses a property the caller cannot actually access", async () => {
    // Validated against the tenant's OWN live list, so an arbitrary id cannot
    // be attached to the connection.
    gaConnection.findUnique.mockResolvedValue(conn({ propertyId: null }));
    const res = await SELECT(selectRequest({ propertyId: "properties/999999999" }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: "invalid_property" });
    expect(gaConnection.update).not.toHaveBeenCalled();
  });

  it("400s when there is no connection at all", async () => {
    const res = await SELECT(selectRequest({ propertyId: "properties/1" }));
    expect(res.status).toBe(400);
  });
});

// ─── Cache ──────────────────────────────────────────────────────────────────

describe("1 h report cache", () => {
  beforeEach(() => {
    gaConnection.findUnique.mockResolvedValue(conn());
  });

  it("queries GA4 on a miss and replays on a hit", async () => {
    const first = await (await REPORT(reportRequest("?range=28"))).json();
    expect(first.report.cached).toBeUndefined();
    const callsAfterFirst = runReport.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);

    const second = await (await REPORT(reportRequest("?range=28"))).json();
    expect(second.report.cached).toBe(true);
    // Nothing new was asked of GA4.
    expect(runReport.mock.calls.length).toBe(callsAfterFirst);
  });

  it("keys the cache per range, so switching range is a real query", async () => {
    await REPORT(reportRequest("?range=7"));
    const after7 = runReport.mock.calls.length;
    await REPORT(reportRequest("?range=28"));
    expect(runReport.mock.calls.length).toBeGreaterThan(after7);
    expect(redisStore.size).toBe(2);
  });

  it("force=1 bypasses the cache", async () => {
    await REPORT(reportRequest("?range=28"));
    const cached = runReport.mock.calls.length;
    const res = await REPORT(reportRequest("?range=28&force=1"));
    expect((await res.json()).report.cached).toBeUndefined();
    expect(runReport.mock.calls.length).toBeGreaterThan(cached);
  });

  it("falls back to the default range for a bogus one", async () => {
    await REPORT(reportRequest("?range=999"));
    const key = [...redisStore.keys()][0];
    expect(key.endsWith(":28")).toBe(true);
  });

  it("drops the tenant's cached reports on disconnect", async () => {
    await REPORT(reportRequest("?range=28"));
    expect(redisStore.size).toBe(1);
    await DISCONNECT();
    expect(redisStore.size).toBe(0);
  });
});

// ─── Rate limit + upstream failures ─────────────────────────────────────────

describe("rate limiting and GA4 failures", () => {
  beforeEach(() => {
    gaConnection.findUnique.mockResolvedValue(conn());
  });

  it("a cached read never spends a rate-limit slot", async () => {
    await REPORT(reportRequest("?range=28")); // warms the cache
    rateLimit.mockClear();
    await REPORT(reportRequest("?range=28")); // served from cache
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it("429s a forced refresh once the hour is used up", async () => {
    rateLimit.mockResolvedValue({ success: false, remaining: 0 });
    const res = await REPORT(reportRequest("?range=28&force=1"));
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.code).toBe("RATE_LIMITED");
    expect(body.limit).toBe(REPORTS_PER_HOUR);
    expect(runReport).not.toHaveBeenCalled();
  });

  it("429s a GA4 quota error with its own code", async () => {
    // Distinct from OUR limiter: the fix is to wait for Google, not for us.
    runReport.mockRejectedValue(new GaQuotaError());
    const res = await REPORT(reportRequest());
    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toMatchObject({ code: "QUOTA_EXCEEDED" });
  });

  it("403s a missing-scope error, which only an operator can fix", async () => {
    runReport.mockRejectedValue(new GaScopeError());
    const res = await REPORT(reportRequest());
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({ code: "MISSING_SCOPE" });
  });

  it("does not cache a failed report", async () => {
    runReport.mockRejectedValue(new GaQuotaError());
    await REPORT(reportRequest());
    expect(redisStore.size).toBe(0);
  });
});

// ─── Report shape ───────────────────────────────────────────────────────────

describe("report payload", () => {
  beforeEach(() => {
    gaConnection.findUnique.mockResolvedValue(conn());
  });

  it("carries both windows so the UI can label the comparison", async () => {
    const body = await (await REPORT(reportRequest("?range=7") )).json();
    const r = body.report;
    expect(r.range).toBe(7);
    expect(r.startDate < r.endDate).toBe(true);
    expect(r.previousEndDate < r.startDate).toBe(true);
    expect(r.propertyName).toBe("echorank360.com — Web");
  });

  it("flags a property with no traffic as empty rather than failing", async () => {
    runReport.mockResolvedValue({ metricHeaders: [], rows: [], totals: [] });
    const body = await (await REPORT(reportRequest())).json();
    expect(body.report.empty).toBe(true);
  });
});
