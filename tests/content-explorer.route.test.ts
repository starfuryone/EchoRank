// Content Explorer route handlers — the paths that cost money, leak data, or
// hand a tenant something its plan does not include.
//
// Prisma, the session guard, the metered client and Redis are stubbed; everything
// else (zod, query normalization, plan gating, cache window, quota arithmetic,
// the summary skip, DTO shaping, error mapping) is the real code path. No live
// call is ever made from this suite.
//
// The costliest thing this tool can do wrong is spend money it did not need to,
// so the assertions below care as much about how many upstream calls happened as
// about the response body.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaidPlanRequiredError } from "@/lib/paid-plan";
import type { PlanType } from "@/generated/prisma";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const requirePaidPlan = vi.fn();
vi.mock("@/lib/paid-plan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paid-plan")>()),
  requirePaidPlan: () => requirePaidPlan(),
}));

const contentSearch = {
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
};
vi.mock("@/lib/prisma", () => ({ prisma: { contentSearch } }));

const seoMeteredCallResult = vi.fn();
vi.mock("@/lib/dataforseo/metering", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/dataforseo/metering")>()),
  seoMeteredCallResult: (...args: unknown[]) => seoMeteredCallResult(...args),
}));

// The `..._a` rest parameter is load-bearing for tsc, not decoration: forwarding
// `...a: unknown[]` into a zero-arg mock is a TS2556, which vitest would never
// catch because it does not typecheck. Same form as lighthouse.route.test.ts and
// web-analytics.route.test.ts.
const rateLimit = vi.fn(async (..._a: unknown[]) => ({ success: true, remaining: 2 }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: (...a: unknown[]) => rateLimit(...a) }));

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
    const v = redisStore.get(key);
    return v === undefined ? null : String(v);
  }),
};
vi.mock("@/infrastructure/redis/connection", () => ({
  getRedisConnection: () => redis,
  getSubscriberConnection: () => redis,
}));

// Imported after the mocks so the modules pick them up.
const { POST: SEARCH } = await import("@/app/api/seo/v1/content-explorer/search/route");
const { GET: HISTORY } = await import("@/app/api/seo/v1/content-explorer/history/route");
const { GET: BY_ID } = await import("@/app/api/seo/v1/content-explorer/[id]/route");
const { contentQuotaKey } = await import("@/lib/content-explorer/quota");
const { CONTENT_ANALYSIS } = await import("@/lib/dataforseo/endpoints");
const { contentSearchLimit } = await import("@/lib/content-explorer/options");

// ─── Helpers ────────────────────────────────────────────────────────────────

function asTenant(tenantId: string, planType: PlanType) {
  return { tenantId, tenant: { id: tenantId, planType, name: "Acme" } };
}

function post(body: unknown): Request {
  return new Request("http://localhost/api/seo/v1/content-explorer/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** A search/live envelope with `count` items. */
function searchEnvelope(count: number, total = count === 0 ? 0 : 1234) {
  return {
    data: [
      {
        total_count: total,
        items_count: count,
        items: Array.from({ length: count }, (_, i) => ({
          url: `https://example${i}.com/post`,
          domain: `example${i}.com`,
          domain_rank: 700 - i,
          spam_score: 0,
          fetch_time: "2026-07-01 10:00:00 +00:00",
          language: "en",
          country: null,
          content_info: {
            title: `Post ${i}`,
            snippet: "…",
            date_published: "2026-06-01 10:00:00 +00:00",
            connotation_types: { positive: 0.7, negative: 0.1, neutral: 0.2 },
          },
        })),
      },
    ],
    billing: { path: ["v3", "content_analysis", "search", "live"], costUsd: 0.0258 },
  };
}

function summaryEnvelope() {
  return {
    data: [
      {
        total_count: 1234,
        connotation_types: { positive: 0.6, negative: 0.15, neutral: 0.25 },
        top_domains: [{ domain: "big.com", count: 40 }],
        countries: { US: 10 },
        languages: { en: 30 },
        page_types: { blogs: 20 },
      },
    ],
    billing: { path: ["v3", "content_analysis", "summary", "live"], costUsd: 0.024036 },
  };
}

/** Mirrors what prisma.create would hand back. */
function storedRow(over: Record<string, unknown> = {}) {
  return {
    id: "cs_1",
    tenantId: "t1",
    query: "acme",
    angle: "brand",
    params: {},
    results: { totalCount: 1234, mentions: [{ url: "https://example0.com/post" }] },
    summary: { totalCount: 1234, topDomains: [], countries: [], languages: [], pageTypes: [], sentiment: null },
    costUsd: "0.049836",
    createdAt: new Date("2026-07-30T06:00:00Z"),
    ...over,
  };
}

beforeEach(() => {
  redisStore.clear();
  vi.clearAllMocks();
  requirePaidPlan.mockResolvedValue(asTenant("t1", "GROWTH"));
  contentSearch.findFirst.mockResolvedValue(null);
  contentSearch.findMany.mockResolvedValue([]);
  contentSearch.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
    storedRow(data),
  );
  rateLimit.mockResolvedValue({ success: true, remaining: 2 });
  seoMeteredCallResult.mockImplementation(async (_t: string, path: string) =>
    path === CONTENT_ANALYSIS.search ? searchEnvelope(3) : summaryEnvelope(),
  );
});

// ─── Auth ───────────────────────────────────────────────────────────────────
describe("auth", () => {
  it("401s an unauthenticated search", async () => {
    requirePaidPlan.mockRejectedValue(new Error("Not authenticated or no tenant access"));
    const res = await SEARCH(post({ query: "acme" }));
    expect(res.status).toBe(401);
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
  });

  it("403s a tenant whose billing is not ACTIVE, before spending", async () => {
    requirePaidPlan.mockRejectedValue(new PaidPlanRequiredError("PAST_DUE"));
    const res = await SEARCH(post({ query: "acme" }));
    expect(res.status).toBe(403);
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
  });

  it("401s history and by-id too", async () => {
    requirePaidPlan.mockRejectedValue(new Error("Not authenticated or no tenant access"));
    expect((await HISTORY()).status).toBe(401);
    const res = await BY_ID(new Request("http://localhost"), {
      params: Promise.resolve({ id: "cs_1" }),
    });
    expect(res.status).toBe(401);
  });
});

// ─── Validation ─────────────────────────────────────────────────────────────
describe("validation", () => {
  it("400s a too-short or missing phrase without spending", async () => {
    for (const body of [{}, { query: "" }, { query: "a" }, { query: "   " }]) {
      const res = await SEARCH(post(body));
      expect(res.status).toBe(400);
    }
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
  });

  it("400s a phrase that is only whitespace after normalization", async () => {
    const res = await SEARCH(post({ query: "   \t  " }));
    expect(res.status).toBe(400);
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
  });

  it("rejects an unknown angle", async () => {
    const res = await SEARCH(post({ query: "acme", angle: "nonsense" }));
    expect(res.status).toBe(400);
  });
});

// ─── Plan gating ────────────────────────────────────────────────────────────
describe("plan gating", () => {
  it("lets a legacy AI_VISIBILITY row search, folded onto STARTER", async () => {
    // The tier is retired; a stale row must behave as STARTER, not be locked
    // out of a tool STARTER can use.
    requirePaidPlan.mockResolvedValue(asTenant("t1", "AI_VISIBILITY"));
    const res = await SEARCH(post({ query: "acme" }));
    expect(res.status).toBe(200);
  });

  it("lets STARTER search", async () => {
    requirePaidPlan.mockResolvedValue(asTenant("t1", "STARTER"));
    const res = await SEARCH(post({ query: "acme" }));
    expect(res.status).toBe(200);
  });
});

// ─── Quota ──────────────────────────────────────────────────────────────────
describe("monthly cap", () => {
  it("429s once the plan's allowance is gone, and does not call upstream", async () => {
    requirePaidPlan.mockResolvedValue(asTenant("t1", "STARTER"));
    redisStore.set(contentQuotaKey("t1"), contentSearchLimit("STARTER"));
    const res = await SEARCH(post({ query: "acme" }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe("QUOTA_EXCEEDED");
    expect(body.limit).toBe(10);
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
  });

  it("rolls the counter back when the upstream call fails", async () => {
    // The tenant must not lose an allowance for a search that produced nothing.
    seoMeteredCallResult.mockRejectedValue(new Error("upstream exploded"));
    await SEARCH(post({ query: "acme" }));
    expect(redisStore.get(contentQuotaKey("t1")) ?? 0).toBe(0);
  });

  it("keeps the reservation when the search succeeds", async () => {
    await SEARCH(post({ query: "acme" }));
    expect(redisStore.get(contentQuotaKey("t1"))).toBe(1);
  });

  it("isolates tenants — one tenant's spend never consumes another's", async () => {
    requirePaidPlan.mockResolvedValue(asTenant("t1", "STARTER"));
    redisStore.set(contentQuotaKey("t1"), 10);
    expect((await SEARCH(post({ query: "acme" }))).status).toBe(429);

    requirePaidPlan.mockResolvedValue(asTenant("t2", "STARTER"));
    expect((await SEARCH(post({ query: "acme" }))).status).toBe(200);
    expect(contentQuotaKey("t1")).not.toBe(contentQuotaKey("t2"));
  });

  it("429s a burst via the rate limit before touching the monthly allowance", async () => {
    rateLimit.mockResolvedValue({ success: false, remaining: 0 });
    const res = await SEARCH(post({ query: "acme" }));
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("RATE_LIMITED");
    expect(redisStore.get(contentQuotaKey("t1")) ?? 0).toBe(0);
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
  });
});

// ─── Cache ──────────────────────────────────────────────────────────────────
describe("24h cache", () => {
  it("serves a stored search without spending or consuming the allowance", async () => {
    contentSearch.findFirst.mockResolvedValue(storedRow());
    const res = await SEARCH(post({ query: "acme" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cached).toBe(true);
    expect(body.search.cached).toBe(true);
    expect(body.search.reRunAvailableInMs).toBeGreaterThanOrEqual(0);
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
    expect(redisStore.get(contentQuotaKey("t1")) ?? 0).toBe(0);
  });

  it("looks the cache up on the NORMALIZED phrase", async () => {
    // Otherwise "Acme" and "acme " are two paid searches for one answer.
    await SEARCH(post({ query: "  ACME  " }));
    const where = contentSearch.findFirst.mock.calls[0][0].where;
    expect(where.query).toBe("acme");
    expect(where.tenantId).toBe("t1");
    expect(where.createdAt.gte).toBeInstanceOf(Date);
  });

  it("scopes the cache lookup to the tenant", async () => {
    requirePaidPlan.mockResolvedValue(asTenant("t2", "GROWTH"));
    await SEARCH(post({ query: "acme" }));
    expect(contentSearch.findFirst.mock.calls[0][0].where.tenantId).toBe("t2");
  });
});

// ─── The summary skip ───────────────────────────────────────────────────────
describe("zero-result searches", () => {
  it("SKIPS summary/live when nothing matched — the only cost lever available", async () => {
    // Both calls bill a flat $0.024, so skipping one halves the price of a search
    // that found nothing. Verified live: summary returns all zeros for such a
    // phrase, so the call buys nothing.
    seoMeteredCallResult.mockImplementation(async (_t: string, path: string) =>
      path === CONTENT_ANALYSIS.search ? searchEnvelope(0, 0) : summaryEnvelope(),
    );
    contentSearch.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      storedRow({ ...data, results: { totalCount: 0, mentions: [] }, summary: null }),
    );

    const res = await SEARCH(post({ query: "echorank360" }));
    expect(res.status).toBe(200);

    const paths = seoMeteredCallResult.mock.calls.map((c) => c[1]);
    expect(paths).toEqual([CONTENT_ANALYSIS.search]);
    expect(paths).not.toContain(CONTENT_ANALYSIS.summary);

    const body = await res.json();
    expect(body.search.totalCount).toBe(0);
    expect(body.search.mentions).toEqual([]);
    expect(body.search.summary).toBeNull();
  });

  it("still stores and still charges the allowance for an empty result", async () => {
    // It cost real money, and "nobody writes about you" is a genuine answer that
    // should not cost twice to see again.
    seoMeteredCallResult.mockImplementation(async () => searchEnvelope(0, 0));
    await SEARCH(post({ query: "echorank360" }));
    expect(contentSearch.create).toHaveBeenCalledTimes(1);
    expect(redisStore.get(contentQuotaKey("t1"))).toBe(1);
  });

  it("calls BOTH endpoints when there are matches", async () => {
    await SEARCH(post({ query: "acme" }));
    const paths = seoMeteredCallResult.mock.calls.map((c) => c[1]);
    expect(paths).toEqual([CONTENT_ANALYSIS.search, CONTENT_ANALYSIS.summary]);
  });

  it("sums both envelope costs onto the row, never a price table", async () => {
    await SEARCH(post({ query: "acme" }));
    const data = contentSearch.create.mock.calls[0][0].data;
    expect(data.costUsd).toBeCloseTo(0.0258 + 0.024036, 6);
  });

  it("keeps the mentions when only the summary call fails", async () => {
    // Failing the whole search would waste money already spent on the half that
    // worked.
    seoMeteredCallResult.mockImplementation(async (_t: string, path: string) => {
      if (path === CONTENT_ANALYSIS.search) return searchEnvelope(3);
      throw new Error("summary exploded");
    });
    const res = await SEARCH(post({ query: "acme" }));
    expect(res.status).toBe(200);
    const data = contentSearch.create.mock.calls[0][0].data;
    expect(data.summary).toBeUndefined();
    expect(data.costUsd).toBeCloseTo(0.0258, 6);
  });
});

// ─── History and by-id ──────────────────────────────────────────────────────
describe("history and reopening", () => {
  it("lists this tenant's searches with live usage", async () => {
    contentSearch.findMany.mockResolvedValue([storedRow(), storedRow({ id: "cs_2" })]);
    const res = await HISTORY();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.searches).toHaveLength(2);
    expect(body.usage.limit).toBe(contentSearchLimit("GROWTH"));
    expect(contentSearch.findMany.mock.calls[0][0].where.tenantId).toBe("t1");
  });

  it("reopens a stored search for free", async () => {
    contentSearch.findFirst.mockResolvedValue(storedRow());
    const res = await BY_ID(new Request("http://localhost"), {
      params: Promise.resolve({ id: "cs_1" }),
    });
    expect(res.status).toBe(200);
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
    expect(redisStore.get(contentQuotaKey("t1")) ?? 0).toBe(0);
  });

  it("404s another tenant's search id — scoped on BOTH id and tenantId", async () => {
    contentSearch.findFirst.mockResolvedValue(null);
    const res = await BY_ID(new Request("http://localhost"), {
      params: Promise.resolve({ id: "someone-elses-id" }),
    });
    expect(res.status).toBe(404);
    const where = contentSearch.findFirst.mock.calls[0][0].where;
    expect(where.id).toBe("someone-elses-id");
    expect(where.tenantId).toBe("t1");
  });
});

// ─── Response shape ─────────────────────────────────────────────────────────
describe("response shape", () => {
  it("returns the search plus live usage", async () => {
    const res = await SEARCH(post({ query: "acme", angle: "competitor" }));
    const body = await res.json();
    expect(body.search.id).toBeTruthy();
    expect(body.search.query).toBe("acme");
    expect(body.usage.used).toBe(1);
    expect(body.usage.limit).toBe(contentSearchLimit("GROWTH"));
    expect(body.usage.canSearch).toBe(true);
  });

  it("stores the angle it was given, and defaults to topic", async () => {
    await SEARCH(post({ query: "acme", angle: "competitor" }));
    expect(contentSearch.create.mock.calls[0][0].data.angle).toBe("competitor");
    vi.clearAllMocks();
    contentSearch.findFirst.mockResolvedValue(null);
    contentSearch.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      storedRow(data),
    );
    seoMeteredCallResult.mockImplementation(async (_t: string, path: string) =>
      path === CONTENT_ANALYSIS.search ? searchEnvelope(3) : summaryEnvelope(),
    );
    await SEARCH(post({ query: "acme" }));
    expect(contentSearch.create.mock.calls[0][0].data.angle).toBe("topic");
  });
});
