// tests/site-crawler-external.db.test.ts — Phase 4g external links against
// Postgres: each distinct external URL is resolved ONCE per crawl (not per
// source page), most-linked first, the per-crawl HEAD cache is reused; the
// External tab groups by URL with source counts and filters; aggregation's
// external_4xx carries "found on". SKIPPED UNLESS TEST_DATABASE_URL IS SET.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;
vi.mock("server-only", () => ({}));
const requirePaidPlan = vi.fn();
vi.mock("@/lib/paid-plan", async (orig) => ({ ...(await orig<typeof import("@/lib/paid-plan")>()), requirePaidPlan: () => requirePaidPlan() }));

describe.skipIf(!TEST_DB)("external links against Postgres", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let x: typeof import("@/lib/site-crawler/external-links");
  const tenantId = `t_ext_${Date.now()}`;
  const job = `${tenantId}_j`;
  const ids: string[] = [];
  const cache = new Map<string, string>();
  const redis = {
    hget: async (_k: string, f: string) => cache.get(f) ?? null,
    hset: async (_k: string, f: string, v: string) => void cache.set(f, v),
    expire: async () => 1,
  };

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    x = await import("@/lib/site-crawler/external-links");
    await prisma.tenant.create({ data: { id: tenantId, name: "ext", slug: tenantId, planType: "GROWTH" } });
    await prisma.crawlJob.create({ data: { id: job, tenantId, rootUrl: "https://site.example/", urlCap: 10, status: "COMPLETED" } });
    for (const p of ["a", "b", "c"]) ids.push((await prisma.crawlPage.create({ data: { crawlJobId: job, url: `https://site.example/${p}`, depth: 1 } })).id);
    const link = (from: number, toUrl: string, anchor: string | null, position = 0) => ({ crawlJobId: job, fromPageId: ids[from]!, toUrl, anchor, position, isExternal: true });
    await prisma.crawlLink.createMany({
      data: [
        link(0, "https://gone.example/x", "Old docs"), link(1, "https://gone.example/x", "docs", 3), link(2, "https://gone.example/x", null),
        link(0, "https://down.example/", "Down"), link(1, "https://ok.example/", "OK"),
        // already checked by a page-time HEAD (cache hit, never asked again)
        link(2, "https://cached.example/", "Cached"),
        // an internal edge is not touched
        { crawlJobId: job, fromPageId: ids[0]!, toUrl: "https://site.example/b", anchor: "b", position: 1 },
      ],
    });
    cache.set("https://cached.example/", "301|");
  });
  afterAll(async () => {
    await prisma?.tenant.delete({ where: { id: tenantId } }).catch(() => {});
  });

  it("resolves each external URL once, most-linked first, reusing the crawl's HEAD cache", async () => {
    const asked: string[] = [];
    const headFn = async (u: string) => (asked.push(u), { status: u.includes("gone") ? 404 : u.includes("down") ? 503 : 200, bytes: null });
    const out = await x.resolveExternalStatuses(job, redis, "k", headFn);
    expect(out).toEqual({ urls: 4, checked: 4, capped: false });
    expect(asked.sort()).toEqual(["https://down.example/", "https://gone.example/x", "https://ok.example/"]);
    const rows = await prisma.crawlLink.findMany({ where: { crawlJobId: job }, select: { toUrl: true, status: true, isExternal: true } });
    expect(rows.filter((r) => r.toUrl === "https://gone.example/x").map((r) => r.status)).toEqual([404, 404, 404]);
    expect(rows.find((r) => r.toUrl === "https://cached.example/")!.status).toBe(301);
    expect(rows.find((r) => !r.isExternal)!.status).toBeNull();
    // A second pass asks nobody: every URL is in the cache now.
    asked.length = 0;
    await x.resolveExternalStatuses(job, redis, "k", headFn);
    expect(asked).toEqual([]);
  });

  it("gives each source page its broken count, a sample and how many pages it is found on", async () => {
    const facts = await x.externalFacts(job);
    expect(facts.get(ids[0]!)).toEqual({ checked: 2, clientErrors: 1, serverErrors: 1, sample: "https://gone.example/x", sampleStatus: 404, foundOn: 3 });
    expect(facts.get(ids[2]!)).toMatchObject({ clientErrors: 1, serverErrors: 0, foundOn: 3 });
  });

  it("groups the External tab by URL with source counts, first anchor, status and host filters", async () => {
    const all = await x.externalRows(job, { statusClass: null, host: null }, { take: 10 });
    expect(all[0]).toEqual({ url: "https://gone.example/x", host: "gone.example", status: 404, sources: 3, firstAnchor: "Old docs" });
    expect(await x.externalCount(job, { statusClass: "4xx", host: null })).toBe(1);
    expect((await x.externalRows(job, { statusClass: "5xx", host: null }, { take: 10 })).map((r) => r.url)).toEqual(["https://down.example/"]);
    expect((await x.externalRows(job, { statusClass: null, host: "ok.example" }, { take: 10 })).map((r) => r.url)).toEqual(["https://ok.example/"]);
    expect((await x.externalSources(job, "https://gone.example/x", 10)).map((s) => s.url)).toEqual(ids.map((_, i) => `https://site.example/${"abc"[i]}`));
  });

  it("the route is tenant-scoped and streams a CSV", async () => {
    const { GET } = await import("@/app/api/seo/v1/crawl/[id]/external/route");
    requirePaidPlan.mockResolvedValue({ tenantId, tenant: { planType: "GROWTH" } });
    const csv = await (await GET(new Request(`https://app.test/x?format=csv`), { params: Promise.resolve({ id: job }) })).text();
    expect(csv.replace(/^﻿/, "").split("\r\n")[0]).toBe("URL,Status,Source pages,First anchor,Host");
    expect(csv).toContain("https://gone.example/x,404,3,Old docs,gone.example");
    requirePaidPlan.mockResolvedValue({ tenantId: "someone-else", tenant: { planType: "GROWTH" } });
    expect((await GET(new Request("https://app.test/x"), { params: Promise.resolve({ id: job }) })).status).toBe(404);
  });
});
