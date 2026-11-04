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
const executeRaw = vi.fn(async () => 0);
const jobUpdate = vi.fn(async () => ({}));
const tenantUpdateMany = vi.fn(async ({ where }: { where: { slug: string } }) => ({ count: where.slug === "acme" ? 1 : 0 }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => tenants[where.id] ?? null),
      updateMany: (a: { where: { slug: string } }) => tenantUpdateMany(a),
    },
    crawlJob: {
      count: vi.fn(async ({ where }: { where: { tenantId?: string; status?: unknown } }) =>
        where.status === "RUNNING" && where.tenantId ? (running[where.tenantId] ?? 0) : 0,
      ),
      groupBy: vi.fn(async () => [{ tenantId: "t_kept" }]),
      findMany: vi.fn(async () =>
        Array.from({ length: 5 }, (_, i) => ({
          id: `c${i}`,
          status: "COMPLETED",
          pinned: false,
          finishedAt: new Date(),
          createdAt: new Date(Date.UTC(2026, 10, 1 + i)),
        })),
      ),
      update: (...a: unknown[]) => jobUpdate(...(a as [])),
      findUnique: vi.fn(async () => ({ config: null })),
    },
    crawlComparison: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    crawlSiteDefault: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    $executeRaw: (...a: unknown[]) => executeRaw(...(a as [])),
  },
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
const { __testing } = await import("@/infrastructure/queue/workers/site-crawl.worker");
const adminRoute = await import("@/app/api/admin/crawl-overrides/route");
const { DelayedError } = await import("bullmq");
const { planConfig } = await import("@/lib/plan-config");

beforeEach(() => {
  for (const k of Object.keys(tenants)) delete tenants[k];
  for (const k of Object.keys(running)) delete running[k];
  executeRaw.mockClear();
  jobUpdate.mockClear();
  runCrawl.mockClear();
  tenantUpdateMany.mockClear();
  platform.email = "staff@echorank360.com";
});

describe("box-wide crawl concurrency (CRAWL_MAX_CONCURRENT)", () => {
  it("defaults to 6, takes an integer within 1-16, ignores junk", () => {
    expect(caps.crawlMaxConcurrent(undefined)).toBe(6);
    expect(caps.crawlMaxConcurrent("")).toBe(6);
    expect(caps.crawlMaxConcurrent("lots")).toBe(6);
    expect(caps.crawlMaxConcurrent("2.5")).toBe(6);
    expect(caps.crawlMaxConcurrent("4")).toBe(4);
    expect(caps.crawlMaxConcurrent("0")).toBe(1);
    expect(caps.crawlMaxConcurrent("99")).toBe(16);
  });
});

describe("effective caps", () => {
  it("the plan's values unless an override is set", () => {
    const g = planConfig("GROWTH");
    expect(caps.effectiveCaps("GROWTH")).toEqual({ urlCap: g.crawlUrlCap, crawlsKept: g.crawlsKept, concurrency: 1 });
    expect(caps.effectiveCaps("GROWTH", { crawlConcurrencyOverride: 3, crawlsKeptOverride: 500, crawlUrlCapOverride: 5000 })).toEqual({
      urlCap: 5000,
      crawlsKept: 500,
      concurrency: 3,
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
});

describe("POST /api/admin/crawl-overrides (staff only)", () => {
  const form = (fields: Record<string, string>, headers: Record<string, string> = {}) =>
    adminRoute.POST(new Request("https://app.test/api/admin/crawl-overrides", { method: "POST", headers, body: new URLSearchParams(fields) }));

  it("sets the three overrides and redirects back; empty clears one", async () => {
    const res = await form({ slug: "acme", crawlConcurrencyOverride: "3", crawlsKeptOverride: "500", crawlUrlCapOverride: "" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://app.test/admin/crawl-overrides?slug=acme&saved=1");
    expect(tenantUpdateMany).toHaveBeenCalledWith({
      where: { slug: "acme" },
      data: { crawlConcurrencyOverride: 3, crawlsKeptOverride: 500, crawlUrlCapOverride: null },
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
