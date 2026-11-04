// tests/site-crawler-metrics-inspection.db.test.ts — Phase 4g URL Inspection
// against Postgres: the top N HTML pages inspected once each (rows <= N in
// crawl_page_metrics source gsc_inspection), the quota reserved before every
// call (the step stops at the daily limit and says so), the three
// search_console rules on the inspected pages; a property that does not
// cover the host stops it. SKIPPED UNLESS TEST_DATABASE_URL IS SET.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;
vi.mock("server-only", () => ({}));

describe.skipIf(!TEST_DB)("URL Inspection against Postgres", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let r: typeof import("@/lib/site-crawler/metrics-runner");
  const tenantId = `t_ins_${Date.now()}`;
  const url = (p: string) => `https://ins.example/${p}`;
  const result = (p: string) => ({
    verdict: p === "lost" ? "NEUTRAL" : "PASS",
    coverageState: p === "lost" ? "Crawled - currently not indexed" : "Submitted and indexed",
    indexingState: "INDEXING_ALLOWED",
    robotsTxtState: p === "walled" ? "DISALLOWED" : "ALLOWED",
    pageFetchState: "SUCCESSFUL",
    googleCanonical: p === "dupe" ? url("main") : url(p),
    lastCrawlTime: "2026-10-30T08:00:00Z",
    mobileUsability: "PASS",
    richResults: null,
  });
  let inspected: string[] = [];
  let budget = Infinity;
  const deps = (siteUrl = "sc-domain:ins.example") => ({
    gscConnection: async () => ({ status: "ACTIVE", siteUrl }),
    reserveInspection: async () => (budget-- > 0 ? { ok: true as const } : { ok: false as const, reason: "daily_quota" as const }),
    inspect: async (_t: string, _s: string, u: string) => (inspected.push(u), result(u.split("/").pop()!)),
  });
  const makeJob = async (id: string, names: string[], pages: number) => {
    await prisma.crawlJob.create({ data: { id, tenantId, rootUrl: url(""), urlCap: 50, status: "COMPLETED", summary: {}, config: { inspection: { pages, segment: null } } } });
    for (const [i, n] of names.entries()) {
      await prisma.crawlPage.create({ data: { crawlJobId: id, url: url(n), canonical: url(n), depth: 1, statusCode: 200, contentType: "text/html", noindex: false, inlinkCount: 50 - i } });
    }
  };
  const run = async (id: string, d: ReturnType<typeof deps>) => {
    let tick = await r.runCrawlMetrics(id, d as never);
    while (!tick.done) tick = await r.runCrawlMetrics(id, d as never);
    return ((await prisma.crawlJob.findUnique({ where: { id }, select: { summary: true } }))!.summary as { metrics: { gsc_inspection: Record<string, unknown> } }).metrics.gsc_inspection;
  };
  const fired = async (id: string, rule: string) =>
    (await prisma.crawlIssue.findMany({ where: { crawlJobId: id, ruleId: rule }, include: { crawlPage: { select: { url: true } } } })).map((i) => i.crawlPage.url).sort();

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    r = await import("@/lib/site-crawler/metrics-runner");
    await prisma.tenant.create({ data: { id: tenantId, name: "ins", slug: tenantId, planType: "GROWTH" } });
  });
  afterAll(async () => {
    await prisma?.tenant.delete({ where: { id: tenantId } }).catch(() => {});
  });

  it("inspects the top N once each, stores the nine fields, runs the three rules", async () => {
    const id = `${tenantId}_a`;
    await makeJob(id, ["lost", "walled", "dupe", "fine", "tail"], 4);
    inspected = [];
    budget = Infinity;
    const st = await run(id, deps());
    expect(st).toMatchObject({ status: "done", targets: 4, completed: 4 });
    expect(inspected.sort()).toEqual([url("dupe"), url("fine"), url("lost"), url("walled")]);
    const rows = await prisma.crawlPageMetric.findMany({ where: { crawlJobId: id, source: "gsc_inspection" }, select: { data: true } });
    expect(rows.length).toBeLessThanOrEqual(4);
    expect(rows[0]!.data).toHaveProperty("lastCrawlTime");
    expect(await fired(id, "gsc.not_indexed_with_inlinks")).toEqual([url("lost")]);
    expect(await fired(id, "gsc.blocked_for_google")).toEqual([url("walled")]);
    expect(await fired(id, "gsc.google_canonical_differs")).toEqual([url("dupe")]);
    inspected = [];
    await run(id, deps());
    expect(inspected).toEqual([]);
  });

  it("stops at the daily quota and says so", async () => {
    const id = `${tenantId}_b`;
    await makeJob(id, ["p1", "p2", "p3"], 3);
    inspected = [];
    budget = 2;
    const st = await run(id, deps());
    expect(inspected).toHaveLength(2);
    expect(st).toMatchObject({ status: "stopped", stoppedReason: "daily_quota", completed: 2 });
  });

  it("stops when the property does not cover the host", async () => {
    const id = `${tenantId}_c`;
    await makeJob(id, ["p1"], 1);
    inspected = [];
    budget = Infinity;
    const st = await run(id, deps("https://other.example/"));
    expect(inspected).toEqual([]);
    expect(st).toMatchObject({ status: "stopped", stoppedReason: "not_covered" });
  });
});
