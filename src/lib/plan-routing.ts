import type { PlanType } from "@/generated/prisma";

/** Where each plan lands after login / when redirected off a forbidden path. */
export const PLAN_HOME: Record<PlanType, string> = {
  AI_VISIBILITY: "/visibility",
  STARTER: "/dashboard",
  GROWTH: "/dashboard",
  AGENCY: "/dashboard",
  ENTERPRISE: "/dashboard",
};

/**
 * Dashboard path prefixes each plan may reach. `null` means unrestricted.
 * Only AI_VISIBILITY is confined: it is a standalone product, so the
 * reputation surfaces (customers, campaigns, feedback, …) are not part of it.
 */
const PLAN_ALLOWED_PREFIXES: Record<PlanType, string[] | null> = {
  // /team is included so AI_VISIBILITY tenants can invite teammates (the
  // onboarding checklist links there); team management is plan-agnostic.
  // /help is included because help is never plan-gated: the one tier that is
  // confined to a subset of the app is the tier most likely to need the manual.
  AI_VISIBILITY: ["/visibility", "/settings", "/billing", "/team", "/help"],
  STARTER: null,
  GROWTH: null,
  AGENCY: null,
  ENTERPRISE: null,
};

export function canAccessPath(
  plan: PlanType | null | undefined,
  pathname: string,
): boolean {
  if (!plan) return false;
  const allowed = PLAN_ALLOWED_PREFIXES[plan];
  if (allowed === null) return true;
  return allowed.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/** Maps a `?plan=` query value (e.g. "ai_visibility") to a PlanType. */
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
