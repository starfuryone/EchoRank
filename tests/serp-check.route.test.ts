// SERP Checker route handlers — the four paths that cost money or leak data:
// auth, tenant isolation, the 24 h cache, and the monthly quota 429.
//
// Prisma, the session guard and Redis are stubbed; everything else (zod
// validation, quota arithmetic, cache window, DTO shaping, error mapping) is
// the real code path.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaidPlanRequiredError } from "@/lib/paid-plan";
import type { PlanType } from "@/generated/prisma";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const requirePaidPlan = vi.fn();
vi.mock("@/lib/paid-plan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paid-plan")>()),
  requirePaidPlan: () => requirePaidPlan(),
}));

const serpCheck = {
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  aggregate: vi.fn(),
};
vi.mock("@/lib/prisma", () => ({ prisma: { serpCheck } }));

const seoMeteredCallResult = vi.fn();
vi.mock("@/lib/dataforseo/metering", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/dataforseo/metering")>()),
  seoMeteredCallResult: (...args: unknown[]) => seoMeteredCallResult(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({ success: true, remaining: 9 })),
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
const { POST, GET: GET_LIST } = await import("@/app/api/seo/v1/serp/check/route");
const { GET: GET_BY_ID } = await import("@/app/api/seo/v1/serp/check/[id]/route");
const { SERP_CHECKS_PER_MONTH, serpQuotaKey } = await import("@/lib/serp/quota");

// ─── Helpers ────────────────────────────────────────────────────────────────

const TENANT = "tenant_a";

function membership(planType: PlanType = "STARTER", tenantId = TENANT) {
  return { tenantId, tenant: { planType } };
}

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/seo/v1/serp/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "chk_1",
    tenantId: TENANT,
    keyword: "plumber toronto",
    locationCode: 2124,
    languageCode: "en",
    device: "desktop",
    dataforseoTaskId: "task_1",
    status: "queued",
    costUsd: 0.0006,
    results: null,
    serpFeatures: null,
    itemCount: null,
    error: null,
    createdAt: new Date("2026-07-28T12:00:00Z"),
    completedAt: null,
    ...overrides,
  };
}

const OK_POST = {
  data: [],
  billing: { path: ["v3", "serp", "google", "organic", "task_post"], costUsd: 0.0006 },
  taskId: "task_1",
};

beforeEach(() => {
  redisStore.clear();
  requirePaidPlan.mockResolvedValue(membership());
  serpCheck.findFirst.mockResolvedValue(null);
  serpCheck.findMany.mockResolvedValue([]);
  serpCheck.aggregate.mockResolvedValue({ _sum: { costUsd: 0 } });
  serpCheck.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
    row(data),
  );
  seoMeteredCallResult.mockResolvedValue(OK_POST);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── Auth ───────────────────────────────────────────────────────────────────

describe("auth is required", () => {
  it("POST returns 401 when there is no session or tenant", async () => {
    requirePaidPlan.mockRejectedValue(new Error("Not authenticated or no tenant access"));
    const res = await POST(postRequest({ keyword: "pizza" }));
    expect(res.status).toBe(401);
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
  });

  it("POST returns 403 when the workspace has no active subscription", async () => {
    requirePaidPlan.mockRejectedValue(new PaidPlanRequiredError("TRIALING"));
    const res = await POST(postRequest({ keyword: "pizza" }));
    expect(res.status).toBe(403);
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
  });

  it("GET /[id] returns 401 when there is no session or tenant", async () => {
    requirePaidPlan.mockRejectedValue(new Error("Not authenticated or no tenant access"));
    const res = await GET_BY_ID(new Request("http://localhost"), {
      params: Promise.resolve({ id: "chk_1" }),
    });
    expect(res.status).toBe(401);
    expect(serpCheck.findFirst).not.toHaveBeenCalled();
  });

  it("GET history returns 401 when there is no session or tenant", async () => {
    requirePaidPlan.mockRejectedValue(new Error("Not authenticated or no tenant access"));
    expect((await GET_LIST()).status).toBe(401);
  });
});

// ─── Tenant isolation ───────────────────────────────────────────────────────

describe("GET /[id] is tenant-scoped", () => {
  it("filters on the caller's tenantId, not just the check id", async () => {
    serpCheck.findFirst.mockResolvedValue(row({ status: "completed" }));
    await GET_BY_ID(new Request("http://localhost"), {
      params: Promise.resolve({ id: "chk_1" }),
    });
    expect(serpCheck.findFirst).toHaveBeenCalledWith({
      where: { id: "chk_1", tenantId: TENANT },
    });
  });

  it("404s another workspace's check id rather than leaking it", async () => {
    requirePaidPlan.mockResolvedValue(membership("STARTER", "tenant_b"));
    // A tenant-scoped query for someone else's row simply finds nothing.
    serpCheck.findFirst.mockResolvedValue(null);

    const res = await GET_BY_ID(new Request("http://localhost"), {
      params: Promise.resolve({ id: "chk_1" }),
    });

    expect(res.status).toBe(404);
    expect(serpCheck.findFirst).toHaveBeenCalledWith({
      where: { id: "chk_1", tenantId: "tenant_b" },
    });
    await expect(res.json()).resolves.toMatchObject({ code: "NOT_FOUND" });
  });

  it("serializes Decimal cost and Date fields for the wire", async () => {
    serpCheck.findFirst.mockResolvedValue(
      row({
        status: "completed",
        results: { items: [{ position: 1, title: "T", url: "https://a.test/", domain: "a.test", snippet: "" }] },
        serpFeatures: ["people_also_ask"],
        itemCount: 1,
        completedAt: new Date("2026-07-28T12:03:00Z"),
      }),
    );

    const body = await (
      await GET_BY_ID(new Request("http://localhost"), {
        params: Promise.resolve({ id: "chk_1" }),
      })
    ).json();

    expect(body.costUsd).toBe(0.0006);
    expect(body.serpFeatures).toEqual(["people_also_ask"]);
    expect(body.createdAt).toBe("2026-07-28T12:00:00.000Z");
    expect(body.completedAt).toBe("2026-07-28T12:03:00.000Z");
  });
});

// ─── Cache ──────────────────────────────────────────────────────────────────

describe("24 h cache", () => {
  it("returns the stored check without posting a task or spending quota", async () => {
    serpCheck.findFirst.mockResolvedValue(
      row({ status: "completed", itemCount: 100, completedAt: new Date() }),
    );

    const res = await POST(postRequest({ keyword: "plumber toronto" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.cached).toBe(true);
    expect(body.check.status).toBe("completed");
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
    expect(serpCheck.create).not.toHaveBeenCalled();
    expect(redis.incr).not.toHaveBeenCalled();
  });

  it("keys the lookup on tenant + keyword + location + language + device", async () => {
    await POST(
      postRequest({
        keyword: "pizza",
        locationCode: 2840,
        languageCode: "fr",
        device: "mobile",
      }),
    );

    const where = serpCheck.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({
      tenantId: TENANT,
      keyword: "pizza",
      locationCode: 2840,
      languageCode: "fr",
      device: "mobile",
      status: "completed",
    });
    // Only checks inside the window count as a hit.
    expect(where.createdAt.gte).toBeInstanceOf(Date);
  });

  it("misses the cache and queues a standard-queue task at priority 1", async () => {
    const res = await POST(postRequest({ keyword: "plumber toronto" }));
    const body = await res.json();

    expect(res.status).toBe(202);
    expect(body.status).toBe("queued");
    expect(body.cached).toBe(false);

    const [, path, task] = seoMeteredCallResult.mock.calls[0];
    expect(path).toBe("v3/serp/google/organic/task_post");
    expect(task).toMatchObject({
      keyword: "plumber toronto",
      location_code: 2124, // Canada, matching keywords/overview
      language_code: "en",
      device: "desktop",
      priority: 1, // standard queue — NOT the 2x-priced high queue
      depth: 100,
    });

    // The billed cost and DataForSEO task id are persisted for the worker.
    expect(serpCheck.create.mock.calls[0][0].data).toMatchObject({
      dataforseoTaskId: "task_1",
      costUsd: 0.0006,
      status: "queued",
    });
  });
});

// ─── Quota ──────────────────────────────────────────────────────────────────

describe("monthly per-plan quota", () => {
  it("429s with an upgrade message once the plan's limit is used up", async () => {
    const limit = SERP_CHECKS_PER_MONTH.STARTER;
    redisStore.set(serpQuotaKey(TENANT), limit);

    const res = await POST(postRequest({ keyword: "pizza" }));
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.code).toBe("QUOTA_EXCEEDED");
    expect(body.limit).toBe(limit);
    expect(body.upgradeHref).toBe("/billing");
    expect(body.error).toMatch(/upgrade/i);

    // Nothing was posted, and the rejected reservation was rolled back.
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
    expect(redisStore.get(serpQuotaKey(TENANT))).toBe(limit);
  });

  it("counts each accepted check against the month key", async () => {
    await POST(postRequest({ keyword: "one" }));
    await POST(postRequest({ keyword: "two" }));
    expect(redisStore.get(serpQuotaKey(TENANT))).toBe(2);
    expect(redis.expire).toHaveBeenCalled();
  });

  it("gives the reservation back when the upstream post fails", async () => {
    seoMeteredCallResult.mockRejectedValue(
      Object.assign(new Error("boom"), { name: "DataforseoError" }),
    );
    await POST(postRequest({ keyword: "pizza" }));
    expect(redisStore.get(serpQuotaKey(TENANT))).toBe(0);
    expect(serpCheck.create).not.toHaveBeenCalled();
  });

  it("applies the plan's own limit, not STARTER's", async () => {
    requirePaidPlan.mockResolvedValue(membership("GROWTH"));
    redisStore.set(serpQuotaKey(TENANT), SERP_CHECKS_PER_MONTH.STARTER);

    // Well past STARTER's 25, still inside GROWTH's 200.
    expect((await POST(postRequest({ keyword: "pizza" }))).status).toBe(202);
  });

  it("503s rather than spending when Redis is unreachable", async () => {
    redis.incr.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const res = await POST(postRequest({ keyword: "pizza" }));
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ code: "QUOTA_UNAVAILABLE" });
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
  });
});

// ─── Validation + history ───────────────────────────────────────────────────

describe("validation and history", () => {
  it("400s an empty keyword before any spend", async () => {
    const res = await POST(postRequest({ keyword: "   " }));
    expect(res.status).toBe(400);
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
  });

  it("400s an unknown device", async () => {
    const res = await POST(postRequest({ keyword: "pizza", device: "tablet" }));
    expect(res.status).toBe(400);
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
  });

  it("history is tenant-scoped, drops result payloads, and totals spend", async () => {
    serpCheck.findMany.mockResolvedValue([row({ status: "completed", itemCount: 100, results: { items: [] } })]);
    serpCheck.aggregate.mockResolvedValue({ _sum: { costUsd: 0.0018 } });

    const body = await (await GET_LIST()).json();

    expect(serpCheck.findMany.mock.calls[0][0].where).toEqual({ tenantId: TENANT });
    expect(body.checks[0].results).toBeNull();
    expect(body.checks[0].itemCount).toBe(100);
    expect(body.totalCostUsd).toBe(0.0018);
    expect(body.usage.limit).toBe(SERP_CHECKS_PER_MONTH.STARTER);
  });
});
