// tests/site-crawler-retention.db.test.ts
//
// Retention against a real Postgres: batched deletes take pages, issues and
// links, leave the row and its summary, and spare kept and pinned crawls.
// SKIPPED UNLESS TEST_DATABASE_URL IS SET (see site-crawler-aggregate.db.test.ts).

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

vi.mock("server-only", () => ({}));

describe.skipIf(!TEST_DB)("retention against Postgres", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let r: typeof import("@/lib/site-crawler/retention");
  const tenantId = `t_ret_${Date.now()}`;
  const job = (n: number) => `${tenantId}_j${n}`;

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    r = await import("@/lib/site-crawler/retention");
    await prisma.tenant.create({ data: { id: tenantId, name: "ret", slug: tenantId, planType: "STARTER" } });
    // Five completed crawls, oldest first; the oldest is pinned. STARTER keeps 3.
    for (let n = 1; n <= 5; n++) {
      await prisma.crawlJob.create({
        data: { id: job(n), tenantId, rootUrl: "https://ret.example.com/", urlCap: 10, status: "COMPLETED", pinned: n === 1, summary: { n }, createdAt: new Date(Date.UTC(2026, 9, n)) },
      });
      for (let p = 0; p < 7; p++) {
        const page = await prisma.crawlPage.create({
          data: { crawlJobId: job(n), url: `https://ret.example.com/${p}`, depth: 1, issues: { create: [{ crawlJobId: job(n), type: "x", severity: "NOTICE", ruleId: "x" }] } },
        });
        await prisma.crawlLink.create({ data: { crawlJobId: job(n), fromPageId: page.id, toUrl: "https://ret.example.com/", position: 0 } });
        await prisma.crawlExtraction.create({ data: { crawlJobId: job(n), pageId: page.id, extractorIndex: 0, values: ["v"] } });
      }
    }
  });

  afterAll(async () => {
    await prisma?.tenant.delete({ where: { id: tenantId } }).catch(() => {});
  });

  it("purges in batches, keeps the row and summary", async () => {
    const deleted = await r.purgeCrawlData(job(2), 3);
    expect(deleted).toBe(28); // 7 issues + 7 extractions + 7 links + 7 pages, three at a time
    const row = await prisma.crawlJob.findUnique({ where: { id: job(2) } });
    expect(row).toMatchObject({ summary: { n: 2 } });
    expect(row!.dataPurgedAt).not.toBeNull();
    expect(await prisma.crawlPage.count({ where: { crawlJobId: job(2) } })).toBe(0);
    expect(await prisma.crawlExtraction.count({ where: { crawlJobId: job(2) } })).toBe(0);
  });

  it("the nightly run spares the 3 newest and the pinned one", async () => {
    const result = await r.runCrawlRetention();
    expect(result.crawlsPurged).toBeGreaterThanOrEqual(0);
    const pagesLeft = async (n: number) => prisma.crawlPage.count({ where: { crawlJobId: job(n) } });
    expect([await pagesLeft(1), await pagesLeft(3), await pagesLeft(4), await pagesLeft(5)]).toEqual([7, 7, 7, 7]);
    // job 2 was already purged; a second night changes nothing.
    const again = await r.runCrawlRetention();
    expect(await prisma.crawlJob.count({ where: { tenantId, dataPurgedAt: { not: null } } })).toBe(1);
    expect(again.crawlsPurged).toBe(0);
  });

  it("a newer crawl pushes the oldest unpinned one out", async () => {
    await prisma.crawlJob.create({
      data: { id: job(6), tenantId, rootUrl: "https://ret.example.com/", urlCap: 10, status: "COMPLETED", createdAt: new Date(Date.UTC(2026, 9, 6)) },
    });
    await r.runCrawlRetention();
    const purged = await prisma.crawlJob.findMany({ where: { tenantId, dataPurgedAt: { not: null } }, select: { id: true }, orderBy: { id: "asc" } });
    expect(purged.map((j) => j.id)).toEqual([job(2), job(3)]);
    expect(await prisma.crawlLink.count({ where: { crawlJobId: job(3) } })).toBe(0);
    expect(await prisma.crawlPage.count({ where: { crawlJobId: job(1) } })).toBe(7);
  });
});
