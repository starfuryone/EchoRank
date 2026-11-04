// tests/site-crawler-metrics.db.test.ts — the Phase 4d metrics store against
// Postgres: upsert replaces per (page, source), the URL join matches http/https
// and trailing-slash variants, coverage per source, cascade with the page.
// SKIPPED UNLESS TEST_DATABASE_URL IS SET.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;
vi.mock("server-only", () => ({}));

describe.skipIf(!TEST_DB)("metrics store against Postgres", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let m: typeof import("@/lib/site-crawler/metrics");
  const tenantId = `t_met_${Date.now()}`;
  const job = `${tenantId}_j`;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    m = await import("@/lib/site-crawler/metrics");
    await prisma.tenant.create({ data: { id: tenantId, name: "met", slug: tenantId, planType: "GROWTH" } });
    await prisma.crawlJob.create({ data: { id: job, tenantId, rootUrl: "https://x.com/", urlCap: 10, status: "COMPLETED" } });
    for (const [k, url] of Object.entries({ root: "https://x.com/", a: "https://x.com/a/", b: "http://x.com/b", c: "https://x.com/c?p=2" })) {
      ids[k] = (await prisma.crawlPage.create({ data: { crawlJobId: job, url, depth: 1 } })).id;
    }
  });
  afterAll(async () => {
    await prisma?.tenant.delete({ where: { id: tenantId } }).catch(() => {});
  });

  it("joins one upstream chunk by normalised URL", async () => {
    const byKey = new Map([
      ["x.com", { clicks: 1 }],
      ["x.com/a", { clicks: 2 }],
      ["x.com/b", { clicks: 3 }],
      ["x.com/c", { clicks: 9 }],
    ]);
    expect(await m.joinChunkByUrl(job, "gsc", byKey)).toBe(3);
    const got = await m.metricsForPages(Object.values(ids));
    expect([ids.root, ids.a, ids.b, ids.c].map((id) => (got.get(id!)?.gsc as { clicks: number } | undefined)?.clicks ?? null)).toEqual([1, 2, 3, null]);
  });

  it("upsert replaces the row for (page, source) and leaves other sources alone", async () => {
    await m.upsertPageMetrics(job, "backlinks", [{ pageId: ids.a!, data: { backlinks: 5 } }]);
    await m.upsertPageMetrics(job, "gsc", [{ pageId: ids.a!, data: { clicks: 20 } }]);
    expect(await prisma.crawlPageMetric.count({ where: { pageId: ids.a } })).toBe(2);
    expect((await m.metricsForPages([ids.a!])).get(ids.a!)).toEqual({ gsc: { clicks: 20 }, backlinks: { backlinks: 5 } });
    expect(await m.metricCoverage(job)).toEqual({ gsc: 3, psi: 0, ga4: 0, backlinks: 1 });
  });

  it("goes with its page", async () => {
    await prisma.crawlPage.delete({ where: { id: ids.b } });
    expect(await prisma.crawlPageMetric.count({ where: { pageId: ids.b } })).toBe(0);
  });
});
