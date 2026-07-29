// Lighthouse route handlers — auth, tenant isolation, URL validation, the 6 h
// cache, the hourly limiter, and the no-CrUX path.
//
// The PSI HTTP call is mocked at the client boundary; everything else (zod,
// URL validation, cache window, limiter ordering, parsing, DTO shaping, error
// mapping) is the real code path. No network call is ever made.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PaidPlanRequiredError } from "@/lib/paid-plan";
import type { PlanType } from "@/generated/prisma";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const requirePaidPlan = vi.fn();
vi.mock("@/lib/paid-plan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paid-plan")>()),
  requirePaidPlan: () => requirePaidPlan(),
}));

const lighthouseAudit = {
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
};
vi.mock("@/lib/prisma", () => ({ prisma: { lighthouseAudit } }));

/** The PSI HTTP boundary. hasApiKey stays real — it only reads an env var. */
const runPagespeed = vi.fn<(...args: unknown[]) => Promise<unknown>>();
vi.mock("@/lib/pagespeed/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pagespeed/client")>()),
  runPagespeed: (...args: unknown[]) => runPagespeed(...args),
}));

const rateLimit = vi.fn(async (..._args: unknown[]) => ({ success: true, remaining: 19 }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: (...a: unknown[]) => rateLimit(...a) }));

const redis = { zcount: vi.fn(async () => 3) };
vi.mock("@/infrastructure/redis/connection", () => ({ getRedisConnection: () => redis }));

// Imported after the mocks so the route modules pick them up.
const { POST } = await import("@/app/api/seo/v1/lighthouse/audit/route");
const { GET: GET_HISTORY } = await import("@/app/api/seo/v1/lighthouse/history/route");
const { GET: GET_BY_ID } = await import("@/app/api/seo/v1/lighthouse/[id]/route");
const { AUDITS_PER_HOUR } = await import("@/lib/lighthouse/options");
const { PagespeedError } = await import("@/lib/pagespeed/client");

// ─── Helpers ────────────────────────────────────────────────────────────────

const TENANT = "tenant_a";

function fixture(name: string): unknown {
  return JSON.parse(
    readFileSync(join(process.cwd(), "fixtures", "pagespeed", `${name}.json`), "utf8"),
  );
}
const WITH_CRUX = fixture("__synthetic__-with-crux-mobile");
const NO_CRUX = fixture("__synthetic__-no-crux-desktop");

function membership(planType: PlanType = "STARTER", tenantId = TENANT) {
  return { tenantId, tenant: { planType } };
}

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/seo/v1/lighthouse/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "lh_1",
    tenantId: TENANT,
    url: "https://example.com/",
    strategy: "mobile",
    scores: { performance: 62, accessibility: 94, bestPractices: 96, seo: 100 },
    metrics: [{ key: "LCP", value: 3104.8, display: "3.1 s", score: 48 }],
    opportunities: [],
    crux: null,
    lighthouseVersion: "12.2.1",
    fetchedAt: new Date("2026-07-29T12:00:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  requirePaidPlan.mockResolvedValue(membership());
  lighthouseAudit.findFirst.mockResolvedValue(null);
  lighthouseAudit.findMany.mockResolvedValue([]);
  lighthouseAudit.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => row({ ...data, id: "lh_new" }),
  );
  runPagespeed.mockResolvedValue(WITH_CRUX);
  rateLimit.mockResolvedValue({ success: true, remaining: 19 });
  redis.zcount.mockResolvedValue(3);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── Auth ───────────────────────────────────────────────────────────────────

describe("auth is required", () => {
  it("POST returns 401 without a session", async () => {
    requirePaidPlan.mockRejectedValue(new Error("Not authenticated or no tenant access"));
    const res = await POST(postRequest({ url: "https://example.com/" }));
    expect(res.status).toBe(401);
    expect(runPagespeed).not.toHaveBeenCalled();
  });

  it("POST returns 403 without an active subscription", async () => {
    requirePaidPlan.mockRejectedValue(new PaidPlanRequiredError("TRIALING"));
    const res = await POST(postRequest({ url: "https://example.com/" }));
    expect(res.status).toBe(403);
    expect(runPagespeed).not.toHaveBeenCalled();
  });

  it("GET /[id] returns 401 without a session", async () => {
    requirePaidPlan.mockRejectedValue(new Error("Not authenticated or no tenant access"));
    const res = await GET_BY_ID(new Request("http://localhost"), {
      params: Promise.resolve({ id: "lh_1" }),
    });
    expect(res.status).toBe(401);
    expect(lighthouseAudit.findFirst).not.toHaveBeenCalled();
  });

  it("GET history returns 401 without a session", async () => {
    requirePaidPlan.mockRejectedValue(new Error("Not authenticated or no tenant access"));
    expect((await GET_HISTORY()).status).toBe(401);
  });

  it("every paid plan can audit — PSI is free, so there is no plan gate", async () => {
    for (const plan of ["STARTER", "AI_VISIBILITY", "GROWTH", "AGENCY"] as const) {
      vi.clearAllMocks();
      requirePaidPlan.mockResolvedValue(membership(plan));
      lighthouseAudit.findFirst.mockResolvedValue(null);
      lighthouseAudit.create.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => row({ ...data }),
      );
      runPagespeed.mockResolvedValue(WITH_CRUX);
      rateLimit.mockResolvedValue({ success: true, remaining: 19 });
      expect((await POST(postRequest({ url: "https://example.com/" }))).status).toBe(200);
    }
  });
});

// ─── URL validation ─────────────────────────────────────────────────────────

describe("URL validation happens before PSI is contacted", () => {
  it("normalizes the URL and passes it upstream with the strategy", async () => {
    await POST(postRequest({ url: "  Example.com/Pricing#top  ", strategy: "desktop" }));
    expect(runPagespeed).toHaveBeenCalledWith("https://example.com/Pricing", "desktop");
  });

  it("defaults to mobile — what Google indexes", async () => {
    await POST(postRequest({ url: "https://example.com/" }));
    expect(runPagespeed.mock.calls[0][1]).toBe("mobile");
  });

  it.each([
    "http://localhost:3000/",
    "https://127.0.0.1/",
    "https://192.168.1.5/",
    "https://api.internal/",
  ])("400s %j as unreachable without calling PSI", async (url) => {
    const res = await POST(postRequest({ url }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.reason).toBe("not_public");
    expect(runPagespeed).not.toHaveBeenCalled();
  });

  it.each(["", "not a url", "ftp://example.com/x"])("400s %j as malformed", async (url) => {
    expect((await POST(postRequest({ url }))).status).toBe(400);
    expect(runPagespeed).not.toHaveBeenCalled();
  });

  it("400s an unknown strategy", async () => {
    const res = await POST(postRequest({ url: "https://example.com/", strategy: "tablet" }));
    expect(res.status).toBe(400);
    expect(runPagespeed).not.toHaveBeenCalled();
  });
});

// ─── Cache ──────────────────────────────────────────────────────────────────

describe("6 h cache", () => {
  it("replays the stored audit without calling PSI or taking a limiter slot", async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    lighthouseAudit.findFirst.mockResolvedValue(row({ fetchedAt: twoHoursAgo }));

    const res = await POST(postRequest({ url: "https://example.com/" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.cached).toBe(true);
    expect(runPagespeed).not.toHaveBeenCalled();
    expect(lighthouseAudit.create).not.toHaveBeenCalled();
    // A replay consumes no upstream quota, so it must not consume an
    // allowance either — the limiter is checked AFTER the cache.
    expect(rateLimit).not.toHaveBeenCalled();

    const hoursLeft = body.audit.reRunAvailableInMs / 3_600_000;
    expect(hoursLeft).toBeGreaterThan(3.9);
    expect(hoursLeft).toBeLessThanOrEqual(4);
  });

  it("keys the lookup on tenant + url + STRATEGY, inside the window", async () => {
    await POST(postRequest({ url: "https://example.com/", strategy: "desktop" }));
    const where = lighthouseAudit.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({
      tenantId: TENANT,
      url: "https://example.com/",
      // Mobile and desktop are separate audits that routinely differ by 30+
      // points; sharing a cache row would show the wrong one.
      strategy: "desktop",
    });
    expect(where.fetchedAt.gte).toBeInstanceOf(Date);
  });
});

// ─── Limiter ────────────────────────────────────────────────────────────────

describe("hourly limiter", () => {
  it("429s with a friendly message once the hour is used up", async () => {
    rateLimit.mockResolvedValue({ success: false, remaining: 0 });

    const res = await POST(postRequest({ url: "https://example.com/" }));
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.code).toBe("RATE_LIMITED");
    expect(body.limit).toBe(AUDITS_PER_HOUR);
    expect(runPagespeed).not.toHaveBeenCalled();
    expect(lighthouseAudit.create).not.toHaveBeenCalled();
  });

  it("scopes the limiter key to the tenant", async () => {
    await POST(postRequest({ url: "https://example.com/" }));
    expect(rateLimit).toHaveBeenCalledWith(`lighthouse:${TENANT}`, AUDITS_PER_HOUR, 3_600_000);
  });

  it("distinguishes Google's own 429 from ours", async () => {
    // Two different 429s with different fixes; support needs to tell them apart.
    runPagespeed.mockRejectedValue(new PagespeedError("quota", "RATE_LIMITED"));
    const res = await POST(postRequest({ url: "https://example.com/" }));
    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toMatchObject({ code: "UPSTREAM_RATE_LIMITED" });
  });
});

// ─── Upstream failures ──────────────────────────────────────────────────────

describe("PSI failures map to actionable statuses", () => {
  it("400s a page PSI could not load — the user's URL, not our fault", async () => {
    runPagespeed.mockRejectedValue(new PagespeedError("could not fetch", "UNREACHABLE"));
    const res = await POST(postRequest({ url: "https://example.com/" }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ code: "UNREACHABLE" });
    expect(lighthouseAudit.create).not.toHaveBeenCalled();
  });

  it("504s a timeout", async () => {
    runPagespeed.mockRejectedValue(new PagespeedError("too slow", "TIMEOUT"));
    const res = await POST(postRequest({ url: "https://example.com/" }));
    expect(res.status).toBe(504);
    await expect(res.json()).resolves.toMatchObject({ code: "TIMEOUT" });
  });

  it("502s an upstream outage", async () => {
    runPagespeed.mockRejectedValue(new PagespeedError("down", "UPSTREAM_UNAVAILABLE"));
    expect((await POST(postRequest({ url: "https://example.com/" }))).status).toBe(502);
  });
});

// ─── Persisted shape ────────────────────────────────────────────────────────

describe("a fresh run parses and persists every section", () => {
  it("stores scores, metrics, opportunities and CrUX", async () => {
    const res = await POST(postRequest({ url: "https://example.com/" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.cached).toBe(false);

    const data = lighthouseAudit.create.mock.calls[0][0].data;
    expect(data.scores).toEqual({
      performance: 62,
      accessibility: 94,
      bestPractices: 96,
      seo: 100,
    });
    expect(data.metrics).toHaveLength(6);
    expect(data.opportunities.length).toBeGreaterThan(0);
    expect(data.crux).not.toBeNull();
    expect(data.lighthouseVersion).toBe("12.2.1");
  });

  it("stores the REQUESTED url, not the redirect target", async () => {
    // Storing finalUrl would make a redirecting site miss its own cache on
    // every run and show a URL the user never typed in their history.
    await POST(postRequest({ url: "https://example.com/" }));
    expect(lighthouseAudit.create.mock.calls[0][0].data.url).toBe("https://example.com/");
  });

  it("persists crux as undefined when the page has no field data", async () => {
    runPagespeed.mockResolvedValue(NO_CRUX);
    const res = await POST(postRequest({ url: "https://example.com/", strategy: "desktop" }));
    const body = await res.json();

    const data = lighthouseAudit.create.mock.calls[0][0].data;
    // undefined -> the column stays NULL, which the UI renders as the
    // "no field data available" state rather than zeros.
    expect(data.crux).toBeUndefined();
    expect(body.audit.crux).toBeNull();
    expect(body.audit.scores.performance).toBe(93);
  });

  it("reports whether an API key is configured", async () => {
    const body = await (await POST(postRequest({ url: "https://example.com/" }))).json();
    expect(typeof body.usage.apiKeyConfigured).toBe("boolean");
    expect(body.usage.limit).toBe(AUDITS_PER_HOUR);
  });
});

// ─── Tenant isolation ───────────────────────────────────────────────────────

describe("tenant isolation", () => {
  it("GET /[id] filters on the caller's tenantId, not just the audit id", async () => {
    lighthouseAudit.findFirst.mockResolvedValue(row());
    await GET_BY_ID(new Request("http://localhost"), {
      params: Promise.resolve({ id: "lh_1" }),
    });
    expect(lighthouseAudit.findFirst).toHaveBeenCalledWith({
      where: { id: "lh_1", tenantId: TENANT },
    });
  });

  it("404s another workspace's audit id rather than leaking it", async () => {
    requirePaidPlan.mockResolvedValue(membership("STARTER", "tenant_b"));
    lighthouseAudit.findFirst.mockResolvedValue(null);

    const res = await GET_BY_ID(new Request("http://localhost"), {
      params: Promise.resolve({ id: "lh_1" }),
    });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({ code: "NOT_FOUND" });
    expect(lighthouseAudit.findFirst.mock.calls[0][0].where.tenantId).toBe("tenant_b");
  });

  it("serializes Date fields for the wire and never re-runs", async () => {
    lighthouseAudit.findFirst.mockResolvedValue(row());
    const body = await (
      await GET_BY_ID(new Request("http://localhost"), {
        params: Promise.resolve({ id: "lh_1" }),
      })
    ).json();

    expect(body.fetchedAt).toBe("2026-07-29T12:00:00.000Z");
    expect(body.crux).toBeNull();
    expect(runPagespeed).not.toHaveBeenCalled();
  });

  it("history is tenant-scoped and carries scores but no payloads", async () => {
    lighthouseAudit.findMany.mockResolvedValue([
      {
        id: "lh_1",
        url: "https://example.com/",
        strategy: "mobile",
        scores: { performance: 62, accessibility: 94, bestPractices: 96, seo: 100 },
        fetchedAt: new Date("2026-07-29T12:00:00Z"),
      },
    ]);

    const body = await (await GET_HISTORY()).json();

    expect(lighthouseAudit.findMany.mock.calls[0][0].where).toEqual({ tenantId: TENANT });
    expect(body.audits[0]).toEqual({
      id: "lh_1",
      url: "https://example.com/",
      strategy: "mobile",
      scores: { performance: 62, accessibility: 94, bestPractices: 96, seo: 100 },
      fetchedAt: "2026-07-29T12:00:00.000Z",
    });
    // The list renders score chips only — no metrics/opportunities/CrUX.
    expect(body.audits[0]).not.toHaveProperty("metrics");
    expect(body.usage.used).toBe(3);
  });
});
