// tests/site-crawler-metrics-backlinks.db.test.ts — the Phase 4d backlink
// opt-in against Postgres: the top N pages by inlinks of ANY status, one
// metered lookup each, the USD cap checked before every call (the step stops
// and the crawl says usd_cap), then the backlinks rules on the pages looked
// up. SKIPPED UNLESS TEST_DATABASE_URL IS SET.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;
vi.mock("server-only", () => ({}));

describe.skipIf(!TEST_DB)("backlink opt-in against Postgres", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let r: typeof import("@/lib/site-crawler/metrics-runner");
  const tenantId = `t_bl_${Date.now()}`;
  const job = `${tenantId}_j`;
  const url = (p: string) => `https://bl.example/${p}`;
  let spent = 0;
  const looked: string[] = [];
  const deps = (cap: number) => ({
    backlinksSummary: async (_t: string, u: string) => {
      looked.push(u);
      spent += 0.03;
      return [{ referring_domains: u.endsWith("/quiet") ? 0 : 4, backlinks: u.endsWith("/quiet") ? 0 : 20, rank: 120 }];
    },
    budget: async () => ({ spent, cap }),
  });

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    r = await import("@/lib/site-crawler/metrics-runner");
    await prisma.tenant.create({ data: { id: tenantId, name: "bl", slug: tenantId, planType: "GROWTH" } });
    await prisma.crawlJob.create({
      data: { id: job, tenantId, rootUrl: url(""), urlCap: 10, status: "COMPLETED", summary: {}, config: { addData: { psi: null, backlinks: { pages: 4, segment: null } } } },
    });
    const page = (p: string, inlinks: number, statusCode: number, over: Record<string, unknown> = {}) =>
      prisma.crawlPage.create({ data: { crawlJobId: job, url: url(p), depth: 1, statusCode, inlinkCount: inlinks, ...over } });
    await page("gone", 30, 404);
    await page("moved", 20, 301, { redirectTarget: url("new") });
    await page("quiet", 10, 404);
    await page("ok", 5, 200);
    await page("tail", 1, 404);
  });
  afterAll(async () => {
    await prisma?.tenant.delete({ where: { id: tenantId } }).catch(() => {});
  });

  it("stops at the USD cap and says so; judges only the pages it looked up", async () => {
    // Cap after two lookups: 0.06 spent ≥ 0.05.
    let tick = await r.runCrawlMetrics(job, deps(0.05));
    while (!tick.done) tick = await r.runCrawlMetrics(job, deps(0.05));
    expect(looked).toEqual([url("gone"), url("moved")]);
    const row = await prisma.crawlJob.findUnique({ where: { id: job }, select: { summary: true, issueCount: true } });
    expect((row!.summary as { metrics: { backlinks: unknown } }).metrics.backlinks).toMatchObject({ status: "stopped", stoppedReason: "usd_cap", targets: 4, completed: 2 });
    const fired = async (rule: string) =>
      (await prisma.crawlIssue.findMany({ where: { crawlJobId: job, ruleId: rule }, include: { crawlPage: { select: { url: true } } } })).map((i) => i.crawlPage.url);
    expect(await fired("backlinks.page_with_links_is_broken")).toEqual([url("gone")]);
    expect(await fired("backlinks.page_with_links_redirects")).toEqual([url("moved")]);
    expect(row!.issueCount).toBe(2);
    const data = await prisma.crawlPageMetric.findFirst({ where: { crawlJobId: job, source: "backlinks", page: { url: url("gone") } } });
    expect(data!.data).toEqual({ referringDomains: 4, backlinks: 20, rank: 120 });
    // Stopped is settled: another tick spends nothing.
    expect(await r.runCrawlMetrics(job, deps(100))).toEqual({ done: true });
    expect(looked).toHaveLength(2);
  });

  it("the estimate uses the last metered unit cost, else the observed one", async () => {
    const { backlinkUnitCostUsd, OBSERVED_BACKLINK_UNIT_USD } = await import("@/lib/site-crawler/backlink-cost");
    const before = await backlinkUnitCostUsd();
    expect(before).toBeGreaterThan(0);
    await prisma.seoApiCall.create({ data: { tenantId, feature: "backlinks", path: "v3/backlinks/summary/live", costUsd: 0.0311, ok: true } });
    expect(await backlinkUnitCostUsd()).toBeCloseTo(0.0311);
    expect(OBSERVED_BACKLINK_UNIT_USD).toBeCloseTo(0.024036);
  });
});
