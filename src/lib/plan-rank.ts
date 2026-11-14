// src/lib/plan-rank.ts — the "X and up" ladder requirePlan() checks
// (src/lib/plan-enforcement.ts). Dependency-free so the locked-message
// registry (src/lib/locked-plan.ts), which client components read, can ask
// the same question the route does.
import type { PlanType } from "@/generated/prisma";

// Ranked by price, low to high. AI_VISIBILITY (AI-only) sits below
// STARTER again since its reinstatement (2026-11-07). Which AREAS a plan may
// reach is src/lib/plan-access.ts, not this rank.
export const PLAN_RANK: Record<PlanType, number> = {
  AI_VISIBILITY: 0,
  // The crawler-only plan: below every ladder plan, so any "X and up" check
  // refuses it (it is off PLAN_ORDER the same way, plan-config.ts).
  NOSY_BAT: -1,
  STARTER: 1,
  GROWTH: 2,
  AGENCY: 3,
  ENTERPRISE: 4,
};

/** requirePlan(minimum)'s test: is `plan` at or above `minimum` on the ladder? */
export function planAtLeast(plan: PlanType, minimum: PlanType): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[minimum];
}
