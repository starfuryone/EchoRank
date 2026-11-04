// tests/site-crawler-report.test.ts — Phase 4c PDF crawl report: the top-20
// ranking, the payload (families, evidence, segments, compare), and the route
// (paid + tenant scoping, completed crawls only, sidecar call, PDF stream).
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const flags = vi.hoisted(() => ({ on: new Set<string>(["crawl.reports", "crawl.segments"]) }));
vi.mock("@/lib/flags", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/flags")>();
  return { ...real, flag: (n: string) => flags.on.has(n) };
});
const requirePaidPlan = vi.fn();
vi.mock("@/lib/paid-plan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paid-plan")>()),
  requirePaidPlan: () => requirePaidPlan(),
}));
const crawlJob = { findFirst: vi.fn() };
const crawlIssue = { findFirst: vi.fn(), groupBy: vi.fn() };
const crawlComparison = { findFirst: vi.fn() };
const queryRaw = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { crawlJob, crawlIssue, crawlComparison, $queryRaw: (...a: unknown[]) => queryRaw(...a) } }));

const { topRules, crawlReportPayload, REPORT_TOP_ISSUES } = await import("@/lib/site-crawler/report");
const route = await import("@/app/api/seo/v1/crawl/[id]/report/route");
const { RULE_IDS } = await import("@/lib/crawl-rules-meta");
const { RULE_BY_ID } = await import("@/lib/crawl-rules");

const CRAWL = {
  id: "j1",
  rootUrl: "https://x.com/",
  createdAt: new Date("2026-11-04T03:00:00Z"),
  pagesCrawled: 10,
  urlCap: 5000,
  stoppedReason: null,
  renderMode: "none",
  status: "COMPLETED",
  dataPurgedAt: null,
  config: { segments: [{ name: "Blog", rule: { kind: "urlPattern", pattern: "/blog/*" } }] },
  summary: {
    totals: { ERROR: 3, WARNING: 2, NOTICE: 1 },
    issues: {
      "response_codes.internal_4xx": { count: 3, kind: "issue", priority: "high" },
      [RULE_IDS.find((id) => RULE_BY_ID.get(id)?.kind === "opportunity")!]: { count: 9, kind: "opportunity", priority: "low" },
    },
    issuesByKind: { issue: 3, warning: 0, opportunity: 9 },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  requirePaidPlan.mockResolvedValue({ tenantId: "t1", tenant: { planType: "GROWTH" } });
  crawlJob.findFirst.mockResolvedValue(CRAWL);
  crawlIssue.findFirst.mockResolvedValue({ evidence: { status: 404, title: "<x>" }, detail: null, crawlPage: { url: "https://x.com/missing" } });
  queryRaw.mockResolvedValueOnce([{ seg: 0, n: 4 }]).mockResolvedValueOnce([{ seg: 0, severity: "ERROR", n: 2 }]);
  crawlComparison.findFirst.mockResolvedValue(null);
});

describe("top issues", () => {
  it("issues before warnings before opportunities, then priority, then findings; at most 20", () => {
    const many = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`r${String(i).padStart(2, "0")}`, { count: i + 1, kind: i % 3 === 0 ? "issue" : "opportunity", priority: i % 2 ? "high" : "low" }]));
    const ranked = topRules(many);
    expect(ranked).toHaveLength(REPORT_TOP_ISSUES);
    const kinds = ranked.map(([, t]) => t.kind);
    expect(kinds.lastIndexOf("issue")).toBeLessThan(kinds.indexOf("opportunity"));
    expect(topRules({ a: { count: 0, kind: "issue", priority: "high" } })).toEqual([]);
  });
});

describe("payload", () => {
  it("families, the example finding with its evidence, segments; no compare without a comparison", async () => {
    const p = await crawlReportPayload(CRAWL);
    expect(p).toMatchObject({ host: "x.com", pagesCrawled: 10, totals: { ERROR: 3, WARNING: 2, NOTICE: 1 }, byKind: { issue: 3, opportunity: 9 }, compare: null });
    expect(p.families.find((f) => f.family === "response_codes")).toMatchObject({ label: "Response codes", issue: 3, total: 3 });
    expect(p.topIssues[0]).toMatchObject({ ruleId: "response_codes.internal_4xx", pages: 3, example: { url: "https://x.com/missing", evidence: "status: 404 · title: <x>" } });
    expect(crawlIssue.findFirst.mock.calls[0]![0].where).toMatchObject({ crawlJobId: "j1" });
    expect(p.segments).toEqual([{ name: "Blog", pages: 4, ERROR: 2, WARNING: 0, NOTICE: 0 }]);
  });

  it("the latest whole-crawl comparison fills compare", async () => {
    crawlComparison.findFirst.mockResolvedValue({
      jobB: { createdAt: new Date("2026-10-28T03:00:00Z") },
      result: { counts: { added: 1, removed: 2, changed: 3, issuesNew: 4, issuesResolved: 5 }, summary: { a: {}, b: {} }, rules: [{ ruleId: "response_codes.internal_4xx", new: 4, resolved: 0 }] },
    });
    const p = await crawlReportPayload(CRAWL);
    expect(crawlComparison.findFirst.mock.calls[0]![0].where).toEqual({ jobAId: "j1", segmentId: null });
    expect(p.compare).toMatchObject({ baselineDate: "2026-10-28T03:00:00.000Z", counts: { added: 1 }, rules: [{ ruleId: "response_codes.internal_4xx", new: 4 }] });
    expect(p.compare!.rules[0]!.name).not.toBe("response_codes.internal_4xx");
  });
});

describe("route", () => {
  const ctx = { params: Promise.resolve({ id: "j1" }) };

  it("GET probes availability through the tenant's crawl", async () => {
    expect(await (await route.GET(new Request("https://app.test/x"), ctx)).json()).toEqual({ available: true });
    expect(crawlJob.findFirst.mock.calls[0]![0].where).toEqual({ id: "j1", tenantId: "t1" });
    crawlJob.findFirst.mockResolvedValueOnce({ ...CRAWL, status: "RUNNING" });
    expect(await (await route.GET(new Request("https://app.test/x"), ctx)).json()).toEqual({ available: false });
  });

  it("POST sends the payload to the sidecar with the secret header and streams the PDF back", async () => {
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([37, 80, 68, 70]), { status: 200, headers: { "content-disposition": 'attachment; filename="r.pdf"' } }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await route.POST(new Request("https://app.test/x", { method: "POST" }), ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/crawl-report$/);
    expect(init.headers).toHaveProperty("X-Internal-Secret");
    expect(JSON.parse(init.body as string)).toMatchObject({ host: "x.com" });
    vi.unstubAllGlobals();
  });

  it("another tenant's or an unfinished crawl is a 404; the flag off is a 404 and unavailable", async () => {
    crawlJob.findFirst.mockResolvedValueOnce(null);
    expect((await route.POST(new Request("https://app.test/x", { method: "POST" }), ctx)).status).toBe(404);
    crawlJob.findFirst.mockResolvedValueOnce({ ...CRAWL, dataPurgedAt: new Date() });
    expect((await route.POST(new Request("https://app.test/x", { method: "POST" }), ctx)).status).toBe(404);
    flags.on.delete("crawl.reports");
    expect((await route.POST(new Request("https://app.test/x", { method: "POST" }), ctx)).status).toBe(404);
    expect(await (await route.GET(new Request("https://app.test/x"), ctx)).json()).toEqual({ available: false });
    flags.on.add("crawl.reports");
  });

  it("an unauthenticated caller gets 401, not a PDF", async () => {
    requirePaidPlan.mockRejectedValueOnce(new Error("Not authenticated or no tenant access"));
    expect((await route.POST(new Request("https://app.test/x", { method: "POST" }), ctx)).status).toBe(401);
  });
});
