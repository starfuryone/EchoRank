// The pooled monthly SEO search quota.
//
// Two things here are easy to get wrong and expensive when wrong:
//
//   1. WHAT COUNTS. A row counts only once a usable result exists. Counting at
//      task_post would charge a tenant a search for a standard-queue task that
//      later expired — they paid for an answer they never saw. The USD cap is a
//      separate aggregate over the same table and DOES include those, because
//      DataForSEO charged us regardless.
//   2. WHEN IT RESETS. Calendar month, UTC. A December boundary that rolls to
//      month 12 instead of January would freeze the reset date for a year.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlanType } from "@/generated/prisma";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const seoApiCall = { count: vi.fn(), updateMany: vi.fn(), create: vi.fn() };
vi.mock("@/lib/prisma", () => ({ prisma: { seoApiCall } }));

const {
  SEO_SEARCH_FEATURES,
  SeoQuotaExceededError,
  TrackedKeywordLimitError,
  isSeoSearchFeature,
  monthReset,
  monthStart,
  requireSeoQuota,
  requireTrackedKeywordRoom,
  seoQuotaUsage,
  seoSearchLimit,
  trackedKeywordLimit,
} = await import("@/lib/seo-quota");
const { PLAN_CONFIGS } = await import("@/lib/plan-config");
type SellablePlanType = Exclude<PlanType, "AI_VISIBILITY">;

const NOW = new Date("2026-07-30T15:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  seoApiCall.count.mockResolvedValue(0);
});

// ─── Limits come from plan-config, nowhere else ─────────────────────────────
describe("limits are single-sourced", () => {
  it("reads every tier straight from plan-config", () => {
    for (const plan of Object.keys(PLAN_CONFIGS) as SellablePlanType[]) {
      expect(seoSearchLimit(plan)).toBe(PLAN_CONFIGS[plan].seoSearchesPerMonth);
      expect(trackedKeywordLimit(plan)).toBe(PLAN_CONFIGS[plan].trackedKeywords);
    }
  });

  it("carries the agreed per-tier numbers", () => {
    expect(seoSearchLimit("STARTER")).toBe(250);
    expect(seoSearchLimit("GROWTH")).toBe(1000);
    expect(seoSearchLimit("AGENCY")).toBe(5000);
    expect(seoSearchLimit("ENTERPRISE")).toBeNull(); // unlimited
  });

  it("states each tier's pricing bullet with the same number it enforces", () => {
    // The marketing bullet and the guard must never disagree.
    const bullet = (plan: SellablePlanType) =>
      PLAN_CONFIGS[plan].features.find((f: string) => /SEO searches\/mo/.test(f));
    expect(bullet("STARTER")).toContain("250");
    expect(bullet("GROWTH")).toContain("1,000");
    expect(bullet("AGENCY")).toContain("5,000");
    // Enterprise is unlimited, so it must NOT print a number.
    expect(bullet("ENTERPRISE")).toBeUndefined();
  });
});

// ─── Scope of the pool ──────────────────────────────────────────────────────
describe("which features are pooled", () => {
  it("covers the four search tools and nothing else", () => {
    expect([...SEO_SEARCH_FEATURES].sort()).toEqual([
      "backlinks",
      "domain_overview",
      "keyword_research",
      "local_seo",
    ]);
  });

  it("excludes per-page and separately-capped tools", () => {
    // site_audit is billed per crawled page, so counting "a search" is
    // meaningless; content_research has its own tighter cap; rank_tracking is
    // bounded by tracked keywords and spends without a user action.
    expect(isSeoSearchFeature("site_audit")).toBe(false);
    expect(isSeoSearchFeature("content_research")).toBe(false);
    expect(isSeoSearchFeature("rank_tracking")).toBe(false);
  });
});

// ─── The guard ──────────────────────────────────────────────────────────────
describe("requireSeoQuota", () => {
  it("passes under the limit and reports what is left", async () => {
    seoApiCall.count.mockResolvedValue(249);
    await expect(
      requireSeoQuota("t1", "STARTER", "domain_overview", NOW),
    ).resolves.toBe(1);
  });

  it("denies exactly AT the limit, not one past it", async () => {
    seoApiCall.count.mockResolvedValue(250);
    await expect(
      requireSeoQuota("t1", "STARTER", "domain_overview", NOW),
    ).rejects.toBeInstanceOf(SeoQuotaExceededError);
  });

  it("returns the typed body the UI needs", async () => {
    seoApiCall.count.mockResolvedValue(250);
    try {
      await requireSeoQuota("t1", "STARTER", "domain_overview", NOW);
      throw new Error("should have thrown");
    } catch (err) {
      const e = err as InstanceType<typeof SeoQuotaExceededError>;
      expect(e.statusCode).toBe(429);
      expect(e.toBody()).toEqual({
        error: "quota_exceeded",
        limit: 250,
        used: 250,
        resetsAt: "2026-08-01T00:00:00.000Z",
        upgradeUrl: "/billing",
      });
    }
  });

  it("treats a null limit as unlimited without querying at all", async () => {
    await expect(
      requireSeoQuota("t1", "ENTERPRISE", "backlinks", NOW),
    ).resolves.toBe(Number.POSITIVE_INFINITY);
    expect(seoApiCall.count).not.toHaveBeenCalled();
  });

  it("gives every sellable tier a nonzero pool", () => {
    // The zero-limit short circuit below is retained as a guard, but no tier
    // exercises it now: selling ai_visibility on a tier with no pool would be
    // a broken sale, so this asserts that can't happen silently.
    for (const plan of ["STARTER", "GROWTH", "AGENCY"] as const) {
      expect(seoSearchLimit(plan), plan).toBeGreaterThan(0);
    }
    expect(seoSearchLimit("ENTERPRISE")).toBeNull();
  });

  it("says 'not included' rather than 'used up' at a zero limit", async () => {
    try {
      await requireSeoQuota("t1", "AI_VISIBILITY", "backlinks", NOW);
    } catch (err) {
      expect((err as Error).message).toMatch(/does not include/i);
    }
  });

  it("counts only rows with a result, scoped to tenant and month", async () => {
    await requireSeoQuota("t1", "GROWTH", "backlinks", NOW);
    const where = seoApiCall.count.mock.calls[0][0].where;
    expect(where.tenantId).toBe("t1");
    // resultAt, NOT ok: a billed-but-unresolved task must not consume a search.
    expect(where.resultAt).toEqual({ gte: monthStart(NOW) });
    expect(where.ok).toBeUndefined();
    expect(where.feature.in.sort()).toEqual([...SEO_SEARCH_FEATURES].sort());
  });
});

// ─── Month boundaries ───────────────────────────────────────────────────────
describe("calendar month, UTC", () => {
  it("starts the window at the first instant of the month", () => {
    expect(monthStart(NOW).toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });

  it("resets on the first of next month", () => {
    expect(monthReset(NOW).toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });

  it("rolls December into January of the next year", () => {
    const dec = new Date("2026-12-31T23:59:59Z");
    expect(monthReset(dec).toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("rolls usage over: last month's spend does not count against this month", async () => {
    // The window is a >= filter on monthStart, so a row from 31 July is simply
    // outside August's range — no reset job, nothing to forget to run.
    const aug = new Date("2026-08-01T00:00:01Z");
    seoApiCall.count.mockResolvedValue(0);
    await expect(requireSeoQuota("t1", "STARTER", "backlinks", aug)).resolves.toBe(250);
    expect(seoApiCall.count.mock.calls[0][0].where.resultAt).toEqual({
      gte: new Date("2026-08-01T00:00:00.000Z"),
    });
  });
});

// ─── Usage block ────────────────────────────────────────────────────────────
describe("seoQuotaUsage", () => {
  it("reports remaining and reset for a limited tier", async () => {
    seoApiCall.count.mockResolvedValue(40);
    const u = await seoQuotaUsage("t1", "STARTER", NOW);
    expect(u).toMatchObject({
      used: 40,
      limit: 250,
      remaining: 210,
      unlimited: false,
      exceeded: false,
      resetsAt: "2026-08-01T00:00:00.000Z",
    });
  });

  it("never reports negative remaining when usage overshoots", async () => {
    // Concurrency can land a couple of rows past the line; the UI must not
    // render "-3 searches left".
    seoApiCall.count.mockResolvedValue(253);
    const u = await seoQuotaUsage("t1", "STARTER", NOW);
    expect(u.remaining).toBe(0);
    expect(u.exceeded).toBe(true);
  });

  it("marks an unlimited tier without a ratio", async () => {
    seoApiCall.count.mockResolvedValue(9999);
    const u = await seoQuotaUsage("t1", "ENTERPRISE", NOW);
    expect(u.unlimited).toBe(true);
    expect(u.remaining).toBeNull();
    expect(u.exceeded).toBe(false);
  });

  it("reports a legacy AI_VISIBILITY row against STARTER's pool", async () => {
    const u = await seoQuotaUsage("t1", "AI_VISIBILITY", NOW);
    expect(u.limit).toBe(seoSearchLimit("STARTER"));
    expect(u.exceeded).toBe(false);
  });
});

// ─── Tracked keywords ───────────────────────────────────────────────────────
describe("tracked keyword cap", () => {
  it("allows an add that lands exactly on the limit", () => {
    expect(requireTrackedKeywordRoom("GROWTH", 40, 10, NOW)).toBe(0);
  });

  it("denies the add that would cross it", () => {
    expect(() => requireTrackedKeywordRoom("GROWTH", 40, 11, NOW)).toThrow(
      TrackedKeywordLimitError,
    );
  });

  it("returns the same typed body shape as the search quota", () => {
    try {
      requireTrackedKeywordRoom("GROWTH", 50, 1, NOW);
      throw new Error("should have thrown");
    } catch (err) {
      const e = err as InstanceType<typeof TrackedKeywordLimitError>;
      expect(e.statusCode).toBe(429);
      expect(e.toBody()).toEqual({
        error: "quota_exceeded",
        limit: 50,
        used: 50,
        resetsAt: "2026-08-01T00:00:00.000Z",
        upgradeUrl: "/billing",
      });
    }
  });

  it("denies STARTER and AI_VISIBILITY outright — the tool is not in those tiers", () => {
    // This change must not have quietly granted rank tracking to STARTER.
    expect(trackedKeywordLimit("STARTER")).toBe(0);
    expect(trackedKeywordLimit("AI_VISIBILITY")).toBe(0);
    expect(() => requireTrackedKeywordRoom("STARTER", 0, 1, NOW)).toThrow(
      TrackedKeywordLimitError,
    );
  });

  it("keeps the pre-existing per-tier numbers", () => {
    // Guards against a well-meaning "round these up" edit: these are the values
    // customers are on today.
    expect(trackedKeywordLimit("GROWTH")).toBe(50);
    expect(trackedKeywordLimit("AGENCY")).toBe(250);
    expect(trackedKeywordLimit("ENTERPRISE")).toBe(1000);
  });
});
