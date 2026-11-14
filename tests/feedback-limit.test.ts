// The monthly feedback-request allowance (src/lib/feedback-limit.ts): one
// helper for the sender, the /billing meter and the plan hub. PLAN_CONFIGS is
// the limit; the stored per-tenant value counts for Enterprise only.
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  tenantFind: vi.fn(),
  feedbackCount: vi.fn(),
  customerFind: vi.fn(),
  feedbackCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: { findUnique: m.tenantFind },
    feedback: { count: m.feedbackCount, create: m.feedbackCreate },
    customer: { findFirst: m.customerFind },
    campaign: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/tenant", () => ({ requireTenant: async () => ({ tenantId: "t1", userId: "u1" }) }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn(async () => undefined) }));

import { PLAN_CONFIGS, PLAN_ORDER } from "@/lib/plan-config";
import {
  effectiveFeedbackLimit,
  feedbackAllowance,
  feedbackMonthResetsAt,
  feedbackMonthStart,
} from "@/lib/feedback-limit";

const NOW = new Date("2026-11-14T12:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("effectiveFeedbackLimit", () => {
  it("is PLAN_CONFIGS maxRequestsPerMonth for every plan but Enterprise, whatever is stored", () => {
    for (const planType of [...PLAN_ORDER, "NOSY_BAT"] as const) {
      if (planType === "ENTERPRISE") continue;
      expect(effectiveFeedbackLimit({ planType, monthlyRequestLimit: 10_000 }), planType).toBe(
        PLAN_CONFIGS[planType].quotaDefaults.maxRequestsPerMonth,
      );
    }
  });

  it("is the stored, contracted value on Enterprise", () => {
    expect(effectiveFeedbackLimit({ planType: "ENTERPRISE", monthlyRequestLimit: 42_000 })).toBe(42_000);
  });

  it("counts the calendar month, UTC", () => {
    expect(feedbackMonthStart(NOW).toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(feedbackMonthResetsAt(NOW).toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(feedbackMonthResetsAt(new Date("2026-12-31T23:59:59Z")).toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});

describe("feedbackAllowance", () => {
  it("allows below the limit and refuses at it", async () => {
    m.tenantFind.mockResolvedValue({ planType: "STARTER", monthlyRequestLimit: 10_000 });
    m.feedbackCount.mockResolvedValue(499);
    expect(await feedbackAllowance("t1", NOW)).toMatchObject({ allowed: true, used: 499, limit: 500 });
    m.feedbackCount.mockResolvedValue(500);
    expect(await feedbackAllowance("t1", NOW)).toMatchObject({ allowed: false, used: 500, limit: 500 });
    expect(m.feedbackCount).toHaveBeenCalledWith({ where: { tenantId: "t1", createdAt: { gte: new Date("2026-11-01T00:00:00Z") } } });
  });

  it("a plan without feedback requests (limit 0) can send none", async () => {
    m.tenantFind.mockResolvedValue({ planType: "NOSY_BAT", monthlyRequestLimit: 300 });
    m.feedbackCount.mockResolvedValue(0);
    expect((await feedbackAllowance("t1", NOW)).allowed).toBe(false);
  });
});

describe("POST /api/feedback", () => {
  const post = async () => {
    const { POST } = await import("@/app/api/feedback/route");
    return POST(new Request("https://echorank360.com/api/feedback", { method: "POST", body: JSON.stringify({ customerId: "c1" }) }));
  };

  beforeEach(() => {
    m.customerFind.mockResolvedValue({ id: "c1", tenantId: "t1" });
    m.feedbackCreate.mockResolvedValue({ id: "f1", token: "tok" });
  });

  it("refuses with 429 FEEDBACK_LIMIT_REACHED at the plan's limit, and creates nothing", async () => {
    m.tenantFind.mockResolvedValue({ planType: "GROWTH", monthlyRequestLimit: 10_000 });
    m.feedbackCount.mockResolvedValue(5_000);
    const res = await post();
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ code: "FEEDBACK_LIMIT_REACHED", limit: 5_000, used: 5_000 });
    expect(m.feedbackCreate).not.toHaveBeenCalled();
  });

  it("sends below it", async () => {
    m.tenantFind.mockResolvedValue({ planType: "GROWTH", monthlyRequestLimit: 10 });
    m.feedbackCount.mockResolvedValue(11);
    const res = await post();
    expect(res.status).not.toBe(429);
    expect(m.feedbackCreate).toHaveBeenCalledTimes(1);
  });
});
