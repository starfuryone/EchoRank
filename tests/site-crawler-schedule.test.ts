// tests/site-crawler-schedule.test.ts — Phase 4c scheduled crawls: cadence
// maths, the repeatable sync on worker start, the tick (quota, re-checked
// sealed config, scheduleId on the job), the completion hook (compare with
// lastJobId, then exports), the email, and the routes' tenant scoping.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Job } from "bullmq";

vi.mock("server-only", () => ({}));
const flags = vi.hoisted(() => ({ on: new Set<string>(["crawl.schedule", "crawl.reports", "crawl.config", "crawl.segments", "crawl.extraction"]) }));
vi.mock("@/lib/flags", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/flags")>();
  return { ...real, flag: (n: string) => flags.on.has(n) };
});
const requirePaidPlan = vi.fn();
vi.mock("@/lib/paid-plan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paid-plan")>()),
  requirePaidPlan: () => requirePaidPlan(),
}));
const crawlJob = { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn() };
const crawlSchedule = { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() };
const crawlSiteDefault = { findUnique: vi.fn() };
const crawlSegment = { findMany: vi.fn(async () => []) };
const queryRaw = vi.fn<(...a: unknown[]) => Promise<unknown[]>>(async () => []);
vi.mock("@/lib/prisma", () => ({ prisma: { crawlJob, crawlSchedule, crawlSiteDefault, crawlSegment, $queryRaw: (...a: unknown[]) => queryRaw(...a) } }));
const rateLimit = vi.fn<(...a: unknown[]) => Promise<{ success: boolean }>>(async () => ({ success: true }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: (...a: unknown[]) => rateLimit(...a) }));
const addJob = vi.fn(async () => ({ id: "bull" }));
const queue = {
  getRepeatableJobs: vi.fn(async () => [] as unknown[]),
  removeRepeatableByKey: vi.fn<(key: string) => Promise<boolean>>(async () => true),
  add: vi.fn<(name: string, data: unknown, opts: { repeat: unknown }) => Promise<object>>(async () => ({})),
};
vi.mock("@/infrastructure/queue/registry", () => ({ addJob: (...a: unknown[]) => addJob(...(a as [])), getQueue: () => queue }));
vi.mock("@/infrastructure/redis/connection", () => ({ getRedisConnection: () => ({}) }));
const compare = vi.hoisted(() => ({ resolveCompare: vi.fn(), runComparison: vi.fn() }));
vi.mock("@/lib/site-crawler/compare", () => compare);

const s = await import("@/lib/site-crawler/schedule");
const svc = await import("@/lib/site-crawler/schedule-service");
const { scheduleEmail, SCHEDULE_EMAIL_COPY } = await import("@/lib/site-crawler/schedule-email");
const listRoute = await import("@/app/api/seo/v1/crawl/schedules/route");
const oneRoute = await import("@/app/api/seo/v1/crawl/schedules/[scheduleId]/route");
const runRoute = await import("@/app/api/seo/v1/crawl/schedules/[scheduleId]/run/route");

beforeEach(() => {
  vi.clearAllMocks();
  queue.getRepeatableJobs.mockResolvedValue([]);
  crawlJob.count.mockResolvedValue(0);
  crawlSiteDefault.findUnique.mockResolvedValue(null);
  requirePaidPlan.mockResolvedValue({ tenantId: "t1", tenant: { planType: "GROWTH", timezone: "Europe/Zurich" } });
  queryRaw.mockResolvedValue([]);
  rateLimit.mockResolvedValue({ success: true });
});

describe("cadence", () => {
  it.each([
    ["daily", 3, "0 3 * * *"],
    ["weekly", 0, "0 0 * * 1"],
    ["monthly", 23, "0 23 1 * *"],
  ] as const)("%s at %i → %s", (cadence, h, pattern) => {
    expect(s.cronPattern(cadence, h)).toBe(pattern);
  });

  // 2026-11-04 is a Wednesday.
  it.each([
    ["daily", 3, "2026-11-04T02:00:00Z", "2026-11-04T03:00:00.000Z"],
    ["daily", 3, "2026-11-04T03:00:00Z", "2026-11-05T03:00:00.000Z"],
    ["weekly", 3, "2026-11-04T10:00:00Z", "2026-11-09T03:00:00.000Z"],
    ["weekly", 3, "2026-11-09T02:59:00Z", "2026-11-09T03:00:00.000Z"],
    ["weekly", 3, "2026-11-09T03:00:00Z", "2026-11-16T03:00:00.000Z"],
    ["monthly", 3, "2026-11-04T10:00:00Z", "2026-12-01T03:00:00.000Z"],
    ["monthly", 3, "2026-12-15T10:00:00Z", "2027-01-01T03:00:00.000Z"],
  ] as const)("%s at %i after %s → %s", (cadence, h, now, want) => {
    expect(s.nextRunAt(cadence, h, new Date(now)).toISOString()).toBe(want);
  });

  it("the repeat key has no colon, and the repeat job id BullMQ derives from it validates", () => {
    expect(s.repeatKey("cl123")).toBe("crawl-schedule-cl123");
    const job = Object.create(Job.prototype) as Job & { validateOptions(d: unknown): void };
    Object.assign(job, { opts: { jobId: `repeat:${s.repeatKey("cl123")}:1762300800000` }, data: {}, queue: { opts: {} } });
    expect(() => job.validateOptions({})).not.toThrow();
  });

  it.each([
    ["STARTER", "monthly", 0, null],
    ["STARTER", "weekly", 0, "cadence_not_in_plan"],
    ["STARTER", "monthly", 1, "over_plan_cap"],
    ["GROWTH", "weekly", 1, null],
    ["GROWTH", "daily", 0, "cadence_not_in_plan"],
    ["AGENCY", "daily", 9, null],
    ["AGENCY", "daily", 10, "over_plan_cap"],
  ] as const)("%s %s with %i saved → %s", async (plan, cadence, existing, want) => {
    const { scheduleCapsForPlan } = await import("@/lib/site-crawler/quota");
    expect(s.scheduleProblem({ cadence }, scheduleCapsForPlan(plan), existing)).toBe(want);
  });
});

describe("repeatables on worker start", () => {
  const retention = { name: "retention", every: 86_400_000 };
  it("keeps retention (every as a string) and matching schedules, prunes the rest, adds the missing", async () => {
    queue.getRepeatableJobs.mockResolvedValue([
      { name: "retention", every: "86400000", key: "r", pattern: null },
      { name: "retention", every: "3600000", key: "r-stale", pattern: null },
      { name: "schedule", key: "crawl-schedule-a", pattern: "0 3 * * *" },
      { name: "schedule", key: "crawl-schedule-b", pattern: "0 9 * * *" },
      { name: "schedule", key: "crawl-schedule-gone", pattern: "0 3 * * *" },
    ]);
    const out = await svc.syncAllRepeatables(queue as never, retention, [
      { id: "a", cadence: "daily", hourUtc: 3, enabled: true },
      { id: "b", cadence: "daily", hourUtc: 4, enabled: true },
      { id: "c", cadence: "monthly", hourUtc: 0, enabled: true },
      { id: "d", cadence: "monthly", hourUtc: 0, enabled: false },
    ]);
    expect(queue.removeRepeatableByKey.mock.calls.map((c) => c[0])).toEqual(["r-stale", "crawl-schedule-b", "crawl-schedule-gone", "crawl-schedule-b"]);
    const added = queue.add.mock.calls.map((c) => [c[0], c[2].repeat]);
    expect(added).toEqual([
      ["retention", { every: 86_400_000 }],
      ["schedule", { pattern: "0 4 * * *", tz: "UTC", key: "crawl-schedule-b" }],
      ["schedule", { pattern: "0 0 1 * *", tz: "UTC", key: "crawl-schedule-c" }],
    ]);
    expect(out).toEqual({ removed: 3, added: 2 });
  });
});

describe("the tick", () => {
  const row = (over: Record<string, unknown> = {}) => ({
    id: "s1",
    tenantId: "t1",
    host: "x.com",
    cadence: "weekly",
    hourUtc: 3,
    enabled: true,
    lastJobId: null,
    exportTo: { email: true, sheets: null },
    config: { rootUrl: "https://x.com/", renderMode: "none", crawl: { maxUrls: 99999, maxDepth: 3, include: [], exclude: [], extractors: [], searches: [], headers: [], cookies: null, basicAuth: null, respectRobots: true, userAgent: "echorank" } },
    tenant: { planType: "GROWTH" },
    ...over,
  });

  it("starts a normal crawl with the sealed config re-checked (URL cap clamped) and scheduleId on the job", async () => {
    crawlSchedule.findUnique.mockResolvedValue(row());
    crawlJob.create.mockImplementation(async (a: { data: Record<string, unknown> }) => ({ id: "job1", createdAt: new Date(), ...a.data }));
    const out = await svc.runScheduledCrawl("s1", new Date("2026-11-04T10:00:00Z"));
    expect(out).toEqual({ status: "started", crawlJobId: "job1" });
    expect(crawlJob.create.mock.calls[0]![0].data).toMatchObject({ tenantId: "t1", rootUrl: "https://x.com/", urlCap: 5000, status: "QUEUED", scheduleId: "s1" });
    expect(addJob).toHaveBeenCalledWith("site-crawl", "crawl", { crawlJobId: "job1", tenantId: "t1", scheduleId: "s1" });
    expect(crawlSchedule.update.mock.calls[0]![0].data.nextRunAt.toISOString()).toBe("2026-11-09T03:00:00.000Z");
  });

  it.each([
    ["missing", null, 0],
    ["disabled", row({ enabled: false }), 0],
    ["quota_exhausted", row(), 20],
    ["url_refused", row({ config: { ...row().config, rootUrl: "http://127.0.0.1/" } }), 0],
    ["config_refused", row({ config: { ...row().config, crawl: { ...row().config.crawl, respectRobots: false } } }), 0],
  ] as const)("skips with reason %s and starts nothing", async (reason, r, used) => {
    crawlSchedule.findUnique.mockResolvedValue(r);
    crawlJob.count.mockResolvedValue(used);
    expect(await svc.runScheduledCrawl("s1")).toEqual({ status: "skipped", reason });
    expect(crawlJob.create).not.toHaveBeenCalled();
    expect(addJob).not.toHaveBeenCalled();
  });
});

describe("after a scheduled crawl", () => {
  const job = { id: "j2", tenantId: "t1", rootUrl: "https://x.com/", mode: "spider", config: null, createdAt: new Date(), status: "COMPLETED" };
  const sched = { id: "s1", tenantId: "t1", lastJobId: "j1", exportTo: { email: true, sheets: { spreadsheetId: null } } };

  it("compares with lastJobId, moves lastJobId, emails; Sheets waits for its flag", async () => {
    crawlSchedule.findUnique.mockResolvedValue(sched);
    crawlJob.findFirst.mockResolvedValue(job);
    compare.resolveCompare.mockResolvedValue({ jobAId: "j2", jobBId: "j1" });
    compare.runComparison.mockResolvedValue({ id: "cmp" });
    const email = vi.fn(async () => true);
    const sheets = vi.fn(async () => true);
    const out = await svc.afterScheduledCrawl("s1", "j2", { email, sheets });
    expect(compare.resolveCompare).toHaveBeenCalledWith(job, "j1", null, []);
    expect(crawlJob.findFirst.mock.calls[0]![0].where).toEqual({ id: "j2", tenantId: "t1" });
    expect(crawlSchedule.update).toHaveBeenCalledWith({ where: { id: "s1" }, data: { lastJobId: "j2" } });
    expect(email).toHaveBeenCalledWith({ tenantId: "t1", crawlJobId: "j2", comparisonId: "cmp" });
    expect(sheets).not.toHaveBeenCalled();
    expect(out).toEqual({ compared: true, comparisonId: "cmp" });
  });

  it("a baseline that can no longer be compared still moves lastJobId; a failed crawl changes nothing", async () => {
    crawlSchedule.findUnique.mockResolvedValue(sched);
    crawlJob.findFirst.mockResolvedValueOnce(job);
    compare.resolveCompare.mockRejectedValueOnce(new Error("not_comparable"));
    expect(await svc.afterScheduledCrawl("s1", "j2", {})).toEqual({ compared: false, comparisonId: null });
    expect(crawlSchedule.update).toHaveBeenCalledTimes(1);
    crawlJob.findFirst.mockResolvedValueOnce({ ...job, status: "FAILED" });
    await svc.afterScheduledCrawl("s1", "j2", {});
    expect(crawlSchedule.update).toHaveBeenCalledTimes(1);
  });

  it("no email while crawl.reports is off", async () => {
    flags.on.delete("crawl.reports");
    crawlSchedule.findUnique.mockResolvedValue({ ...sched, lastJobId: null });
    crawlJob.findFirst.mockResolvedValue(job);
    const email = vi.fn();
    await svc.afterScheduledCrawl("s1", "j2", { email });
    expect(email).not.toHaveBeenCalled();
    flags.on.add("crawl.reports");
  });
});

describe("the email", () => {
  const data = (locale: "en" | "fr" | "de-CH", comparison = true) => ({
    locale,
    host: "x.com<b>",
    crawlJobId: "j2",
    pagesCrawled: 1234,
    issues: { ERROR: 1, WARNING: 2, NOTICE: 3 },
    comparison: comparison ? { id: "cmp", counts: { added: 4, removed: 5, changed: 6, issuesNew: 7, issuesResolved: 8 } } : null,
  });

  it.each(["en", "fr", "de-CH"] as const)("%s: summary, deltas, sign-in links only, escaped", (l) => {
    const m = scheduleEmail(data(l));
    const c = SCHEDULE_EMAIL_COPY[l];
    expect(m.subject).toBe(c.subject("x.com<b>"));
    expect(m.text).toContain(c.since);
    expect(m.html).toContain("x.com&lt;b&gt;");
    expect(m.html).not.toContain("x.com<b>");
    expect(m.links[0]).toBe("https://echorank360.com/crawler/j2");
    expect(m.links).toContain("https://echorank360.com/api/seo/v1/crawl/j2/compare/cmp?bucket=added&format=csv");
    for (const href of m.links) {
      expect(href.startsWith("https://echorank360.com/")).toBe(true);
      expect(href).not.toMatch(/token|sig|signature|expires|share/i);
    }
    expect(JSON.stringify(c)).not.toContain("ß");
  });

  it("first run: no deltas, no compare CSVs", () => {
    const m = scheduleEmail(data("en", false));
    expect(m.text).toContain(SCHEDULE_EMAIL_COPY.en.noBaseline);
    expect(m.links).toHaveLength(4);
  });
});

describe("routes", () => {
  const post = (body: unknown) => listRoute.POST(new Request("https://app.test/x", { method: "POST", body: JSON.stringify(body) }));
  const valid = { rootUrl: "https://x.com/", cadence: "weekly", hourUtc: 3, exportTo: { email: true, sheets: { spreadsheetId: null } } };

  it("POST saves under the caller's tenant, schedules the repeatable, drops sheets while crawl.sheets is off", async () => {
    crawlSchedule.count.mockResolvedValue(0);
    crawlSchedule.create.mockImplementation(async (a: { data: Record<string, unknown> }) => ({ id: "s9", createdAt: new Date(), lastJobId: null, ...a.data }));
    const res = await post(valid);
    expect(res.status).toBe(201);
    const data = crawlSchedule.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({ tenantId: "t1", host: "x.com", cadence: "weekly", hourUtc: 3, exportTo: { email: true, sheets: null } });
    expect(crawlSchedule.count).toHaveBeenCalledWith({ where: { tenantId: "t1" } });
    expect(queue.add).toHaveBeenCalledWith("schedule", { scheduleId: "s9" }, expect.objectContaining({ repeat: { pattern: "0 3 * * 1", tz: "UTC", key: "crawl-schedule-s9" } }));
    const body = await res.json();
    expect(body).not.toHaveProperty("config");
  });

  it.each([
    [{ ...valid, cadence: "daily" }, 0, "cadence_not_in_plan"],
    [valid, 2, "over_plan_cap"],
  ])("POST %j with %i saved → 400 %s", async (body, existing, reason) => {
    crawlSchedule.count.mockResolvedValue(existing);
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "SCHEDULE_REFUSED", reason });
    expect(crawlSchedule.create).not.toHaveBeenCalled();
  });

  it("POST refuses a private URL", async () => {
    crawlSchedule.count.mockResolvedValue(0);
    expect((await post({ ...valid, rootUrl: "http://127.0.0.1/" })).status).toBe(400);
  });

  it("PATCH / DELETE are scoped to the tenant; another tenant's id is a 404", async () => {
    const ctx = { params: Promise.resolve({ scheduleId: "s1" }) };
    crawlSchedule.findFirst.mockResolvedValue(null);
    const res = await oneRoute.PATCH(new Request("https://app.test/x", { method: "PATCH", body: JSON.stringify({ enabled: false }) }), ctx);
    expect(res.status).toBe(404);
    expect(crawlSchedule.findFirst).toHaveBeenCalledWith({ where: { id: "s1", tenantId: "t1" } });
    crawlSchedule.deleteMany.mockResolvedValue({ count: 0 });
    expect((await oneRoute.DELETE(new Request("https://app.test/x"), ctx)).status).toBe(404);
    expect(crawlSchedule.deleteMany).toHaveBeenCalledWith({ where: { id: "s1", tenantId: "t1" } });
  });

  it("GET lists each schedule with its last completed run's health, read tenant-scoped", async () => {
    const base = { tenantId: "t1", host: "x.com", cadence: "weekly", hourUtc: 3, enabled: true, nextRunAt: new Date("2026-12-01T03:00:00Z"), exportTo: null, createdAt: new Date(), config: { rootUrl: "https://x.com/", renderMode: "none", crawl: null } };
    crawlSchedule.findMany.mockResolvedValue([{ ...base, id: "s1", lastJobId: "j1" }, { ...base, id: "s2", lastJobId: null }]);
    crawlJob.findMany.mockResolvedValue([{ id: "j1", summary: { health: { score: 77 } } }]);
    const body = await (await listRoute.GET()).json();
    expect(crawlJob.findMany).toHaveBeenCalledWith({ where: { id: { in: ["j1"] }, tenantId: "t1" }, select: { id: true, summary: true } });
    expect(body.schedules.map((x: { id: string; lastHealth: number | null }) => [x.id, x.lastHealth])).toEqual([["s1", 77], ["s2", null]]);
  });

  it("GET: last and previous completed runs per schedule (the delta), the plan that unlocks a cadence, the workspace timezone", async () => {
    const base = { tenantId: "t1", host: "x.com", cadence: "weekly", hourUtc: 3, enabled: true, nextRunAt: new Date("2026-12-01T03:00:00Z"), exportTo: null, createdAt: new Date(), config: { rootUrl: "https://x.com/", renderMode: "none", crawl: null } };
    crawlSchedule.findMany.mockResolvedValue([{ ...base, id: "s1", lastJobId: "j9" }, { ...base, id: "s2", lastJobId: "j1" }]);
    crawlJob.findMany.mockResolvedValue([{ id: "j1", summary: { health: { score: 55 } } }]);
    queryRaw.mockResolvedValue([
      { scheduleId: "s1", score: 74, rn: BigInt(1) },
      { scheduleId: "s1", score: 70, rn: BigInt(2) },
    ]);
    const body = await (await listRoute.GET()).json();
    const sql = queryRaw.mock.calls[0]! as unknown as [TemplateStringsArray, ...unknown[]];
    expect(sql[0].join("?")).toContain("row_number() OVER (PARTITION BY \"scheduleId\"");
    expect(sql.slice(1)).toEqual(["t1", ["s1", "s2"]]);
    // s1 from its runs; s2 has none tagged yet, so its lastJobId answers and there is no delta.
    expect(body.schedules.map((x: { id: string; lastHealth: number | null; prevHealth: number | null }) => [x.id, x.lastHealth, x.prevHealth])).toEqual([
      ["s1", 74, 70],
      ["s2", 55, null],
    ]);
    expect(body).toMatchObject({ cadences: ["weekly", "monthly"], cadenceUnlocks: { daily: "Agency" }, timezone: "Europe/Zurich" });
    expect(s.cadenceUnlocks(["monthly"])).toEqual({ daily: "Agency", weekly: "Growth" });
    expect(s.cadenceUnlocks(["daily", "weekly", "monthly"])).toEqual({});
  });

  describe("POST /schedules/[id]/run (Run now)", () => {
    const ctx = { params: Promise.resolve({ scheduleId: "s1" }) };
    const run = () => runRoute.POST(new Request("https://app.test/x", { method: "POST" }), ctx);
    const tickRow = (over: Record<string, unknown> = {}) => ({
      id: "s1", tenantId: "t1", host: "x.com", cadence: "weekly", hourUtc: 3, enabled: true, lastJobId: null, exportTo: { email: true, sheets: null },
      config: { rootUrl: "https://x.com/", renderMode: "none", crawl: null }, tenant: { planType: "GROWTH" }, ...over,
    });

    it("another workspace's schedule is a 404 and nothing runs", async () => {
      crawlSchedule.findFirst.mockResolvedValue(null);
      expect((await run()).status).toBe(404);
      expect(crawlSchedule.findFirst).toHaveBeenCalledWith({ where: { id: "s1", tenantId: "t1" }, select: { id: true } });
      expect(crawlSchedule.findUnique).not.toHaveBeenCalled();
    });

    it("rate-limited with crawl starts", async () => {
      crawlSchedule.findFirst.mockResolvedValue({ id: "s1" });
      rateLimit.mockResolvedValue({ success: false });
      expect((await run()).status).toBe(429);
      expect(rateLimit.mock.calls[0]![0]).toContain("t1");
      expect(crawlSchedule.findUnique).not.toHaveBeenCalled();
    });

    it("starts the schedule's crawl like its tick (scheduleId on the job): 202", async () => {
      crawlSchedule.findFirst.mockResolvedValue({ id: "s1" });
      crawlSchedule.findUnique.mockResolvedValue(tickRow());
      crawlJob.create.mockImplementation(async (a: { data: Record<string, unknown> }) => ({ id: "job7", createdAt: new Date(), ...a.data }));
      const res = await run();
      expect(res.status).toBe(202);
      expect(await res.json()).toEqual({ status: "started", crawlJobId: "job7" });
      expect(addJob).toHaveBeenCalledWith("site-crawl", "crawl", { crawlJobId: "job7", tenantId: "t1", scheduleId: "s1" });
    });

    it("a skipped run is a 409 with its reason", async () => {
      crawlSchedule.findFirst.mockResolvedValue({ id: "s1" });
      crawlSchedule.findUnique.mockResolvedValue(tickRow({ enabled: false }));
      const res = await run();
      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({ code: "SCHEDULE_SKIPPED", reason: "disabled" });
      expect(crawlJob.create).not.toHaveBeenCalled();
    });
  });

  it("everything is a 404 while crawl.schedule is off", async () => {
    flags.on.delete("crawl.schedule");
    expect((await listRoute.GET()).status).toBe(404);
    expect((await post(valid)).status).toBe(404);
    expect((await runRoute.POST(new Request("https://app.test/x", { method: "POST" }), { params: Promise.resolve({ scheduleId: "s1" }) })).status).toBe(404);
    flags.on.add("crawl.schedule");
  });
});
