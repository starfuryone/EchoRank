// tests/site-crawler-compare.db.test.ts
//
// Crawl comparison against a real Postgres: buckets by SQL set operations,
// the staging → production URL mapping (and its agreement with the JS
// reference), per-segment comparison, keyset paging, the stored-row cache,
// and a mapping Postgres rejects.
// SKIPPED UNLESS TEST_DATABASE_URL IS SET (see site-crawler-aggregate.db.test.ts).

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

vi.mock("server-only", () => ({}));

describe.skipIf(!TEST_DB)("compare against Postgres", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let c: typeof import("@/lib/site-crawler/compare");
  let m: typeof import("@/lib/site-crawler/compare-mapping");
  const tenantId = `t_cmp_${Date.now()}`;
  const A = `${tenantId}_a`;
  const B = `${tenantId}_b`;
  const segs = { segments: [{ name: "Blog", rule: { kind: "urlPattern", pattern: "/blog/*" } }] };

  type P = { path: string; status?: number; title?: string; canonical?: string | null; noindex?: boolean; seg?: boolean; rules?: string[] };
  async function seed(jobId: string, host: string, pages: P[]) {
    for (const p of pages) {
      await prisma.crawlPage.create({
        data: {
          crawlJobId: jobId,
          url: `https://${host}${p.path}`,
          statusCode: p.status ?? 200,
          title: p.title ?? p.path,
          canonical: p.canonical ?? null,
          noindex: p.noindex ?? false,
          depth: 1,
          segmentIds: p.seg ? [0] : [],
          issues: { create: (p.rules ?? []).map((r) => ({ crawlJobId: jobId, type: r, ruleId: r, severity: "WARNING" })) },
        },
      });
    }
  }

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    c = await import("@/lib/site-crawler/compare");
    m = await import("@/lib/site-crawler/compare-mapping");
    await prisma.tenant.create({ data: { id: tenantId, name: "cmp", slug: tenantId, planType: "GROWTH" } });
    const job = (id: string, root: string, at: number) =>
      prisma.crawlJob.create({ data: { id, tenantId, rootUrl: root, urlCap: 100, status: "COMPLETED", config: segs, createdAt: new Date(Date.UTC(2026, 10, at)) } });
    await job(B, "https://staging.x.com/", 1);
    await job(A, "https://www.x.com/", 2);
    // Baseline = staging. /old removed, /new added, /blog/a title changed,
    // /blog/b goes noindex, /keep unchanged. Issue rule r1 fixed on /keep, r2 new on /blog/a.
    await seed(B, "staging.x.com", [
      { path: "/keep", rules: ["r1"] },
      { path: "/old" },
      { path: "/blog/a", title: "Old title", seg: true },
      { path: "/blog/b", seg: true },
    ]);
    await seed(A, "www.x.com", [
      { path: "/keep" },
      { path: "/new", status: 404 },
      { path: "/blog/a", title: "New title", seg: true, rules: ["r2"] },
      { path: "/blog/b", noindex: true, seg: true },
    ]);
  });

  afterAll(async () => {
    await prisma?.tenant.delete({ where: { id: tenantId } }).catch(() => {});
  });

  const staging = [{ find: "^https://staging\\.x\\.com", replace: "https://www.x.com" }];
  const input = (over: Partial<import("@/lib/site-crawler/compare").CompareInput> = {}) => ({ jobAId: A, jobBId: B, mapping: staging, segmentA: null, segmentB: null, ...over });

  it("with the mapping: added, removed, changed by field, issues new and resolved, summary per side", async () => {
    const r = await c.computeComparison(input());
    expect(r.counts).toEqual({ added: 1, removed: 1, changed: 2, issuesNew: 1, issuesResolved: 1 });
    expect(r.changedFields).toEqual({ status: 0, title: 1, canonical: 0, indexability: 1 });
    expect(r.samples.added).toEqual(["https://www.x.com/new"]);
    expect(r.samples.removed).toEqual(["https://www.x.com/old"]);
    expect(r.samples.changed.map((x) => [x.url, x.fields])).toEqual([
      ["https://www.x.com/blog/a", ["title"]],
      ["https://www.x.com/blog/b", ["indexability"]],
    ]);
    expect(r.samples.issuesNew).toEqual([{ url: "https://www.x.com/blog/a", ruleId: "r2" }]);
    expect(r.samples.issuesResolved).toEqual([{ url: "https://www.x.com/keep", ruleId: "r1" }]);
    expect(r.rules).toEqual(expect.arrayContaining([{ ruleId: "r1", new: 0, resolved: 1 }, { ruleId: "r2", new: 1, resolved: 0 }]));
    expect(r.summary.a).toMatchObject({ pages: 4, indexable: 2, errors: 1, issues: { WARNING: 1 } });
    expect(r.summary.b).toMatchObject({ pages: 4, indexable: 4, errors: 0, issues: { WARNING: 1 } });
  });

  it("without it, nothing matches: every page is added or removed", async () => {
    const r = await c.computeComparison(input({ mapping: [] }));
    expect(r.counts).toMatchObject({ added: 4, removed: 4, changed: 0 });
  });

  it("per segment: only the Blog pages on both sides", async () => {
    const r = await c.computeComparison(input({ segmentA: 0, segmentB: 0 }));
    expect(r.counts).toEqual({ added: 0, removed: 0, changed: 2, issuesNew: 1, issuesResolved: 0 });
  });

  it("the SQL mapping agrees with the JavaScript reference ($1 groups, $&, literal backslash)", async () => {
    const mapping = [
      { find: "^https://staging\\.(x)\\.com/(blog)/", replace: "https://www.$1.com/$2-archive/" },
      { find: "/keep$", replace: "$&\\v2" },
    ];
    const rows = (await c.comparisonBucket(input({ mapping }), "removed", null, 50)) as string[];
    const want = ["https://staging.x.com/blog/a", "https://staging.x.com/blog/b", "https://staging.x.com/keep", "https://staging.x.com/old"].map((u) => m.applyMapping(u, mapping)).sort();
    expect([...rows].sort()).toEqual(want);
  });

  it("buckets page by keyset", async () => {
    const one = await c.comparisonBucket(input({ mapping: [] }), "added", null, 2);
    const two = await c.comparisonBucket(input({ mapping: [] }), "added", c.bucketCursor(one[1]!), 2);
    expect([...one, ...two]).toEqual(["https://www.x.com/blog/a", "https://www.x.com/blog/b", "https://www.x.com/keep", "https://www.x.com/new"]);
    const issues = await c.comparisonBucket(input(), "issuesNew", null, 10);
    expect(await c.comparisonBucket(input(), "issuesNew", c.bucketCursor(issues[0]!), 10)).toEqual([]);
  });

  it("stores once per pair, mapping and segment; purging either side deletes it", async () => {
    const first = await c.runComparison(input());
    const again = await c.runComparison(input());
    expect(again.id).toBe(first.id);
    const other = await c.runComparison(input({ mapping: [] }));
    expect(other.id).not.toBe(first.id);
    const { purgeCrawlData } = await import("@/lib/site-crawler/retention");
    await purgeCrawlData(B);
    expect(await prisma.crawlComparison.count({ where: { jobAId: A } })).toBe(0);
  });

  it("a pattern Postgres rejects is a CompareError, not a 500", async () => {
    await expect(c.computeComparison(input({ jobBId: A, mapping: [{ find: "a{2,1}", replace: "" }] }))).rejects.toMatchObject({ name: "CompareError", code: "invalid_mapping" });
  });
});
