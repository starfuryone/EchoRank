// tests/site-crawler-segments.db.test.ts
//
// Phase 4b segments against a real Postgres: segmentIds (smallint[]) filters,
// the per-segment Overview and per-rule counts (unnest), the duplicates and
// broken-link SQL with a segment clause, and extractions going with their page.
//
// SKIPPED UNLESS TEST_DATABASE_URL IS SET (the configured DATABASE_URL is
// production). See tests/site-crawler-aggregate.db.test.ts for the recipe.

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

vi.mock("server-only", () => ({}));
const requirePaidPlan = vi.fn();
vi.mock("@/lib/paid-plan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paid-plan")>()),
  requirePaidPlan: () => requirePaidPlan(),
}));

const ROOT = "https://seg.example.com/";
const u = (path: string) => new URL(path, ROOT).toString();

describe.skipIf(!TEST_DB)("segments against Postgres", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let f: typeof import("@/lib/site-crawler/segment-filter");
  let g: typeof import("@/lib/site-crawler/link-graph");
  const tenantId = `t_seg_${Date.now()}`;
  const jobId = `j_seg_${Date.now()}`;
  const defs = [
    { name: "Blog", rule: { kind: "urlPattern" as const, pattern: "/blog/*" } },
    { name: "Shop", rule: { kind: "urlPattern" as const, pattern: "/shop/*" } },
  ];
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    f = await import("@/lib/site-crawler/segment-filter");
    g = await import("@/lib/site-crawler/link-graph");
    await prisma.tenant.create({ data: { id: tenantId, name: "seg", slug: tenantId } });
    await prisma.crawlJob.create({
      data: { id: jobId, tenantId, rootUrl: ROOT, urlCap: 100, status: "COMPLETED", config: { segments: defs } },
    });
    const pages: [string, number, number[], string | null][] = [
      ["/", 200, [], "Home"],
      ["/blog/a", 200, [0], "Same title"],
      ["/blog/b", 200, [0], "Same title"],
      ["/shop/x", 200, [1], "Same title"],
      ["/blog/gone", 404, [0], null],
    ];
    for (const [path, statusCode, segmentIds, title] of pages) {
      const p = await prisma.crawlPage.create({
        data: { crawlJobId: jobId, url: u(path), statusCode, fetchMs: 5, depth: 1, segmentIds, title, contentType: "text/html" },
      });
      ids[path] = p.id;
    }
    const issue = (path: string, ruleId: string, severity: string) => ({
      crawlPageId: ids[path]!, crawlJobId: jobId, type: ruleId, ruleId, severity,
    });
    await prisma.crawlIssue.createMany({
      data: [
        issue("/blog/a", "page_titles.duplicate", "WARNING"),
        issue("/blog/b", "page_titles.duplicate", "WARNING"),
        issue("/shop/x", "page_titles.duplicate", "WARNING"),
        issue("/blog/gone", "response_codes.internal_4xx", "ERROR"),
      ],
    });
    await prisma.crawlLink.createMany({
      data: [
        { crawlJobId: jobId, fromPageId: ids["/blog/a"]!, toUrl: u("/blog/gone"), position: 0 },
        { crawlJobId: jobId, fromPageId: ids["/shop/x"]!, toUrl: u("/blog/gone"), position: 0 },
      ],
    });
    await g.resolveLinkGraph(jobId);
    await prisma.crawlExtraction.create({ data: { crawlJobId: jobId, pageId: ids["/shop/x"]!, extractorIndex: 0, values: ["9.90"] } });
  });

  afterAll(async () => {
    await prisma?.tenant.delete({ where: { id: tenantId } }).catch(() => {});
  });

  it("filters pages by segmentIds", async () => {
    const n = await prisma.crawlPage.count({ where: { crawlJobId: jobId, ...f.pageInSegment({ defs, index: 0 }) } });
    expect(n).toBe(3);
  });

  it("counts pages and issue totals per segment", async () => {
    expect(await f.segmentOverview(jobId, defs)).toEqual([
      { index: 0, name: "Blog", pages: 3, totals: { ERROR: 1, WARNING: 2, NOTICE: 0 } },
      { index: 1, name: "Shop", pages: 1, totals: { ERROR: 0, WARNING: 1, NOTICE: 0 } },
    ]);
  });

  it("counts findings per rule per segment", async () => {
    expect(await f.ruleCountsBySegment(jobId, defs)).toEqual({
      "page_titles.duplicate": [2, 1],
      "response_codes.internal_4xx": [1, 0],
    });
  });

  it("narrows severity totals and issue filters to one segment", async () => {
    expect(await f.segmentIssueTotals(jobId, { defs, index: 1 })).toEqual({ ERROR: 0, WARNING: 1, NOTICE: 0 });
    const n = await prisma.crawlIssue.count({ where: { crawlPage: { crawlJobId: jobId }, severity: "WARNING", ...f.issueInSegment({ defs, index: 0 }) } });
    expect(n).toBe(2);
  });

  it("broken links: the source page's segment", async () => {
    const blog = await g.brokenLinksPage(jobId, null, 100, 0);
    expect(blog.map((r) => [r.source, r.segmentIds])).toEqual([[u("/blog/a"), [0]]]);
    expect(await g.brokenLinksPage(jobId, null, 100, null)).toHaveLength(2);
  });

  it("duplicates route: groups count members inside the segment only", async () => {
    requirePaidPlan.mockResolvedValue({ tenantId, tenant: { planType: "GROWTH" } });
    const { GET } = await import("@/app/api/seo/v1/crawl/[id]/duplicates/route");
    const call = async (q: string) =>
      (await GET(new Request(`https://app.test/api/seo/v1/crawl/${jobId}/duplicates?type=title${q}`), { params: Promise.resolve({ id: jobId }) })).json();
    const all = await call("");
    expect(all.groups?.[0], JSON.stringify(all)).toMatchObject({ value: "Same title", members: 3 });
    expect((await call("&segment=0")).groups[0]).toMatchObject({ value: "Same title", members: 2 });
    expect((await call("&segment=1")).groups).toEqual([]);
    expect((await call("&segment=1")).total).toBe(0);
  });

  it("extraction rows go with their page", async () => {
    await prisma.crawlPage.delete({ where: { id: ids["/shop/x"]! } });
    expect(await prisma.crawlExtraction.count({ where: { crawlJobId: jobId } })).toBe(0);
  });
});
