// Phase 4b Extraction tab route: tenant-scoped, columns from the crawl's own
// config, has / empty and segment filters, CSV with one column per extractor.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const requirePaidPlan = vi.fn();
vi.mock("@/lib/paid-plan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paid-plan")>()),
  requirePaidPlan: () => requirePaidPlan(),
}));

const crawlJob = { findFirst: vi.fn() };
const crawlPage = { findMany: vi.fn(), count: vi.fn() };
vi.mock("@/lib/prisma", () => ({ prisma: { crawlJob, crawlPage } }));

const { GET } = await import("@/app/api/seo/v1/crawl/[id]/extractions/route");

const call = (q: string) =>
  GET(new Request(`https://app.test/api/seo/v1/crawl/c1/extractions?${q}`), { params: Promise.resolve({ id: "c1" }) });
const lines = async (res: Response) => (await res.text()).replace(/^﻿/, "").trim().split("\r\n");

const config = {
  extractors: [
    { name: "Price", kind: "css", expr: "[itemprop=price]", attr: "content", multiple: false },
    { name: "Author", kind: "xpath", expr: "//meta[@name='author']/@content", attr: null, multiple: false },
  ],
  segments: [{ name: "Shop", rule: { kind: "urlPattern", pattern: "/shop/*" } }],
};
const rows = [
  { id: "p1", url: "https://x.com/shop/a", segmentIds: [0], extractions: [{ extractorIndex: 0, values: ["=19.90"] }] },
  { id: "p2", url: "https://x.com/blog", segmentIds: [], extractions: [{ extractorIndex: 1, values: ["Ada", "Bob"] }] },
];

beforeEach(() => {
  vi.clearAllMocks();
  requirePaidPlan.mockResolvedValue({ tenantId: "t1", tenant: { planType: "GROWTH" } });
  crawlJob.findFirst.mockResolvedValue({ id: "c1", config });
  crawlPage.count.mockResolvedValue(2);
  crawlPage.findMany.mockResolvedValueOnce(rows).mockResolvedValue([]);
});

describe("GET extractions", () => {
  it("looks the crawl up by id AND tenant, and 404s another tenant's", async () => {
    crawlJob.findFirst.mockResolvedValueOnce(null);
    expect((await call("")).status).toBe(404);
    expect(crawlJob.findFirst.mock.calls[0]![0].where).toEqual({ id: "c1", tenantId: "t1" });
  });

  it("returns one value list per extractor, null where nothing was found", async () => {
    const body = await (await call("")).json();
    expect(body.extractors).toEqual([{ name: "Price", kind: "css" }, { name: "Author", kind: "xpath" }]);
    expect(body.rows.map((r: { values: unknown }) => r.values)).toEqual([[["=19.90"], null], [null, ["Ada", "Bob"]]]);
    expect(body.rows[0].segment).toBe("Shop");
  });

  it.each([
    ["extractor=1&has=true", { extractions: { some: { extractorIndex: 1 } } }],
    ["extractor=0&has=false", { extractions: { none: { extractorIndex: 0 } } }],
    ["segment=0", { segmentIds: { has: 0 } }],
  ])("%s filters the HTML pages", async (q, want) => {
    await call(q);
    expect(crawlPage.findMany.mock.calls[0]![0].where).toMatchObject({
      crawlJobId: "c1",
      contentType: { contains: "html", mode: "insensitive" },
      ...want,
    });
  });

  it.each(["extractor=2&has=true", "extractor=x", "extractor=0&has=maybe"])("400s %s", async (q) => {
    expect((await call(q)).status).toBe(400);
  });

  it("CSV: URL, one column per extractor by name, segment; formula-guarded", async () => {
    expect(await lines(await call("format=csv"))).toEqual([
      "URL,Price,Author,Segment",
      "https://x.com/shop/a,'=19.90,,Shop",
      "https://x.com/blog,,Ada | Bob,",
    ]);
  });
});
