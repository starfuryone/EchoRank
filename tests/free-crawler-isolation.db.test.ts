// tests/free-crawler-isolation.db.test.ts — the free public crawler against a
// real Postgres: free crawls live in the system tenant (source free) and never
// appear in, or count against, a paid tenant; customer-only tenant queries
// leave it out; the 7-day purge deletes the crawl and its result link
// (cascade) and keeps the lead.
// SKIPPED UNLESS TEST_DATABASE_URL IS SET (see site-crawler-aggregate.db.test.ts).

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

vi.mock("server-only", () => ({}));
vi.mock("@/infrastructure/queue/registry", () => ({ addJob: vi.fn(async () => ({ id: "j" })), getQueue: vi.fn() }));
vi.mock("@/lib/site-crawler/backlink-cost", () => ({ OBSERVED_BACKLINK_UNIT_USD: 0.02, backlinkUnitCostUsd: async () => 0.02, seoBudgetLeftUsd: async () => 1 }));
vi.mock("@/lib/lighthouse/usage", () => ({ auditsUsedThisHour: async () => 0 }));

describe.skipIf(!TEST_DB)("free crawler isolation against Postgres", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  const paidId = `t_paid_${Date.now()}`;
  let freeJobId = "";
  let freeTenantId = "";
  let paidJobId = "";

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    await prisma.tenant.create({ data: { id: paidId, name: "Paid", slug: paidId, planType: "STARTER" } });
    paidJobId = (await prisma.crawlJob.create({ data: { tenantId: paidId, rootUrl: "https://paid.example.com/", urlCap: 10, status: "COMPLETED" } })).id;
    const { enqueueFreeCrawl } = await import("@/lib/site-crawler/free-crawl");
    const job = await enqueueFreeCrawl("https://free.example.org/");
    freeJobId = job.id;
    freeTenantId = job.tenantId;
  });

  afterAll(async () => {
    await prisma.crawlJob.deleteMany({ where: { tenantId: { in: [paidId, freeTenantId] } } });
    await prisma.freeCrawlLead.deleteMany({ where: { token: "tok_isolation_test_0001" } });
    await prisma.tenant.deleteMany({ where: { id: { in: [paidId, freeTenantId] } } });
  });

  it("the free crawl belongs to the free-crawler tenant (source free), not to any paid one", async () => {
    const t = await prisma.tenant.findUnique({ where: { id: freeTenantId }, select: { slug: true, source: true, billingStatus: true } });
    expect(t).toEqual({ slug: "free-crawler", source: "free", billingStatus: "NONE" });
    expect(freeTenantId).not.toBe(paidId);
  });

  it("a paid tenant's list and lookup never return a free crawl", async () => {
    const { findPublicCrawl, listPublicCrawls } = await import("@/lib/site-crawler/public-api");
    expect((await listPublicCrawls(paidId, { limit: 100 })).map((c) => c.crawlId)).toEqual([paidJobId]);
    expect(await findPublicCrawl(paidId, freeJobId)).toBeNull();
  });

  it("free crawls count toward no paid quota", async () => {
    const { getCrawlQuota } = await import("@/lib/site-crawler/quota");
    const before = (await getCrawlQuota(paidId, "STARTER")).used;
    const { enqueueFreeCrawl } = await import("@/lib/site-crawler/free-crawl");
    await enqueueFreeCrawl("https://free2.example.org/");
    expect((await getCrawlQuota(paidId, "STARTER")).used).toBe(before);
  });

  it("customer-only tenant queries leave the system tenant out", async () => {
    const { CUSTOMER_TENANTS } = await import("@/lib/site-crawler/free-tenant");
    const ids = (await prisma.tenant.findMany({ where: CUSTOMER_TENANTS, select: { id: true } })).map((t) => t.id);
    expect(ids).toContain(paidId);
    expect(ids).not.toContain(freeTenantId);
    const { listTenantIds } = await import("@/lib/revenue/store");
    expect(await listTenantIds()).not.toContain(freeTenantId);
  });

  it("the 7-day purge deletes the crawl and its result link, keeps the lead", async () => {
    await prisma.freeCrawl.create({ data: { token: "tok_isolation_test_0001", crawlJobId: freeJobId, domain: "example.org", host: "free.example.org", ipHash: "h" } });
    await prisma.freeCrawlLead.create({ data: { token: "tok_isolation_test_0001", email: "lead@example.org", domain: "example.org" } });
    await prisma.crawlJob.update({ where: { id: freeJobId }, data: { status: "COMPLETED", createdAt: new Date(Date.now() - 8 * 86_400_000) } });
    const { purgeFreeCrawls } = await import("@/lib/site-crawler/retention");
    expect(await purgeFreeCrawls()).toBe(1);
    expect(await prisma.crawlJob.findUnique({ where: { id: freeJobId } })).toBeNull();
    expect(await prisma.freeCrawl.findUnique({ where: { token: "tok_isolation_test_0001" } })).toBeNull();
    expect(await prisma.freeCrawlLead.count({ where: { token: "tok_isolation_test_0001" } })).toBe(1);
    // The paid crawl is untouched.
    expect(await prisma.crawlJob.findUnique({ where: { id: paidJobId }, select: { id: true } })).toEqual({ id: paidJobId });
  });
});
