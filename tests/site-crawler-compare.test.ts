// tests/site-crawler-compare.test.ts — Phase 4c compare: mapping screens and
// translation, the 1 MB fit, CSV columns, and the routes (tenant scoping,
// comparability, validation) with Prisma mocked.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const requirePaidPlan = vi.fn();
vi.mock("@/lib/paid-plan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paid-plan")>()),
  requirePaidPlan: () => requirePaidPlan(),
}));
const crawlJob = { findFirst: vi.fn(), findMany: vi.fn() };
const crawlComparison = { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() };
vi.mock("@/lib/prisma", () => ({ prisma: { crawlJob, crawlComparison, $transaction: vi.fn() } }));

const { applyMapping, mappingProblems, toPgReplacement, MappingSchema } = await import("@/lib/site-crawler/compare-mapping");
const { fitResult, defaultBaseline, bucketCursor } = await import("@/lib/site-crawler/compare");
const { compareColumns } = await import("@/lib/site-crawler/compare-csv");
const route = await import("@/app/api/seo/v1/crawl/[id]/compare/route");
const one = await import("@/app/api/seo/v1/crawl/[id]/compare/[comparisonId]/route");

describe("mapping", () => {
  it.each([
    ["^https://staging\\.x\\.com", null],
    ["(a+)+$", "unsafe_regex"],
    ["a{2,1}", "invalid_regex"],
    ["(?<=x)y", "unsupported_regex"],
    ["(?<!x)y", "unsupported_regex"],
    ["(?<host>[a-z]+)", "unsupported_regex"],
    ["\\p{L}", "unsupported_regex"],
    ["\\u00e9", "unsupported_regex"],
    ["(?:non-capturing)", null],
  ])("%s → %s", (find, code) => {
    const p = mappingProblems([{ find, replace: "" }]);
    expect(p).toEqual(code ? [{ index: 0, code }] : []);
  });

  it("refuses inline flag groups whichever screen catches them (Node versions differ on (?i:))", () => {
    expect(mappingProblems([{ find: "(?i:abc)", replace: "" }])).toHaveLength(1);
    expect(mappingProblems([{ find: "(", replace: "" }])).toHaveLength(1);
  });

  it.each([
    ["https://www.x.com", "https://www.x.com"],
    ["$1/$2", "\\1/\\2"],
    ["[$&]", "[\\&]"],
    ["$$5", "$5"],
    ["a\\b", "a\\\\b"],
    ["$0 $x $", "$0 $x $"],
  ])("replacement %s → %s", (js, pg) => {
    expect(toPgReplacement(js)).toBe(pg);
  });

  it("applies pairs in order, first match each", () => {
    expect(applyMapping("https://staging.x.com/a/a", [{ find: "staging\\.", replace: "" }, { find: "/a", replace: "/b" }])).toBe("https://x.com/b/a");
  });

  it("caps pairs and expression length", () => {
    expect(MappingSchema.safeParse(Array.from({ length: 11 }, () => ({ find: "a", replace: "" }))).success).toBe(false);
    expect(MappingSchema.safeParse([{ find: "a".repeat(501), replace: "" }]).success).toBe(false);
  });
});

describe("result size", () => {
  const big = (n: number) => Array.from({ length: n }, (_, i) => `https://x.com/${"p".repeat(1500)}/${i}`);
  const result = () => ({
    version: 1 as const,
    counts: { added: 500, removed: 500, changed: 0, issuesNew: 0, issuesResolved: 0 },
    changedFields: { status: 0, title: 0, canonical: 0, indexability: 0 },
    summary: { a: {} as never, b: {} as never },
    rules: [],
    samples: { added: big(500), removed: big(500), changed: [], issuesNew: [], issuesResolved: [] },
    truncated: false,
  });

  it("halves the longest sample until the row is under 1 MB; counts stay", () => {
    const fitted = fitResult(result());
    expect(Buffer.byteLength(JSON.stringify(fitted))).toBeLessThanOrEqual(1_000_000);
    expect(fitted.truncated).toBe(true);
    expect(fitted.counts.added).toBe(500);
    expect(fitted.samples.added.length).toBeLessThan(500);
  });

  it("leaves a small result alone", () => {
    const small = { ...result(), samples: { ...result().samples, added: ["a"], removed: [] } };
    expect(fitResult(small)).toBe(small);
  });
});

describe("baseline and CSV", () => {
  const a = { id: "a", tenantId: "t", rootUrl: "https://x.com/", mode: "spider", config: null, createdAt: new Date("2026-11-03") };
  it("defaults to the newest older crawl of the same host", () => {
    const list = [
      { id: "newer", rootUrl: "https://x.com/", createdAt: new Date("2026-11-04") },
      { id: "other-host", rootUrl: "https://y.com/", createdAt: new Date("2026-11-02") },
      { id: "prev", rootUrl: "https://x.com/en", createdAt: new Date("2026-11-01") },
    ];
    expect(defaultBaseline(a, list)).toBe("prev");
    expect(defaultBaseline({ ...a, mode: "list" }, list)).toBe("other-host");
    expect(defaultBaseline(a, [])).toBeNull();
  });

  it("columns per bucket, cursors per row shape", () => {
    expect(compareColumns("added").map((c) => c.header)).toEqual(["URL"]);
    expect(compareColumns("changed").map((c) => c.header)).toContain("Indexable (this crawl)");
    expect(compareColumns("issuesNew").map((c) => c.header)).toEqual(["URL", "Rule", "Issue"]);
    expect(bucketCursor("u")).toBe("u");
    expect(bucketCursor({ url: "u", ruleId: "r" })).toBe('["u","r"]');
  });
});

describe("routes", () => {
  const ctx = { params: Promise.resolve({ id: "a" }) };
  const post = (body: unknown) => route.POST(new Request("https://app.test/x", { method: "POST", body: JSON.stringify(body) }), ctx);
  const A = { id: "a", tenantId: "t1", rootUrl: "https://x.com/", mode: "spider", config: null, createdAt: new Date(), status: "COMPLETED", dataPurgedAt: null };

  beforeEach(() => {
    vi.clearAllMocks();
    requirePaidPlan.mockResolvedValue({ tenantId: "t1", tenant: { planType: "GROWTH" } });
    crawlJob.findFirst.mockResolvedValue(A);
    crawlJob.findMany.mockResolvedValue([]);
    crawlComparison.findMany.mockResolvedValue([]);
  });

  it("GET looks the crawl up by id AND tenant, and refuses a running or purged one", async () => {
    expect((await route.GET(new Request("https://app.test/x"), ctx)).status).toBe(200);
    expect(crawlJob.findFirst.mock.calls[0]![0].where).toEqual({ id: "a", tenantId: "t1" });
    expect(crawlJob.findMany.mock.calls[0]![0].where).toMatchObject({ tenantId: "t1", mode: "spider", status: "COMPLETED", dataPurgedAt: null });
    crawlJob.findFirst.mockResolvedValueOnce({ ...A, status: "RUNNING" });
    expect((await route.GET(new Request("https://app.test/x"), ctx)).status).toBe(409);
    crawlJob.findFirst.mockResolvedValueOnce(null);
    expect((await route.GET(new Request("https://app.test/x"), ctx)).status).toBe(404);
  });

  it.each([
    [{}, 400, "INVALID_REQUEST"],
    [{ baselineId: "b", mapping: [{ find: "(?<=a)b", replace: "" }] }, 400, "INVALID_MAPPING"],
    [{ baselineId: "b", segment: 0 }, 400, "INVALID_REQUEST"],
  ])("POST %j → %i %s", async (body, status, code) => {
    const res = await post(body);
    expect(res.status).toBe(status);
    expect((await res.json()).code).toBe(code);
  });

  it("POST refuses a baseline of another tenant or mode (B is looked up with A's tenant and mode)", async () => {
    crawlJob.findFirst.mockResolvedValueOnce(A).mockResolvedValueOnce(null);
    const res = await post({ baselineId: "b" });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "COMPARE_ERROR", reason: "not_comparable" });
    expect(crawlJob.findFirst.mock.calls[1]![0].where).toMatchObject({ id: "b", tenantId: "t1", mode: "spider", status: "COMPLETED", dataPurgedAt: null });
  });

  it("the stored comparison is read through the tenant's crawl; unknown buckets are 400", async () => {
    const ctx1 = { params: Promise.resolve({ id: "a", comparisonId: "cmp" }) };
    crawlComparison.findFirst.mockResolvedValueOnce(null);
    expect((await one.GET(new Request("https://app.test/x"), ctx1)).status).toBe(404);
    expect(crawlComparison.findFirst.mock.calls[0]![0].where).toEqual({ id: "cmp", jobAId: "a" });
    crawlComparison.findFirst.mockResolvedValueOnce({ id: "cmp", jobAId: "a", jobBId: "b", segmentId: null, mapping: [] });
    expect((await one.GET(new Request("https://app.test/x?bucket=nope"), ctx1)).status).toBe(400);
  });
});
