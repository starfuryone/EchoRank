// Crawl retention (Phase 4a): which crawls lose their full data, the nightly
// schedule's numeric prune, and pinning.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const requirePaidPlan = vi.fn();
vi.mock("@/lib/paid-plan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paid-plan")>()),
  requirePaidPlan: () => requirePaidPlan(),
}));
const crawlJob = { findFirst: vi.fn(), count: vi.fn(), update: vi.fn() };
vi.mock("@/lib/prisma", () => ({ prisma: { crawlJob } }));
vi.mock("@/infrastructure/queue/registry", () => ({ getQueue: vi.fn(), addJob: vi.fn() }));

const { crawlsToPurge } = await import("@/lib/site-crawler/retention");
const { scheduleRetention, RETENTION_INTERVAL_MS } = await import("@/infrastructure/queue/workers/site-crawl.worker");
const { PATCH } = await import("@/app/api/seo/v1/crawl/[id]/route");
const { PLAN_CONFIGS } = await import("@/lib/plan-config");

const NOW = new Date("2026-11-04T03:00:00Z");
const day = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const c = (id: string, status: string, ageDays: number, pinned = false) => ({
  id,
  status,
  pinned,
  createdAt: day(ageDays),
  finishedAt: day(ageDays),
});

describe("crawlsToPurge", () => {
  it("keeps the N most recent completed crawls and every pinned one", () => {
    const crawls = [c("c1", "COMPLETED", 1), c("c2", "COMPLETED", 2), c("c3", "COMPLETED", 3), c("c4", "COMPLETED", 4), c("c5", "COMPLETED", 5, true)];
    expect(crawlsToPurge(crawls, 3, NOW)).toEqual(["c4"]);
  });

  it.each([
    ["failed 2 days ago", c("f", "FAILED", 2), []],
    ["failed 8 days ago", c("f", "FAILED", 8), ["f"]],
    ["cancelled 30 days ago", c("x", "CANCELLED", 30), ["x"]],
    ["still running", c("r", "RUNNING", 30), []],
  ])("%s", (_n, crawl, expected) => {
    expect(crawlsToPurge([crawl], 3, NOW)).toEqual(expected);
  });

  it("reads the cap from plan-config: 3 / 10 / 50", () => {
    expect([PLAN_CONFIGS.STARTER.crawlsKept, PLAN_CONFIGS.GROWTH.crawlsKept, PLAN_CONFIGS.AGENCY.crawlsKept]).toEqual([3, 10, 50]);
  });
});

describe("nightly schedule", () => {
  it("keeps the current schedule (every comes back as a string) and prunes any other", async () => {
    const queue = {
      getRepeatableJobs: vi.fn(async () => [
        { name: "retention", every: String(RETENTION_INTERVAL_MS), key: "keep" },
        { name: "retention", every: "3600000", key: "stale" },
      ]),
      removeRepeatableByKey: vi.fn(async () => true),
      add: vi.fn(async () => ({})),
    };
    await scheduleRetention(queue as never);
    expect(queue.removeRepeatableByKey.mock.calls).toEqual([["stale"]]);
    expect(queue.add).toHaveBeenCalledWith("retention", { retention: true }, expect.objectContaining({ repeat: { every: RETENTION_INTERVAL_MS } }));
  });
});

describe("PATCH /crawl/[id] {pinned}", () => {
  const patch = (body: unknown) =>
    PATCH(new Request("https://app.test/api/seo/v1/crawl/c1", { method: "PATCH", body: JSON.stringify(body) }), {
      params: Promise.resolve({ id: "c1" }),
    });
  const row = { id: "c1", tenantId: "t1", rootUrl: "https://x.com/", status: "COMPLETED", urlCap: 1, pagesCrawled: 1, issueCount: 0, stoppedReason: null, startedAt: null, finishedAt: null, createdAt: NOW };

  beforeEach(() => {
    vi.clearAllMocks();
    requirePaidPlan.mockResolvedValue({ tenantId: "t1", tenant: { planType: "GROWTH" } });
    crawlJob.findFirst.mockResolvedValue({ id: "c1", pinned: false, dataPurgedAt: null });
    crawlJob.count.mockResolvedValue(0);
    crawlJob.update.mockImplementation(async (a: { data: { pinned: boolean } }) => ({ ...row, pinned: a.data.pinned }));
  });

  it("pins the caller's own crawl", async () => {
    const res = await patch({ pinned: true });
    expect(await res.json()).toMatchObject({ id: "c1", pinned: true });
    expect(crawlJob.findFirst.mock.calls[0]![0].where).toEqual({ id: "c1", tenantId: "t1" });
  });

  it("refuses a sixth pin, and a crawl already purged", async () => {
    crawlJob.count.mockResolvedValue(5);
    expect(await (await patch({ pinned: true })).json()).toMatchObject({ code: "PIN_LIMIT", limit: 5 });
    crawlJob.findFirst.mockResolvedValue({ id: "c1", pinned: false, dataPurgedAt: NOW });
    expect(await (await patch({ pinned: true })).json()).toMatchObject({ code: "PURGED" });
    expect(crawlJob.update).not.toHaveBeenCalled();
  });

  it("unpins without counting", async () => {
    crawlJob.findFirst.mockResolvedValue({ id: "c1", pinned: true, dataPurgedAt: null });
    crawlJob.count.mockResolvedValue(5);
    expect((await patch({ pinned: false })).status).toBe(200);
  });

  it("404s another workspace's crawl; 400s a bad body", async () => {
    crawlJob.findFirst.mockResolvedValue(null);
    expect((await patch({ pinned: true })).status).toBe(404);
    expect((await patch({ pinned: "yes" })).status).toBe(400);
  });
});
