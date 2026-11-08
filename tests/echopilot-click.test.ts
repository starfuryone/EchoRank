// The EchoPilot click event (2026-11-08): a click on the CTA of "Social
// posting, by EchoPilot" stores one partner_clicks row — workspace, plan,
// time — and the staff overview at /admin counts them.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  requirePaidPlan: vi.fn(),
  create: vi.fn(async () => ({ id: "pc_1" })),
  count: vi.fn(),
  groupBy: vi.fn(),
}));

vi.mock("@/lib/paid-plan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paid-plan")>()),
  requirePaidPlan: m.requirePaidPlan,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { partnerClick: { create: m.create, count: m.count, groupBy: m.groupBy } },
}));

import { POST } from "@/app/api/echopilot/click/route";
import { PaidPlanRequiredError } from "@/lib/paid-plan";
import { ECHOPILOT_CLICK_WINDOW_DAYS, echopilotClickStats } from "@/lib/echopilot-clicks";
import { ECHOPILOT_SOCIAL_TARGET } from "@/lib/echopilot";
import { areaForApi, planAllowsApi } from "@/lib/plan-access";

const member = (tenantId: string, planType: string) => ({ tenantId, tenant: { id: tenantId, planType } });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/echopilot/click", () => {
  it("records one row with the tenant and the plan it is on (204)", async () => {
    m.requirePaidPlan.mockResolvedValue(member("t_growth", "GROWTH"));
    const res = await POST();
    expect(res.status).toBe(204);
    expect(m.create).toHaveBeenCalledTimes(1);
    expect(m.create).toHaveBeenCalledWith({
      data: { tenantId: "t_growth", plan: "GROWTH", target: ECHOPILOT_SOCIAL_TARGET },
      select: { id: true },
    });
  });

  it("records the AI-only plan too: the page is on every paid plan", async () => {
    m.requirePaidPlan.mockResolvedValue(member("t_ai", "AI_VISIBILITY"));
    expect((await POST()).status).toBe(204);
    expect(m.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ plan: "AI_VISIBILITY" }) }));
    expect(planAllowsApi("AI_VISIBILITY", "/api/echopilot/click", "POST")).toBe(true);
    expect(areaForApi("/api/echopilot/click", "POST")).toBe("ai_visibility");
  });

  it("an unpaid workspace is refused (403) and nothing is stored", async () => {
    m.requirePaidPlan.mockRejectedValue(new PaidPlanRequiredError("NONE"));
    const res = await POST();
    expect(res.status).toBe(403);
    expect(m.create).not.toHaveBeenCalled();
  });

  it("signed out is 401 and nothing is stored", async () => {
    m.requirePaidPlan.mockRejectedValue(new Error("Not authenticated or no tenant access"));
    expect((await POST()).status).toBe(401);
    expect(m.create).not.toHaveBeenCalled();
  });

  it("a database failure is a 500 that carries no detail", async () => {
    m.requirePaidPlan.mockResolvedValue(member("t1", "STARTER"));
    m.create.mockRejectedValueOnce(new Error("connection refused"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("connection refused");
    spy.mockRestore();
  });
});

describe("the admin count", () => {
  it("total, the last 30 days, distinct workspaces and clicks by plan, largest first", async () => {
    m.count.mockResolvedValueOnce(42).mockResolvedValueOnce(9);
    m.groupBy
      .mockResolvedValueOnce([{ tenantId: "a" }, { tenantId: "b" }, { tenantId: "c" }])
      .mockResolvedValueOnce([
        { plan: "STARTER", _count: { _all: 2 } },
        { plan: "GROWTH", _count: { _all: 5 } },
        { plan: "AI_VISIBILITY", _count: { _all: 2 } },
      ]);
    const now = new Date("2026-11-08T12:00:00Z");
    const stats = await echopilotClickStats(now);
    expect(stats).toEqual({
      total: 42,
      recent: 9,
      recentTenants: 3,
      recentByPlan: [
        { plan: "GROWTH", clicks: 5 },
        { plan: "AI_VISIBILITY", clicks: 2 },
        { plan: "STARTER", clicks: 2 },
      ],
    });
    const since = new Date(now.getTime() - ECHOPILOT_CLICK_WINDOW_DAYS * 86_400_000);
    expect(m.count).toHaveBeenNthCalledWith(1, { where: { target: ECHOPILOT_SOCIAL_TARGET } });
    expect(m.count).toHaveBeenNthCalledWith(2, { where: { target: ECHOPILOT_SOCIAL_TARGET, createdAt: { gte: since } } });
  });

  it("the /admin overview is staff only and shows the count", () => {
    const page = readFileSync(join(process.cwd(), "src/app/admin/page.tsx"), "utf8");
    expect(page).toMatch(/if \(!\(await platformAdmin\(\)\)\) notFound\(\);/);
    expect(page).toContain("echopilotClickStats()");
  });
});

describe("the table", () => {
  const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
  const model = schema.slice(schema.indexOf("model PartnerClick {"), schema.indexOf("}", schema.indexOf("model PartnerClick {")));

  it("keeps tenant, plan and time, nothing about the person", () => {
    expect(model).toMatch(/tenantId\s+String\n/);
    expect(model).toMatch(/plan\s+PlanType\n/);
    expect(model).toMatch(/createdAt\s+DateTime\s+@default\(now\(\)\)/);
    expect(model).not.toMatch(/userId|ipAddress|email/);
    expect(model).toMatch(/onDelete: Cascade/);
  });

  it("ships a hand-written migration for it", () => {
    const sql = readFileSync(join(process.cwd(), "prisma/migrations/20261127090000_partner_clicks/migration.sql"), "utf8");
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "partner_clicks"');
    expect(sql).toContain('"plan" "PlanType" NOT NULL');
    expect(sql).toContain('REFERENCES "tenants"("id") ON DELETE CASCADE');
  });
});
