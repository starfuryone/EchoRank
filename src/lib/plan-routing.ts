import type { PlanType } from "@/generated/prisma";

/**
 * Where each plan lands after login / when redirected off a forbidden path.
 *
 * The AI-only plan lands on /visibility, the part of the product it has
 * (src/lib/plan-access.ts); every other tier on /dashboard.
 */
export const PLAN_HOME: Record<PlanType, string> = {
  AI_VISIBILITY: "/visibility",
  // The crawler-only plan lands on the crawler, the one tool it has.
  NOSY_BAT: "/crawler",
  STARTER: "/dashboard",
  GROWTH: "/dashboard",
  AGENCY: "/dashboard",
  ENTERPRISE: "/dashboard",
};

/**
 * Maps a `?plan=` query value (e.g. "starter") to a PlanType.
 *
 * `ai_visibility` is the AI-only plan again (reinstated 2026-11-07).
 */
export function planFromParam(
  planParam: string | null | undefined,
): PlanType | null {
  if (!planParam) return null;
  const normalized = planParam.trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(PLAN_HOME, normalized)
    ? (normalized as PlanType)
    : null;
}

/** Where to send a user immediately after signup, given `?plan=`. */
export function postSignupRedirect(
  planParam: string | null | undefined,
): string {
  const plan = planFromParam(planParam);
  return plan ? PLAN_HOME[plan] : "/dashboard";
}
