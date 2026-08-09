// Per-tier caps, the monthly count, and which statuses consume a slot.
//
// The tier numbers are asserted against PLAN_CONFIGS rather than restated, so
// this cannot drift the way a hand-kept copy of the prices did in July. What IS
// named here is the spec's intent — AI_VISIBILITY locked, AGENCY unlimited —
// because those are product decisions a refactor should not be free to change
// silently.
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { PlanType } from "@/generated/prisma";
import { PLAN_CONFIGS, type SellablePlanType } from "@/lib/plan-config";

const counts = { value: 0 };
vi.mock("@/lib/prisma", () => ({
  prisma: {
    crawlJob: {
      count: vi.fn(async () => counts.value),
    },
  },
}));

const {
  QUOTA_CONSUMING_STATUSES,
  crawlsUsedThisMonth,
  getCrawlQuota,
  monthStart,
  monthlyLimitForPlan,
  urlCapForPlan,
} = await import("@/lib/site-crawler/quota");
const { prisma } = await import("@/lib/prisma");

const ALL_PLANS: SellablePlanType[] = ["STARTER", "GROWTH", "AGENCY", "ENTERPRISE"];

beforeEach(() => {
  counts.value = 0;
  vi.clearAllMocks();
});
afterEach(() => vi.useRealTimers());

describe("per-tier caps", () => {
  it("reads the URL cap from PLAN_CONFIGS, never a second copy", () => {
    for (const plan of ALL_PLANS) {
      expect(urlCapForPlan(plan), plan).toBe(PLAN_CONFIGS[plan].crawlUrlCap);
      expect(monthlyLimitForPlan(plan), plan).toBe(PLAN_CONFIGS[plan].crawlsPerMonth);
    }
  });

  it("matches the numbers the spec asked for", () => {
    expect(urlCapForPlan("STARTER")).toBe(500);
    expect(urlCapForPlan("GROWTH")).toBe(5_000);
    expect(urlCapForPlan("AGENCY")).toBe(25_000);
    expect(urlCapForPlan("ENTERPRISE")).toBe(urlCapForPlan("AGENCY"));

    expect(monthlyLimitForPlan("STARTER")).toBe(4);
    expect(monthlyLimitForPlan("GROWTH")).toBe(20);
    expect(monthlyLimitForPlan("AGENCY")).toBeNull();
    expect(monthlyLimitForPlan("ENTERPRISE")).toBeNull();
  });

  it("orders the caps by tier — a cheaper plan never crawls more", () => {
    expect(urlCapForPlan("STARTER")).toBeLessThan(urlCapForPlan("GROWTH"));
    expect(urlCapForPlan("GROWTH")).toBeLessThan(urlCapForPlan("AGENCY"));
  });
});

describe("monthly window", () => {
  it("starts at the first instant of the UTC month", () => {
    const start = monthStart(new Date("2026-08-05T05:00:00.000Z"));
    expect(start.toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });

  it("counts only this month's rows", async () => {
    counts.value = 3;
    const now = new Date("2026-08-20T00:00:00.000Z");
    await crawlsUsedThisMonth("tenant_1", now);

    const where = vi.mocked(prisma.crawlJob.count).mock.calls[0]![0]!.where!;
    expect(where.tenantId).toBe("tenant_1");
    expect((where.createdAt as { gte: Date }).gte.toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });
});

describe("which statuses consume quota", () => {
  it("charges QUEUED, RUNNING and COMPLETED", () => {
    expect([...QUOTA_CONSUMING_STATUSES].sort()).toEqual(
      ["COMPLETED", "QUEUED", "RUNNING"].sort(),
    );
  });

  it("excludes FAILED and CANCELLED from the count query", async () => {
    // Implemented by EXCLUSION rather than by decrementing a counter: a query
    // that names what it charges for stays correct when a job changes status
    // after the fact.
    await crawlsUsedThisMonth("tenant_1");
    const where = vi.mocked(prisma.crawlJob.count).mock.calls[0]![0]!.where!;
    const statuses = (where.status as { in: string[] }).in;
    expect(statuses).not.toContain("FAILED");
    expect(statuses).not.toContain("CANCELLED");
  });
});

describe("getCrawlQuota", () => {
  it("unlocks a legacy AI_VISIBILITY row, folded onto STARTER", async () => {
    const quota = await getCrawlQuota("tenant_1", "AI_VISIBILITY");
    expect(quota.locked).toBe(false);
    expect(quota.urlCap).toBe(urlCapForPlan("STARTER"));
  });

  it("allows a tier with allowance left", async () => {
    counts.value = 1;
    const quota = await getCrawlQuota("tenant_1", "STARTER");
    expect(quota.allowed).toBe(true);
    expect(quota.used).toBe(1);
    expect(quota.remaining).toBe(3);
  });

  it("denies once the monthly allowance is spent", async () => {
    counts.value = 4;
    const quota = await getCrawlQuota("tenant_1", "STARTER");
    expect(quota.allowed).toBe(false);
    expect(quota.remaining).toBe(0);
  });

  it("never reports negative remaining if the count overshoots", async () => {
    counts.value = 99;
    const quota = await getCrawlQuota("tenant_1", "STARTER");
    expect(quota.remaining).toBe(0);
  });

  it("treats a null monthly limit as unlimited", async () => {
    counts.value = 500;
    const quota = await getCrawlQuota("tenant_1", "AGENCY");
    expect(quota.monthlyLimit).toBeNull();
    expect(quota.remaining).toBeNull();
    expect(quota.allowed).toBe(true);
  });
});
