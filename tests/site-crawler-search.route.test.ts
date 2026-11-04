// Phase 4b custom search on the Pages route: filter by "search N matched /
// did not", counts on the JSON rows, one count column per search in the CSV.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const requirePaidPlan = vi.fn();
vi.mock("@/lib/paid-plan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paid-plan")>()),
  requirePaidPlan: () => requirePaidPlan(),
}));

const crawlJob = { findFirst: vi.fn() };
const crawlPage = { findMany: vi.fn(), count: vi.fn() };
vi.mock("@/lib/prisma", () => ({ prisma: { crawlJob, crawlPage, crawlPageMetric: { groupBy: async () => [] } } }));

const { GET } = await import("@/app/api/seo/v1/crawl/[id]/pages/route");
import { EMPTY_PAGE_FILTERS, pageFilterParams } from "@/lib/site-crawler/types";
import { searchCount } from "@/lib/site-crawler/csv-columns";

const call = (q: string) => GET(new Request(`https://app.test/api/seo/v1/crawl/c1/pages?${q}`), { params: Promise.resolve({ id: "c1" }) });
const lines = async (res: Response) => (await res.text()).replace(/^﻿/, "").trim().split("\r\n");

const config = { searches: [{ name: "GTM", pattern: "googletagmanager", isRegex: false }, { name: "Price", pattern: "\\d+\\.\\d\\d", isRegex: true }] };
const row = {
  id: "p1", url: "https://x.com/", statusCode: 200, title: "T", titleLength: 1, metaDescLength: 0, h1Count: 1, wordCount: 10, depth: 0,
  internalLinks: 3, fetchMs: 10, contentType: "text/html", redirectTarget: null, canonical: null, inlinkCount: 0, inSitemap: true, foundOn: null,
  searchHits: { "0": 2, "1": 0 }, _count: { issues: 1 },
};

beforeEach(() => {
  vi.clearAllMocks();
  requirePaidPlan.mockResolvedValue({ tenantId: "t1", tenant: { planType: "GROWTH" } });
  crawlJob.findFirst.mockResolvedValue({ id: "c1", config });
  // Phase 4g: the CSV asks whether any page has a Link Score; these crawls have none.
  crawlPage.count.mockImplementation(async (a?: { where?: { linkScore?: unknown } }) => (a?.where?.linkScore ? 0 : 1));
  crawlPage.findMany.mockResolvedValueOnce([row]).mockResolvedValue([]);
});

describe("pages: custom search", () => {
  it.each([
    ["search=0&hit=true", { searchHits: { path: ["0"], gt: 0 } }],
    ["search=1&hit=false", { searchHits: { path: ["1"], equals: 0 } }],
  ])("%s filters on the stored count", async (q, want) => {
    await call(q);
    expect(crawlPage.findMany.mock.calls[0]![0].where).toMatchObject({ crawlJobId: "c1", ...want });
  });

  it.each(["search=2&hit=true", "search=0", "search=0&hit=yes", "search=-1&hit=true"])("400s %s", async (q) => {
    expect((await call(q)).status).toBe(400);
  });

  it("returns the counts on each row", async () => {
    const body = await (await call("")).json();
    expect(body.pages[0].searchHits).toEqual({ "0": 2, "1": 0 });
  });

  it("CSV carries one count column per search", async () => {
    const out = await lines(await call("format=csv"));
    expect(out[0]!.endsWith(",Found on,Page score,Issues,High-priority issues,Search: GTM,Search: Price")).toBe(true);
    expect(out[1]!.endsWith(",2,0")).toBe(true);
  });

  it("a crawl without searches exports the 4a columns only", async () => {
    crawlJob.findFirst.mockResolvedValue({ id: "c1", config: null });
    expect((await lines(await call("format=csv")))[0]!.endsWith(",Found on,Page score,Issues,High-priority issues")).toBe(true);
  });
});

describe("helpers", () => {
  it("pageFilterParams carries the search filter", () => {
    expect(pageFilterParams({ ...EMPTY_PAGE_FILTERS, depth: "2", search: "1:none" }).toString()).toBe("depth=2&search=1&hit=false");
    expect(pageFilterParams(EMPTY_PAGE_FILTERS).toString()).toBe("");
  });

  it("searchCount reads a count or null", () => {
    expect(searchCount({ "0": 3 }, 0)).toBe(3);
    expect(searchCount({ "0": 3 }, 1)).toBeNull();
    expect(searchCount(null, 0)).toBeNull();
  });
});
