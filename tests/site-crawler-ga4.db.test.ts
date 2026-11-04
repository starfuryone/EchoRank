// tests/site-crawler-ga4.db.test.ts — GA4 joined at aggregation against
// Postgres (crawl.ga4 mocked on): landing pages matched to crawled URLs, the
// zero-sessions opportunity, and the converting page that carries a
// high-priority finding — one written during the crawl (page scope) and one
// found in the same aggregation pass (site scope).
// SKIPPED UNLESS TEST_DATABASE_URL IS SET.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;
vi.mock("server-only", () => ({}));
vi.mock("@/lib/flags", async (orig) => {
  const real = await orig<typeof import("@/lib/flags")>();
  return { ...real, flag: (n: string) => n === "crawl.ga4" || (real.FLAGS as Record<string, boolean>)[n] === true && n !== "crawl.gsc" };
});
vi.mock("@/lib/gsc/service", () => ({
  getConnection: async () => ({ status: "ACTIVE", siteUrl: null, ga4PropertyId: "properties/42" }),
  withAccessToken: (_c: unknown, fn: (t: string) => unknown) => fn("tok"),
  latestAvailableDay: () => "2026-11-01",
}));
vi.mock("@/lib/ga4/client", async (orig) => ({
  ...(await orig<typeof import("@/lib/ga4/client")>()),
  landingPageReport: async () => ({
    rows: [
      { hostName: "ga.example", landingPage: "/buy", sessions: 50, totalUsers: 40, engagementRate: 0.7, keyEvents: 4 },
      { hostName: "ga.example", landingPage: "/canon", sessions: 9, totalUsers: 9, engagementRate: 0.5, keyEvents: 1 },
    ],
    rowCount: 2,
  }),
}));

describe.skipIf(!TEST_DB)("GA4 join against Postgres", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  const tenantId = `t_ga4_${Date.now()}`;
  const jobId = `${tenantId}_j`;
  const ROOT = "https://ga.example/";
  const u = (p: string) => `https://ga.example${p}`;
  const fakeRedis = { hscan: async () => ["0", []], hget: async () => null };

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    await prisma.tenant.create({ data: { id: tenantId, name: "ga4", slug: tenantId, planType: "GROWTH" } });
    await prisma.crawlJob.create({ data: { id: jobId, tenantId, rootUrl: ROOT, urlCap: 10 } });
    const page = (p: string, over: Record<string, unknown> = {}) =>
      prisma.crawlPage.create({ data: { crawlJobId: jobId, url: u(p), depth: 1, statusCode: 200, contentType: "text/html", noindex: false, canonical: u(p), title: `Title ${p}`, ...over } });
    const buy = await page("/buy");
    await page("/quiet");
    // A canonical to a noindex page: canonicals.to_noindex, a high-priority
    // site-scope finding made in the same aggregation pass.
    await page("/canon", { canonical: u("/hidden") });
    await page("/hidden", { noindex: true });
    // A high-priority page-scope finding written during the crawl.
    await prisma.crawlIssue.create({ data: { crawlPageId: buy.id, crawlJobId: jobId, type: "page_titles.missing", ruleId: "page_titles.missing", severity: "ERROR", kind: "issue", priority: "high" } });
  });
  afterAll(async () => {
    await prisma?.tenant.delete({ where: { id: tenantId } }).catch(() => {});
  });

  it("joins GA4 and runs the analytics rules in the aggregation pass", async () => {
    const { aggregateCrawl } = await import("@/lib/site-crawler/aggregate");
    const out = await aggregateCrawl({
      jobId,
      rootUrl: ROOT,
      redis: fakeRedis as never,
      sitemap: { found: false, urls: [], filesFetched: 0, truncated: false },
      sitemapSeeded: new Set(),
      tenantId,
    });
    expect(out.summary.metrics?.ga4).toMatchObject({ status: "ok", rows: 2, pages: 2 });
    const urls = async (rule: string) =>
      (await prisma.crawlIssue.findMany({ where: { crawlJobId: jobId, ruleId: rule }, include: { crawlPage: { select: { url: true } } } })).map((i) => i.crawlPage.url).sort();
    expect(await urls("canonicals.to_noindex")).toEqual([u("/canon")]);
    // /canon and /hidden are not indexable; /quiet is, with no sessions.
    expect(await urls("ga4.crawled_zero_sessions")).toEqual([u("/quiet")]);
    expect(await urls("ga4.converting_page_has_issues")).toEqual([u("/buy"), u("/canon")]);
  });
});
