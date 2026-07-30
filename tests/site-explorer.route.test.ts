// Site Explorer route handlers — the paths that cost money or leak data:
// auth, domain validation, tenant isolation on [id], the 24 h cache, the
// monthly quota 429, and partial-failure persistence.
//
// Prisma, the session guard, the metered client and Redis are stubbed;
// everything else (zod validation, domain normalization, quota arithmetic,
// cache window, section parsing, DTO shaping, error mapping) is the real code
// path. No live call is ever made from this suite.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaidPlanRequiredError } from "@/lib/paid-plan";
import type { PlanType } from "@/generated/prisma";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const requirePaidPlan = vi.fn();
vi.mock("@/lib/paid-plan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paid-plan")>()),
  requirePaidPlan: () => requirePaidPlan(),
}));

const siteExplorerAnalysis = {
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  aggregate: vi.fn(),
};
// seoApiCall backs the pooled monthly search quota, which every DataForSEO
// service now checks before spending. Default 0 used = quota available, so
// these suites keep testing their own per-tool gate rather than this one.
const seoApiCall = { count: vi.fn(async () => 0), updateMany: vi.fn(), create: vi.fn() };
vi.mock("@/lib/prisma", () => ({ prisma: { siteExplorerAnalysis, seoApiCall } }));

const seoMeteredCallResult = vi.fn();
vi.mock("@/lib/dataforseo/metering", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/dataforseo/metering")>()),
  seoMeteredCallResult: (...args: unknown[]) => seoMeteredCallResult(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({ success: true, remaining: 4 })),
}));

/** Minimal in-memory stand-in for the ioredis singleton the quota uses. */
const redisStore = new Map<string, number>();
const redis = {
  incr: vi.fn(async (key: string) => {
    const next = (redisStore.get(key) ?? 0) + 1;
    redisStore.set(key, next);
    return next;
  }),
  decr: vi.fn(async (key: string) => {
    const next = (redisStore.get(key) ?? 0) - 1;
    redisStore.set(key, next);
    return next;
  }),
  expire: vi.fn(async () => 1),
  get: vi.fn(async (key: string) => {
    const value = redisStore.get(key);
    return value === undefined ? null : String(value);
  }),
};
vi.mock("@/infrastructure/redis/connection", () => ({
  getRedisConnection: () => redis,
}));

// Imported after the mocks so the route modules pick them up.
const { POST } = await import("@/app/api/seo/v1/site-explorer/analyze/route");
const { GET: GET_HISTORY } = await import("@/app/api/seo/v1/site-explorer/history/route");
const { GET: GET_BY_ID } = await import("@/app/api/seo/v1/site-explorer/[id]/route");
const { SITE_EXPLORER_ANALYSES_PER_MONTH } = await import("@/lib/site-explorer/options");
const { siteExplorerQuotaKey } = await import("@/lib/site-explorer/quota");

// ─── Helpers ────────────────────────────────────────────────────────────────

const TENANT = "tenant_a";

function membership(planType: PlanType = "STARTER", tenantId = TENANT) {
  return { tenantId, tenant: { planType } };
}

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/seo/v1/site-explorer/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "sea_1",
    tenantId: TENANT,
    domain: "example.com",
    locationCode: 2124,
    languageCode: "en",
    status: "completed",
    costUsd: 0.05,
    overview: { etv: 10, keywordCount: 5, estimatedPaidTrafficCost: 3, distribution: {} },
    rankedKeywords: { items: [], totalCount: 5 },
    competitors: { items: [] },
    backlinks: { backlinks: 1, referringDomains: 1 },
    failedSections: [],
    createdAt: new Date("2026-07-28T12:00:00Z"),
    ...overrides,
  };
}

/** One envelope per endpoint, keyed by the v3 path the service calls. */
const ENVELOPES: Record<string, { data: unknown; billing: { path: string[]; costUsd: number } }> = {
  // Shape matters: the metrics are nested under result[0].items[0], not on
  // the result element (see fixtures/dataforseo/*domain_rank_overview*.json).
  "v3/dataforseo_labs/google/domain_rank_overview/live": {
    data: [
      {
        items: [
          {
            metrics: {
              organic: {
                etv: 1234.5,
                count: 87,
                estimated_paid_traffic_cost: 999.5,
                pos_1: 3,
                pos_2_3: 5,
                pos_4_10: 20,
                pos_11_20: 19,
                pos_21_30: 40,
              },
            },
          },
        ],
      },
    ],
    billing: { path: ["v3", "dataforseo_labs", "google", "domain_rank_overview", "live"], costUsd: 0.02 },
  },
  "v3/dataforseo_labs/google/ranked_keywords/live": {
    data: [
      {
        total_count: 87,
        items: [
          {
            keyword_data: { keyword: "widgets", keyword_info: { search_volume: 900 } },
            ranked_serp_element: {
              serp_item: { rank_group: 2, url: "https://example.com/widgets", etv: 120.4 },
            },
          },
          // No keyword text — unrenderable, must be dropped by the parser.
          { ranked_serp_element: { serp_item: { rank_group: 9 } } },
        ],
      },
    ],
    billing: { path: ["v3", "dataforseo_labs", "google", "ranked_keywords", "live"], costUsd: 0.011 },
  },
  "v3/dataforseo_labs/google/competitors_domain/live": {
    data: [
      {
        items: [
          // The target itself — DataForSEO always returns it; must be filtered.
          { domain: "example.com", intersections: 87, avg_position: 12 },
          {
            domain: "WWW.Rival.com",
            intersections: 40,
            avg_position: 8.5,
            // `metrics` is OUR traffic on the shared keywords; the column shows
            // THEIRS, so the parser must prefer competitor_metrics.
            metrics: { organic: { etv: 11.1 } },
            competitor_metrics: { organic: { etv: 55.5 } },
          },
        ],
      },
    ],
    billing: { path: ["v3", "dataforseo_labs", "google", "competitors_domain", "live"], costUsd: 0.014 },
  },
  "v3/backlinks/summary/live": {
    data: [
      {
        backlinks: 1000,
        referring_domains: 120,
        referring_domains_nofollow: 30,
        referring_main_domains: 110,
        rank: 240,
        broken_backlinks: 7,
        // Counted against referring PAGES — must NOT be differenced from
        // `backlinks`, which is a different base.
        referring_links_attributes: { nofollow: 250, noopener: 40 },
      },
    ],
    billing: { path: ["v3", "backlinks", "summary", "live"], costUsd: 0.005 },
  },
};

const TOTAL_COST = 0.02 + 0.011 + 0.014 + 0.005;

beforeEach(() => {
  redisStore.clear();
  requirePaidPlan.mockResolvedValue(membership());
  siteExplorerAnalysis.findFirst.mockResolvedValue(null);
  siteExplorerAnalysis.findMany.mockResolvedValue([]);
  siteExplorerAnalysis.aggregate.mockResolvedValue({ _sum: { costUsd: 0 } });
  siteExplorerAnalysis.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => row({ ...data, id: "sea_new" }),
  );
  seoMeteredCallResult.mockImplementation(async (_tenantId: string, path: string) => {
    const envelope = ENVELOPES[path];
    if (!envelope) throw new Error(`unexpected path ${path}`);
    return envelope;
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── Auth ───────────────────────────────────────────────────────────────────

describe("auth is required", () => {
  it("POST returns 401 when there is no session or tenant", async () => {
    requirePaidPlan.mockRejectedValue(new Error("Not authenticated or no tenant access"));
    const res = await POST(postRequest({ domain: "example.com" }));
    expect(res.status).toBe(401);
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
  });

  it("POST returns 403 when the workspace has no active subscription", async () => {
    requirePaidPlan.mockRejectedValue(new PaidPlanRequiredError("TRIALING"));
    const res = await POST(postRequest({ domain: "example.com" }));
    expect(res.status).toBe(403);
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
  });

  it("GET /[id] returns 401 when there is no session or tenant", async () => {
    requirePaidPlan.mockRejectedValue(new Error("Not authenticated or no tenant access"));
    const res = await GET_BY_ID(new Request("http://localhost"), {
      params: Promise.resolve({ id: "sea_1" }),
    });
    expect(res.status).toBe(401);
    expect(siteExplorerAnalysis.findFirst).not.toHaveBeenCalled();
  });

  it("GET history returns 401 when there is no session or tenant", async () => {
    requirePaidPlan.mockRejectedValue(new Error("Not authenticated or no tenant access"));
    expect((await GET_HISTORY()).status).toBe(401);
  });
});

// ─── Tenant isolation ───────────────────────────────────────────────────────

describe("GET /[id] is tenant-scoped", () => {
  it("filters on the caller's tenantId, not just the analysis id", async () => {
    siteExplorerAnalysis.findFirst.mockResolvedValue(row());
    await GET_BY_ID(new Request("http://localhost"), {
      params: Promise.resolve({ id: "sea_1" }),
    });
    expect(siteExplorerAnalysis.findFirst).toHaveBeenCalledWith({
      where: { id: "sea_1", tenantId: TENANT },
    });
  });

  it("404s another workspace's analysis id rather than leaking it", async () => {
    requirePaidPlan.mockResolvedValue(membership("STARTER", "tenant_b"));
    // A tenant-scoped query for someone else's row simply finds nothing.
    siteExplorerAnalysis.findFirst.mockResolvedValue(null);

    const res = await GET_BY_ID(new Request("http://localhost"), {
      params: Promise.resolve({ id: "sea_1" }),
    });

    expect(res.status).toBe(404);
    expect(siteExplorerAnalysis.findFirst).toHaveBeenCalledWith({
      where: { id: "sea_1", tenantId: "tenant_b" },
    });
    await expect(res.json()).resolves.toMatchObject({ code: "NOT_FOUND" });
  });

  it("serializes Decimal cost and Date fields for the wire", async () => {
    siteExplorerAnalysis.findFirst.mockResolvedValue(row({ costUsd: 0.05, failedSections: ["backlinks"] }));
    const body = await (
      await GET_BY_ID(new Request("http://localhost"), {
        params: Promise.resolve({ id: "sea_1" }),
      })
    ).json();

    expect(body.costUsd).toBe(0.05);
    expect(body.failedSections).toEqual(["backlinks"]);
    expect(body.createdAt).toBe("2026-07-28T12:00:00.000Z");
    // Reading a stored analysis never spends.
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
  });

  it("history is tenant-scoped, carries no section payloads, and totals spend", async () => {
    siteExplorerAnalysis.findMany.mockResolvedValue([
      { id: "sea_1", domain: "example.com", status: "partial", costUsd: 0.05, createdAt: new Date("2026-07-28T12:00:00Z") },
    ]);
    siteExplorerAnalysis.aggregate.mockResolvedValue({ _sum: { costUsd: 0.15 } });

    const body = await (await GET_HISTORY()).json();

    expect(siteExplorerAnalysis.findMany.mock.calls[0][0].where).toEqual({ tenantId: TENANT });
    expect(body.analyses[0]).toEqual({
      id: "sea_1",
      domain: "example.com",
      status: "partial",
      costUsd: 0.05,
      createdAt: "2026-07-28T12:00:00.000Z",
    });
    expect(body.totalCostUsd).toBe(0.15);
    expect(body.usage.limit).toBe(SITE_EXPLORER_ANALYSES_PER_MONTH.STARTER);
  });
});

// ─── Domain validation ──────────────────────────────────────────────────────

describe("domain normalization happens before any spend", () => {
  it("strips scheme, www., path and port, and lowercases", async () => {
    await POST(postRequest({ domain: "  HTTPS://WWW.Example.CO.UK:443/blog?x=1  " }));
    const [, , task] = seoMeteredCallResult.mock.calls[0];
    expect(task.target).toBe("example.co.uk");
    // The cache is keyed on the same normalized form.
    expect(siteExplorerAnalysis.findFirst.mock.calls[0][0].where.domain).toBe("example.co.uk");
  });

  it.each(["not a domain", "localhost", "192.168.0.1", "example", "-bad.com", "http://"])(
    "400s %j without calling upstream",
    async (domain) => {
      const res = await POST(postRequest({ domain }));
      expect(res.status).toBe(400);
      expect(seoMeteredCallResult).not.toHaveBeenCalled();
      expect(redis.incr).not.toHaveBeenCalled();
    },
  );

  it("400s a missing domain", async () => {
    const res = await POST(postRequest({}));
    expect(res.status).toBe(400);
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
  });
});

// ─── Cache ──────────────────────────────────────────────────────────────────

describe("24 h cache", () => {
  it("returns the stored analysis without any upstream call or quota spend", async () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    siteExplorerAnalysis.findFirst.mockResolvedValue(row({ createdAt: threeHoursAgo }));

    const res = await POST(postRequest({ domain: "example.com" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.cached).toBe(true);
    expect(body.analysis.id).toBe("sea_1");
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
    expect(siteExplorerAnalysis.create).not.toHaveBeenCalled();
    expect(redis.incr).not.toHaveBeenCalled();

    // ~21 h left of the 24 h window — what the UI renders as "Re-run in 21h".
    const hoursLeft = body.analysis.reRunAvailableInMs / 3_600_000;
    expect(hoursLeft).toBeGreaterThan(20.9);
    expect(hoursLeft).toBeLessThanOrEqual(21);
  });

  it("keys the lookup on tenant + domain + location + language, inside the window", async () => {
    await POST(postRequest({ domain: "example.com" }));

    const where = siteExplorerAnalysis.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({
      tenantId: TENANT,
      domain: "example.com",
      locationCode: 2124, // Canada, matching keywords/overview
      languageCode: "en",
    });
    expect(where.createdAt.gte).toBeInstanceOf(Date);
  });
});

// ─── The run itself ─────────────────────────────────────────────────────────

describe("a cache miss runs four live calls and persists one row", () => {
  it("calls all four endpoints in order and sums the billed cost", async () => {
    const res = await POST(postRequest({ domain: "example.com" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(seoMeteredCallResult).toHaveBeenCalledTimes(4);
    expect(seoMeteredCallResult.mock.calls.map((c) => c[1])).toEqual([
      "v3/dataforseo_labs/google/domain_rank_overview/live",
      "v3/dataforseo_labs/google/ranked_keywords/live",
      "v3/dataforseo_labs/google/competitors_domain/live",
      "v3/backlinks/summary/live",
    ]);

    const data = siteExplorerAnalysis.create.mock.calls[0][0].data;
    expect(data.costUsd).toBeCloseTo(TOTAL_COST, 6);
    expect(data.status).toBe("completed");
    expect(data.failedSections).toEqual([]);
    expect(body.cached).toBe(false);
    expect(body.usage.limit).toBe(SITE_EXPLORER_ANALYSES_PER_MONTH.STARTER);
  });

  it("requests 100 keyword rows and 20 competitors — the cost levers", async () => {
    await POST(postRequest({ domain: "example.com" }));
    const tasks = Object.fromEntries(
      seoMeteredCallResult.mock.calls.map((c) => [c[1] as string, c[2] as Record<string, unknown>]),
    );
    expect(tasks["v3/dataforseo_labs/google/ranked_keywords/live"].limit).toBe(100);
    expect(tasks["v3/dataforseo_labs/google/competitors_domain/live"].limit).toBe(20);
  });

  it("parses each section into its persisted shape", async () => {
    await POST(postRequest({ domain: "example.com" }));
    const data = siteExplorerAnalysis.create.mock.calls[0][0].data;

    expect(data.overview).toMatchObject({
      etv: 1234.5,
      keywordCount: 87,
      estimatedPaidTrafficCost: 999.5,
      distribution: { pos1: 3, pos2_3: 5, pos4_10: 20, pos11_20: 19, pos21_100: 40 },
    });
    // The keyword-less row is dropped; totalCount still reflects the domain.
    expect(data.rankedKeywords.items).toEqual([
      { keyword: "widgets", position: 2, searchVolume: 900, etv: 120.4, url: "https://example.com/widgets" },
    ]);
    expect(data.rankedKeywords.totalCount).toBe(87);
    // The target's own row is filtered out; the rival's domain is normalized.
    expect(data.competitors.items).toEqual([
      { domain: "rival.com", intersections: 40, avgPosition: 8.5, etv: 55.5 },
    ]);
    // 120 referring domains, 30 nofollow -> 90 dofollow, 75 %. The 250 in the
    // per-link attributes block is a different base and must not leak in here.
    expect(data.backlinks).toMatchObject({
      backlinks: 1000,
      referringDomains: 120,
      rank: 240,
      brokenBacklinks: 7,
      dofollowDomains: 90,
      nofollowDomains: 30,
      dofollowRatio: 0.75,
    });
  });
});

// ─── Partial failure ────────────────────────────────────────────────────────

describe("partial failure", () => {
  it("keeps the three good sections, flags the failed one, and still charges once", async () => {
    seoMeteredCallResult.mockImplementation(async (_tenantId: string, path: string) => {
      if (path === "v3/backlinks/summary/live") throw new Error("upstream 502");
      return ENVELOPES[path];
    });

    const res = await POST(postRequest({ domain: "example.com" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    const data = siteExplorerAnalysis.create.mock.calls[0][0].data;
    expect(data.status).toBe("partial");
    expect(data.failedSections).toEqual(["backlinks"]);
    expect(data.overview).toBeTruthy();
    expect(data.rankedKeywords).toBeTruthy();
    expect(data.competitors).toBeTruthy();
    expect(data.backlinks).toBeUndefined();
    // Cost is the sum of what actually came back, not the full four.
    expect(data.costUsd).toBeCloseTo(TOTAL_COST - 0.005, 6);
    // The client renders a "couldn't load" card for exactly this key.
    expect(body.analysis.failedSections).toEqual(["backlinks"]);
    // One analysis was still used.
    expect(redisStore.get(siteExplorerQuotaKey(TENANT))).toBe(1);
  });

  it("502s and refunds the analysis when every section fails", async () => {
    seoMeteredCallResult.mockRejectedValue(new Error("upstream down"));

    const res = await POST(postRequest({ domain: "example.com" }));

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toMatchObject({ code: "TASK_FAILED" });
    expect(siteExplorerAnalysis.create).not.toHaveBeenCalled();
    expect(redisStore.get(siteExplorerQuotaKey(TENANT))).toBe(0);
  });
});

// ─── Quota ──────────────────────────────────────────────────────────────────

describe("monthly per-plan quota", () => {
  it("429s with an upgrade message once the plan's limit is used up", async () => {
    const limit = SITE_EXPLORER_ANALYSES_PER_MONTH.STARTER;
    redisStore.set(siteExplorerQuotaKey(TENANT), limit);

    const res = await POST(postRequest({ domain: "example.com" }));
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.code).toBe("QUOTA_EXCEEDED");
    expect(body.limit).toBe(limit);
    expect(body.upgradeHref).toBe("/billing");
    expect(body.error).toMatch(/upgrade/i);

    // Nothing was called, and the rejected reservation was rolled back.
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
    expect(redisStore.get(siteExplorerQuotaKey(TENANT))).toBe(limit);
  });

  it("counts each accepted analysis against the month key", async () => {
    await POST(postRequest({ domain: "one.com" }));
    await POST(postRequest({ domain: "two.com" }));
    expect(redisStore.get(siteExplorerQuotaKey(TENANT))).toBe(2);
    expect(redis.expire).toHaveBeenCalled();
  });

  it("applies the plan's own limit, not STARTER's", async () => {
    requirePaidPlan.mockResolvedValue(membership("GROWTH"));
    redisStore.set(siteExplorerQuotaKey(TENANT), SITE_EXPLORER_ANALYSES_PER_MONTH.STARTER);

    // Well past STARTER's 5, still inside GROWTH's 50.
    expect((await POST(postRequest({ domain: "example.com" }))).status).toBe(200);
  });

  it("503s rather than spending when Redis is unreachable", async () => {
    redis.incr.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const res = await POST(postRequest({ domain: "example.com" }));
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ code: "QUOTA_UNAVAILABLE" });
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
  });
});
