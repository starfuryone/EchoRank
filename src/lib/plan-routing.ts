import type { PlanType } from "@/generated/prisma";

/**
 * Where each plan lands after login / when redirected off a forbidden path.
 *
 * Every tier lands on /dashboard. The retired AI_VISIBILITY tier used to land
 * on /visibility because it was confined to that subtree; no tier is confined
 * any more, so there is nothing left to vary. The key survives only because
 * the enum value does — see feature-flags.ts.
 */
export const PLAN_HOME: Record<PlanType, string> = {
  /** @deprecated AI_VISIBILITY is retired; legacy rows land on /dashboard. */
  AI_VISIBILITY: "/dashboard",
  STARTER: "/dashboard",
  GROWTH: "/dashboard",
  AGENCY: "/dashboard",
  ENTERPRISE: "/dashboard",
};

/**
 * Maps a `?plan=` query value (e.g. "starter") to a PlanType.
 *
 * `ai_visibility` normalizes to STARTER rather than resolving to the retired
 * tier or falling through to null: live external links still carry it, and
 * STARTER is what replaced it (it now includes ai_visibility + answer_tracking).
 */
export function planFromParam(
  planParam: string | null | undefined,
): PlanType | null {
  if (!planParam) return null;
  const normalized = planParam.trim().toUpperCase();
  if (normalized === "AI_VISIBILITY") return "STARTER";
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
