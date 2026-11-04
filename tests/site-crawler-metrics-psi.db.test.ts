// tests/site-crawler-metrics-psi.db.test.ts — the Phase 4d PageSpeed opt-in
// against Postgres: top N pages by inlinks (HTML, indexable), mobile and
// desktop through runAudit, a spent hourly allowance that makes the job wait
// instead of fail, a failed run recorded per strategy, then the "psi" rules
// re-run on the newest runs (replacing earlier findings) and the summary
// re-tallied. SKIPPED UNLESS TEST_DATABASE_URL IS SET.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;
vi.mock("server-only", () => ({}));

describe.skipIf(!TEST_DB)("PSI opt-in against Postgres", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let r: typeof import("@/lib/site-crawler/metrics-runner");
  let RateLimited: typeof import("@/lib/lighthouse/service").LighthouseRateLimitedError;
  const tenantId = `t_psi_${Date.now()}`;
  const job = `${tenantId}_j`;
  const url = (p: string) => `https://psi.example/${p}`;
  let calls: string[] = [];
  let limitAfter = Infinity;

  async function runAudit(t: string, params: { url: string; strategy: "mobile" | "desktop" }) {
    if (calls.length >= limitAfter) throw new RateLimited(20);
    calls.push(`${params.url}|${params.strategy}`);
    if (params.url.endsWith("/b") && params.strategy === "desktop") throw new Error("PSI could not load the page");
    const fetchedAt = new Date();
    // What runAudit persists: the row the 3c rules (and the new mobile rule) read.
    await prisma.lighthouseAudit.create({
      data: { tenantId: t, url: params.url, strategy: params.strategy, scores: {}, metrics: [], opportunities: [], audits: { viewport: { score: 0, value: null, display: null } }, lighthouseVersion: "13.0.1", fetchedAt },
    });
    return {
      cached: false,
      audit: {
        id: "x", url: params.url, strategy: params.strategy, opportunities: [], lighthouseVersion: "13.0.1", fetchedAt: fetchedAt.toISOString(),
        scores: { performance: 71, accessibility: 90, bestPractices: 100, seo: 92 },
        metrics: [{ key: "LCP" as const, value: 2400, display: "2.4 s", score: 80 }, { key: "CLS" as const, value: 0.05, display: "0.05", score: 95 }],
        crux: { overall: "AVERAGE" as const, originFallback: false, metrics: [{ key: "INP", p75: 180, category: "FAST" as const, distribution: [0.8, 0.1, 0.1] as [number, number, number] }] },
      },
    };
  }
  const deps = () => ({ runAudit: runAudit as never, msUntilNextAudit: async () => 123_000 });

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    r = await import("@/lib/site-crawler/metrics-runner");
    ({ LighthouseRateLimitedError: RateLimited } = await import("@/lib/lighthouse/service"));
    await prisma.tenant.create({ data: { id: tenantId, name: "psi", slug: tenantId, planType: "GROWTH" } });
    await prisma.crawlJob.create({
      data: { id: job, tenantId, rootUrl: url(""), urlCap: 10, status: "COMPLETED", summary: { totals: { ERROR: 0, WARNING: 0, NOTICE: 0 } }, config: { addData: { psi: { pages: 2, segment: null }, backlinks: null } } },
    });
    const page = (p: string, inlinks: number, over: Record<string, unknown> = {}) =>
      prisma.crawlPage.create({ data: { crawlJobId: job, url: url(p), depth: 1, statusCode: 200, contentType: "text/html", inlinkCount: inlinks, noindex: false, ...over } });
    await page("a", 9);
    await page("b", 5);
    await page("c", 1);
    await page("pdf", 50, { contentType: "application/pdf" });
    await page("gone", 40, { statusCode: 404 });
    // An earlier finding from a run attached at aggregation: replaced, not doubled.
    const a = await prisma.crawlPage.findFirst({ where: { crawlJobId: job, url: url("a") } });
    await prisma.crawlIssue.create({ data: { crawlPageId: a!.id, crawlJobId: job, type: "mobile.lighthouse_usability_low", ruleId: "mobile.lighthouse_usability_low", severity: "WARNING", kind: "warning", priority: "medium" } });
  });
  afterAll(async () => {
    await prisma?.lighthouseAudit.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma?.tenant.delete({ where: { id: tenantId } }).catch(() => {});
  });

  it("targets the top N indexable HTML pages by inlinks", async () => {
    const pages = await r.targetPages(job, { pages: 2, segment: null }, { htmlOnly: true });
    expect(pages.map((p) => p.url)).toEqual([url("a"), url("b")]);
  });

  it("runs a few audits per tick, waits for the allowance when it is spent, then finishes", async () => {
    calls = [];
    limitAfter = 3;
    expect(await r.runCrawlMetrics(job, deps())).toEqual({ done: false, delayMs: 123_000 });
    expect(calls).toHaveLength(3);
    let row = await prisma.crawlJob.findUnique({ where: { id: job }, select: { summary: true, issueCount: true } });
    expect((row!.summary as { metrics: { psi: { status: string } } }).metrics.psi).toMatchObject({ status: "waiting_quota", targets: 2, completed: 3, failed: 0 });

    limitAfter = Infinity;
    let tick = await r.runCrawlMetrics(job, deps());
    while (!tick.done) tick = await r.runCrawlMetrics(job, deps());
    expect(new Set(calls).size).toBe(4); // each page × strategy exactly once
    row = await prisma.crawlJob.findUnique({ where: { id: job }, select: { summary: true, issueCount: true } });
    expect((row!.summary as { metrics: { psi: unknown } }).metrics.psi).toMatchObject({ status: "done", targets: 2, completed: 4, failed: 1 });

    const metrics = await prisma.crawlPageMetric.findMany({ where: { crawlJobId: job, source: "psi" }, include: { page: { select: { url: true } } } });
    const byUrl = Object.fromEntries(metrics.map((m) => [m.page.url, m.data as Record<string, Record<string, unknown>>]));
    expect(byUrl[url("a")]!.mobile).toMatchObject({ performance: 71, lcpMs: 2400, cls: 0.05, fieldInpMs: 180 });
    expect(byUrl[url("b")]!.desktop).toEqual({ error: "PSI could not load the page" });

    const usability = await prisma.crawlIssue.findMany({ where: { crawlJobId: job, ruleId: "mobile.lighthouse_usability_low" } });
    expect(usability).toHaveLength(2); // a and b, once each
    expect(row!.issueCount).toBe(await prisma.crawlIssue.count({ where: { crawlJobId: job } }));
    expect((row!.summary as { totals: { WARNING: number } }).totals.WARNING).toBe(2);
  });

  it("a finished opt-in does nothing on another tick", async () => {
    calls = [];
    expect(await r.runCrawlMetrics(job, deps())).toEqual({ done: true });
    expect(calls).toEqual([]);
  });
});
