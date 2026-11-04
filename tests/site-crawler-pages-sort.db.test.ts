// tests/site-crawler-pages-sort.db.test.ts — the Pages tab sorted by a joined
// metric against Postgres: numeric values only, missing rows and failed runs
// last, both directions, paging, and every Pages filter restated in SQL
// (a LIKE-special character in the URL prefix stays literal).
// SKIPPED UNLESS TEST_DATABASE_URL IS SET.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;
vi.mock("server-only", () => ({}));

describe.skipIf(!TEST_DB)("metric sort against Postgres", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let s: typeof import("@/lib/site-crawler/pages-sort");
  const tenantId = `t_sort_${Date.now()}`;
  const job = `${tenantId}_j`;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    s = await import("@/lib/site-crawler/pages-sort");
    await prisma.tenant.create({ data: { id: tenantId, name: "sort", slug: tenantId, planType: "GROWTH" } });
    await prisma.crawlJob.create({ data: { id: job, tenantId, rootUrl: "https://s.example/", urlCap: 10, status: "COMPLETED" } });
    const pages: [string, string, Record<string, unknown>, unknown][] = [
      ["a", "https://s.example/blog/a", { depth: 1, inSitemap: true, inlinkCount: 5, segmentIds: [0], searchHits: { "0": 2 } }, { gsc: { clicks: 10 }, psi: { mobile: { lcpMs: 1800 } } }],
      ["b", "https://s.example/blog/b", { depth: 2, inSitemap: true, inlinkCount: 1, segmentIds: [0], searchHits: { "0": 0 } }, { gsc: { clicks: 30 }, psi: { mobile: { error: "x" } } }],
      ["c", "https://s.example/shop/c", { depth: 1, inSitemap: false, inlinkCount: 9, segmentIds: [], searchHits: { "0": 1 } }, { gsc: { clicks: 0 } }],
      ["d", "https://s.example/100%_off", { depth: 1, inSitemap: false, inlinkCount: 0, segmentIds: [] }, {}],
      ["e", "https://s.example/100xyoff", { depth: 1, inSitemap: false, inlinkCount: 0, segmentIds: [] }, {}],
    ];
    for (const [k, url, over, metrics] of pages) {
      const p = await prisma.crawlPage.create({ data: { crawlJobId: job, url, statusCode: 200, ...over } as never });
      ids[k] = p.id;
      for (const [source, data] of Object.entries(metrics as Record<string, unknown>)) {
        await prisma.crawlPageMetric.create({ data: { crawlJobId: job, pageId: p.id, source: source as never, data: data as object } });
      }
    }
  });
  afterAll(async () => {
    await prisma?.tenant.delete({ where: { id: tenantId } }).catch(() => {});
  });
  const name = (list: string[]) => list.map((id) => Object.keys(ids).find((k) => ids[k] === id));

  it("orders by the metric, missing rows last, both directions, paged", async () => {
    expect(name(await s.pageIdsByMetric({ jobId: job }, "gsc.clicks", "desc", 0, 10))).toEqual(["b", "a", "c", expect.any(String), expect.any(String)]);
    expect(name(await s.pageIdsByMetric({ jobId: job }, "gsc.clicks", "asc", 0, 3))).toEqual(["c", "a", "b"]);
    expect(name(await s.pageIdsByMetric({ jobId: job }, "gsc.clicks", "desc", 1, 1))).toEqual(["a"]);
  });

  it("a failed run ({error}) sorts with the missing", async () => {
    expect(name(await s.pageIdsByMetric({ jobId: job }, "psi.mobile.lcpMs", "desc", 0, 1))).toEqual(["a"]);
  });

  it.each([
    [{ inSitemap: true }, ["b", "a"]],
    [{ depth: 2 }, ["b"]],
    [{ minInlinks: 5 }, ["a", "c"]],
    [{ maxInlinks: 1, inSitemap: true }, ["b"]],
    [{ search: { index: 0, hit: true } }, ["a", "c"]],
    [{ search: { index: 0, hit: false } }, ["b"]],
    [{ urlPrefix: "https://s.example/blog/" }, ["b", "a"]],
    [{ segment: 0 }, ["b", "a"]],
  ] as const)("filter %j", async (f, want) => {
    const got = name(await s.pageIdsByMetric({ jobId: job, ...f }, "gsc.clicks", "desc", 0, 10));
    expect(got.slice(0, want.length)).toEqual(want);
    expect(got).toHaveLength(want.length);
  });

  it("a % or _ in the prefix is literal", async () => {
    expect(name(await s.pageIdsByMetric({ jobId: job, urlPrefix: "https://s.example/100%_" }, "gsc.clicks", "desc", 0, 10))).toEqual(["d"]);
    expect(s.likePrefix("a%b_c\\")).toBe("a\\%b\\_c\\\\%");
  });
});
