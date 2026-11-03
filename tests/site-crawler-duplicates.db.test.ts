// tests/site-crawler-duplicates.db.test.ts
//
// The Duplicates tab against a real Postgres: groups and their total for
// each kind. The total query once bound the kind twice (GROUP BY and HAVING
// CASE expressions Postgres could not match) and failed with 42803.
//
// SKIPPED UNLESS TEST_DATABASE_URL IS SET (the configured DATABASE_URL is
// production). See tests/site-crawler-aggregate.db.test.ts for the recipe.

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

vi.mock("server-only", () => ({}));
const requirePaidPlan = vi.fn();
vi.mock("@/lib/paid-plan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paid-plan")>()),
  requirePaidPlan: () => requirePaidPlan(),
}));

describe.skipIf(!TEST_DB)("duplicates route against Postgres", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let GET: typeof import("@/app/api/seo/v1/crawl/[id]/duplicates/route").GET;
  const tenantId = `t_dup_${Date.now()}`;
  const jobId = `j_dup_${Date.now()}`;

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    ({ GET } = await import("@/app/api/seo/v1/crawl/[id]/duplicates/route"));
    requirePaidPlan.mockResolvedValue({ tenantId, tenant: { planType: "GROWTH" } });
    await prisma.tenant.create({ data: { id: tenantId, name: "dup", slug: tenantId } });
    await prisma.crawlJob.create({ data: { id: jobId, tenantId, rootUrl: "https://dup.example.com/", urlCap: 100, status: "COMPLETED" } });
    const page = (path: string, title: string, metaDescription: string | null, contentHash: string) => ({
      crawlJobId: jobId, url: `https://dup.example.com${path}`, statusCode: 200, contentType: "text/html; charset=utf-8", depth: 1, title, metaDescription, contentHash,
    });
    await prisma.crawlPage.createMany({
      data: [
        page("/a", "T1", "M1", "h1"),
        page("/b", "T1", "M1", "h1"),
        page("/c", "T2", "M1", "h2"),
        page("/d", "T2", null, "h3"),
        page("/e", "T3", "", "h4"),
        page("/f", "T4", "", "h5"),
      ],
    });
  });

  afterAll(async () => {
    await prisma?.tenant.delete({ where: { id: tenantId } }).catch(() => {});
  });

  it.each([
    ["title", 2, [2, 2]],
    ["meta", 1, [3]],
    ["content", 1, [2]],
  ] as const)("%s: %i groups", async (type, total, members) => {
    const res = await GET(new Request(`https://app.test/api/seo/v1/crawl/${jobId}/duplicates?type=${type}`), { params: Promise.resolve({ id: jobId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(total);
    expect(body.groups.map((g: { members: number }) => g.members)).toEqual(members);
  });
});
