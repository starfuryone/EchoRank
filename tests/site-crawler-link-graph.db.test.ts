// tests/site-crawler-link-graph.db.test.ts
//
// The Phase 4a link graph against a real Postgres: target and parent ids
// resolved by URL, the broken-link join, inlinks, redirect chains, and edges
// going with their source page.
//
// SKIPPED UNLESS TEST_DATABASE_URL IS SET (the configured DATABASE_URL is
// production). See tests/site-crawler-aggregate.db.test.ts for the recipe.

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

vi.mock("server-only", () => ({}));

const ROOT = "https://graph.example.com/";
const u = (path: string) => new URL(path, ROOT).toString();

describe.skipIf(!TEST_DB)("link graph against Postgres", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let g: typeof import("@/lib/site-crawler/link-graph");
  const tenantId = `t_graph_${Date.now()}`;
  const jobId = `j_graph_${Date.now()}`;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    g = await import("@/lib/site-crawler/link-graph");
    await prisma.tenant.create({ data: { id: tenantId, name: "graph", slug: tenantId } });
    await prisma.crawlJob.create({ data: { id: jobId, tenantId, rootUrl: ROOT, urlCap: 100 } });
    const pages: [string, number | null, number | null, string | null, unknown][] = [
      ["/", 200, 10, null, null],
      ["/a", 200, 10, u("/"), null],
      ["/gone", 404, 10, u("/"), null],
      ["/down", null, 15000, u("/a"), null],
      ["/blocked", null, null, u("/"), null],
      ["/old", 200, 10, u("/a"), [{ url: u("/old"), status: 301 }, { url: u("/a"), status: 200 }]],
    ];
    for (const [path, statusCode, fetchMs, foundOn, redirectChain] of pages) {
      const p = await prisma.crawlPage.create({
        data: { crawlJobId: jobId, url: u(path), statusCode, fetchMs, depth: 1, foundOn, ...(redirectChain ? { redirectChain: redirectChain as object[] } : {}) },
      });
      ids[path] = p.id;
    }
    const edge = (from: string, to: string, anchor: string, position: number, nofollow = false) => ({
      crawlJobId: jobId,
      fromPageId: ids[from]!,
      toUrl: u(to),
      anchor,
      position,
      nofollow,
    });
    await prisma.crawlLink.createMany({
      data: [
        edge("/", "/a", "About", 0),
        edge("/", "/gone", "Old offer", 1),
        edge("/", "/blocked", "Admin", 2),
        edge("/a", "/gone", "Offer", 0, true),
        edge("/a", "/down", "Status", 1),
        edge("/a", "/never-crawled", "Later", 2),
      ],
    });
    await g.resolveLinkGraph(jobId);
  });

  afterAll(async () => {
    await prisma?.tenant.delete({ where: { id: tenantId } }).catch(() => {});
  });

  it("resolves link targets and BFS parents by URL", async () => {
    const links = await prisma.crawlLink.findMany({ where: { crawlJobId: jobId }, select: { toUrl: true, toPageId: true } });
    expect(links.find((l) => l.toUrl === u("/a"))!.toPageId).toBe(ids["/a"]);
    expect(links.find((l) => l.toUrl === u("/never-crawled"))!.toPageId).toBeNull();
    const down = await prisma.crawlPage.findUnique({ where: { id: ids["/down"]! }, select: { parentPageId: true } });
    expect(down!.parentPageId).toBe(ids["/a"]);
  });

  it("lists broken links with source and anchor: 4xx and no-response, not robots-blocked", async () => {
    const rows = await g.brokenLinksPage(jobId, null, 100);
    expect(rows.map((r) => [r.source, r.target, r.anchor, r.statusCode]).sort()).toEqual(
      [
        [u("/"), u("/gone"), "Old offer", 404],
        [u("/a"), u("/down"), "Status", null],
        [u("/a"), u("/gone"), "Offer", 404],
      ].sort(),
    );
  });

  it("pages through broken links by cursor without repeating", async () => {
    const first = await g.brokenLinksPage(jobId, null, 2);
    const rest = await g.brokenLinksPage(jobId, first.at(-1)!.id, 2);
    expect([...first, ...rest].map((r) => r.id)).toHaveLength(3);
    expect(new Set([...first, ...rest].map((r) => r.id)).size).toBe(3);
  });

  it("lists a page's inlinks with anchor and nofollow", async () => {
    const rows = await g.inlinksPage(jobId, ids["/gone"]!, null, 100);
    expect(rows.map((r) => [r.source, r.anchor, r.nofollow]).sort()).toEqual([
      [u("/"), "Old offer", false],
      [u("/a"), "Offer", true],
    ]);
  });

  it("lists redirecting URLs with their chain", async () => {
    const rows = await g.redirectChainsPage(jobId, null, 100);
    expect(rows).toEqual([expect.objectContaining({ url: u("/old"), foundOn: u("/a") })]);
  });

  it("deleting a source page deletes its edges", async () => {
    await prisma.crawlPage.delete({ where: { id: ids["/a"]! } });
    expect(await prisma.crawlLink.count({ where: { crawlJobId: jobId, fromPageId: ids["/a"]! } })).toBe(0);
    expect(await prisma.crawlLink.count({ where: { crawlJobId: jobId } })).toBe(3);
  });
});
