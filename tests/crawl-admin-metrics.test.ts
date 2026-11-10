// /admin/crawl-metrics: the live crawler view (crawl-admin-metrics.ts) and the
// heartbeat it reads (crawl-metrics.ts). Staff only, like every /admin page.
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const platform = vi.hoisted(() => ({ admin: false }));
vi.mock("@/lib/platform-admin", () => ({ platformAdmin: async () => (platform.admin ? { email: "staff@echorank360.com" } : null) }));
vi.mock("@/lib/prisma", () => ({ prisma: { crawlJob: { count: async ({ where }: { where: { status: string } }) => (where.status === "RUNNING" ? 48 : 3) } } }));
vi.mock("@/infrastructure/queue/registry", () => ({ getQueue: () => ({ getJobCounts: async () => ({ active: 48, waiting: 2, prioritized: 1, delayed: 0, failed: 0 }) }) }));

const beat = (i: number) => ({
  id: `h:${100 + i}`, pid: 100 + i, instance: i, role: "crawlers", concurrency: 12, active: 12, cpuPct: 40, rssMb: 600,
  pagesTotal: 1000, pagesPerSec: 24, writes: 50, rowsWritten: 9000, writeMs: { p50: 20, p95: 60, max: 90 }, db: { total: 7, idle: 2, waiting: 0 },
  startedAt: 0, at: Date.now(),
});
const fakeRedis = {
  zrangebyscore: async () => ["h:100", "h:101"],
  mget: async () => [JSON.stringify(beat(0)), JSON.stringify(beat(1))],
  info: async () => "# Memory\r\nused_memory:52428800\r\nused_memory_peak:104857600\r\nmaxmemory:4294967296\r\nmaxmemory_policy:noeviction\r\n",
};
vi.mock("@/infrastructure/redis/connection", () => ({ getRedisConnection: () => fakeRedis }));

const { crawlAdminMetrics, parseRedisMemory, fetchRenderStats } = await import("@/lib/site-crawler/crawl-admin-metrics");
const { percentiles } = await import("@/lib/site-crawler/crawl-metrics");

describe("the numbers", () => {
  it("Redis INFO memory in MB, the cap when one is set", () => {
    expect(parseRedisMemory("used_memory:52428800\r\nused_memory_peak:104857600\r\nmaxmemory:0\r\nmaxmemory_policy:noeviction\r\n")).toEqual({
      usedMb: 50,
      peakMb: 100,
      maxMb: null,
      policy: "noeviction",
    });
  });

  it("percentiles: nearest rank, null when empty", () => {
    expect(percentiles([])).toBeNull();
    expect(percentiles(Array.from({ length: 100 }, (_, i) => i + 1))).toEqual({ p50: 50, p95: 95, max: 100 });
  });

  it("one read: crawls, queue, processes, pages/s summed, Redis, render queue, the connection budget", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ contexts: 6, running: 6, queued: 9, queueWaitS: 120 })));
    vi.stubGlobal("fetch", fetchImpl);
    const m = await crawlAdminMetrics(fakeRedis as never);
    vi.unstubAllGlobals();
    expect(m.crawls).toEqual({ running: 48, queued: 3 });
    expect(m.processes).toHaveLength(2);
    expect(m.slots.live).toBe(24);
    expect(m.pagesPerSec).toBe(48);
    expect(m.redis).toMatchObject({ usedMb: 50, peakMb: 100, maxMb: 4096 });
    expect(m.render).toEqual({ contexts: 6, running: 6, queued: 9, queueWaitS: 120 });
    expect(m.db.budget).toBeLessThan(60);
  });

  it("a sidecar that does not answer is null, not an error", async () => {
    expect(await fetchRenderStats((async () => { throw new Error("ECONNREFUSED"); }) as never)).toBeNull();
    expect(await fetchRenderStats((async () => new Response("no", { status: 404 })) as never)).toBeNull();
  });
});

describe("in the app: Queued, position N", () => {
  it("each dashboard locale says it in its own words (de-CH without ß)", async () => {
    const { SITE_CRAWLER_COPY } = await import("@/lib/i18n/dashboard");
    expect(SITE_CRAWLER_COPY.en.statusQueuedAt("3")).toBe("Queued, position 3");
    expect(SITE_CRAWLER_COPY.fr.statusQueuedAt("3")).toBe("En attente, position 3");
    expect(SITE_CRAWLER_COPY["de-CH"].statusQueuedAt("3")).toBe("In Warteschlange, Position 3");
  });

  it("the results header shows it while the crawl waits, and the status poll sends it", async () => {
    const { readFileSync } = await import("node:fs");
    const client = readFileSync("src/components/seo-tools/site-crawler-client.tsx", "utf8");
    expect(client).toContain('active.status === "QUEUED" && active.queuePosition ? t.statusQueuedAt(int.format(active.queuePosition))');
    const route = readFileSync("src/app/api/seo/v1/crawl/[id]/route.ts", "utf8");
    expect(route).toMatch(/row\.status === "QUEUED" \? \(await queueEstimate\(row\)/);
  });
});

describe("/admin/crawl-metrics", () => {
  it("is a 404 for anyone but staff", async () => {
    const { default: Page } = await import("@/app/admin/crawl-metrics/page");
    platform.admin = false;
    await expect(Page()).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
  });
});
