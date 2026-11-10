// src/lib/authority-checker/gate.ts — who may use the Link Authority Checker's
// API (the check and its PDF): a session, a paid plan (requirePaidPlan: a
// trial counts only with a Stripe PLAN subscription row), and the plan area
// "link_authority" (open on the AI-only plan too). Cheapest refusal first:
// no session → 401, unpaid or outside the plan → 403.

import "server-only";

import type { NextResponse } from "next/server";
import { requirePaidPlan, PaidPlanRequiredError } from "@/lib/paid-plan";
import { planAllowsApi } from "@/lib/plan-access";
import { LINK_AUTHORITY_API } from "./config";
import { authorityError } from "./http";

export type LinkAuthorityMember = Awaited<ReturnType<typeof requirePaidPlan>>;

export async function linkAuthorityMember(
  locale: string | null | undefined,
): Promise<{ ok: true; m: LinkAuthorityMember } | { ok: false; res: NextResponse }> {
  let m: LinkAuthorityMember;
  try {
    m = await requirePaidPlan();
  } catch (err) {
    if (err instanceof PaidPlanRequiredError) return { ok: false, res: authorityError(locale, "plan_required", 403) };
    // requireTenant()'s sentinel: no session, or no membership.
    if (err instanceof Error && err.message.includes("Not authenticated")) return { ok: false, res: authorityError(locale, "unauthorized", 401) };
    throw err;
  }
  if (!planAllowsApi(m.tenant.planType, LINK_AUTHORITY_API, "POST")) {
    return { ok: false, res: authorityError(locale, "plan_required", 403) };
  }
  return { ok: true, m };
}
