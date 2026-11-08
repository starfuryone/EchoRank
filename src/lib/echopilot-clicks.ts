// src/lib/echopilot-clicks.ts — clicks on the "Social posting, by EchoPilot"
// CTA, as a demand signal (partner_clicks). Written by POST
// /api/echopilot/click, read by the staff overview at /admin.
import "server-only";

import type { PlanType } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { ECHOPILOT_SOCIAL_TARGET } from "@/lib/echopilot";

/** The window the admin overview counts in. */
export const ECHOPILOT_CLICK_WINDOW_DAYS = 30;

/** One row: the workspace, the plan it was on, now. */
export async function recordEchopilotClick(tenantId: string, plan: PlanType): Promise<void> {
  await prisma.partnerClick.create({
    data: { tenantId, plan, target: ECHOPILOT_SOCIAL_TARGET },
    select: { id: true },
  });
}

export interface EchopilotClickStats {
  total: number;
  /** Clicks in the last ECHOPILOT_CLICK_WINDOW_DAYS days. */
  recent: number;
  /** Distinct workspaces that clicked in that window. */
  recentTenants: number;
  /** Clicks in that window by the plan the workspace was on, largest first. */
  recentByPlan: Array<{ plan: PlanType; clicks: number }>;
}

export async function echopilotClickStats(now: Date = new Date()): Promise<EchopilotClickStats> {
  const since = new Date(now.getTime() - ECHOPILOT_CLICK_WINDOW_DAYS * 86_400_000);
  const recentWhere = { target: ECHOPILOT_SOCIAL_TARGET, createdAt: { gte: since } };
  const [total, recent, tenants, byPlan] = await Promise.all([
    prisma.partnerClick.count({ where: { target: ECHOPILOT_SOCIAL_TARGET } }),
    prisma.partnerClick.count({ where: recentWhere }),
    prisma.partnerClick.groupBy({ by: ["tenantId"], where: recentWhere }),
    prisma.partnerClick.groupBy({ by: ["plan"], where: recentWhere, _count: { _all: true } }),
  ]);
  return {
    total,
    recent,
    recentTenants: tenants.length,
    recentByPlan: byPlan
      .map((r) => ({ plan: r.plan, clicks: r._count._all }))
      .sort((a, b) => b.clicks - a.clicks || a.plan.localeCompare(b.plan)),
  };
}
