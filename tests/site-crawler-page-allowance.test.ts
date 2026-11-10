// The site crawler's monthly page allowance (src/lib/site-crawler/page-
// allowance.ts, 2026-11-10): the plan figures, the 1st-of-the-month UTC
// reset, the Postgres sum (every status, this month's jobs), the staff
// override, the refusal and its HTTP shape, and the public copy from config.
// The runner's clean stop and the scheduled skip + email are tested in
// site-crawler-runner.test.ts and site-crawler-schedule.test.ts.
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({ used: 0, override: null as number | null, lastWhere: null as unknown }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    crawlJob: {
      aggregate: vi.fn(async (a: { where: unknown }) => {
        db.lastWhere = a.where;
        return { _sum: { pagesCrawled: db.used } };
      }),
      count: vi.fn(async () => 0),
    },
    tenant: { findUnique: vi.fn(async () => ({ crawlConcurrencyOverride: null, crawlsKeptOverride: null, crawlUrlCapOverride: null, crawlPagesPerMonthOverride: db.override })) },
  },
}));

import { PLAN_CONFIGS } from "@/lib/plan-config";
import {
  allowanceFrom,
  allowanceMonthStart,
  allowanceResetsAt,
  pageAllowance,
  pagesLeftForJob,
  pagesUsedThisMonth,
} from "@/lib/site-crawler/page-allowance";
import { CrawlPageAllowanceError } from "@/lib/site-crawler/errors";
import { crawlRouteError } from "@/lib/site-crawler/http";
import { comparisonTable } from "@/lib/pricing-page/compare";

beforeEach(() => {
  db.used = 0;
  db.override = null;
  db.lastWhere = null;
});

describe("plan config", () => {
  it("Starter 25,000, Growth 100,000, Agency 300,000 pages a month; none on the AI-only plan; Enterprise Agency's by default", () => {
    expect(PLAN_CONFIGS.STARTER.crawlPagesPerMonth).toBe(25_000);
    expect(PLAN_CONFIGS.GROWTH.crawlPagesPerMonth).toBe(100_000);
    expect(PLAN_CONFIGS.AGENCY.crawlPagesPerMonth).toBe(300_000);
    expect(PLAN_CONFIGS.AI_VISIBILITY.crawlPagesPerMonth).toBe(0);
    expect(PLAN_CONFIGS.ENTERPRISE.crawlPagesPerMonth).toBe(300_000);
    // Starter: config supports 2,500 URLs per crawl (the "500 vs 2,500" question).
    expect(PLAN_CONFIGS.STARTER.crawlUrlCap).toBe(2_500);
  });
});

describe("the month", () => {
  it("starts and resets on the 1st, 00:00 UTC", () => {
    const mid = new Date("2026-11-15T23:30:00Z");
    expect(allowanceMonthStart(mid).toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(allowanceResetsAt(mid).toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(allowanceResetsAt(new Date("2026-12-31T23:59:59Z")).toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("counts every job created this month, whatever its status, and can leave one out", async () => {
    const now = new Date("2026-11-15T12:00:00Z");
    db.used = 1234;
    expect(await pagesUsedThisMonth("t1", now)).toBe(1234);
    expect(db.lastWhere).toEqual({ tenantId: "t1", createdAt: { gte: new Date("2026-11-01T00:00:00Z") } });
    await pagesUsedThisMonth("t1", now, "job_9");
    expect(db.lastWhere).toEqual({ tenantId: "t1", createdAt: { gte: new Date("2026-11-01T00:00:00Z") }, id: { not: "job_9" } });
  });

  it("x / y with what is left; unlimited is null", () => {
    expect(allowanceFrom(25_000, 24_000, new Date("2026-11-02T00:00:00Z"))).toEqual({ limit: 25_000, used: 24_000, remaining: 1_000, resetsAt: "2026-12-01T00:00:00.000Z" });
    expect(allowanceFrom(25_000, 30_000).remaining).toBe(0);
    expect(allowanceFrom(null, 5).remaining).toBeNull();
  });
});

describe("the tenant's allowance", () => {
  it("the plan's, unless staff set an override", async () => {
    db.used = 100;
    expect(await pageAllowance("t1", "GROWTH")).toMatchObject({ limit: 100_000, used: 100, remaining: 99_900 });
    db.override = 2_000_000;
    expect(await pageAllowance("t1", "ENTERPRISE")).toMatchObject({ limit: 2_000_000 });
  });

  it("the runner's gate: what the month has left after the other crawls and this one", async () => {
    db.used = 900;
    expect(await pagesLeftForJob("t1", 1_000, "job_1", 50)).toBe(50);
    expect(await pagesLeftForJob("t1", 1_000, "job_1", 100)).toBe(0);
    expect(await pagesLeftForJob("t1", 1_000, "job_1", 500)).toBe(0);
    expect(await pagesLeftForJob("t1", null, "job_1", 1e9)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("the refusal", () => {
  it("429 PAGE_ALLOWANCE_EXCEEDED with used, limit and the reset", async () => {
    const res = crawlRouteError(new CrawlPageAllowanceError(25_000, 25_000, "2026-12-01T00:00:00.000Z"));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body).toMatchObject({ code: "PAGE_ALLOWANCE_EXCEEDED", limit: 25_000, used: 25_000, resetsAt: "2026-12-01T00:00:00.000Z", upgradeHref: "/billing" });
    expect(body.error).toBe("Monthly allowance reached: 25,000 of 25,000 pages this month.");
  });
});

describe("public copy from config", () => {
  it("/pricing's comparison table has a pages-per-month row read from crawlPagesPerMonth", () => {
    const crawler = comparisonTable("en").groups.find((g) => g.id === "crawler")!;
    const row = crawler.rows.find((r) => r.id === "crawl-pages")!;
    expect(row).toBeTruthy();
    const text = JSON.stringify(row);
    for (const p of ["STARTER", "GROWTH", "AGENCY"] as const) {
      expect(text).toContain(PLAN_CONFIGS[p].crawlPagesPerMonth!.toLocaleString("en-US"));
    }
  });
});
