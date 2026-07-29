// Site Audit routes + poller — auth, tenant isolation, both caps, the cache,
// status transitions, and the guarantee that this poller and the standard-queue
// sweep never touch each other's rows.
//
// Prisma, the session guard, the metered client and Redis are stubbed;
// everything else (zod, domain normalization, cap arithmetic, cache window,
// parsing, status transitions, DTO shaping, error mapping) is the real code
// path. No live call is ever made.

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

const siteAudit = {
  findFirst: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
};
const serpCheck = { findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() };
const rankSnapshot = { findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() };
vi.mock("@/lib/prisma", () => ({ prisma: { siteAudit, serpCheck, rankSnapshot } }));

const seoMeteredCallResult = vi.fn();
vi.mock("@/lib/dataforseo/metering", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/dataforseo/metering")>()),
  seoMeteredCallResult: (...args: unknown[]) => seoMeteredCallResult(...args),
}));

/** The DataForSEO HTTP boundary, shared by both pollers. */
const getEndpoint = vi.fn<(...a: unknown[]) => Promise<unknown>>();
const postTask = vi.fn<(...a: unknown[]) => Promise<unknown>>();
vi.mock("@/lib/dataforseo/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/dataforseo/client")>()),
  getEndpoint: (...a: unknown[]) => getEndpoint(...a),
  postTask: (...a: unknown[]) => postTask(...a),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({ success: true, remaining: 2 })),
}));

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
const { POST: START } = await import("@/app/api/seo/v1/site-audit/start/route");
const { GET: GET_HISTORY } = await import("@/app/api/seo/v1/site-audit/history/route");
const { GET: GET_BY_ID } = await import("@/app/api/seo/v1/site-audit/[id]/route");
const { processSiteAuditSweep } = await import("@/lib/site-audit/poll");
const { AUDITS_PER_MONTH, CRAWL_PAGES_PER_PLAN } = await import("@/lib/site-audit/options");
const { siteAuditQuotaKey } = await import("@/lib/site-audit/quota");
const { sweepStandardQueue } = await import("@/lib/dataforseo/standard-queue");
const { serpCheckOwner } = await import("@/lib/serp/task-owner");
const { rankSnapshotOwner } = await import("@/lib/rank-tracker/task-owner");

// ─── Helpers ────────────────────────────────────────────────────────────────

const TENANT = "tenant_a";

function fixture(apiPath: string): unknown {
  const file = join(process.cwd(), "fixtures", "dataforseo", `${apiPath.replace(/\//g, "-")}.json`);
  return (JSON.parse(readFileSync(file, "utf8")) as { tasks: { result: unknown }[] }).tasks[0]
    .result;
}
/** Already the `result` ARRAY, not a single element — do not re-wrap. */
const SUMMARY_RESULT = fixture("v3/on_page/summary") as unknown[];
const PAGES_RESULT = fixture("v3/on_page/pages");

function membership(planType: PlanType = "GROWTH", tenantId = TENANT) {
  return { tenantId, tenant: { planType } };
}

function startRequest(body: unknown): Request {
  return new Request("http://localhost/api/seo/v1/site-audit/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "sa_1",
    tenantId: TENANT,
    domain: "example.com",
    maxPages: 100,
    dataforseoTaskId: "task_onpage_1",
    status: "queued",
    pagesCrawled: 0,
    summary: null,
    issues: null,
    pages: null,
    costUsd: 0.01125,
    error: null,
    createdAt: new Date("2026-07-29T12:00:00Z"),
    finishedAt: null,
    ...overrides,
  };
}

const OK_POST = {
  data: [],
  billing: { path: ["v3", "on_page", "task_post"], costUsd: 0.01125 },
  taskId: "task_onpage_1",
};

beforeEach(() => {
  redisStore.clear();
  requirePaidPlan.mockResolvedValue(membership());
  siteAudit.findFirst.mockResolvedValue(null);
  siteAudit.findMany.mockResolvedValue([]);
  siteAudit.findUnique.mockResolvedValue(null);
  siteAudit.updateMany.mockResolvedValue({ count: 0 });
  siteAudit.update.mockResolvedValue(row());
  siteAudit.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
    row({ ...data, id: "sa_new" }),
  );
  seoMeteredCallResult.mockResolvedValue(OK_POST);
  serpCheck.findMany.mockResolvedValue([]);
  serpCheck.updateMany.mockResolvedValue({ count: 0 });
  rankSnapshot.findMany.mockResolvedValue([]);
  rankSnapshot.updateMany.mockResolvedValue({ count: 0 });
  getEndpoint.mockResolvedValue({ data: SUMMARY_RESULT, billing: { path: [], costUsd: 0 } });
  postTask.mockResolvedValue({ data: PAGES_RESULT, billing: { path: [], costUsd: 0 } });
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── Auth ───────────────────────────────────────────────────────────────────

describe("auth is required", () => {
  it("start returns 401 without a session", async () => {
    requirePaidPlan.mockRejectedValue(new Error("Not authenticated or no tenant access"));
    const res = await START(startRequest({ domain: "example.com" }));
    expect(res.status).toBe(401);
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
  });

  it("start returns 403 without an active subscription", async () => {
    requirePaidPlan.mockRejectedValue(new PaidPlanRequiredError("TRIALING"));
    expect((await START(startRequest({ domain: "example.com" }))).status).toBe(403);
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
  });

  it("GET /[id] returns 401 without a session", async () => {
    requirePaidPlan.mockRejectedValue(new Error("Not authenticated or no tenant access"));
    const res = await GET_BY_ID(new Request("http://localhost"), {
      params: Promise.resolve({ id: "sa_1" }),
    });
    expect(res.status).toBe(401);
    expect(siteAudit.findFirst).not.toHaveBeenCalled();
  });

  it("GET history returns 401 without a session", async () => {
    requirePaidPlan.mockRejectedValue(new Error("Not authenticated or no tenant access"));
    expect((await GET_HISTORY()).status).toBe(401);
  });
});

// ─── Caps ───────────────────────────────────────────────────────────────────

describe("plan caps", () => {
  it.each([
    ["STARTER", 25],
    ["GROWTH", 100],
    ["AGENCY", 500],
  ] as const)("%s crawls at most %i pages", async (plan, pages) => {
    requirePaidPlan.mockResolvedValue(membership(plan));
    await START(startRequest({ domain: "example.com" }));
    const [, , task] = seoMeteredCallResult.mock.calls[0];
    // The page cap IS the cost, so it comes from the plan, never the request.
    expect(task.max_crawl_pages).toBe(pages);
    expect(siteAudit.create.mock.calls[0][0].data.maxPages).toBe(pages);
  });

  it("ignores any crawl size supplied by the client", async () => {
    requirePaidPlan.mockResolvedValue(membership("STARTER"));
    await START(startRequest({ domain: "example.com", maxPages: 5000 }));
    expect(seoMeteredCallResult.mock.calls[0][2].max_crawl_pages).toBe(
      CRAWL_PAGES_PER_PLAN.STARTER,
    );
  });

  it("429s once the month's audits are used up", async () => {
    const limit = AUDITS_PER_MONTH.GROWTH;
    redisStore.set(siteAuditQuotaKey(TENANT), limit);

    const res = await START(startRequest({ domain: "example.com" }));
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.code).toBe("QUOTA_EXCEEDED");
    expect(body.limit).toBe(limit);
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
    // The rejected reservation was rolled back.
    expect(redisStore.get(siteAuditQuotaKey(TENANT))).toBe(limit);
  });

  it("gives the reservation back when task_post fails", async () => {
    seoMeteredCallResult.mockRejectedValue(new Error("upstream 502"));
    await START(startRequest({ domain: "example.com" })).catch(() => undefined);
    expect(redisStore.get(siteAuditQuotaKey(TENANT))).toBe(0);
    expect(siteAudit.create).not.toHaveBeenCalled();
  });

  it("disables JavaScript rendering, which multiplies the per-page price", async () => {
    await START(startRequest({ domain: "example.com" }));
    const task = seoMeteredCallResult.mock.calls[0][2];
    expect(task.enable_javascript).toBe(false);
    expect(task.enable_browser_rendering).toBe(false);
  });
});

// ─── Domain + cache ─────────────────────────────────────────────────────────

describe("domain normalization and the 24 h cache", () => {
  it("normalizes before anything can cost money", async () => {
    await START(startRequest({ domain: "  HTTPS://WWW.Example.CO.UK/pricing  " }));
    expect(seoMeteredCallResult.mock.calls[0][2].target).toBe("example.co.uk");
    expect(siteAudit.findFirst.mock.calls[0][0].where.domain).toBe("example.co.uk");
  });

  it.each(["not a domain", "localhost", "192.168.0.1", "-bad.com"])(
    "400s %j without crawling",
    async (domain) => {
      expect((await START(startRequest({ domain }))).status).toBe(400);
      expect(seoMeteredCallResult).not.toHaveBeenCalled();
      expect(redis.incr).not.toHaveBeenCalled();
    },
  );

  it("replays a completed audit without crawling or spending quota", async () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    siteAudit.findFirst.mockResolvedValue(
      row({ status: "completed", createdAt: threeHoursAgo, pagesCrawled: 25 }),
    );

    const res = await START(startRequest({ domain: "example.com" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.cached).toBe(true);
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
    expect(redis.incr).not.toHaveBeenCalled();
    const hoursLeft = body.audit.reRunAvailableInMs / 3_600_000;
    expect(hoursLeft).toBeGreaterThan(20.9);
    expect(hoursLeft).toBeLessThanOrEqual(21);
  });

  it("joins an in-flight crawl instead of starting a second paid one", async () => {
    siteAudit.findFirst.mockResolvedValue(row({ status: "crawling", pagesCrawled: 12 }));
    const res = await START(startRequest({ domain: "example.com" }));
    const body = await res.json();
    expect(body.cached).toBe(true);
    expect(body.audit.status).toBe("crawling");
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
  });

  it("does NOT replay a failed audit — that would trap the tenant for 24 h", async () => {
    await START(startRequest({ domain: "example.com" }));
    expect(siteAudit.findFirst.mock.calls[0][0].where.status).toEqual({
      in: ["queued", "crawling", "completed"],
    });
  });

  it("returns 202 for a fresh crawl, since it is not done yet", async () => {
    const res = await START(startRequest({ domain: "example.com" }));
    expect(res.status).toBe(202);
    expect((await res.json()).audit.status).toBe("queued");
  });
});

// ─── Poller: status transitions ─────────────────────────────────────────────

describe("crawl poller", () => {
  it("publishes progress and stays crawling while the crawl runs", async () => {
    siteAudit.findMany.mockResolvedValue([
      { id: "sa_1", dataforseoTaskId: "task_onpage_1", costUsd: 0.01125 },
    ]);
    getEndpoint.mockResolvedValue({
      data: [{ crawl_progress: "in_progress", crawl_status: { pages_crawled: 6 } }],
      billing: { path: [], costUsd: 0 },
    });

    await processSiteAuditSweep();

    expect(siteAudit.update.mock.calls[0][0].data).toEqual({
      status: "crawling",
      pagesCrawled: 6,
    });
    // The page table is only fetched once the crawl is finished.
    expect(postTask).not.toHaveBeenCalled();
  });

  it("stores summary, issues and pages when the crawl finishes", async () => {
    siteAudit.findMany.mockResolvedValue([
      { id: "sa_1", dataforseoTaskId: "task_onpage_1", costUsd: 0.01125 },
    ]);

    await processSiteAuditSweep();

    const data = siteAudit.update.mock.calls[0][0].data;
    expect(data.status).toBe("completed");
    expect(data.pagesCrawled).toBe(25);
    expect(data.summary.onPageScore).toBeCloseTo(92.79, 2);
    expect(data.issues.totals.error).toBe(20);
    expect(data.pages.items.length).toBe(25);
    expect(data.finishedAt).toBeInstanceOf(Date);
  });

  it("keeps the summary when the page fetch fails", async () => {
    siteAudit.findMany.mockResolvedValue([
      { id: "sa_1", dataforseoTaskId: "task_onpage_1", costUsd: 0.01125 },
    ]);
    postTask.mockRejectedValue(new Error("pages unavailable"));

    await processSiteAuditSweep();

    const data = siteAudit.update.mock.calls[0][0].data;
    // Losing the page table is not worth discarding a paid crawl.
    expect(data.status).toBe("completed");
    expect(data.summary).toBeTruthy();
    expect(data.pages).toBeUndefined();
  });

  it("times out a crawl that never finishes", async () => {
    siteAudit.updateMany.mockResolvedValue({ count: 1 });
    await processSiteAuditSweep();
    const where = siteAudit.updateMany.mock.calls[0][0].where;
    expect(where.status).toEqual({ in: ["queued", "crawling"] });
    expect(siteAudit.updateMany.mock.calls[0][0].data.status).toBe("failed");
  });

  it("scrubs the vendor name out of a failure message", async () => {
    siteAudit.findMany.mockResolvedValue([
      { id: "sa_1", dataforseoTaskId: "task_onpage_1", costUsd: 0.01125 },
    ]);
    getEndpoint.mockRejectedValue(new Error("DataForSEO exploded"));

    await processSiteAuditSweep();

    const data = siteAudit.update.mock.calls[0][0].data;
    expect(data.status).toBe("failed");
    expect(data.error).not.toMatch(/dataforseo/i);
  });

  it("only ever looks at unfinished rows that have a task id", async () => {
    await processSiteAuditSweep();
    const where = siteAudit.findMany.mock.calls[0][0].where;
    expect(where.status).toEqual({ in: ["queued", "crawling"] });
    expect(where.dataforseoTaskId).toEqual({ not: null });
  });
});

// ─── Poller isolation ───────────────────────────────────────────────────────

describe("the two pollers never touch each other's rows", () => {
  it("the standard-queue sweep never reads SiteAudit", async () => {
    getEndpoint.mockResolvedValue({ data: [], billing: { path: [], costUsd: 0 } });

    await sweepStandardQueue([serpCheckOwner, rankSnapshotOwner], new Date());

    // SERP and rank-tracker own their own tables; SiteAudit is not among them.
    expect(siteAudit.findMany).not.toHaveBeenCalled();
    expect(siteAudit.updateMany).not.toHaveBeenCalled();
    expect(siteAudit.update).not.toHaveBeenCalled();
  });

  it("the site-audit sweep never reads SerpCheck or RankSnapshot", async () => {
    await processSiteAuditSweep();

    expect(serpCheck.findMany).not.toHaveBeenCalled();
    expect(rankSnapshot.findMany).not.toHaveBeenCalled();
    expect(serpCheck.update).not.toHaveBeenCalled();
    expect(rankSnapshot.update).not.toHaveBeenCalled();
  });

  it("the site-audit sweep never reads the SERP tasks_ready drain", async () => {
    // tasks_ready is consumed on read; a second reader would eat SERP's ids.
    // OnPage is not on that queue at all, so this poller must never call it.
    siteAudit.findMany.mockResolvedValue([
      { id: "sa_1", dataforseoTaskId: "task_onpage_1", costUsd: 0.01125 },
    ]);
    await processSiteAuditSweep();

    for (const call of getEndpoint.mock.calls) {
      expect(String(call[0])).not.toContain("tasks_ready");
      expect(String(call[0])).toContain("on_page/summary");
    }
  });
});

// ─── Tenant isolation ───────────────────────────────────────────────────────

describe("tenant isolation", () => {
  it("GET /[id] filters on the caller's tenantId", async () => {
    siteAudit.findFirst.mockResolvedValue(row());
    await GET_BY_ID(new Request("http://localhost"), { params: Promise.resolve({ id: "sa_1" }) });
    expect(siteAudit.findFirst).toHaveBeenCalledWith({
      where: { id: "sa_1", tenantId: TENANT },
    });
  });

  it("404s another workspace's audit id rather than leaking it", async () => {
    requirePaidPlan.mockResolvedValue(membership("GROWTH", "tenant_b"));
    siteAudit.findFirst.mockResolvedValue(null);

    const res = await GET_BY_ID(new Request("http://localhost"), {
      params: Promise.resolve({ id: "sa_1" }),
    });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({ code: "NOT_FOUND" });
    expect(siteAudit.findFirst.mock.calls[0][0].where.tenantId).toBe("tenant_b");
  });

  it("history is tenant-scoped and surfaces in-flight crawls", async () => {
    siteAudit.findMany.mockResolvedValue([
      {
        id: "sa_1",
        domain: "example.com",
        status: "crawling",
        summary: null,
        pagesCrawled: 12,
        maxPages: 100,
        costUsd: 0.01125,
        createdAt: new Date("2026-07-29T12:00:00Z"),
      },
    ]);

    const body = await (await GET_HISTORY()).json();

    expect(siteAudit.findMany.mock.calls[0][0].where).toEqual({ tenantId: TENANT });
    // A running crawl must appear — it is how a user who navigated away finds
    // their audit again.
    expect(body.audits[0]).toEqual({
      id: "sa_1",
      domain: "example.com",
      status: "crawling",
      onPageScore: null,
      pagesCrawled: 12,
      maxPages: 100,
      costUsd: 0.01125,
      createdAt: "2026-07-29T12:00:00.000Z",
    });
    expect(body.usage.limit).toBe(AUDITS_PER_MONTH.GROWTH);
    expect(body.usage.maxPages).toBe(CRAWL_PAGES_PER_PLAN.GROWTH);
  });

  it("serializes Decimal and Date fields for the wire", async () => {
    siteAudit.findFirst.mockResolvedValue(
      row({ status: "completed", finishedAt: new Date("2026-07-29T12:05:00Z") }),
    );
    const body = await (
      await GET_BY_ID(new Request("http://localhost"), { params: Promise.resolve({ id: "sa_1" }) })
    ).json();

    expect(body.costUsd).toBe(0.01125);
    expect(body.createdAt).toBe("2026-07-29T12:00:00.000Z");
    expect(body.finishedAt).toBe("2026-07-29T12:05:00.000Z");
  });
});
