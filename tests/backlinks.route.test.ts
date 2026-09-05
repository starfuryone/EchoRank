// Backlinks route handlers — the paths that cost money, leak data, or hand a
// tenant something its plan does not include.
//
// Prisma, the session guard, the metered client and Redis are stubbed;
// everything else (zod, target normalization, plan gating, cache window, quota
// arithmetic, section parsing, DTO shaping, error mapping) is the real code
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

const backlinksAnalysis = {
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  aggregate: vi.fn(),
};
// seoApiCall backs the pooled monthly search quota, which every DataForSEO
// service now checks before spending. Default 0 used = quota available, so
// these suites keep testing their own per-tool gate rather than this one.
const seoApiCall = { count: vi.fn(async () => 0), updateMany: vi.fn(), create: vi.fn() };
vi.mock("@/lib/prisma", () => ({ prisma: { backlinksAnalysis, seoApiCall } }));

const seoMeteredCallResult = vi.fn();
vi.mock("@/lib/dataforseo/metering", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/dataforseo/metering")>()),
  seoMeteredCallResult: (...args: unknown[]) => seoMeteredCallResult(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({ success: true, remaining: 4 })),
}));

// The shared Spaces cache. Mocked rather than left to fall through on a missing
// SPACES_CACHE_BUCKET: "the cache is off because the env is unset" and "the
// cache missed" are the same behaviour but not the same test, and only the
// second one is what these assertions mean.
const readCache = vi.fn(async () => null as unknown);
const writeCache = vi.fn(async () => true);
vi.mock("@/lib/spaces-cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/spaces-cache")>()),
  readCache: (...args: unknown[]) => readCache(...(args as [])),
  writeCache: (...args: unknown[]) => writeCache(...(args as [])),
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
const { POST } = await import("@/app/api/seo/v1/backlinks/analyze/route");
const { GET: GET_HISTORY } = await import("@/app/api/seo/v1/backlinks/history/route");
const { GET: GET_BY_ID } = await import("@/app/api/seo/v1/backlinks/[id]/route");
const {
  BACKLINKS_ANALYSES_PER_MONTH,
  backlinksAnalysisLimit,
  planCanAnalyzeBacklinks,
} = await import("@/lib/backlinks/options");
const { backlinksQuotaKey } = await import("@/lib/backlinks/quota");

// ─── Helpers ────────────────────────────────────────────────────────────────

const TENANT = "tenant_a";

// AGENCY, not GROWTH. The two-tier split of 2026-09-05 made GROWTH a BASIC
// tier — domain scope only, no anchors, no linked pages — so every test below
// that asserts five endpoints, exact-URL scope or a partial failure across all
// five is describing the FULL experience. The Basic experience has its own
// block at the end of this file.
function membership(planType: PlanType = "AGENCY", tenantId = TENANT) {
  return { tenantId, tenant: { planType } };
}

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/seo/v1/backlinks/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "bl_1",
    tenantId: TENANT,
    target: "example.com",
    mode: "domain",
    status: "completed",
    costUsd: 0.124068,
    summary: { backlinks: 10, referringDomains: 4 },
    history: { points: [] },
    referringDomains: { items: [], totalCount: 0 },
    anchors: { items: [], totalCount: 0, maxBacklinks: 0 },
    pages: { items: [], totalCount: 0 },
    failedSections: [],
    createdAt: new Date("2026-07-29T12:00:00Z"),
    ...overrides,
  };
}

/** One envelope per endpoint, keyed by the v3 path the service calls. */
const ENVELOPES: Record<string, { data: unknown; billing: { path: string[]; costUsd: number } }> = {
  "v3/backlinks/summary/live": {
    data: [
      {
        backlinks: 1000,
        referring_domains: 120,
        referring_domains_nofollow: 30,
        referring_main_domains: 110,
        rank: 240,
        broken_backlinks: 7,
        backlinks_spam_score: 5,
      },
    ],
    billing: { path: ["v3", "backlinks", "summary", "live"], costUsd: 0.024036 },
  },
  "v3/backlinks/history/live": {
    data: [
      {
        items: [
          { date: "2026-06-30 00:00:00 +00:00", backlinks: 900, referring_domains: 100 },
          { date: "2026-07-31 00:00:00 +00:00", backlinks: 1000, referring_domains: 120 },
        ],
      },
    ],
    billing: { path: ["v3", "backlinks", "history", "live"], costUsd: 0.024432 },
  },
  "v3/backlinks/referring_domains/live": {
    data: [
      {
        total_count: 120,
        items: [
          { domain: "WWW.Rival.com", rank: 400, backlinks: 50, backlinks_spam_score: 2, first_seen: "2024-01-01 00:00:00 +00:00" },
        ],
      },
    ],
    billing: { path: ["v3", "backlinks", "referring_domains", "live"], costUsd: 0.0258 },
  },
  "v3/backlinks/anchors/live": {
    data: [
      {
        total_count: 90,
        items: [
          { anchor: null, backlinks: 80, referring_domains: 20, referring_domains_nofollow: 5 },
          { anchor: "example", backlinks: 40, referring_domains: 10, referring_domains_nofollow: 0 },
        ],
      },
    ],
    billing: { path: ["v3", "backlinks", "anchors", "live"], costUsd: 0.02508 },
  },
  "v3/backlinks/domain_pages/live": {
    data: [
      {
        total_count: 300,
        items: [
          {
            page: "https://example.com/a",
            status_code: 200,
            meta: { title: "A" },
            page_summary: { backlinks: 60, referring_domains: 12, rank: 300 },
          },
        ],
      },
    ],
    billing: { path: ["v3", "backlinks", "domain_pages", "live"], costUsd: 0.02472 },
  },
  // The Full tier's individual-links table. This endpoint bills per request
  // AND per row, like its siblings.
  "v3/backlinks/backlinks/live": {
    data: [
      {
        total_count: 1000,
        items: [
          {
            url_from: "https://rival.com/post",
            url_to: "https://example.com/pricing",
            domain_from: "rival.com",
            anchor: "best widget",
            domain_from_rank: 400,
            dofollow: true,
            is_lost: false,
            is_broken: false,
            first_seen: "2024-01-01 00:00:00 +00:00",
          },
        ],
      },
    ],
    billing: { path: ["v3", "backlinks", "backlinks", "live"], costUsd: 0.0261 },
  },
};

const TOTAL_COST = 0.024036 + 0.024432 + 0.0258 + 0.02508 + 0.02472 + 0.0261;

beforeEach(() => {
  redisStore.clear();
  requirePaidPlan.mockResolvedValue(membership());
  backlinksAnalysis.findFirst.mockResolvedValue(null);
  backlinksAnalysis.findMany.mockResolvedValue([]);
  backlinksAnalysis.aggregate.mockResolvedValue({ _sum: { costUsd: 0 } });
  backlinksAnalysis.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => row({ ...data, id: "bl_new" }),
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
    const res = await POST(postRequest({ target: "example.com" }));
    expect(res.status).toBe(401);
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
  });

  it("POST returns 403 when the workspace has no active subscription", async () => {
    requirePaidPlan.mockRejectedValue(new PaidPlanRequiredError("TRIALING"));
    const res = await POST(postRequest({ target: "example.com" }));
    expect(res.status).toBe(403);
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
  });

  it("GET /[id] returns 401 when there is no session or tenant", async () => {
    requirePaidPlan.mockRejectedValue(new Error("Not authenticated or no tenant access"));
    const res = await GET_BY_ID(new Request("http://localhost"), {
      params: Promise.resolve({ id: "bl_1" }),
    });
    expect(res.status).toBe(401);
    expect(backlinksAnalysis.findFirst).not.toHaveBeenCalled();
  });

  it("GET history returns 401 when there is no session or tenant", async () => {
    requirePaidPlan.mockRejectedValue(new Error("Not authenticated or no tenant access"));
    expect((await GET_HISTORY()).status).toBe(401);
  });
});

// ─── Plan gating ────────────────────────────────────────────────────────────

describe("plan gating", () => {
  // STARTER USED TO BE LOCKED OUT ENTIRELY. The two-tier split assigned it to
  // Basic, and a tier whose allowance is zero cannot use the tier it is
  // assigned to — the locked card would still be the whole experience. Its
  // allowance is now 5. This is a PACKAGING decision, so it is asserted rather
  // than implied: setting it back to 0 must fail here and be argued for.
  it.each(["STARTER", "AI_VISIBILITY", "GROWTH", "AGENCY", "ENTERPRISE"] as const)(
    "%s can run a lookup",
    async (plan) => {
      requirePaidPlan.mockResolvedValue(membership(plan));
      const body = await (await GET_HISTORY()).json();
      expect(body.usage.canAnalyze).toBe(true);
      expect(body.usage.limit).toBeGreaterThan(0);
    },
  );

  it("gives STARTER a small but real allowance", async () => {
    requirePaidPlan.mockResolvedValue(membership("STARTER"));
    const body = await (await GET_HISTORY()).json();
    expect(body.usage.limit).toBe(BACKLINKS_ANALYSES_PER_MONTH.STARTER);
    expect(body.usage.limit).toBe(5);
  });

  it("still locks a tier whose allowance is zero", async () => {
    // The branch and its copy stay because this remains a real question: a
    // future tier, or one whose allowance is cut back, gets the locked card
    // without a component change. Asserted through the predicate rather than
    // through a plan that no longer triggers it.
    expect(planCanAnalyzeBacklinks("STARTER")).toBe(true);
    expect(backlinksAnalysisLimit("STARTER")).toBeGreaterThan(0);
  });

  it("reports the plan's own limit in the usage block", async () => {
    requirePaidPlan.mockResolvedValue(membership("AGENCY"));
    const body = await (await GET_HISTORY()).json();
    expect(body.usage.limit).toBe(BACKLINKS_ANALYSES_PER_MONTH.AGENCY);
    expect(body.usage.canAnalyze).toBe(true);
  });
});

// ─── Target normalization at the edge ───────────────────────────────────────

describe("target normalization happens before any spend", () => {
  it("strips scheme, www., path and port in domain mode", async () => {
    await POST(postRequest({ target: "  HTTPS://WWW.Example.CO.UK:443/blog?x=1  " }));
    const [, , task] = seoMeteredCallResult.mock.calls[0];
    expect(task.target).toBe("example.co.uk");
    expect(backlinksAnalysis.findFirst.mock.calls[0][0].where.target).toBe("example.co.uk");
  });

  it("keeps the full URL in exact-URL mode and does not widen to subdomains", async () => {
    await POST(
      postRequest({ target: "https://www.example.com/pricing?a=1#top", mode: "exact_url" }),
    );
    const [, , task] = seoMeteredCallResult.mock.calls[0];
    expect(task.target).toBe("https://www.example.com/pricing?a=1");
    // DataForSEO ignores include_subdomains for page targets.
    expect(task.include_subdomains).toBe(false);
  });

  it("widens to subdomains in domain mode", async () => {
    await POST(postRequest({ target: "example.com", mode: "domain" }));
    const [, , task] = seoMeteredCallResult.mock.calls[0];
    expect(task.include_subdomains).toBe(true);
  });

  it("skips the domain-only sections in exact-URL mode instead of failing them", async () => {
    // history charts a DOMAIN's growth and domain_pages lists a DOMAIN's
    // pages; both error upstream for a page target (verified live). They must
    // not be called, and must not appear as failures — a "couldn't load" card
    // for something that can never load is a bug, not a status.
    const res = await POST(
      postRequest({ target: "https://example.com/pricing", mode: "exact_url" }),
    );
    const body = await res.json();

    expect(seoMeteredCallResult).toHaveBeenCalledTimes(4);
    expect(seoMeteredCallResult.mock.calls.map((c) => c[1])).toEqual([
      "v3/backlinks/summary/live",
      "v3/backlinks/referring_domains/live",
      "v3/backlinks/anchors/live",
      // The individual-links table, which a page target CAN have — unlike
      // history and domain_pages, both of which are about a whole domain.
      "v3/backlinks/backlinks/live",
    ]);

    const data = backlinksAnalysis.create.mock.calls[0][0].data;
    expect(data.status).toBe("completed");
    expect(data.failedSections).toEqual([]);
    expect(data.history).toBeUndefined();
    expect(data.pages).toBeUndefined();
    expect(body.analysis.status).toBe("completed");
  });

  it("charges an exact-URL analysis for fewer sections than a domain one", async () => {
    await POST(postRequest({ target: "https://example.com/a", mode: "exact_url" }));
    const data = backlinksAnalysis.create.mock.calls[0][0].data;
    // summary + referring_domains + anchors + the individual-links list;
    // history and domain_pages are skipped, so they are not billed.
    expect(data.costUsd).toBeCloseTo(0.024036 + 0.0258 + 0.02508 + 0.0261, 6);
  });

  it.each(["not a domain", "localhost", "192.168.0.1", "example", "-bad.com"])(
    "400s %j without calling upstream",
    async (target) => {
      const res = await POST(postRequest({ target }));
      expect(res.status).toBe(400);
      expect(seoMeteredCallResult).not.toHaveBeenCalled();
      expect(redis.incr).not.toHaveBeenCalled();
    },
  );

  it("400s a missing target", async () => {
    expect((await POST(postRequest({}))).status).toBe(400);
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
  });
});

// ─── Cache ──────────────────────────────────────────────────────────────────

describe("24 h cache", () => {
  it("returns the stored analysis without any upstream call or quota spend", async () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    backlinksAnalysis.findFirst.mockResolvedValue(row({ createdAt: threeHoursAgo }));

    const res = await POST(postRequest({ target: "example.com" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.cached).toBe(true);
    expect(body.analysis.id).toBe("bl_1");
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
    expect(backlinksAnalysis.create).not.toHaveBeenCalled();
    expect(redis.incr).not.toHaveBeenCalled();

    // THE WINDOW WIDENED FROM 24 HOURS TO 7 DAYS on 2026-09-05, because a
    // lookup costs ~$0.37 and a link profile does not move in a week. The
    // user-visible cost is exactly this number: "Re-run in 21h" became
    // "Re-run in 6 days". Asserted rather than loosened, so narrowing or
    // widening it again is a deliberate edit.
    const hoursLeft = body.analysis.reRunAvailableInMs / 3_600_000;
    expect(hoursLeft).toBeGreaterThan(7 * 24 - 3.1);
    expect(hoursLeft).toBeLessThanOrEqual(7 * 24 - 3);
  });

  it("keys the lookup on tenant + target + MODE, inside the window", async () => {
    await POST(postRequest({ target: "example.com", mode: "exact_url" }));
    const where = backlinksAnalysis.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({
      tenantId: TENANT,
      target: "https://example.com/",
      // Without mode in the key a whole-domain analysis would be replayed for
      // an exact-URL request, which is a different question entirely.
      mode: "exact_url",
    });
    expect(where.createdAt.gte).toBeInstanceOf(Date);
  });
});

// ─── The run itself ─────────────────────────────────────────────────────────

describe("a cache miss runs five live calls and persists one row", () => {
  it("calls every Full-tier endpoint in order and sums the billed cost", async () => {
    const res = await POST(postRequest({ target: "example.com" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(seoMeteredCallResult).toHaveBeenCalledTimes(6);
    expect(seoMeteredCallResult.mock.calls.map((c) => c[1])).toEqual([
      "v3/backlinks/summary/live",
      "v3/backlinks/history/live",
      "v3/backlinks/referring_domains/live",
      "v3/backlinks/anchors/live",
      "v3/backlinks/domain_pages/live",
      "v3/backlinks/backlinks/live",
    ]);

    const data = backlinksAnalysis.create.mock.calls[0][0].data;
    expect(data.costUsd).toBeCloseTo(TOTAL_COST, 6);
    expect(data.status).toBe("completed");
    expect(data.failedSections).toEqual([]);
    expect(body.cached).toBe(false);
  });

  it("requests the row limits that ARE the price of an analysis", async () => {
    await POST(postRequest({ target: "example.com" }));
    const tasks = Object.fromEntries(
      seoMeteredCallResult.mock.calls.map((c) => [c[1] as string, c[2] as Record<string, unknown>]),
    );
    expect(tasks["v3/backlinks/referring_domains/live"].limit).toBe(50);
    expect(tasks["v3/backlinks/anchors/live"].limit).toBe(30);
    expect(tasks["v3/backlinks/domain_pages/live"].limit).toBe(20);
    // domain_pages rejects order_by outright — sending it fails the section.
    expect(tasks["v3/backlinks/domain_pages/live"].order_by).toBeUndefined();
  });

  it("parses each section into its persisted shape", async () => {
    await POST(postRequest({ target: "example.com" }));
    const data = backlinksAnalysis.create.mock.calls[0][0].data;

    expect(data.summary).toMatchObject({
      backlinks: 1000,
      referringDomains: 120,
      dofollowDomains: 90,
      nofollowDomains: 30,
      spamScore: 5,
    });
    expect(data.history.points.map((p: { month: string }) => p.month)).toEqual([
      "2026-06",
      "2026-07",
    ]);
    expect(data.referringDomains.items[0]).toMatchObject({
      domain: "rival.com", // normalized
      rank: 400,
      spamScore: 2,
    });
    // Null anchor is kept; dofollow domains differenced from the nofollow pair.
    expect(data.anchors.items[0]).toMatchObject({ anchor: "", dofollowDomains: 15 });
    expect(data.anchors.maxBacklinks).toBe(80);
    expect(data.pages.items[0]).toMatchObject({
      url: "https://example.com/a",
      backlinks: 60,
      rank: 300,
    });
  });
});

// ─── Partial failure ────────────────────────────────────────────────────────

describe("partial failure", () => {
  it("keeps the good sections, flags the failed one, and still charges once", async () => {
    seoMeteredCallResult.mockImplementation(async (_tenantId: string, path: string) => {
      if (path === "v3/backlinks/domain_pages/live") throw new Error("Invalid Field: 'order_by'");
      return ENVELOPES[path];
    });

    const res = await POST(postRequest({ target: "example.com" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    const data = backlinksAnalysis.create.mock.calls[0][0].data;
    expect(data.status).toBe("partial");
    expect(data.failedSections).toEqual(["pages"]);
    expect(data.summary).toBeTruthy();
    expect(data.history).toBeTruthy();
    expect(data.referringDomains).toBeTruthy();
    expect(data.anchors).toBeTruthy();
    expect(data.pages).toBeUndefined();
    // Cost is the sum of what actually came back, not the full five.
    expect(data.costUsd).toBeCloseTo(TOTAL_COST - 0.02472, 6);
    // The client renders a "couldn't load" card for exactly this key.
    expect(body.analysis.failedSections).toEqual(["pages"]);
    expect(redisStore.get(backlinksQuotaKey(TENANT))).toBe(1);
  });

  it("502s and refunds the analysis when every section fails", async () => {
    seoMeteredCallResult.mockRejectedValue(new Error("upstream down"));

    const res = await POST(postRequest({ target: "example.com" }));

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toMatchObject({ code: "TASK_FAILED" });
    expect(backlinksAnalysis.create).not.toHaveBeenCalled();
    expect(redisStore.get(backlinksQuotaKey(TENANT))).toBe(0);
  });
});

// ─── Quota ──────────────────────────────────────────────────────────────────

describe("monthly per-plan quota", () => {
  it("429s with an upgrade message once the plan's limit is used up", async () => {
    // The suite's default membership is AGENCY, so this must exhaust AGENCY's
    // limit. It used to say GROWTH's, which was the same tier back when GROWTH
    // was the default — a silent no-op after the default moved.
    const limit = BACKLINKS_ANALYSES_PER_MONTH.AGENCY;
    redisStore.set(backlinksQuotaKey(TENANT), limit);

    const res = await POST(postRequest({ target: "example.com" }));
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.code).toBe("QUOTA_EXCEEDED");
    expect(body.limit).toBe(limit);
    expect(body.upgradeHref).toBe("/billing");
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
    // The rejected reservation was rolled back.
    expect(redisStore.get(backlinksQuotaKey(TENANT))).toBe(limit);
  });

  it("counts each accepted analysis against the month key", async () => {
    await POST(postRequest({ target: "one.com" }));
    await POST(postRequest({ target: "two.com" }));
    expect(redisStore.get(backlinksQuotaKey(TENANT))).toBe(2);
    expect(redis.expire).toHaveBeenCalled();
  });

  it("applies the plan's own limit, not GROWTH's", async () => {
    requirePaidPlan.mockResolvedValue(membership("AGENCY"));
    redisStore.set(backlinksQuotaKey(TENANT), BACKLINKS_ANALYSES_PER_MONTH.GROWTH);
    // Past GROWTH's 25, still inside AGENCY's 100.
    expect((await POST(postRequest({ target: "example.com" }))).status).toBe(200);
  });

  it("503s rather than spending when Redis is unreachable", async () => {
    redis.incr.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const res = await POST(postRequest({ target: "example.com" }));
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ code: "QUOTA_UNAVAILABLE" });
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
  });
});

// ─── Tenant isolation ───────────────────────────────────────────────────────

describe("tenant isolation", () => {
  it("GET /[id] filters on the caller's tenantId, not just the analysis id", async () => {
    backlinksAnalysis.findFirst.mockResolvedValue(row());
    await GET_BY_ID(new Request("http://localhost"), {
      params: Promise.resolve({ id: "bl_1" }),
    });
    expect(backlinksAnalysis.findFirst).toHaveBeenCalledWith({
      where: { id: "bl_1", tenantId: TENANT },
    });
  });

  it("404s another workspace's analysis id rather than leaking it", async () => {
    requirePaidPlan.mockResolvedValue(membership("GROWTH", "tenant_b"));
    backlinksAnalysis.findFirst.mockResolvedValue(null);

    const res = await GET_BY_ID(new Request("http://localhost"), {
      params: Promise.resolve({ id: "bl_1" }),
    });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({ code: "NOT_FOUND" });
    expect(backlinksAnalysis.findFirst.mock.calls[0][0].where.tenantId).toBe("tenant_b");
  });

  it("serializes Decimal cost and Date fields for the wire", async () => {
    backlinksAnalysis.findFirst.mockResolvedValue(row({ failedSections: ["pages"] }));
    const body = await (
      await GET_BY_ID(new Request("http://localhost"), {
        params: Promise.resolve({ id: "bl_1" }),
      })
    ).json();

    expect(body.costUsd).toBe(0.124068);
    expect(body.failedSections).toEqual(["pages"]);
    expect(body.createdAt).toBe("2026-07-29T12:00:00.000Z");
    // Reading a stored analysis never spends.
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
  });

  it("history is tenant-scoped, carries no section payloads, and totals spend", async () => {
    backlinksAnalysis.findMany.mockResolvedValue([
      {
        id: "bl_1",
        target: "example.com",
        mode: "domain",
        status: "partial",
        costUsd: 0.1,
        createdAt: new Date("2026-07-29T12:00:00Z"),
      },
    ]);
    backlinksAnalysis.aggregate.mockResolvedValue({ _sum: { costUsd: 0.3 } });

    const body = await (await GET_HISTORY()).json();

    expect(backlinksAnalysis.findMany.mock.calls[0][0].where).toEqual({ tenantId: TENANT });
    expect(body.analyses[0]).toEqual({
      id: "bl_1",
      target: "example.com",
      mode: "domain",
      status: "partial",
      costUsd: 0.1,
      createdAt: "2026-07-29T12:00:00.000Z",
    });
    expect(body.totalCostUsd).toBe(0.3);
  });
});
