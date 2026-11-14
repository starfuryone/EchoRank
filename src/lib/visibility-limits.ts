// src/lib/visibility-limits.ts — the AI visibility cards' plan limits,
// dependency-free so the routes that enforce them and the locked messages
// that name a plan for them (src/lib/locked-plan.ts) read one table.
import type { PlanType } from "@/generated/prisma";
import { planAtLeast } from "@/lib/plan-rank";

/** Distinct competitors the benchmark card compares per rolling 24 h. */
export function benchmarkDailyLimit(plan: PlanType): number {
  return plan === "AGENCY" || plan === "ENTERPRISE" ? 5 : 1;
}

/** The lowest plan a DAILY visibility monitor may run on (requirePlan). */
export const MONITOR_DAILY_MIN_PLAN: PlanType = "AGENCY";

export function monitorDailyAllowed(plan: PlanType): boolean {
  return planAtLeast(plan, MONITOR_DAILY_MIN_PLAN);
}
