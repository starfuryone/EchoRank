// tests/site-crawler-tenant-caps.test.ts — Phase 3d-A tenant overrides:
// crawlConcurrencyOverride, crawlsKeptOverride, crawlUrlCapOverride replace
// the plan's caps where they are read — getCrawlQuota (the URL cap startCrawl
// enforces, the crawls kept the UI shows), nightly retention, and the
// worker's fair share (a tenant at its simultaneous-crawl limit waits). Set
// only through the staff API, within bounds, same-origin.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const tenants: Record<string, Record<string, unknown>> = {};
const running: Record<string, number> = {};
const olderQueued: Record<string, number> = {};
const claimRow: { current: { status: string; createdAt: Date } | null } = { current: null };
const executeRaw = vi.fn(async () => 0);
const jobUpdate = vi.fn(async () => ({}));
const jobUpdateMany = vi.fn<(args: unknown) => Promise<{ count: number }>>(async () => ({ count: 1 }));
const tenantUpdateMany = vi.fn(async ({ where }: { where: { slug: string } }) => ({ count: where.slug === "acme" ? 1 : 0 }));
const prismaMock: Record<string, unknown> = {};
vi.mock("@/lib/prisma", () => ({
  prisma: Object.assign(prismaMock, {
    // claimCrawlSlot's transaction (advisory lock, count, flip): run it on the same fakes.
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prismaMock),
    tenant: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => tenants[where.id] ?? null),
      updateMany: (a: { where: { slug: string } }) => tenantUpdateMany(a),
    },
    crawlJob: {
      aggregate: vi.fn(async () => ({ _sum: { pagesCrawled: 0 } })),
      count: vi.fn(async ({ where }: { where: { tenantId?: string; status?: unknown } }) =>
        where.status === "RUNNING" && where.tenantId
          ? (running[where.tenantId] ?? 0)
          : where.status === "QUEUED" && where.tenantId
            ? (olderQueued[where.tenantId] ?? 0)
            : 0,
      ),
      groupBy: vi.fn(async () => [{ tenantId: "t_kept" }]),
      // The free crawler's purge (where.tenant) finds nothing here.
      findMany: vi.fn(async (a?: { where?: { tenant?: unknown } }) =>
        a?.where?.tenant ? [] : Array.from({ length: 5 }, (_, i) => ({
          id: `c${i}`,
          status: "COMPLETED",
          pinned: false,
          finishedAt: new Date(),
          createdAt: new Date(Date.UTC(2026, 10, 1 + i)),
        })),
      ),
      update: (...a: unknown[]) => jobUpdate(...(a as [])),
      updateMany: (a: unknown) => jobUpdateMany(a),
      findUnique: vi.fn(async () => ({ config: null })),
      // The claim reads the crawl first (QUEUED unless a test says otherwise).
      findFirst: vi.fn(async () => claimRow.current),
    },
    crawlComparison: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    crawlSiteDefault: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    $executeRaw: (...a: unknown[]) => executeRaw(...(a as [])),
  }),
}));
vi.mock("@/lib/site-crawler/backlink-cost", () => ({
  OBSERVED_BACKLINK_UNIT_USD: 0.02,
  backlinkUnitCostUsd: async () => 0.02,
  seoBudgetLeftUsd: async () => 1,
}));
vi.mock("@/lib/lighthouse/usage", () => ({ auditsUsedThisHour: async () => 0 }));

const platform = vi.hoisted(() => ({ email: "staff@echorank360.com" as string | null }));
vi.mock("@/lib/platform-admin", async () => {
  const { NextResponse } = await import("next/server");
  return { requirePlatformAdminApi: async () => (platform.email ? { email: platform.email } : NextResponse.json({ error: "forbidden" }, { status: 403 })) };
});

const runCrawl = vi.fn(async () => ({ status: "COMPLETED", pagesCrawled: 1, issueCount: 0, stoppedReason: null }));
vi.mock("@/lib/site-crawler/runner", () => ({ runCrawl: (...a: unknown[]) => runCrawl(...(a as [])) }));
vi.mock("@/infrastructure/queue/registry", () => ({ addJob: vi.fn(), getQueue: vi.fn() }));
vi.mock("@/infrastructure/redis/connection", () => ({ getSubscriberConnection: vi.fn(), createNewConnection: vi.fn(() => ({})) }));
vi.mock("@/lib/site-crawler/callback", () => ({ CALLBACK_JOB_NAME: "callback", deliverCrawlCallback: vi.fn(async () => "skipped") }));
vi.mock("@/lib/site-crawler/metrics-runner", () => ({ METRICS_JOB_NAME: "metrics", needsMetrics: () => false, runCrawlMetrics: vi.fn() }));

const caps = await import("@/lib/site-crawler/tenant-caps");
const { getCrawlQuota } = await import("@/lib/site-crawler/quota");
const { runCrawlRetention } = await import("@/lib/site-crawler/retention");
const { __testing, failOrphanedCrawl } = await import("@/infrastructure/queue/workers/site-crawl.worker");
const adminRoute = await import("@/app/api/admin/crawl-overrides/route");
const { DelayedError } = await import("bullmq");
const { planConfig } = await import("@/lib/plan-config");

beforeEach(() => {
  for (const k of Object.keys(tenants)) delete tenants[k];
  for (const k of Object.keys(running)) delete running[k];
  for (const k of Object.keys(olderQueued)) delete olderQueued[k];
  claimRow.current = { status: "QUEUED", createdAt: new Date() };
  executeRaw.mockClear();
  jobUpdate.mockClear();
  runCrawl.mockClear();
  tenantUpdateMany.mockClear();
  platform.email = "staff@echorank360.com";
});

describe("this process's crawl concurrency", () => {
  it("is capacity.ts's per-process figure (CRAWL_MAX_CONCURRENT while crawls run in the workers, default 6)", () => {
    const saved = { ...process.env };
    delete process.env.CRAWL_PROCESSES;
    delete process.env.CRAWL_MAX_CONCURRENT;
    expect(caps.crawlMaxConcurrent()).toBe(6);
    process.env.CRAWL_PROCESSES = "4";
    expect(caps.crawlMaxConcurrent()).toBe(12);
    process.env = saved;
  });
});

describe("effective caps", () => {
  it("the plan's values unless an override is set", () => {
    const g = planConfig("GROWTH");
    expect(caps.effectiveCaps("GROWTH")).toEqual({ urlCap: g.crawlUrlCap, crawlsKept: g.crawlsKept, concurrency: 2, pagesPerMonth: g.crawlPagesPerMonth });
    expect(
      caps.effectiveCaps("GROWTH", { crawlConcurrencyOverride: 3, crawlsKeptOverride: 500, crawlUrlCapOverride: 5000, crawlPagesPerMonthOverride: 1_000_000 }),
    ).toEqual({
      urlCap: 5000,
      crawlsKept: 500,
      concurrency: 3,
      pagesPerMonth: 1_000_000,
    });
    expect(caps.effectiveCaps("STARTER", { ...caps.NO_OVERRIDES, crawlUrlCapOverride: 7000 }).urlCap).toBe(7000);
  });

  it.each([
    ["crawlConcurrencyOverride", "3", 3],
    ["crawlConcurrencyOverride", "", null],
    ["crawlsKeptOverride", "500", 500],
    ["crawlUrlCapOverride", "5,000", 5000],
    ["crawlUrlCapOverride", "100001", "bad"],
    ["crawlConcurrencyOverride", "0", "bad"],
    ["crawlsKeptOverride", "2.5", "bad"],
  ] as const)("parse %s %j → %j", (field, raw, expected) => {
    const r = caps.parseOverride(field, raw);
    expect(r.ok ? r.value : "bad").toBe(expected);
  });
});

describe("where the caps are read", () => {
  it("getCrawlQuota: the URL cap startCrawl enforces and the crawls kept come from the overrides", async () => {
    tenants.t1 = { crawlConcurrencyOverride: null, crawlsKeptOverride: 500, crawlUrlCapOverride: 5000 };
    const q = await getCrawlQuota("t1", "STARTER");
    expect([q.urlCap, q.crawlsKept, q.locked]).toEqual([5000, 500, false]);
    const plain = await getCrawlQuota("t2", "STARTER");
    expect([plain.urlCap, plain.crawlsKept]).toEqual([planConfig("STARTER").crawlUrlCap, planConfig("STARTER").crawlsKept]);
  });

  it("retention keeps the override's number of completed crawls", async () => {
    tenants.t_kept = { planType: "AGENCY", crawlConcurrencyOverride: null, crawlsKeptOverride: 2, crawlUrlCapOverride: null };
    const r = await runCrawlRetention(new Date(Date.UTC(2026, 10, 10)));
    expect(r.crawlsPurged).toBe(3);
    const purged = jobUpdate.mock.calls.map((c) => (c as unknown as [{ where: { id: string } }])[0].where.id).sort();
    expect(purged).toEqual(["c0", "c1", "c2"]);
  });
});

describe("fair share in the worker", () => {
  const job = (tenantId: string) => ({ name: "crawl", id: "b1", data: { crawlJobId: "c9", tenantId }, moveToDelayed: vi.fn(async () => undefined) });

  it("a tenant already running a crawl waits (default 1): moved back, still queued, not run", async () => {
    running.t_a = 1;
    const j = job("t_a");
    await expect(__testing.processSiteCrawlJob(j as never, "tok")).rejects.toBeInstanceOf(DelayedError);
    expect(j.moveToDelayed).toHaveBeenCalledWith(expect.any(Number), "tok");
    const at = (j.moveToDelayed.mock.calls[0] as unknown as [number])[0];
    expect(at - Date.now()).toBeGreaterThan(caps.FAIR_SHARE_RETRY_MS - 1000);
    expect(runCrawl).not.toHaveBeenCalled();
  });

  it("another tenant, or one with a raised concurrency, runs", async () => {
    running.t_a = 1;
    await __testing.processSiteCrawlJob(job("t_b") as never, "tok");
    expect(runCrawl).toHaveBeenCalledTimes(1);
    tenants.t_partner = { crawlConcurrencyOverride: 3, crawlsKeptOverride: null, crawlUrlCapOverride: null };
    running.t_partner = 2;
    await __testing.processSiteCrawlJob(job("t_partner") as never, "tok");
    expect(runCrawl).toHaveBeenCalledTimes(2);
    running.t_partner = 3;
    await expect(__testing.processSiteCrawlJob(job("t_partner") as never, "tok")).rejects.toBeInstanceOf(DelayedError);
  });

  it("the limit is the plan's crawlConcurrency: Starter 1, Growth 2, Agency 3", async () => {
    for (const [plan, limit] of [["STARTER", 1], ["GROWTH", 2], ["AGENCY", 3]] as const) {
      expect(planConfig(plan).crawlConcurrency).toBe(limit);
      tenants[`t_${plan}`] = { planType: plan, crawlConcurrencyOverride: null };
      running[`t_${plan}`] = limit - 1;
      runCrawl.mockClear();
      await __testing.processSiteCrawlJob(job(`t_${plan}`) as never, "tok");
      expect(runCrawl, plan).toHaveBeenCalledTimes(1);
      running[`t_${plan}`] = limit;
      await expect(__testing.processSiteCrawlJob(job(`t_${plan}`) as never, "tok"), plan).rejects.toBeInstanceOf(DelayedError);
    }
    // The free crawler's system tenant runs one, whatever its plan or override says.
    expect(caps.tenantCrawlLimit({ source: "free", planType: "AGENCY", crawlConcurrencyOverride: 5 })).toBe(1);
  });

  it("the claim is atomic: under the tenant's advisory lock, and it flips the crawl to RUNNING", async () => {
    await __testing.processSiteCrawlJob(job("t_b") as never, "tok");
    const lock = (executeRaw.mock.calls[0] as unknown as [TemplateStringsArray, ...unknown[]]);
    expect(lock[0].join("?")).toContain("pg_advisory_xact_lock");
    expect(lock[1]).toBe("crawl-slot:t_b");
    expect(jobUpdate).toHaveBeenCalledWith({ where: { id: "c9" }, data: { status: "RUNNING", startedAt: expect.any(Date) } });
    expect(runCrawl).toHaveBeenCalledWith(expect.objectContaining({ jobId: "c9", resume: false }));
  });

  it("in order: the workspace's older queued crawls keep their slots first", async () => {
    tenants.t_agency = { planType: "AGENCY", crawlConcurrencyOverride: null };
    // Agency runs 3: two running and one older crawl still queued leave no room for this one.
    running.t_agency = 2;
    olderQueued.t_agency = 1;
    await expect(__testing.processSiteCrawlJob(job("t_agency") as never, "tok")).rejects.toBeInstanceOf(DelayedError);
    expect(runCrawl).not.toHaveBeenCalled();
    // One running and one older queued: room for both, so this one runs too.
    running.t_agency = 1;
    await __testing.processSiteCrawlJob(job("t_agency") as never, "tok");
    expect(runCrawl).toHaveBeenCalledTimes(1);
  });

  it("a crawl already RUNNING is a restart: resumed, not held back by its own slot", async () => {
    claimRow.current = { status: "RUNNING", createdAt: new Date() };
    running.t_a = 1;
    await __testing.processSiteCrawlJob(job("t_a") as never, "tok");
    expect(runCrawl).toHaveBeenCalledWith(expect.objectContaining({ jobId: "c9", resume: true }));
    expect(jobUpdate).not.toHaveBeenCalled();
  });

  it("a crawl cancelled while queued is skipped: not run, not re-queued", async () => {
    claimRow.current = { status: "CANCELLED", createdAt: new Date() };
    const j = job("t_a");
    await __testing.processSiteCrawlJob(j as never, "tok");
    expect(runCrawl).not.toHaveBeenCalled();
    expect(j.moveToDelayed).not.toHaveBeenCalled();
  });

  it("an INTERRUPTED crawl (shutdown) goes straight back to the queue", async () => {
    runCrawl.mockResolvedValueOnce({ status: "INTERRUPTED", pagesCrawled: 25, issueCount: 0, stoppedReason: null });
    const j = job("t_a");
    await expect(__testing.processSiteCrawlJob(j as never, "tok")).rejects.toBeInstanceOf(DelayedError);
    const at = (j.moveToDelayed.mock.calls[0] as unknown as [number])[0];
    expect(at - Date.now()).toBeLessThan(5_000);
  });
});

describe("POST /api/admin/crawl-overrides (staff only)", () => {
  const form = (fields: Record<string, string>, headers: Record<string, string> = {}) =>
    adminRoute.POST(new Request("https://app.test/api/admin/crawl-overrides", { method: "POST", headers, body: new URLSearchParams(fields) }));

  it("sets the four overrides and redirects back; empty clears one", async () => {
    const res = await form({
      slug: "acme",
      crawlConcurrencyOverride: "3",
      crawlsKeptOverride: "500",
      crawlUrlCapOverride: "",
      crawlPagesPerMonthOverride: "1,000,000",
    });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://app.test/admin/crawl-overrides?slug=acme&saved=1");
    expect(tenantUpdateMany).toHaveBeenCalledWith({
      where: { slug: "acme" },
      data: { crawlConcurrencyOverride: 3, crawlsKeptOverride: 500, crawlUrlCapOverride: null, crawlPagesPerMonthOverride: 1_000_000 },
    });
  });

  it("refuses non-staff, out-of-bounds values, unknown tenants and cross-site forms", async () => {
    platform.email = null;
    expect((await form({ slug: "acme", crawlConcurrencyOverride: "3" })).status).toBe(403);
    platform.email = "staff@echorank360.com";
    const bad = await form({ slug: "acme", crawlUrlCapOverride: "9999999" });
    expect([bad.status, (await bad.json()).field]).toEqual([400, "crawlUrlCapOverride"]);
    expect((await form({ slug: "nobody", crawlConcurrencyOverride: "2" })).status).toBe(404);
    expect((await form({ slug: "acme" }, { origin: "https://evil.example", host: "app.test" })).status).toBe(403);
    expect((await form({ crawlConcurrencyOverride: "2" })).status).toBe(400);
    expect(tenantUpdateMany).toHaveBeenCalledTimes(1);
  });
});

describe("a crawl job BullMQ gave up on never leaves its row RUNNING (failOrphanedCrawl)", () => {
  const failed = (name: string, data: object) => ({ name, data }) as never;

  it("a crawl job that failed for good fails its RUNNING row, with the reason", async () => {
    jobUpdateMany.mockClear();
    // The load test's case: the terminal write and then the worker's next query both timed out on the pool.
    await failOrphanedCrawl(failed("crawl", { crawlJobId: "c1", tenantId: "t" }), new Error("timeout exceeded when trying to connect"));
    expect(jobUpdateMany).toHaveBeenCalledWith({
      where: { id: "c1", status: "RUNNING" },
      data: { status: "FAILED", stoppedReason: "failed: timeout exceeded when trying to connect", finishedAt: expect.any(Date) },
    });
  });

  it("a stall says so", async () => {
    jobUpdateMany.mockClear();
    await failOrphanedCrawl(failed("crawl", { crawlJobId: "c1" }), new Error("job stalled more than allowable limit"));
    expect(jobUpdateMany.mock.calls[0]?.[0]).toMatchObject({ data: { stoppedReason: "stalled: the crawl's process stopped too many times" } });
  });

  it("a metrics or callback job failing leaves its crawl alone", async () => {
    jobUpdateMany.mockClear();
    await failOrphanedCrawl(failed("metrics", { crawlJobId: "c1", metrics: true }), new Error("x"));
    await failOrphanedCrawl(failed("callback", { crawlJobId: "c1", callback: true }), new Error("x"));
    await failOrphanedCrawl(undefined, new Error("x"));
    expect(jobUpdateMany).not.toHaveBeenCalled();
  });
});
