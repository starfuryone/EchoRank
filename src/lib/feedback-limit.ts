// src/lib/feedback-limit.ts — the monthly feedback-request allowance, ONE
// source for the sender (POST /api/feedback), the /billing meter and the plan
// hub (owner, 2026-11-14).
//
// THE LIMIT IS PLAN_CONFIGS quotaDefaults.maxRequestsPerMonth, the figure the
// pricing table and the Enterprise page sell. Tenant.monthlyRequestLimit, a
// per-tenant column no code path writes (default 300), counts ONLY for
// Enterprise, whose allowance is contracted per customer. Until 2026-11-14 the
// /billing meter read the column for every plan and nothing enforced either.
//
// THE COUNT is Feedback rows created this calendar month (UTC): one row is one
// request sent (POST /api/feedback is the only writer). Counted from rows, not
// a counter, like the SEO searches and crawl pages: the rows are the record
// and survive every restart.
//
// Prisma is imported lazily so the pure helpers stay importable in DB-less
// contexts (the hub's tests, node --test).

import type { PlanType } from "@/generated/prisma";
import { PLAN_CONFIGS } from "@/lib/plan-config";

export interface FeedbackLimitTenant {
  planType: PlanType;
  monthlyRequestLimit: number;
}

/** Feedback requests a month: the plan's figure, or Enterprise's contracted one. */
export function effectiveFeedbackLimit(tenant: FeedbackLimitTenant): number {
  if (tenant.planType === "ENTERPRISE") return tenant.monthlyRequestLimit;
  return PLAN_CONFIGS[tenant.planType].quotaDefaults.maxRequestsPerMonth;
}

/** 00:00 UTC on the 1st of this month. */
export function feedbackMonthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** 00:00 UTC on the 1st of next month, when the count starts again. */
export function feedbackMonthResetsAt(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

/** Requests sent this calendar month (UTC). */
export async function feedbackRequestsThisMonth(tenantId: string, now = new Date()): Promise<number> {
  const { prisma } = await import("@/lib/prisma");
  return prisma.feedback.count({ where: { tenantId, createdAt: { gte: feedbackMonthStart(now) } } });
}

export interface FeedbackAllowance {
  allowed: boolean;
  used: number;
  limit: number;
  resetsAt: Date;
}

/** May this tenant send one more request this month? */
export async function feedbackAllowance(tenantId: string, now = new Date()): Promise<FeedbackAllowance> {
  const { prisma } = await import("@/lib/prisma");
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { planType: true, monthlyRequestLimit: true },
  });
  const limit = tenant ? effectiveFeedbackLimit(tenant) : 0;
  const used = await feedbackRequestsThisMonth(tenantId, now);
  return { allowed: used < limit, used, limit, resetsAt: feedbackMonthResetsAt(now) };
}
