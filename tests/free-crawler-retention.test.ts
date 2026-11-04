// tests/free-crawler-retention.test.ts — the free public crawler's retention
// (commit 5): the nightly job deletes free crawls older than 7 days outright
// (full data, then the crawl_jobs row; the result link cascades), never a
// RUNNING one, never a paid tenant's crawl, and never a lead; the free tenant
// is skipped by the crawlsKept rule.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const NOW = new Date("2026-11-20T03:00:00Z");
const day = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
type Job = { id: string; tenantId: string; status: string; createdAt: Date; finishedAt: Date; pinned: boolean; dataPurgedAt: Date | null };
const tenants: Record<string, { planType: string; source: string }> = {
  t_free: { planType: "STARTER", source: "free" },
  t_paid: { planType: "STARTER", source: "customer" },
};
let jobs: Job[] = [];
const leads = [{ token: "tok_old", email: "a@b.co" }];
const deleted: string[] = [];
const executeRaw = vi.fn(async () => 0);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const t = tenants[where.id];
        return t ? { ...t, crawlConcurrencyOverride: null, crawlsKeptOverride: null, crawlUrlCapOverride: null } : null;
      }),
    },
    crawlJob: {
      groupBy: vi.fn(async () => [...new Set(jobs.filter((j) => !j.dataPurgedAt && j.status !== "RUNNING" && j.status !== "QUEUED").map((j) => j.tenantId))].map((tenantId) => ({ tenantId }))),
      findMany: vi.fn(async ({ where }: { where: { tenantId?: string; tenant?: { source: string }; createdAt?: { lt: Date }; status?: { not?: string; in?: string[] } } }) => {
        if (where.tenant) {
          return jobs
            .filter((j) => tenants[j.tenantId]!.source === where.tenant!.source && j.createdAt < where.createdAt!.lt && j.status !== where.status!.not)
            .map((j) => ({ id: j.id }));
        }
        return jobs.filter((j) => j.tenantId === where.tenantId && !j.dataPurgedAt && where.status!.in!.includes(j.status));
      }),
      update: vi.fn(async ({ where }: { where: { id: string } }) => {
        const j = jobs.find((x) => x.id === where.id)!;
        j.dataPurgedAt = NOW;
        return j;
      }),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        deleted.push(where.id);
        jobs = jobs.filter((j) => j.id !== where.id);
        return {};
      }),
    },
    crawlComparison: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    crawlSiteDefault: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    freeCrawlLead: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    $executeRaw: (...a: unknown[]) => executeRaw(...(a as [])),
  },
}));

const { runCrawlRetention } = await import("@/lib/site-crawler/retention");
const { prisma } = await import("@/lib/prisma");

const job = (id: string, tenantId: string, status: string, ageDays: number): Job => ({ id, tenantId, status, createdAt: day(ageDays), finishedAt: day(ageDays), pinned: false, dataPurgedAt: null });

beforeEach(() => {
  deleted.length = 0;
  jobs = [
    job("free_8d", "t_free", "COMPLETED", 8),
    job("free_8d_failed", "t_free", "FAILED", 8),
    job("free_8d_running", "t_free", "RUNNING", 8),
    job("free_6d", "t_free", "COMPLETED", 6),
    job("free_1d", "t_free", "COMPLETED", 1),
    job("free_2d", "t_free", "COMPLETED", 2),
    job("free_3d", "t_free", "COMPLETED", 3),
    job("free_4d", "t_free", "COMPLETED", 4),
    job("paid_30d", "t_paid", "COMPLETED", 30),
  ];
});

describe("free crawl retention", () => {
  it("deletes free crawls older than 7 days, data first; spares running, recent and paid ones; keeps leads", async () => {
    const res = await runCrawlRetention(NOW);
    expect(deleted.sort()).toEqual(["free_8d", "free_8d_failed"]);
    expect(res.freeCrawlsDeleted).toBe(2);
    // Full data went first (one batched DELETE per table, per crawl).
    expect(executeRaw.mock.calls.length).toBeGreaterThanOrEqual(2 * 5);
    expect(jobs.map((j) => j.id)).toEqual(expect.arrayContaining(["free_8d_running", "free_6d", "free_1d", "paid_30d"]));
    expect(prisma.freeCrawlLead.deleteMany).not.toHaveBeenCalled();
    expect(leads).toHaveLength(1);
  });

  it("does not run the free tenant through crawlsKept (STARTER would purge its older recent crawls)", async () => {
    await runCrawlRetention(NOW);
    // Six recent free crawls, STARTER keeps fewer: none of them lost its data.
    for (const id of ["free_6d", "free_1d", "free_2d", "free_3d", "free_4d"]) expect(jobs.find((j) => j.id === id)!.dataPurgedAt).toBeNull();
  });
});
