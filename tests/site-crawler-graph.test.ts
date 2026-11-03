// The Structure tab's data (Phase 4a): directory and crawl trees, and the route.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const requirePaidPlan = vi.fn();
vi.mock("@/lib/paid-plan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paid-plan")>()),
  requirePaidPlan: () => requirePaidPlan(),
}));
const crawlJob = { findFirst: vi.fn() };
const crawlPage = { findMany: vi.fn() };
const crawlLink = { findMany: vi.fn() };
vi.mock("@/lib/prisma", () => ({ prisma: { crawlJob, crawlPage, crawlLink } }));

const { crawlTree, directoryTree } = await import("@/lib/site-crawler/graph");
const { GET } = await import("@/app/api/seo/v1/crawl/[id]/graph/route");

const row = (id: string, path: string, depth: number, parentPageId: string | null = null, over: Record<string, unknown> = {}) => ({
  id,
  url: `https://x.com${path}`,
  statusCode: 200,
  noindex: false,
  depth,
  inlinkCount: 3,
  parentPageId,
  ...over,
});

describe("directoryTree", () => {
  it("nests paths, counts pages per folder, marks crawled folders", () => {
    const t = directoryTree([row("r", "/", 0), row("b", "/blog", 1), row("b1", "/blog/a", 2), row("b2", "/blog/b?page=2", 2)]);
    expect(t).toMatchObject({ path: "/", pages: 4, pageId: "r" });
    const blog = t.children.find((c) => c.name === "blog")!;
    expect(blog).toMatchObject({ path: "/blog", pages: 3, pageId: "b" });
    expect(blog.children.map((c) => c.name).sort()).toEqual(["a", "b?page=2"]);
  });
});

describe("crawlTree", () => {
  it("keeps a parent link only when the parent is in the set", () => {
    const t = crawlTree([row("r", "/", 0), row("a", "/a", 1, "r"), row("b", "/b", 2, "missing", { statusCode: 404 })]);
    expect(t.map((n) => [n.id, n.parentId, n.indexable])).toEqual([
      ["r", null, true],
      ["a", "r", true],
      ["b", null, false],
    ]);
  });
});

describe("GET /crawl/[id]/graph", () => {
  const get = (qs: string) => GET(new Request(`https://app.test/api/seo/v1/crawl/c1/graph${qs}`), { params: Promise.resolve({ id: "c1" }) });

  beforeEach(() => {
    vi.clearAllMocks();
    requirePaidPlan.mockResolvedValue({ tenantId: "t1", tenant: { planType: "GROWTH" } });
    crawlJob.findFirst.mockResolvedValue({ id: "c1", dataPurgedAt: null });
    crawlPage.findMany.mockResolvedValue([row("r", "/", 0), row("a", "/a", 1, "r")]);
    crawlLink.findMany.mockResolvedValue([{ fromPageId: "r", toPageId: "a", nofollow: false }]);
  });

  it("links: nodes by inlinks and the edges among them, capped at the limit", async () => {
    const body = await (await get("?kind=links&limit=50")).json();
    expect(body.edges).toEqual([{ source: "r", target: "a", nofollow: false }]);
    expect(crawlPage.findMany.mock.calls[0]![0]).toMatchObject({ where: { crawlJobId: "c1" }, take: 50 });
    expect(crawlLink.findMany.mock.calls[0]![0].where).toEqual({ crawlJobId: "c1", fromPageId: { in: ["r", "a"] }, toPageId: { in: ["r", "a"] } });
  });

  it.each(["", "?kind=sideways", "?kind=links&limit=2001", "?kind=links&limit=0"])("400 on %s", async (qs) => {
    expect((await get(qs)).status).toBe(400);
  });

  it("404 for another tenant, 409 once purged", async () => {
    crawlJob.findFirst.mockResolvedValueOnce(null);
    expect((await get("?kind=directory")).status).toBe(404);
    expect(crawlJob.findFirst.mock.calls[0]![0].where).toEqual({ id: "c1", tenantId: "t1" });
    crawlJob.findFirst.mockResolvedValueOnce({ id: "c1", dataPurgedAt: new Date() });
    expect((await get("?kind=directory")).status).toBe(409);
  });
});
