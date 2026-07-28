// Rank Tracker route handlers + scheduler: the paths that cost money, leak
// data, or hand a tenant something its plan does not include.
//
// Prisma, the session guard, the metered client and Redis are stubbed;
// everything else (zod, plan gating, cap arithmetic, quota reservation, DTO
// shaping, error mapping, scheduler selection) is the real code path. No live
// call is ever made from this suite.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaidPlanRequiredError } from "@/lib/paid-plan";
import type { PlanType } from "@/generated/prisma";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const requirePaidPlan = vi.fn();
vi.mock("@/lib/paid-plan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paid-plan")>()),
  requirePaidPlan: () => requirePaidPlan(),
}));

const rankProject = {
  findFirst: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deleteMany: vi.fn(),
};
const rankKeyword = { count: vi.fn() };
const rankSnapshot = { create: vi.fn() };
const tenant = { findUnique: vi.fn() };
vi.mock("@/lib/prisma", () => ({
  prisma: { rankProject, rankKeyword, rankSnapshot, tenant },
}));

const seoMeteredCallResult = vi.fn();
vi.mock("@/lib/dataforseo/metering", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/dataforseo/metering")>()),
  seoMeteredCallResult: (...args: unknown[]) => seoMeteredCallResult(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({ success: true, remaining: 2 })),
}));

const addJob = vi.fn(async (..._args: unknown[]) => ({ id: "job_1" }));
vi.mock("@/infrastructure/queue/registry", () => ({
  addJob: (...args: unknown[]) => addJob(...args),
}));

/** Minimal in-memory stand-in for the ioredis singleton the quota uses. */
const redisStore = new Map<string, number>();
const redis = {
  incrby: vi.fn(async (key: string, by: number) => {
    const next = (redisStore.get(key) ?? 0) + by;
    redisStore.set(key, next);
    return next;
  }),
  decrby: vi.fn(async (key: string, by: number) => {
    const next = (redisStore.get(key) ?? 0) - by;
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
  getSubscriberConnection: () => redis,
}));

// Imported after the mocks so the modules pick them up.
const { GET: LIST, POST: CREATE } = await import(
  "@/app/api/seo/v1/rank-tracker/projects/route"
);
const { GET: DETAIL, DELETE: REMOVE } = await import(
  "@/app/api/seo/v1/rank-tracker/projects/[id]/route"
);
const { POST: RUN } = await import(
  "@/app/api/seo/v1/rank-tracker/projects/[id]/run/route"
);
const { runProject } = await import("@/lib/rank-tracker/service");
const { processSchedule } = await import(
  "@/infrastructure/queue/workers/rank-tracker.worker"
);
const { RANK_TRACKED_KEYWORDS, RANK_CHECKS_PER_MONTH } = await import(
  "@/lib/rank-tracker/options"
);
const { rankQuotaKey } = await import("@/lib/rank-tracker/quota");

// ─── Helpers ────────────────────────────────────────────────────────────────

const TENANT = "tenant_a";

function membership(planType: PlanType = "GROWTH", tenantId = TENANT) {
  return { tenantId, tenant: { planType } };
}

function jsonRequest(body: unknown, method = "POST"): Request {
  return new Request("http://localhost/api/seo/v1/rank-tracker/projects", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  name: "Main site",
  domain: "example.com",
  keywords: ["plumber toronto", "drain cleaning"],
  frequency: "weekly" as const,
};

function projectRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "proj_1",
    tenantId: TENANT,
    name: "Main site",
    domain: "example.com",
    locationCode: 2124,
    languageCode: "en",
    device: "desktop",
    frequency: "weekly",
    active: true,
    overCap: false,
    lastRunAt: null,
    createdAt: new Date("2026-07-28T12:00:00Z"),
    updatedAt: new Date("2026-07-28T12:00:00Z"),
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
  rankKeyword.count.mockResolvedValue(0);
  rankProject.findMany.mockResolvedValue([]);
  rankProject.findFirst.mockResolvedValue(null);
  rankProject.findUnique.mockResolvedValue(null);
  rankProject.deleteMany.mockResolvedValue({ count: 1 });
  rankProject.update.mockImplementation(async () => projectRow());
  rankProject.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    ...projectRow(data),
    _count: { keywords: (data.keywords as { create: unknown[] })?.create?.length ?? 0 },
  }));
  rankSnapshot.create.mockResolvedValue({ id: "snap_1" });
  tenant.findUnique.mockResolvedValue({ planType: "GROWTH" });
  seoMeteredCallResult.mockResolvedValue(OK_POST);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── Auth ───────────────────────────────────────────────────────────────────

describe("auth is required", () => {
  it("list returns 401 without a session", async () => {
    requirePaidPlan.mockRejectedValue(new Error("Not authenticated or no tenant access"));
    expect((await LIST()).status).toBe(401);
  });

  it("create returns 403 without an active subscription", async () => {
    requirePaidPlan.mockRejectedValue(new PaidPlanRequiredError("TRIALING"));
    const res = await CREATE(jsonRequest(VALID_BODY));
    expect(res.status).toBe(403);
    expect(rankProject.create).not.toHaveBeenCalled();
  });

  it("detail returns 401 without a session", async () => {
    requirePaidPlan.mockRejectedValue(new Error("Not authenticated or no tenant access"));
    const res = await DETAIL(new Request("http://localhost"), {
      params: Promise.resolve({ id: "proj_1" }),
    });
    expect(res.status).toBe(401);
    expect(rankProject.findFirst).not.toHaveBeenCalled();
  });
});

// ─── Plan gating ────────────────────────────────────────────────────────────

describe("plan gating", () => {
  it.each(["STARTER", "AI_VISIBILITY"] as const)(
    "%s cannot create a project — the tool is not in the plan",
    async (plan) => {
      requirePaidPlan.mockResolvedValue(membership(plan));
      const res = await CREATE(jsonRequest(VALID_BODY));
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.code).toBe("PLAN_LOCKED");
      expect(body.upgradeHref).toBe("/billing");
      expect(rankProject.create).not.toHaveBeenCalled();
    },
  );

  it("GROWTH cannot schedule daily checks", async () => {
    requirePaidPlan.mockResolvedValue(membership("GROWTH"));
    const res = await CREATE(jsonRequest({ ...VALID_BODY, frequency: "daily" }));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.code).toBe("FREQUENCY_NOT_ALLOWED");
    expect(rankProject.create).not.toHaveBeenCalled();
  });

  it("AGENCY may schedule daily checks", async () => {
    requirePaidPlan.mockResolvedValue(membership("AGENCY"));
    const res = await CREATE(jsonRequest({ ...VALID_BODY, frequency: "daily" }));
    expect(res.status).toBe(201);
    expect(rankProject.create).toHaveBeenCalled();
  });

  it("reports the plan's own limits in the usage block", async () => {
    requirePaidPlan.mockResolvedValue(membership("AGENCY"));
    rankKeyword.count.mockResolvedValue(12);
    const body = await (await LIST()).json();

    expect(body.usage.trackedKeywords).toBe(12);
    expect(body.usage.trackedKeywordLimit).toBe(RANK_TRACKED_KEYWORDS.AGENCY);
    expect(body.usage.checksLimit).toBe(RANK_CHECKS_PER_MONTH.AGENCY);
    expect(body.usage.canTrack).toBe(true);
    expect(body.usage.allowedFrequencies).toEqual(["daily", "weekly"]);
  });

  it("tells STARTER it cannot track, so the UI shows the locked card", async () => {
    requirePaidPlan.mockResolvedValue(membership("STARTER"));
    const body = await (await LIST()).json();
    expect(body.usage.canTrack).toBe(false);
    expect(body.usage.trackedKeywordLimit).toBe(0);
    expect(body.usage.allowedFrequencies).toEqual([]);
  });
});

// ─── Tracked-keyword cap ────────────────────────────────────────────────────

describe("tracked-keyword cap at create", () => {
  it("rejects a list that would exceed the plan's total", async () => {
    requirePaidPlan.mockResolvedValue(membership("GROWTH"));
    // 49 already tracked elsewhere + 2 incoming = 51 > GROWTH's 50.
    rankKeyword.count.mockResolvedValue(49);

    const res = await CREATE(jsonRequest(VALID_BODY));
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.code).toBe("KEYWORD_CAP_EXCEEDED");
    expect(body.limit).toBe(RANK_TRACKED_KEYWORDS.GROWTH);
    expect(body.requested).toBe(51);
    expect(rankProject.create).not.toHaveBeenCalled();
  });

  it("accepts a list that exactly fills the cap", async () => {
    requirePaidPlan.mockResolvedValue(membership("GROWTH"));
    rankKeyword.count.mockResolvedValue(48);
    expect((await CREATE(jsonRequest(VALID_BODY))).status).toBe(201);
  });

  it("counts across ALL of the tenant's projects, not just this one", async () => {
    requirePaidPlan.mockResolvedValue(membership("GROWTH"));
    await CREATE(jsonRequest(VALID_BODY));
    // The count query is scoped to the tenant through the project relation.
    expect(rankKeyword.count.mock.calls[0][0].where.project).toMatchObject({
      tenantId: TENANT,
    });
  });
});

// ─── Tenant isolation ───────────────────────────────────────────────────────

describe("tenant isolation", () => {
  it("detail filters on the caller's tenantId, not just the project id", async () => {
    rankProject.findFirst.mockResolvedValue({ ...projectRow(), keywords: [] });
    await DETAIL(new Request("http://localhost"), {
      params: Promise.resolve({ id: "proj_1" }),
    });
    expect(rankProject.findFirst.mock.calls[0][0].where).toMatchObject({
      id: "proj_1",
      tenantId: TENANT,
    });
  });

  it("404s another workspace's project rather than leaking it", async () => {
    requirePaidPlan.mockResolvedValue(membership("GROWTH", "tenant_b"));
    rankProject.findFirst.mockResolvedValue(null);

    const res = await DETAIL(new Request("http://localhost"), {
      params: Promise.resolve({ id: "proj_1" }),
    });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({ code: "NOT_FOUND" });
    expect(rankProject.findFirst.mock.calls[0][0].where.tenantId).toBe("tenant_b");
  });

  it("delete is tenant-scoped and 404s when it matches nothing", async () => {
    rankProject.deleteMany.mockResolvedValue({ count: 0 });
    const res = await REMOVE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "proj_1" }),
    });
    expect(res.status).toBe(404);
    expect(rankProject.deleteMany.mock.calls[0][0].where).toEqual({
      id: "proj_1",
      tenantId: TENANT,
    });
  });

  it("list only ever queries this tenant's projects", async () => {
    await LIST();
    expect(rankProject.findMany.mock.calls[0][0].where).toEqual({ tenantId: TENANT });
  });

  it("run refuses a project id belonging to another workspace", async () => {
    rankProject.findFirst.mockResolvedValue(null);
    const res = await RUN(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: "someone_elses" }),
    });
    expect(res.status).toBe(404);
    expect(addJob).not.toHaveBeenCalled();
  });
});

// ─── Run now ────────────────────────────────────────────────────────────────

describe("run now", () => {
  it("enqueues rather than posting inline, and reports what will run", async () => {
    rankProject.findFirst.mockResolvedValue({ id: "proj_1", _count: { keywords: 12 } });

    const res = await RUN(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: "proj_1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(202);
    expect(body).toMatchObject({ queued: true, keywords: 12 });
    expect(addJob).toHaveBeenCalledWith("rank-tracker", "run-now", { projectId: "proj_1" });
    // 250 task_posts have no business in a request handler.
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
  });

  it("400s a project with no keywords instead of queueing a no-op", async () => {
    rankProject.findFirst.mockResolvedValue({ id: "proj_1", _count: { keywords: 0 } });
    const res = await RUN(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: "proj_1" }),
    });
    expect(res.status).toBe(400);
    expect(addJob).not.toHaveBeenCalled();
  });

  it("429s fast when the month's checks would be exceeded", async () => {
    requirePaidPlan.mockResolvedValue(membership("GROWTH"));
    rankProject.findFirst.mockResolvedValue({ id: "proj_1", _count: { keywords: 10 } });
    redisStore.set(rankQuotaKey(TENANT), RANK_CHECKS_PER_MONTH.GROWTH - 5);

    const res = await RUN(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: "proj_1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.code).toBe("QUOTA_EXCEEDED");
    expect(addJob).not.toHaveBeenCalled();
  });

  it("429s a project left over the keyword cap by a downgrade", async () => {
    requirePaidPlan.mockResolvedValue(membership("GROWTH"));
    // 80 keywords on a plan that now allows 50.
    rankProject.findFirst.mockResolvedValue({ id: "proj_1", _count: { keywords: 80 } });

    const res = await RUN(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: "proj_1" }),
    });

    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toMatchObject({ code: "KEYWORD_CAP_EXCEEDED" });
    expect(addJob).not.toHaveBeenCalled();
  });
});

// ─── runProject: spend path ─────────────────────────────────────────────────

function projectWithKeywords(count: number, overrides: Record<string, unknown> = {}) {
  return {
    ...projectRow(overrides),
    keywords: Array.from({ length: count }, (_, i) => ({
      id: `kw_${i}`,
      keyword: `keyword ${i}`,
    })),
  };
}

describe("runProject", () => {
  it("posts one standard-queue task per keyword and writes a queued snapshot", async () => {
    rankProject.findUnique.mockResolvedValue(projectWithKeywords(3));

    const result = await runProject("proj_1");

    expect(result.posted).toBe(3);
    expect(seoMeteredCallResult).toHaveBeenCalledTimes(3);
    const [, path, task] = seoMeteredCallResult.mock.calls[0];
    expect(path).toBe("v3/serp/google/organic/task_post");
    expect(task).toMatchObject({ priority: 1, depth: 100, device: "desktop" });

    expect(rankSnapshot.create).toHaveBeenCalledTimes(3);
    expect(rankSnapshot.create.mock.calls[0][0].data).toMatchObject({
      status: "queued",
      dataforseoTaskId: "task_1",
      costUsd: 0.0006,
    });
    expect(result.costUsd).toBeCloseTo(3 * 0.0006, 8);
  });

  it("counts every keyword against the month's Redis allowance", async () => {
    rankProject.findUnique.mockResolvedValue(projectWithKeywords(4));
    await runProject("proj_1");
    expect(redisStore.get(rankQuotaKey(TENANT))).toBe(4);
  });

  it("refuses the whole run when it would breach the monthly allowance", async () => {
    rankProject.findUnique.mockResolvedValue(projectWithKeywords(10));
    redisStore.set(rankQuotaKey(TENANT), RANK_CHECKS_PER_MONTH.GROWTH - 5);

    await expect(runProject("proj_1")).rejects.toThrow(/limit reached/i);

    // All-or-nothing: a half-run project shows a misleading history gap.
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
    expect(rankSnapshot.create).not.toHaveBeenCalled();
    expect(redisStore.get(rankQuotaKey(TENANT))).toBe(RANK_CHECKS_PER_MONTH.GROWTH - 5);
  });

  it("hands back the reservation for keywords that failed to post", async () => {
    rankProject.findUnique.mockResolvedValue(projectWithKeywords(3));
    seoMeteredCallResult
      .mockResolvedValueOnce(OK_POST)
      .mockRejectedValueOnce(new Error("upstream 502"))
      .mockResolvedValueOnce(OK_POST);

    const result = await runProject("proj_1");

    expect(result.posted).toBe(2);
    expect(result.failed).toBe(1);
    // 3 reserved, 1 given back.
    expect(redisStore.get(rankQuotaKey(TENANT))).toBe(2);
  });

  it("skips and flags a project whose plan no longer includes the tool", async () => {
    rankProject.findUnique.mockResolvedValue(projectWithKeywords(3));
    tenant.findUnique.mockResolvedValue({ planType: "STARTER" });

    const result = await runProject("proj_1");

    expect(result.posted).toBe(0);
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
    expect(rankProject.update.mock.calls[0][0].data).toMatchObject({ overCap: true });
  });

  it("skips and flags a project holding more keywords than the plan allows", async () => {
    // 60 keywords, GROWTH allows 50 — the post-downgrade case.
    rankProject.findUnique.mockResolvedValue(projectWithKeywords(60));

    const result = await runProject("proj_1");

    expect(result.posted).toBe(0);
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
    expect(rankProject.update.mock.calls[0][0].data).toMatchObject({ overCap: true });
    // Nothing was reserved either.
    expect(redisStore.get(rankQuotaKey(TENANT))).toBeUndefined();
  });
});

// ─── Scheduler ──────────────────────────────────────────────────────────────

describe("scheduler tick", () => {
  /** 2026-07-28 is a Tuesday (UTC). */
  const TUESDAY = new Date("2026-07-28T06:00:00Z");

  it("runs only the projects due today and leaves the rest alone", async () => {
    rankProject.findMany.mockResolvedValue([
      { id: "daily", frequency: "daily", active: true, createdAt: TUESDAY, lastRunAt: null },
      // Weekly, anchored to Wednesday -> not due on a Tuesday.
      {
        id: "weekly_wed",
        frequency: "weekly",
        active: true,
        createdAt: new Date("2026-07-29T06:00:00Z"),
        lastRunAt: null,
      },
    ]);
    rankProject.findUnique.mockResolvedValue(projectWithKeywords(2));

    await processSchedule(TUESDAY);

    // Only the daily project was fetched for running.
    expect(rankProject.findUnique).toHaveBeenCalledTimes(1);
    expect(rankProject.findUnique.mock.calls[0][0].where).toEqual({ id: "daily" });
    expect(rankProject.findMany.mock.calls[0][0].where).toEqual({ active: true });
  });

  it("keeps going when one project throws", async () => {
    rankProject.findMany.mockResolvedValue([
      { id: "a", frequency: "daily", active: true, createdAt: TUESDAY, lastRunAt: null },
      { id: "b", frequency: "daily", active: true, createdAt: TUESDAY, lastRunAt: null },
    ]);
    rankProject.findUnique
      .mockRejectedValueOnce(new Error("db blip"))
      .mockResolvedValueOnce(projectWithKeywords(1));

    await processSchedule(TUESDAY);

    // The second project still ran.
    expect(seoMeteredCallResult).toHaveBeenCalledTimes(1);
  });

  it("skips over-cap projects without spending, after a downgrade", async () => {
    rankProject.findMany.mockResolvedValue([
      { id: "big", frequency: "daily", active: true, createdAt: TUESDAY, lastRunAt: null },
    ]);
    // 200 keywords, but the tenant is now on GROWTH (50).
    rankProject.findUnique.mockResolvedValue(projectWithKeywords(200));

    await processSchedule(TUESDAY);

    expect(seoMeteredCallResult).not.toHaveBeenCalled();
    expect(rankProject.update.mock.calls[0][0].data).toMatchObject({ overCap: true });
  });
});
