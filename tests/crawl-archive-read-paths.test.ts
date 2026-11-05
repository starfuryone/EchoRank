// tests/crawl-archive-read-paths.test.ts — every route, MCP tool and lib
// function that reads a crawl's child rows answers an archived crawl with 409
// ARCHIVED (or its summary-only view) and NEVER queries crawl_pages /
// crawl_issues / crawl_links / crawl_extractions / crawl_page_metrics: the
// prisma mock throws on any access to them, and on raw SQL.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const requirePaidPlan = vi.fn();
vi.mock("@/lib/paid-plan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paid-plan")>()),
  requirePaidPlan: () => requirePaidPlan(),
}));
vi.mock("@/lib/flags", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/flags")>();
  return { ...real, flag: (k: string) => (k === "crawl.sheets" ? true : real.flag(k as never)) };
});

const childReads: string[] = [];
const forbidden = (name: string) =>
  new Proxy(() => undefined, {
    get: (_t, k) => () => {
      childReads.push(`${name}.${String(k)}`);
      throw new Error(`child read: ${name}.${String(k)}`);
    },
    apply: () => {
      childReads.push(name);
      throw new Error(`child read: ${name}`);
    },
  });

const crawlJob = { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn(), updateMany: vi.fn() };
const crawlComparison = { findFirst: vi.fn(), findMany: vi.fn() };
const prismaMock = new Proxy(
  { crawlJob, crawlComparison } as Record<string, unknown>,
  { get: (t, k: string) => (k in t ? t[k] : forbidden(k)) },
);
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/api-keys", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  authenticatePublicRequest: async () => ({ ok: true, tenantId: "t1" }),
}));

const ARCHIVED = {
  id: "c1",
  tenantId: "t1",
  rootUrl: "https://ex.com/",
  status: "COMPLETED",
  mode: "spider",
  config: { segments: [{ name: "Blog", rule: { kind: "urlPattern", pattern: "/blog/*" } }] },
  storageState: "ARCHIVED",
  dataPurgedAt: null,
  pagesCrawled: 10,
  urlCap: 100,
  issueCount: 3,
  stoppedReason: null,
  renderMode: "none",
  renderCap: 0,
  pagesRendered: 0,
  pinned: false,
  scheduleId: null,
  apiKeyId: null,
  createdAt: new Date("2026-10-01T00:00:00Z"),
  startedAt: new Date("2026-10-01T00:00:00Z"),
  finishedAt: new Date("2026-10-01T01:00:00Z"),
  archivedAt: new Date("2026-10-20T05:17:00Z"),
  restoredAt: null,
  summary: { totals: { ERROR: 1, WARNING: 2, NOTICE: 3 }, issues: { "content.thin": { count: 2, kind: "warning", priority: "low" } }, issuesByKind: { issue: 0, warning: 2, opportunity: 0 }, health: 80 },
};

// Typed loosely: each route declares its own params shape.
const ctx = (extra: Record<string, string> = {}) => ({ params: Promise.resolve({ id: "c1", ...extra }) }) as never;
const req = (path: string, init?: RequestInit) => new Request(`https://app.test/api/seo/v1/crawl/c1${path}`, init);

beforeEach(() => {
  vi.clearAllMocks();
  childReads.length = 0;
  requirePaidPlan.mockResolvedValue({ tenantId: "t1", tenant: { planType: "GROWTH" } });
  crawlJob.findFirst.mockResolvedValue({ ...ARCHIVED });
  crawlJob.findUnique.mockResolvedValue({ ...ARCHIVED });
  crawlComparison.findFirst.mockResolvedValue({ id: "cmp1", jobAId: "c1", jobBId: "c0", segmentId: null, mapping: [], result: {} });
});

async function expectArchived(res: Response) {
  expect(res.status).toBe(409);
  expect(await res.json()).toMatchObject({ code: "ARCHIVED", storageState: "ARCHIVED" });
  expect(childReads).toEqual([]);
}

describe("dashboard routes: 409 ARCHIVED, no child-row query", () => {
  const cases: [string, () => Promise<Response>][] = [
    ["duplicates", async () => (await import("@/app/api/seo/v1/crawl/[id]/duplicates/route")).GET(req("/duplicates?type=title"), ctx())],
    ["export", async () => (await import("@/app/api/seo/v1/crawl/[id]/export/route")).GET(req("/export?view=issues"), ctx())],
    ["external", async () => (await import("@/app/api/seo/v1/crawl/[id]/external/route")).GET(req("/external"), ctx())],
    ["extractions", async () => (await import("@/app/api/seo/v1/crawl/[id]/extractions/route")).GET(req("/extractions"), ctx())],
    ["issues", async () => (await import("@/app/api/seo/v1/crawl/[id]/issues/route")).GET(req("/issues"), ctx())],
    ["issues csv", async () => (await import("@/app/api/seo/v1/crawl/[id]/issues/route")).GET(req("/issues?format=csv"), ctx())],
    ["redirects", async () => (await import("@/app/api/seo/v1/crawl/[id]/redirects/route")).GET(req("/redirects"), ctx())],
    ["rules", async () => (await import("@/app/api/seo/v1/crawl/[id]/rules/route")).GET(req("/rules"), ctx())],
    ["rules/[ruleId]", async () => (await import("@/app/api/seo/v1/crawl/[id]/rules/[ruleId]/route")).GET(req("/rules/content.thin"), ctx({ ruleId: "content.thin" }))],
    ["pages", async () => (await import("@/app/api/seo/v1/crawl/[id]/pages/route")).GET(req("/pages"), ctx())],
    ["pages csv", async () => (await import("@/app/api/seo/v1/crawl/[id]/pages/route")).GET(req("/pages?format=csv"), ctx())],
    ["pages/[pageId]", async () => (await import("@/app/api/seo/v1/crawl/[id]/pages/[pageId]/route")).GET(req("/pages/p1"), ctx({ pageId: "p1" }))],
    ["inlinks", async () => (await import("@/app/api/seo/v1/crawl/[id]/pages/[pageId]/inlinks/route")).GET(req("/pages/p1/inlinks"), ctx({ pageId: "p1" }))],
    ["graph", async () => (await import("@/app/api/seo/v1/crawl/[id]/graph/route")).GET(req("/graph?kind=directory"), ctx())],
    ["compare GET", async () => (await import("@/app/api/seo/v1/crawl/[id]/compare/route")).GET(req("/compare"), ctx())],
    ["compare POST", async () => (await import("@/app/api/seo/v1/crawl/[id]/compare/route")).POST(req("/compare", { method: "POST", body: JSON.stringify({ baselineId: "c0" }) }), ctx())],
    ["comparison detail", async () => (await import("@/app/api/seo/v1/crawl/[id]/compare/[comparisonId]/route")).GET(req("/compare/cmp1?bucket=added"), ctx({ comparisonId: "cmp1" }))],
    ["sitemap", async () => (await import("@/app/api/seo/v1/crawl/[id]/sitemap/route")).GET(req("/sitemap"), ctx())],
    ["report POST", async () => (await import("@/app/api/seo/v1/crawl/[id]/report/route")).POST(req("/report", { method: "POST" }), ctx())],
    ["sheets POST", async () => (await import("@/app/api/seo/v1/crawl/[id]/sheets/route")).POST(req("/sheets", { method: "POST", body: JSON.stringify({ spreadsheet: "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcdefg" }) }), ctx())],
    ["summary ?segment", async () => (await import("@/app/api/seo/v1/crawl/[id]/summary/route")).GET(req("/summary?segment=0"), ctx())],
  ];
  it.each(cases)("%s", async (_name, run) => {
    await expectArchived(await run());
  });

  it("RESTORING and ARCHIVING answer the same way (the rows are moving)", async () => {
    const { GET } = await import("@/app/api/seo/v1/crawl/[id]/issues/route");
    for (const storageState of ["RESTORING", "ARCHIVING"]) {
      crawlJob.findFirst.mockResolvedValue({ ...ARCHIVED, storageState });
      const res = await GET(req("/issues"), ctx());
      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({ code: "ARCHIVED", storageState });
    }
    expect(childReads).toEqual([]);
  });

  it("comparison detail: crawl A hot but its baseline B archived → 409 too", async () => {
    crawlJob.findFirst.mockResolvedValueOnce({ ...ARCHIVED, storageState: "HOT" }).mockResolvedValueOnce({ storageState: "ARCHIVED", dataPurgedAt: null });
    const { GET } = await import("@/app/api/seo/v1/crawl/[id]/compare/[comparisonId]/route");
    await expectArchived(await GET(req("/compare/cmp1?bucket=added"), ctx({ comparisonId: "cmp1" })));
    expect(crawlJob.findFirst.mock.calls[1]![0].where).toEqual({ id: "c0", tenantId: "t1" });
  });

  it("a PURGED crawl keeps its current answer (graph: 409 PURGED)", async () => {
    crawlJob.findFirst.mockResolvedValue({ ...ARCHIVED, storageState: "HOT", dataPurgedAt: new Date() });
    const { GET } = await import("@/app/api/seo/v1/crawl/[id]/graph/route");
    const res = await GET(req("/graph?kind=directory"), ctx());
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("PURGED");
  });
});

describe("summary-only views of an archived crawl: 200 from the cache, no child-row query", () => {
  it("GET /crawl/[id]: storageState, archivedAt and the cached severity counts", async () => {
    const { GET } = await import("@/app/api/seo/v1/crawl/[id]/route");
    const res = await GET(req(""), ctx());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ storageState: "ARCHIVED", archivedAt: "2026-10-20T05:17:00.000Z", severityCounts: { ERROR: 1, WARNING: 2, NOTICE: 3 } });
    expect(childReads).toEqual([]);
  });

  it("GET /crawl/[id] with no cached totals: zeros, still no query", async () => {
    crawlJob.findFirst.mockResolvedValue({ ...ARCHIVED, summary: { health: 80 } });
    const { GET } = await import("@/app/api/seo/v1/crawl/[id]/route");
    expect((await (await GET(req(""), ctx())).json()).severityCounts).toEqual({ ERROR: 0, WARNING: 0, NOTICE: 0 });
    expect(childReads).toEqual([]);
  });

  it("GET /summary: the stored summary, cached tallies and totals; no segment overview or coverage", async () => {
    const { GET } = await import("@/app/api/seo/v1/crawl/[id]/summary/route");
    const res = await GET(req("/summary"), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ totals: { ERROR: 1, WARNING: 2, NOTICE: 3 }, issuesByKind: { warning: 2 }, computed: false });
    expect(body.segments).toBeUndefined();
    expect(body.metricOverview.coverage).toEqual({});
    expect(childReads).toEqual([]);
  });

  it("GET /report: not available (the report reads findings)", async () => {
    const { GET } = await import("@/app/api/seo/v1/crawl/[id]/report/route");
    expect(await (await GET(req("/report"), ctx())).json()).toEqual({ available: false });
    expect(childReads).toEqual([]);
  });
});

describe("the public API, MCP, assistant context", () => {

  it("public issues: 409 {error: archived}", async () => {
    const { GET } = await import("@/app/api/public/v1/crawl/[id]/issues/route");
    const res = await GET(new Request("https://app.test/api/public/v1/crawl/c1/issues"), ctx());
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "archived", storageState: "ARCHIVED" });
    expect(childReads).toEqual([]);
  });

  it("public detail: data = archived, totals from the cache, no segments", async () => {
    const { publicCrawlDetail } = await import("@/lib/site-crawler/public-api");
    const d = await publicCrawlDetail({ ...ARCHIVED } as never);
    expect(d).toMatchObject({ data: "archived", totals: { byKind: { warning: 2 } }, segments: [] });
    expect(childReads).toEqual([]);
  });

  it("publicArchived re-words the proxied 409", async () => {
    const { publicArchived } = await import("@/lib/site-crawler/public-api-archived");
    const res = await publicArchived(new Response(JSON.stringify({ code: "ARCHIVED", storageState: "ARCHIVED" }), { status: 409 }));
    expect(await res.json()).toEqual({ error: "archived", storageState: "ARCHIVED" });
    const other = new Response("{}", { status: 409 });
    expect(await publicArchived(other)).toBe(other);
  });

  it("MCP get_crawl_summary: no findings query, a note on how to restore", async () => {
    const { getCrawlSummary } = await import("@/lib/mcp/reads");
    const out = await getCrawlSummary({ id: "t1" } as never, { crawlJobId: "c1" });
    expect(out).toMatchObject({ found: true, topIssues: [] });
    expect(out.note).toMatch(/archived/);
    expect(childReads).toEqual([]);
  });

  it("action-agent page inventory asks only for a HOT crawl", async () => {
    crawlJob.findFirst.mockResolvedValue(null);
    const { gatherPageInventory } = await import("@/lib/action-agent/context");
    expect(await gatherPageInventory("t1", "https://ex.com/page")).toEqual([]);
    expect(crawlJob.findFirst.mock.calls[0]![0].where).toMatchObject({ storageState: "HOT", dataPurgedAt: null });
  });
});

describe("lib: totals and tallies never query a non-hot crawl", () => {
  it("getIssueTotals / ruleTalliesFor: the cache, or zeros", async () => {
    const { getIssueTotals } = await import("@/lib/site-crawler/issue-totals");
    const { ruleTalliesFor } = await import("@/lib/site-crawler/rule-summary");
    for (const state of [{ storageState: "ARCHIVED", dataPurgedAt: null }, { storageState: "HOT", dataPurgedAt: new Date() }]) {
      expect(await getIssueTotals("c1", null, state)).toEqual({ ERROR: 0, WARNING: 0, NOTICE: 0 });
      expect(await ruleTalliesFor("c1", null, state)).toEqual({ issues: {}, issuesByKind: { issue: 0, warning: 0, opportunity: 0 }, computed: false });
      expect(await getIssueTotals("c1", ARCHIVED.summary, state)).toEqual({ ERROR: 1, WARNING: 2, NOTICE: 3 });
    }
    expect(childReads).toEqual([]);
    // A HOT crawl without the cache still counts its rows (the old behaviour).
    await expect(getIssueTotals("c1", null, { storageState: "HOT", dataPurgedAt: null })).rejects.toThrow(/child read: crawlIssue/);
  });

  it("the metrics runner only picks up a HOT crawl", async () => {
    crawlJob.findFirst.mockResolvedValue(null);
    const { runCrawlMetrics } = await import("@/lib/site-crawler/metrics-runner");
    expect(await runCrawlMetrics("c1")).toEqual({ done: true });
    expect(crawlJob.findFirst.mock.calls[0]![0].where).toMatchObject({ storageState: "HOT" });
  });
});
