// tests/site-crawler-sitemap.db.test.ts
//
// Which crawled pages the sitemap generator lists, against a real Postgres.
// SKIPPED UNLESS TEST_DATABASE_URL IS SET (see site-crawler-aggregate.db.test.ts).

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

vi.mock("server-only", () => ({}));

const ROOT = "https://smap.example.com/";
const u = (path: string) => new URL(path, ROOT).toString();

describe.skipIf(!TEST_DB)("sitemap rows against Postgres", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let sitemapRowsPage: typeof import("@/lib/site-crawler/sitemap-generator").sitemapRowsPage;
  const tenantId = `t_smap_${Date.now()}`;
  const jobId = `j_smap_${Date.now()}`;

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    ({ sitemapRowsPage } = await import("@/lib/site-crawler/sitemap-generator"));
    await prisma.tenant.create({ data: { id: tenantId, name: "smap", slug: tenantId } });
    await prisma.crawlJob.create({ data: { id: jobId, tenantId, rootUrl: ROOT, urlCap: 100 } });
    const html = "text/html; charset=utf-8";
    const pages: [string, Record<string, unknown>][] = [
      ["/listed", { statusCode: 200, contentType: html, noindex: false, imgSrcs: [u("/i.png")] }],
      ["/self-canonical", { statusCode: 200, contentType: html, canonical: u("/self-canonical/") }],
      ["/noindex", { statusCode: 200, contentType: html, noindex: true }],
      ["/canonical-elsewhere", { statusCode: 200, contentType: html, canonical: u("/listed") }],
      ["/redirect", { statusCode: 301, contentType: html }],
      ["/pdf", { statusCode: 200, contentType: "application/pdf" }],
      ["/blocked", { statusCode: null }],
    ];
    for (const [path, data] of pages) await prisma.crawlPage.create({ data: { crawlJobId: jobId, url: u(path), depth: 1, ...data } });
  });

  afterAll(async () => {
    await prisma?.tenant.delete({ where: { id: tenantId } }).catch(() => {});
  });

  it("lists indexable 200 HTML pages that are their own canonical", async () => {
    const rows = await sitemapRowsPage(jobId, null);
    expect(rows.map((r) => r.url).sort()).toEqual([u("/listed"), u("/self-canonical")]);
    expect(rows.find((r) => r.url === u("/listed"))!.imgSrcs).toEqual([u("/i.png")]);
  });

  it("pages by cursor", async () => {
    const first = await sitemapRowsPage(jobId, null, 1);
    const second = await sitemapRowsPage(jobId, first[0]!.id, 1);
    expect(second).toHaveLength(1);
    expect(second[0]!.id > first[0]!.id).toBe(true);
  });
});
