// tests/site-crawler-restart.db.test.ts
//
// Crawl concurrency against a real Postgres and a real Redis: the batched
// writes (multi-row INSERTs with ids made up front), a crawl that survives its
// process dying — cleanly (SIGTERM) and not (a SIGKILL between the rows and
// the inflight clear) — with no page lost or written twice, and the slot
// claim holding a workspace's limit when many crawls race for it.
//
// SKIPPED UNLESS TEST_DATABASE_URL AND TEST_REDIS_URL ARE SET: the configured
// DATABASE_URL is production. A throwaway pair:
//
//   docker run -d --name pg -p 127.0.0.1:55432:5432 -e POSTGRES_PASSWORD=… postgres:16
//   DATABASE_URL=<that> npx prisma migrate deploy
//   redis-server --port 63799 --save ''
//   TEST_DATABASE_URL=<that> TEST_REDIS_URL=redis://127.0.0.1:63799 npx vitest run tests/site-crawler-restart.db.test.ts

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import Redis from "ioredis";

const TEST_DB = process.env.TEST_DATABASE_URL;
const TEST_REDIS = process.env.TEST_REDIS_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

vi.mock("server-only", () => ({}));

// The site: a root linking to 79 pages, every page with three findings' worth
// of thin content and two links back. No socket is opened.
const ROOT = "https://restart.example/";
const PAGES = Array.from({ length: 79 }, (_, i) => `https://restart.example/p${i + 1}`);
const fetched: string[] = [];
function html(url: string) {
  const links = url === ROOT ? PAGES : [ROOT, PAGES[0]!];
  return {
    finalUrl: url,
    statusCode: 200,
    redirectTarget: null,
    redirectHops: 0,
    chain: [],
    lastModified: null,
    contentType: "text/html; charset=utf-8",
    html: `<html><head><title>t</title></head><body><h1>H</h1><p>few words</p>${links.map((l) => `<a href="${l}">x</a>`).join("")}</body></html>`,
    xRobotsTag: null,
    headers: { "content-type": "text/html; charset=utf-8" },
    bytes: 512,
    fetchMs: 1,
    error: null,
  };
}
vi.mock("@/lib/site-crawler/fetch", async (orig) => ({
  ...(await orig<typeof import("@/lib/site-crawler/fetch")>()),
  fetchPage: async (url: string) => (fetched.push(url), html(url)),
  RateLimiter: class {
    async acquire() {}
  },
}));
vi.mock("@/lib/site-crawler/robots", async (orig) => ({
  ...(await orig<typeof import("@/lib/site-crawler/robots")>()),
  fetchRobots: async () => ({ allowAll: true, isAllowed: () => true, crawlDelaySeconds: 0, sitemaps: [] }),
}));
vi.mock("@/lib/site-crawler/sitemap", () => ({ collectSitemapUrls: async () => ({ found: false, urls: [], filesFetched: 0, truncated: false }) }));
vi.mock("@/lib/site-crawler/head-checks", () => ({ attachHeadChecks: async () => {} }));
vi.mock("@/lib/site-crawler/aggregate", () => ({ aggregateCrawl: async () => ({ summary: {}, issueCount: 0 }) }));

const run = TEST_DB && TEST_REDIS ? describe : describe.skip;

run("crawl restarts and slot claims (real Postgres + Redis)", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let runCrawl: typeof import("@/lib/site-crawler/runner").runCrawl;
  let claimCrawlSlot: typeof import("@/lib/site-crawler/tenant-caps").claimCrawlSlot;
  let redis: Redis;
  const tenantId = `t_restart_${Date.now().toString(36)}`;
  const tenantB = `${tenantId}_b`;

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    ({ runCrawl } = await import("@/lib/site-crawler/runner"));
    ({ claimCrawlSlot } = await import("@/lib/site-crawler/tenant-caps"));
    redis = new Redis(TEST_REDIS!);
    await prisma.tenant.create({ data: { id: tenantId, name: "restart", slug: tenantId } });
    await prisma.tenant.create({ data: { id: tenantB, name: "restart b", slug: tenantB, planType: "GROWTH" } });
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, tenantB] } } });
    await redis.quit();
  });

  async function newJob(id: string) {
    await prisma.crawlJob.create({ data: { id, tenantId, rootUrl: ROOT, urlCap: 500 } });
    return id;
  }
  async function pageUrls(jobId: string) {
    return (await prisma.crawlPage.findMany({ where: { crawlJobId: jobId }, select: { url: true } })).map((p) => p.url);
  }

  it("an uninterrupted crawl: every page once, issues and links pointing at real rows", async () => {
    const jobId = await newJob(`${tenantId}_a`);
    const out = await runCrawl({ jobId, redis });
    expect(out).toMatchObject({ status: "COMPLETED", pagesCrawled: 80 });
    const urls = await pageUrls(jobId);
    expect(urls).toHaveLength(80);
    expect(new Set(urls).size).toBe(80);
    const [orphanIssues, orphanLinks] = await Promise.all([
      prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM crawl_issues i LEFT JOIN crawl_pages p ON p.id = i."crawlPageId" WHERE i."crawlJobId" = ${jobId} AND p.id IS NULL`,
      prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM crawl_links l LEFT JOIN crawl_pages p ON p.id = l."fromPageId" WHERE l."crawlJobId" = ${jobId} AND p.id IS NULL`,
    ]);
    expect(Number(orphanIssues[0]!.n)).toBe(0);
    expect(Number(orphanLinks[0]!.n)).toBe(0);
    // Page-scope findings were written (aggregation, which recounts them, is stubbed here).
    expect(await prisma.crawlIssue.count({ where: { crawlJobId: jobId } })).toBeGreaterThan(80);
    expect(await prisma.crawlLink.count({ where: { crawlJobId: jobId } })).toBeGreaterThan(80);
    // Ids are the cuid shape the tables hold.
    expect((await prisma.crawlPage.findFirst({ where: { crawlJobId: jobId }, select: { id: true } }))!.id).toMatch(/^c[0-9a-z]{24}$/);
  });

  it("SIGTERM mid-crawl, then a new process: every page exactly once", async () => {
    const jobId = await newJob(`${tenantId}_term`);
    await prisma.crawlJob.update({ where: { id: jobId }, data: { status: "RUNNING", startedAt: new Date() } });
    let batches = 0;
    const first = await runCrawl({ jobId, redis, shouldStop: () => ++batches > 40 });
    expect(first.status).toBe("INTERRUPTED");
    const row = await prisma.crawlJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(row.status).toBe("RUNNING");
    expect(row.pagesCrawled).toBe(first.pagesCrawled);
    expect(first.pagesCrawled).toBeGreaterThan(0);
    expect(first.pagesCrawled).toBeLessThan(80);

    const second = await runCrawl({ jobId, redis, resume: true });
    expect(second).toMatchObject({ status: "COMPLETED", pagesCrawled: 80 });
    const urls = await pageUrls(jobId);
    expect(urls).toHaveLength(80);
    expect(new Set(urls).size).toBe(80);
  });

  it("SIGKILL after a batch's rows committed but before inflight was cleared: no page twice, none lost", async () => {
    const jobId = await newJob(`${tenantId}_kill`);
    await prisma.crawlJob.update({ where: { id: jobId }, data: { status: "RUNNING", startedAt: new Date() } });
    let n = 0;
    await runCrawl({ jobId, redis, shouldStop: () => ++n > 30 });
    // Re-create the kill window: put the last written pages back into inflight
    // (as if the clear never ran) next to two that were never written.
    const written = await pageUrls(jobId);
    const keys = { inflight: `crawl:${jobId}:inflight`, queue: `crawl:${jobId}:queue` };
    const queued = await redis.lrange(keys.queue, 0, 1);
    await redis.lrem(keys.queue, 1, queued[0]!);
    await redis.lrem(keys.queue, 1, queued[1]!);
    await redis.del(keys.inflight);
    await redis.rpush(keys.inflight, JSON.stringify({ url: written[written.length - 1], depth: 1 }), JSON.stringify({ url: written[written.length - 2], depth: 1 }), ...queued);
    fetched.length = 0;
    const out = await runCrawl({ jobId, redis, resume: true });
    expect(out).toMatchObject({ status: "COMPLETED", pagesCrawled: 80 });
    const urls = await pageUrls(jobId);
    expect(new Set(urls).size).toBe(80);
    expect(urls).toHaveLength(80);
    // The two already-written pages were not fetched again; the two queued ones were, first.
    expect(fetched).not.toContain(written[written.length - 1]);
    expect(fetched.slice(0, 2)).toEqual(queued.map((q) => JSON.parse(q).url));
  });

  it("twelve crawls of one Growth workspace race for slots: exactly two run, and the oldest go first", async () => {
    const ids = Array.from({ length: 12 }, (_, i) => `${tenantB}_${String(i).padStart(2, "0")}`);
    const base = Date.now() - 60_000;
    for (const [i, id] of ids.entries()) {
      await prisma.crawlJob.create({ data: { id, tenantId: tenantB, rootUrl: ROOT, urlCap: 10, createdAt: new Date(base + i * 1000) } });
    }
    // All at once, as four processes picking jobs up in the same second would.
    const claims = await Promise.all([...ids].reverse().map((id) => claimCrawlSlot(tenantB, id)));
    const ran = [...ids].reverse().filter((_, i) => claims[i]!.kind === "run");
    expect(ran.sort()).toEqual(ids.slice(0, 2));
    expect(await prisma.crawlJob.count({ where: { tenantId: tenantB, status: "RUNNING" } })).toBe(2);
    // One finishes: the next in line gets its slot, nobody else.
    await prisma.crawlJob.update({ where: { id: ids[0]! }, data: { status: "COMPLETED" } });
    const again = await Promise.all(ids.slice(2).map((id) => claimCrawlSlot(tenantB, id)));
    expect(ids.slice(2).filter((_, i) => again[i]!.kind === "run")).toEqual([ids[2]]);
    // A running crawl claimed again (a restart) keeps its slot.
    expect(await claimCrawlSlot(tenantB, ids[1]!)).toEqual({ kind: "run", resumed: true });
  });
});
