// VOLATILITY_POLL_ENABLED — the free SERP volatility basket, both states.
//
// Off (the default): the worker is not registered, every repeatable schedule in
// its queue is removed on boot, the sampler refuses before any DataForSEO call,
// and the API serves the last stored snapshot with paused: true.
// On: the tick is kept, the sampler posts, the window ends today.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const serpVolatilitySample = { count: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), upsert: vi.fn() };
const serpCheck = { create: vi.fn(), findMany: vi.fn() };
vi.mock("@/lib/prisma", () => ({ prisma: { serpVolatilitySample, serpCheck } }));

const seoMeteredCallResult = vi.fn();
vi.mock("@/lib/dataforseo/metering", () => ({ seoMeteredCallResult: (...a: unknown[]) => seoMeteredCallResult(...a) }));
vi.mock("@/lib/free-tools/spend", () => ({ FREE_TOOLS_TENANT_ID: "free-tools", checkDailyCap: vi.fn(async () => ({ capped: false, spent: 0, cap: 1 })) }));

const cacheWrites: string[] = [];
vi.mock("@/lib/free-tools/cache", () => ({
  ONE_HOUR: 3600,
  cacheKey: (...p: (string | number)[]) => p.join(":"),
  cached: vi.fn(async () => ({ hit: false, value: null })),
  writeCache: vi.fn(async (key: string) => void cacheWrites.push(key)),
}));
vi.mock("@/infrastructure/redis/connection", () => ({ getSubscriberConnection: vi.fn() }));
vi.mock("@/infrastructure/queue/registry", () => ({ getQueue: vi.fn() }));

const { volatilityPollEnabled } = await import("@/lib/free-tools/volatility-flag");
const { postDailyBasket } = await import("@/lib/free-tools/volatility-sampler");
const { pruneRepeatables, removeFreeToolsVolatilitySchedules } = await import("@/infrastructure/queue/workers/free-tools-volatility.worker");
const { GET } = await import("@/app/api/free/v1/serp-volatility/route");

const HOUR = String(60 * 60_000);
function fakeQueue(jobs: Array<{ key: string; name: string; every: string | null }>) {
  const removed: string[] = [];
  return {
    removed,
    getRepeatableJobs: vi.fn(async () => jobs.filter((j) => !removed.includes(j.key))),
    removeRepeatableByKey: vi.fn(async (k: string) => {
      removed.push(k);
      return true;
    }),
  };
}
const JOBS = [
  { key: "tick::3600000", name: "tick", every: HOUR },
  { key: "tick::1800000", name: "tick", every: "1800000" },
  { key: "other::60000", name: "other", every: "60000" },
];

const day = (d: string, keyword: string, domains: string[]) => ({ sampledOn: new Date(`${d}T00:00:00Z`), category: "tech", keyword, topDomains: domains });
const SAMPLES = [day("2026-09-01", "laptops", ["a.com", "b.com", "c.com"]), day("2026-09-02", "laptops", ["b.com", "a.com", "d.com"])];

beforeEach(() => {
  vi.clearAllMocks();
  cacheWrites.length = 0;
  serpVolatilitySample.count.mockResolvedValue(0);
  serpVolatilitySample.findFirst.mockResolvedValue({ sampledOn: new Date("2026-09-02T00:00:00Z") });
  serpVolatilitySample.findMany.mockResolvedValue(SAMPLES);
  seoMeteredCallResult.mockResolvedValue({ taskId: "t1", billing: { costUsd: 0.0006 } });
});
afterEach(() => vi.unstubAllEnvs());

describe("VOLATILITY_POLL_ENABLED off (default)", () => {
  beforeEach(() => vi.stubEnv("VOLATILITY_POLL_ENABLED", ""));

  it("is off unless exactly true", () => {
    for (const v of ["", "false", "1", "yes"]) {
      vi.stubEnv("VOLATILITY_POLL_ENABLED", v);
      expect(volatilityPollEnabled(), v).toBe(false);
    }
    vi.stubEnv("VOLATILITY_POLL_ENABLED", " TRUE ");
    expect(volatilityPollEnabled()).toBe(true);
  });

  it("the sampler refuses before any DataForSEO call or DB read", async () => {
    const r = await postDailyBasket(new Date("2026-10-26T12:00:00Z"));
    expect(r).toEqual({ posted: 0, skipped: 30, reason: "poll_disabled" });
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
    expect(serpVolatilitySample.count).not.toHaveBeenCalled();
    expect(serpCheck.create).not.toHaveBeenCalled();
  });

  it("boot removes every repeatable job in the queue, the current tick included", async () => {
    const q = fakeQueue(JOBS);
    expect(await removeFreeToolsVolatilitySchedules(q as never)).toBe(3);
    expect(q.removed).toEqual(["tick::3600000", "tick::1800000", "other::60000"]);
  });

  it("start-workers registers the worker only when enabled and removes the schedules on every disabled boot", () => {
    const src = readFileSync(join(process.cwd(), "src/infrastructure/queue/start-workers.ts"), "utf8");
    expect(src).toContain('...(volatilityPollEnabled() ? [{ name: "free-tools-volatility", start: startFreeToolsVolatilityWorker }] : [])');
    expect(src).toContain("const removed = await removeFreeToolsVolatilitySchedules();");
    expect(src).toContain("void disabledWorkers();");
  });

  it("the API serves the last stored snapshot, paused, with no error and no empty state", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.paused).toBe(true);
    expect(body.collecting).toBe(false);
    expect(body.latest.date).toBe("2026-09-02");
    // The window ends at the last sample, not today, so old data never ages out.
    const since = serpVolatilitySample.findMany.mock.calls[0]![0].where.sampledOn.gte as Date;
    expect(since.toISOString()).toBe("2026-08-03T00:00:00.000Z");
    expect(cacheWrites[0]).toContain("paused");
  });
});

describe("VOLATILITY_POLL_ENABLED=true", () => {
  beforeEach(() => vi.stubEnv("VOLATILITY_POLL_ENABLED", "true"));

  it("the sampler posts the basket", async () => {
    const r = await postDailyBasket(new Date("2026-10-26T12:00:00Z"));
    expect(r.posted).toBe(30);
    expect(seoMeteredCallResult).toHaveBeenCalledTimes(30);
  });

  it("the prune keeps the current tick and removes only stale schedules", async () => {
    const q = fakeQueue(JOBS);
    expect(await pruneRepeatables(q as never, true)).toBe(2);
    expect(q.removed).toEqual(["tick::1800000", "other::60000"]);
  });

  it("the API window ends today and says live", async () => {
    const before = Date.now();
    const body = await (await GET()).json();
    expect(body.paused).toBe(false);
    expect(serpVolatilitySample.findFirst).not.toHaveBeenCalled();
    const since = (serpVolatilitySample.findMany.mock.calls[0]![0].where.sampledOn.gte as Date).getTime();
    expect(since).toBeGreaterThanOrEqual(before - 31 * 86_400_000 - 1000);
    expect(cacheWrites[0]).toContain("live");
  });
});
