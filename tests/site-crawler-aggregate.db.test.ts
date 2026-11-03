// tests/site-crawler-aggregate.db.test.ts
//
// Aggregation against a real Postgres: the site facts are SQL (duplicate
// groups, the canonical / hreflang / pagination joins, SimHash banding, the
// inlink flush), so only a database can say they are right.
//
// SKIPPED UNLESS TEST_DATABASE_URL IS SET — see tests/ai-search-roundtrip.db.test.ts
// for why: the one configured DATABASE_URL is production.
//
//   DATABASE_URL=<empty test db> npx prisma migrate deploy
//   TEST_DATABASE_URL=<same url> npx vitest run tests/site-crawler-aggregate.db.test.ts

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

vi.mock("server-only", () => ({}));

const ROOT = "https://agg.example/";
const u = (path: string) => new URL(path, ROOT).toString().replace(/\/$/, path === "/" ? "/" : "");

/** Well-spread 64-bit values (golden-ratio multiplier): no two within 3 bits by accident. */
const spread = (i: number) => BigInt.asIntN(64, BigInt(i) * BigInt("0x9E3779B97F4A7C15"));

/** Hash-only fake Redis: what aggregation reads (HSCAN, HGET). */
function fakeRedis(hashes: Record<string, Record<string, string>>) {
  return {
    async hscan(key: string, cursor: string) {
      if (cursor !== "0") return ["0", []];
      return ["0", Object.entries(hashes[key] ?? {}).flat()];
    },
    async hget(key: string, field: string) {
      return hashes[key]?.[field] ?? null;
    },
  };
}

describe.skipIf(!TEST_DB)("aggregateCrawl against Postgres", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let aggregateCrawl: typeof import("@/lib/site-crawler/aggregate").aggregateCrawl;
  const tenantId = `t_agg_${Date.now()}`;
  const jobId = `j_agg_${Date.now()}`;
  let summary: Awaited<ReturnType<typeof aggregateCrawl>>["summary"];
  let firstCount = 0;
  let redis: ReturnType<typeof fakeRedis>;

  const rulesOn = async (path: string) =>
    (
      await prisma.crawlIssue.findMany({
        where: { crawlJobId: jobId, crawlPage: { url: u(path) } },
        select: { ruleId: true },
      })
    ).map((r) => r.ruleId);

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    ({ aggregateCrawl } = await import("@/lib/site-crawler/aggregate"));
    await prisma.tenant.create({ data: { id: tenantId, name: "agg", slug: tenantId } });
    await prisma.crawlJob.create({ data: { id: jobId, tenantId, rootUrl: ROOT, urlCap: 100 } });

    const page = (path: string, over: Record<string, unknown> = {}) => ({
      crawlJobId: jobId,
      url: u(path),
      depth: 1,
      statusCode: 200,
      contentType: "text/html; charset=utf-8",
      title: `Title of ${path}`,
      canonical: u(path),
      contentHash: `hash-${path}`,
      simhash: null,
      noindex: false,
      ...over,
    });
    await prisma.crawlPage.createMany({
      data: [
        page("/", { depth: 0, simhash: spread(1) }),
        // duplicate titles; the 404 sharing the title is ignored
        page("/dup1", { title: "Same title", simhash: spread(2) }),
        page("/dup2", { title: "Same title", simhash: spread(3) }),
        page("/gone", { title: "Same title", statusCode: 404, simhash: null }),
        // exact duplicate content
        page("/copy1", { contentHash: "same", simhash: BigInt("0x1111000000000000") }),
        page("/copy2", { contentHash: "same", simhash: BigInt("0x1111000000000000") }),
        // near duplicates: one bit apart, different content hashes
        page("/near1", { simhash: BigInt("0x2222222222222222") }),
        page("/near2", { simhash: BigInt("0x2222222222222223") }),
        // canonical to a 404
        page("/canon", { canonical: u("/gone"), simhash: spread(4) }),
        // hreflang: en names fr, fr does not name en back
        page("/en", { langAttr: "en", hreflang: [{ lang: "en", href: u("/en") }, { lang: "fr", href: u("/fr") }], simhash: spread(5) }),
        page("/fr", { langAttr: "fr", hreflang: [], simhash: spread(6) }),
        // pagination: p1 → p2, but p2 has no rel=prev back
        page("/p1", { relNext: u("/p2"), simhash: spread(7) }),
        page("/p2", { simhash: spread(8) }),
        // a redirect loop
        page("/r1", { statusCode: 301, redirectTarget: u("/r2"), contentType: null, simhash: null }),
        page("/r2", { statusCode: 301, redirectTarget: u("/r1"), contentType: null, simhash: null }),
        // linked only with nofollow; and a sitemap orphan
        page("/nf", { simhash: spread(9) }),
        page("/orph", { depth: 0, simhash: spread(10) }),
      ] as never,
    });

    redis = fakeRedis({
      [`crawl:${jobId}:inlinks`]: { [u("/dup1")]: "1", [u("/en")]: "3", [u("/r1")]: "1" },
      [`crawl:${jobId}:nofollow`]: { [u("/nf")]: "2" },
      [`crawl:${jobId}:firstsource`]: { [u("/r1")]: ROOT },
    });
    const run = () =>
      aggregateCrawl({
        jobId,
        rootUrl: ROOT,
        redis: redis as never,
        sitemap: { found: false, urls: [], filesFetched: 0, truncated: false },
        sitemapSeeded: new Set([u("/orph")]),
      });
    summary = (await run()).summary;
    firstCount = await prisma.crawlIssue.count({ where: { crawlJobId: jobId } });
  }, 60_000);

  afterAll(async () => {
    if (!TEST_DB) return;
    await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("flags every member of a duplicate-title group, ignoring non-200 pages", async () => {
    expect(await rulesOn("/dup1")).toContain("page_titles.duplicate");
    expect(await rulesOn("/dup2")).toContain("page_titles.duplicate");
    expect(await rulesOn("/gone")).not.toContain("page_titles.duplicate");
  });

  it("finds exact and near duplicates, and keeps them apart", async () => {
    expect(await rulesOn("/copy1")).toContain("content.exact_duplicate");
    expect(await rulesOn("/copy1")).not.toContain("content.near_duplicate");
    expect(await rulesOn("/near1")).toContain("content.near_duplicate");
    expect(await rulesOn("/near2")).toContain("content.near_duplicate");
    expect(await rulesOn("/dup1")).not.toContain("content.near_duplicate");
    expect(summary.duplicates.nearContent).toBe(2);
  });

  it("judges a canonical by its target row", async () => {
    expect(await rulesOn("/canon")).toEqual(expect.arrayContaining(["canonicals.to_error"]));
  });

  it("finds a missing hreflang return link", async () => {
    expect(await rulesOn("/en")).toContain("hreflang.missing_return_links");
    expect(await rulesOn("/fr")).not.toContain("hreflang.missing_return_links");
  });

  it("finds a pagination sequence error", async () => {
    expect(await rulesOn("/p1")).toContain("pagination.sequence_error");
  });

  it("finds the redirect loop, and credits the page that linked to it", async () => {
    expect(await rulesOn("/r1")).toContain("response_codes.redirect_loop");
    expect(await rulesOn("/r2")).toContain("response_codes.redirect_loop");
    expect(await rulesOn("/")).toContain("links.outlinks_to_redirect");
    expect(await rulesOn("/r1")).toContain("response_codes.inlinks_to_3xx");
  });

  it("flushes inlink counts and nofollow-only pages", async () => {
    const rows = await prisma.crawlPage.findMany({ where: { crawlJobId: jobId }, select: { url: true, inlinkCount: true, nofollowInlinkCount: true } });
    const by = Object.fromEntries(rows.map((r) => [r.url, r]));
    expect(by[u("/en")]).toMatchObject({ inlinkCount: 3, nofollowInlinkCount: 0 });
    expect(by[u("/nf")]).toMatchObject({ inlinkCount: 0, nofollowInlinkCount: 2 });
    expect(await rulesOn("/nf")).toContain("links.inlinks_only_nofollow");
    expect(await rulesOn("/dup1")).toContain("links.only_one_inlink");
  });

  it("finds the sitemap orphan, and puts job-level findings on the root only", async () => {
    expect(await rulesOn("/orph")).toContain("links.orphan");
    expect(await rulesOn("/")).toContain("sitemaps.missing");
    expect(await rulesOn("/dup1")).not.toContain("sitemaps.missing");
  });

  it("writes rows with rule id, kind, priority and job id; the summary tallies them by rule and kind", async () => {
    const row = await prisma.crawlIssue.findFirst({ where: { crawlJobId: jobId, ruleId: "page_titles.duplicate" } });
    expect(row).toMatchObject({ type: "page_titles.duplicate", kind: "issue", priority: "medium", severity: "ERROR" });
    expect(summary.issues!["page_titles.duplicate"]).toEqual({ count: 2, kind: "issue", priority: "medium" });
    const total = Object.values(summary.issuesByKind!).reduce((a, b) => a + b, 0);
    expect(total).toBe(firstCount);
  });

  it("is idempotent: a second run writes the same number of rows", async () => {
    await aggregateCrawl({
      jobId,
      rootUrl: ROOT,
      redis: redis as never,
      sitemap: { found: false, urls: [], filesFetched: 0, truncated: false },
      sitemapSeeded: new Set([u("/orph")]),
    });
    expect(await prisma.crawlIssue.count({ where: { crawlJobId: jobId } })).toBe(firstCount);
  });
});
