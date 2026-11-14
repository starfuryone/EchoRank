// src/lib/ai-citations/plans.ts — which plans include AI Citations,
// dependency-free so the locked message (src/lib/locked-plan.ts) names the
// plan this test opens. service.ts (server-only) re-exports it.
import type { PlanType } from "@/generated/prisma";

/**
 * Plans that include the tool.
 *
 * STARTER is out for the same reason it is out of Backlinks: this is a
 * GROWTH-and-up feature, so STARTER sees a locked card with an upgrade path
 * rather than an empty form it cannot submit.
 */
export function planCanUseAiCitations(plan: PlanType): boolean {
  return plan !== "STARTER" && plan !== "AI_VISIBILITY";
}
