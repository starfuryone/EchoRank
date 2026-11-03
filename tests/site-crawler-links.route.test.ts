// Phase 4a link-graph routes: broken-links and redirects exports, the Inlinks
// panel. Tenant-scoped like every crawl route; CSV through the shared streamer.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const requirePaidPlan = vi.fn();
vi.mock("@/lib/paid-plan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paid-plan")>()),
  requirePaidPlan: () => requirePaidPlan(),
}));

const crawlJob = { findFirst: vi.fn() };
const crawlPage = { findFirst: vi.fn() };
vi.mock("@/lib/prisma", () => ({ prisma: { crawlJob, crawlPage } }));

const graph = { brokenLinksPage: vi.fn(), redirectChainsPage: vi.fn(), inlinksPage: vi.fn() };
vi.mock("@/lib/site-crawler/link-graph", () => graph);

const { GET: exportCsv } = await import("@/app/api/seo/v1/crawl/[id]/export/route");
const { GET: inlinks } = await import("@/app/api/seo/v1/crawl/[id]/pages/[pageId]/inlinks/route");

const req = (path: string) => new Request(`https://app.test/api/seo/v1/crawl/${path}`);
const lines = async (res: Response) => (await res.text()).replace(/^﻿/, "").trim().split("\r\n");

beforeEach(() => {
  vi.clearAllMocks();
  requirePaidPlan.mockResolvedValue({ tenantId: "t1", tenant: { planType: "GROWTH" } });
  crawlJob.findFirst.mockResolvedValue({ id: "c1" });
  graph.brokenLinksPage.mockResolvedValueOnce([
    { id: "l1", source: "https://x.com/", target: "https://x.com/gone", anchor: "=HYPERLINK(1)", statusCode: 404 },
    { id: "l2", source: "https://x.com/a", target: "https://x.com/down", anchor: "Status", statusCode: null },
  ]).mockResolvedValue([]);
  graph.redirectChainsPage.mockResolvedValueOnce([
    { id: "p1", url: "https://x.com/old", foundOn: "https://x.com/", redirectChain: [{ url: "https://x.com/old", status: 301 }, { url: "https://x.com/mid", status: 302 }, { url: "https://x.com/new", status: 200 }] },
  ]).mockResolvedValue([]);
});

describe("export views", () => {
  it("broken-links: one row per source, broken URL, anchor and status, formula-guarded", async () => {
    const out = await lines(await exportCsv(req("c1/export?view=broken-links"), { params: Promise.resolve({ id: "c1" }) }));
    expect(out).toEqual([
      "Source URL,Broken URL,Anchor text,Status code",
      "https://x.com/,https://x.com/gone,'=HYPERLINK(1),404",
      "https://x.com/a,https://x.com/down,Status,no response",
    ]);
    expect(graph.brokenLinksPage.mock.calls[0]![0]).toBe("c1");
  });

  it("redirects: every hop with its status", async () => {
    const out = await lines(await exportCsv(req("c1/export?view=redirects"), { params: Promise.resolve({ id: "c1" }) }));
    expect(out[0]).toBe("URL,Redirects,First status,Final URL,Final status,Chain,Found on");
    expect(out[1]).toBe(
      "https://x.com/old,2,301,https://x.com/new,200,https://x.com/old (301) → https://x.com/mid (302) → https://x.com/new (200),https://x.com/",
    );
  });

  it("404s another tenant's crawl and 400s an unknown view", async () => {
    crawlJob.findFirst.mockResolvedValueOnce(null);
    expect((await exportCsv(req("c9/export?view=broken-links"), { params: Promise.resolve({ id: "c9" }) })).status).toBe(404);
    expect(crawlJob.findFirst.mock.calls[0]![0].where).toEqual({ id: "c9", tenantId: "t1" });
    expect((await exportCsv(req("c1/export?view=secrets"), { params: Promise.resolve({ id: "c1" }) })).status).toBe(400);
  });
});

describe("inlinks", () => {
  const params = { params: Promise.resolve({ id: "c1", pageId: "p1" }) };

  it("is scoped through the crawl to the caller's tenant", async () => {
    crawlPage.findFirst.mockResolvedValue(null);
    expect((await inlinks(req("c1/pages/p1/inlinks"), params)).status).toBe(404);
    expect(crawlPage.findFirst.mock.calls[0]![0].where).toEqual({ id: "p1", crawlJobId: "c1", crawlJob: { tenantId: "t1" } });
  });

  it("pages by cursor", async () => {
    crawlPage.findFirst.mockResolvedValue({ id: "p1", crawlJobId: "c1", url: "https://x.com/gone", inlinkCount: 101 });
    graph.inlinksPage.mockResolvedValue(Array.from({ length: 101 }, (_, i) => ({ id: `l${i}`, source: `https://x.com/${i}`, anchor: "a", nofollow: false })));
    const body = await (await inlinks(req("c1/pages/p1/inlinks"), params)).json();
    expect(body.inlinks).toHaveLength(100);
    expect(body.next).toBe("l99");
  });

  it("streams CSV", async () => {
    crawlPage.findFirst.mockResolvedValue({ id: "p1", crawlJobId: "c1", url: "https://x.com/gone", inlinkCount: 1 });
    graph.inlinksPage.mockResolvedValueOnce([{ id: "l1", source: "https://x.com/", anchor: "Old offer", nofollow: true }]).mockResolvedValue([]);
    expect(await lines(await inlinks(req("c1/pages/p1/inlinks?format=csv"), params))).toEqual([
      "Source URL,Anchor text,Nofollow",
      "https://x.com/,Old offer,true",
    ]);
  });
});
