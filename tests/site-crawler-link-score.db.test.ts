// tests/site-crawler-link-score.db.test.ts — Phase 4g Link Score against
// Postgres: aggregation computes PageRank over the resolved, followed
// internal edges and writes crawl_pages.linkScore (0–100), the bottom decile
// gets links.low_link_score, the Pages tab sorts by it and the CSV carries
// it. SKIPPED UNLESS TEST_DATABASE_URL IS SET.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;
vi.mock("server-only", () => ({}));
const requirePaidPlan = vi.fn();
vi.mock("@/lib/paid-plan", async (orig) => ({ ...(await orig<typeof import("@/lib/paid-plan")>()), requirePaidPlan: () => requirePaidPlan() }));
vi.mock("@/lib/gsc/service", () => ({ getConnection: async () => null }));

describe.skipIf(!TEST_DB)("Link Score against Postgres", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  const tenantId = `t_ls_${Date.now()}`;
  const job = `${tenantId}_j`;
  const u = (p: string) => `https://ls.example/${p}`;
  const names = ["", ...Array.from({ length: 11 }, (_, i) => `p${i}`), "lonely"];
  const id: Record<string, string> = {};

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    await prisma.tenant.create({ data: { id: tenantId, name: "ls", slug: tenantId, planType: "GROWTH" } });
    await prisma.crawlJob.create({ data: { id: job, tenantId, rootUrl: u(""), urlCap: 50, status: "COMPLETED" } });
    for (const n of names) {
      id[n] = (await prisma.crawlPage.create({ data: { crawlJobId: job, url: u(n), depth: n ? 1 : 0, statusCode: 200, contentType: "text/html", noindex: false, canonical: u(n), inlinkCount: 1 } })).id;
    }
    const edge = (from: string, to: string, extra: Record<string, unknown> = {}) => ({ crawlJobId: job, fromPageId: id[from]!, toPageId: id[to]!, toUrl: u(to), anchor: null, position: 0, ...extra });
    await prisma.crawlLink.createMany({
      data: [
        // The home page links every p*, every p* links home: home is the hub.
        ...names.filter((n) => n.startsWith("p")).flatMap((n) => [edge("", n), edge(n, "")]),
        // "lonely" is linked once, from a leaf, and links nowhere.
        edge("p9", "lonely"),
        // nofollow and external rows pass no rank.
        edge("p1", "lonely", { nofollow: true, position: 1 }),
        { crawlJobId: job, fromPageId: id["p2"]!, toPageId: null, toUrl: "https://out.example/", anchor: null, position: 2, isExternal: true },
      ],
    });
    const { aggregateCrawl } = await import("@/lib/site-crawler/aggregate");
    const redis = { hscan: async () => ["0", []], hget: async () => null, hset: async () => 0, expire: async () => 1 };
    await aggregateCrawl({ jobId: job, rootUrl: u(""), redis: redis as never, sitemap: { found: false, urls: [], filesFetched: 0, truncated: false }, sitemapSeeded: new Set() });
  }, 60_000);
  afterAll(async () => {
    await prisma?.tenant.delete({ where: { id: tenantId } }).catch(() => {});
  });

  it("writes 0–100 scores: the hub at 100, the barely linked page lowest", async () => {
    const rows = await prisma.crawlPage.findMany({ where: { crawlJobId: job }, select: { url: true, linkScore: true } });
    const s = Object.fromEntries(rows.map((r) => [r.url, r.linkScore]));
    expect(s[u("")]).toBe(100);
    expect(s[u("lonely")]).toBe(0);
    expect(rows.every((r) => r.linkScore !== null && r.linkScore >= 0 && r.linkScore <= 100)).toBe(true);
    const job2 = await prisma.crawlJob.findUnique({ where: { id: job }, select: { id: true } });
    expect(job2).not.toBeNull();
  });

  it("flags the bottom decile with links.low_link_score", async () => {
    const hits = await prisma.crawlIssue.findMany({ where: { crawlJobId: job, ruleId: "links.low_link_score" }, include: { crawlPage: { select: { url: true } } } });
    expect(hits.map((h) => h.crawlPage.url)).toEqual([u("lonely")]);
    expect(hits[0]!.evidence).toMatchObject({ score: 0, inlinks: 1 });
  });

  it("sorts the Pages tab by Link Score and puts it in the CSV", async () => {
    requirePaidPlan.mockResolvedValue({ tenantId, tenant: { planType: "GROWTH" } });
    const { GET } = await import("@/app/api/seo/v1/crawl/[id]/pages/route");
    const ctx = { params: Promise.resolve({ id: job }) };
    const asc = await (await GET(new Request("https://app.test/x?sort=linkScore&dir=asc&pageSize=2"), ctx)).json();
    expect(asc.pages.map((p: { url: string }) => p.url)[0]).toBe(u("lonely"));
    const desc = await (await GET(new Request("https://app.test/x?sort=linkScore&dir=desc&pageSize=1"), ctx)).json();
    expect(desc.pages[0]).toMatchObject({ url: u(""), linkScore: 100 });
    const csv = await (await GET(new Request("https://app.test/x?format=csv"), ctx)).text();
    expect(csv.split("\r\n")[0]).toContain(",Inlinks,In sitemap,Canonical,Redirect target,Content type,Found on,Link Score");
  });
});
