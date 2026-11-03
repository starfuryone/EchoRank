// Phase 4b segments: the per-site segments API, the ?segment filter every
// crawl route takes (400 for an index the crawl does not have), the Segment
// CSV column, and the per-segment Overview / per-rule counts.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const requirePaidPlan = vi.fn();
vi.mock("@/lib/paid-plan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paid-plan")>()),
  requirePaidPlan: () => requirePaidPlan(),
}));

const crawlJob = { findFirst: vi.fn() };
const crawlPage = { findMany: vi.fn(), count: vi.fn() };
const crawlIssue = { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() };
const crawlSegment = { findMany: vi.fn(), deleteMany: vi.fn((a: unknown) => ({ op: "delete", a })), createMany: vi.fn((a: unknown) => ({ op: "create", a })) };
const queryRaw = vi.fn();
const transaction = vi.fn(async (ops: unknown[]) => ops);
vi.mock("@/lib/prisma", () => ({
  prisma: {
    crawlJob,
    crawlPage,
    crawlIssue,
    crawlSegment,
    $queryRaw: (...a: unknown[]) => queryRaw(...a),
    $transaction: (ops: unknown[]) => transaction(ops),
  },
}));

const segmentsRoute = await import("@/app/api/seo/v1/crawl/segments/route");
const { GET: getIssues } = await import("@/app/api/seo/v1/crawl/[id]/issues/route");
const { GET: getPages } = await import("@/app/api/seo/v1/crawl/[id]/pages/route");
const { GET: getRules } = await import("@/app/api/seo/v1/crawl/[id]/rules/route");
const { GET: getSummary } = await import("@/app/api/seo/v1/crawl/[id]/summary/route");
const { GET: getExport } = await import("@/app/api/seo/v1/crawl/[id]/export/route");
const { GET: getDuplicates } = await import("@/app/api/seo/v1/crawl/[id]/duplicates/route");
const { GET: getRedirects } = await import("@/app/api/seo/v1/crawl/[id]/redirects/route");
const { InvalidSegmentError, issueInSegment, pageInSegment, segmentScope } = await import("@/lib/site-crawler/segment-filter");

const params = { params: Promise.resolve({ id: "c1" }) };
const req = (path: string, init?: RequestInit) => new Request(`https://app.test/api/seo/v1/crawl/${path}`, init);
const lines = async (res: Response) => (await res.text()).replace(/^﻿/, "").trim().split("\r\n");

const SEGMENTS = [
  { name: "Blog", rule: { kind: "urlPattern", pattern: "/blog/*" } },
  { name: "Shallow", rule: { kind: "depthMax", max: 1 } },
];
const CRAWL = { id: "c1", status: "COMPLETED", pagesCrawled: 10, summary: null, config: { segments: SEGMENTS } };

beforeEach(() => {
  vi.clearAllMocks();
  requirePaidPlan.mockResolvedValue({ tenantId: "t1", tenant: { planType: "STARTER" } });
  crawlJob.findFirst.mockResolvedValue(CRAWL);
  crawlPage.findMany.mockResolvedValue([]);
  crawlPage.count.mockResolvedValue(4);
  crawlIssue.findMany.mockResolvedValue([]);
  crawlIssue.count.mockResolvedValue(0);
  crawlIssue.groupBy.mockResolvedValue([]);
  crawlSegment.findMany.mockResolvedValue(SEGMENTS);
  queryRaw.mockResolvedValue([]);
});

describe("segmentScope", () => {
  const url = (q: string) => new URL(`https://app.test/x?${q}`);
  it.each([
    ["", null],
    ["segment=", null],
    ["segment=1", 1],
  ])("%s → %s", (q, index) => {
    expect(segmentScope(url(q), CRAWL.config).index).toBe(index);
  });
  it.each(["segment=2", "segment=-1", "segment=x", "segment=1.5"])("%s is refused", (q) => {
    expect(() => segmentScope(url(q), CRAWL.config)).toThrow(InvalidSegmentError);
  });
  it("a crawl without segments has none to pick", () => {
    expect(() => segmentScope(url("segment=0"), null)).toThrow(InvalidSegmentError);
  });
  it("builds page and issue filters that combine with any other", () => {
    const s = { defs: [], index: 3 };
    expect(pageInSegment(s)).toEqual({ segmentIds: { has: 3 } });
    expect(issueInSegment(s)).toEqual({ AND: [{ crawlPage: { segmentIds: { has: 3 } } }] });
    expect(pageInSegment({ defs: [], index: null })).toEqual({});
  });
});

describe("/crawl/segments", () => {
  const put = (body: unknown) => segmentsRoute.PUT(req("segments", { method: "PUT", body: JSON.stringify(body) }));

  it("GET reads the tenant's segments for the host, in order, with the plan cap", async () => {
    const body = await (await segmentsRoute.GET(req("segments?host=https://Example.com/x"))).json();
    expect(crawlSegment.findMany.mock.calls[0]![0].where).toEqual({ tenantId: "t1", host: "example.com" });
    expect(body).toEqual({ host: "example.com", segments: SEGMENTS, cap: 3 });
  });

  it("PUT replaces them in one transaction, positions in order", async () => {
    const res = await put({ host: "example.com", segments: SEGMENTS });
    expect(res.status).toBe(200);
    expect(crawlSegment.deleteMany).toHaveBeenCalledWith({ where: { tenantId: "t1", host: "example.com" } });
    const created = (crawlSegment.createMany.mock.calls[0]![0] as { data: { name: string; position: number; tenantId: string }[] }).data;
    expect(created.map((d) => [d.name, d.position, d.tenantId])).toEqual([
      ["Blog", 0, "t1"],
      ["Shallow", 1, "t1"],
    ]);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it("PUT refuses more than the plan allows", async () => {
    const four = Array.from({ length: 4 }, (_, i) => ({ name: `s${i}`, rule: { kind: "depthMax", max: i } }));
    const res = await put({ host: "example.com", segments: four });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "OVER_PLAN_CAP", limit: 3 });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("PUT refuses a pattern that does not compile or could backtrack", async () => {
    const res = await put({ host: "example.com", segments: [{ name: "x", rule: { kind: "urlPattern", pattern: "/(a+)+/" } }] });
    expect(await res.json()).toMatchObject({ code: "INVALID_SEGMENT", problems: [{ index: 0, reason: "unsafe_regex" }] });
  });

  it.each([
    [{ host: "example.com", segments: [{ name: "x", rule: { kind: "statusClass", cls: "6xx" } }] }],
    [{ host: "example.com" }],
  ])("PUT 400s a malformed body", async (body) => {
    expect((await put(body)).status).toBe(400);
  });

  it("refuses a private host", async () => {
    expect((await segmentsRoute.GET(req("segments?host=127.0.0.1"))).status).toBe(400);
  });
});

describe("?segment on the crawl routes", () => {
  it.each([
    ["issues", () => getIssues(req("c1/issues?segment=1"), params)],
    ["pages", () => getPages(req("c1/pages?segment=1"), params)],
    ["rules", () => getRules(req("c1/rules?segment=1"), params)],
    ["summary", () => getSummary(req("c1/summary?segment=1"), params)],
    ["export", () => getExport(req("c1/export?segment=1"), params)],
    ["duplicates", () => getDuplicates(req("c1/duplicates?segment=1"), params)],
    ["redirects", () => getRedirects(req("c1/redirects?segment=1"), params)],
  ])("%s accepts a segment the crawl has", async (_n, call) => {
    expect((await call()).status).toBeLessThan(400);
  });

  it.each([
    ["issues", () => getIssues(req("c1/issues?segment=7"), params)],
    ["pages", () => getPages(req("c1/pages?segment=7"), params)],
    ["rules", () => getRules(req("c1/rules?segment=7"), params)],
    ["summary", () => getSummary(req("c1/summary?segment=7"), params)],
    ["export", () => getExport(req("c1/export?view=redirects&segment=7"), params)],
  ])("%s 400s one it does not", async (_n, call) => {
    const res = await call();
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "INVALID_REQUEST" });
  });

  it("issues: filter is ANDed onto the crawl's issues", async () => {
    await getIssues(req("c1/issues?segment=1&severity=ERROR"), params);
    expect(crawlIssue.findMany.mock.calls[0]![0].where).toEqual({
      crawlPage: { crawlJobId: "c1" },
      severity: "ERROR",
      AND: [{ crawlPage: { segmentIds: { has: 1 } } }],
    });
  });

  it("pages: filter on segmentIds", async () => {
    await getPages(req("c1/pages?segment=0"), params);
    expect(crawlPage.findMany.mock.calls[0]![0].where).toMatchObject({ crawlJobId: "c1", segmentIds: { has: 0 } });
  });

  it("duplicates: the segment clause reaches the SQL", async () => {
    await getDuplicates(req("c1/duplicates?segment=1"), params);
    const sql = queryRaw.mock.calls[0]![0] as { strings?: string[] } & Record<string, unknown>;
    expect(JSON.stringify(queryRaw.mock.calls[0])).toContain("segmentIds");
    expect(sql).toBeTruthy();
  });

  it("issue CSV: a Segment column with the page's segment names", async () => {
    crawlIssue.findMany.mockResolvedValueOnce([
      { id: "i1", type: "x", severity: "ERROR", detail: null, crawlPage: { url: "https://x.com/blog/a", statusCode: 200, segmentIds: [0, 1] } },
    ]).mockResolvedValue([]);
    const out = await lines(await getIssues(req("c1/issues?format=csv"), params));
    expect(out[0]).toBe("Severity,Type,URL,Status code,Detail,Segment");
    expect(out[1]).toBe("ERROR,x,https://x.com/blog/a,200,,Blog; Shallow");
  });

  it("a crawl without segments exports without the column", async () => {
    crawlJob.findFirst.mockResolvedValue({ ...CRAWL, config: null });
    const out = await lines(await getIssues(req("c1/issues?format=csv"), params));
    expect(out[0]).toBe("Severity,Type,URL,Status code,Detail");
  });
});

describe("per-segment tallies", () => {
  it("rules: per-rule counts per segment, as CSV columns too", async () => {
    crawlJob.findFirst.mockResolvedValue({
      ...CRAWL,
      summary: { issues: { "response_codes.internal_4xx": { count: 3, kind: "issue", priority: "high" } }, issuesByKind: { issue: 3, warning: 0, opportunity: 0 } },
    });
    queryRaw.mockResolvedValue([{ ruleId: "response_codes.internal_4xx", seg: 1, n: 2 }]);
    const body = await (await getRules(req("c1/rules"), params)).json();
    expect(body.segments).toEqual(["Blog", "Shallow"]);
    expect(body.rules[0].bySegment).toEqual([0, 2]);
    const csv = await lines(await getRules(req("c1/rules?format=csv"), params));
    expect(csv[0]!.endsWith(",Segment: Blog,Segment: Shallow")).toBe(true);
    expect(csv[1]!.endsWith(",0,2")).toBe(true);
  });

  it("rules with ?segment: tallies and share are the segment's", async () => {
    crawlIssue.groupBy.mockResolvedValue([{ ruleId: "response_codes.internal_4xx", type: "x", _count: { _all: 2 } }]);
    const body = await (await getRules(req("c1/rules?segment=1"), params)).json();
    expect(crawlIssue.groupBy.mock.calls[0]![0].where).toEqual({ crawlJobId: "c1", AND: [{ crawlPage: { segmentIds: { has: 1 } } }] });
    expect(body.pagesCrawled).toBe(4);
    expect(body.rules[0]).toMatchObject({ urls: 2, share: 50 });
    expect(body.rules[0].bySegment).toBeUndefined();
  });

  it("summary: pages and totals per segment", async () => {
    queryRaw
      .mockResolvedValueOnce([{ seg: 0, n: 6 }, { seg: 1, n: 4 }])
      .mockResolvedValueOnce([{ seg: 0, severity: "ERROR", n: 2 }, { seg: 1, severity: "NOTICE", n: 5 }]);
    const body = await (await getSummary(req("c1/summary"), params)).json();
    expect(body.segments).toEqual([
      { index: 0, name: "Blog", pages: 6, totals: { ERROR: 2, WARNING: 0, NOTICE: 0 } },
      { index: 1, name: "Shallow", pages: 4, totals: { ERROR: 0, WARNING: 0, NOTICE: 5 } },
    ]);
  });

  it("summary with ?segment: names it and narrows the totals", async () => {
    crawlIssue.groupBy.mockImplementation(async (a: { by: string[] }) => (a.by[0] === "severity" ? [{ severity: "WARNING", _count: { _all: 3 } }] : []));
    const body = await (await getSummary(req("c1/summary?segment=0"), params)).json();
    expect(body.segment).toEqual({ index: 0, name: "Blog", pages: 4 });
    expect(body.totals).toEqual({ ERROR: 0, WARNING: 3, NOTICE: 0 });
    expect(body.segments).toBeUndefined();
  });
});
