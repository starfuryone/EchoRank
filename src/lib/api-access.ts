// src/lib/api-access.ts — who gets the public API (/api/public/v1/*) and the
// MCP server: Agency and up (owner, 2026-11-14), matching the pricing pages
// ("Full API access" from Agency, the comparison table's API row) and the
// Subscription Agreement.
//
// TWO GATES, BOTH REQUIRED. The plan allowlist's "public_api" area
// (src/lib/plan-access.ts) keeps the two restricted plans out; the
// "api_access" feature (src/lib/feature-flags.ts) is what Agency and
// Enterprise have and Starter and Growth do not. Until 2026-11-14 only the
// area was checked, so Starter and Growth could create keys the pricing page
// said they did not have.
//
// THE PLAN NAMED IN THE REFUSAL IS COMPUTED (getMinimumPlan), never typed.
//
// Dependency-free apart from the configs: the key-auth pipeline, the key
// route and the two tool pages all read it.

import type { PlanType } from "@/generated/prisma";
import { getMinimumPlan, hasFeature } from "@/lib/feature-flags";
import { PLAN_UPGRADE_REQUIRED, planAllowsArea } from "@/lib/plan-access";
import { PLAN_CONFIGS } from "@/lib/plan-config";

/** Does this plan include the public API and the MCP server? */
export function planIncludesApi(plan: PlanType | null | undefined): boolean {
  return Boolean(plan) && planAllowsArea(plan, "public_api") && hasFeature(plan!, "api_access");
}

/** The cheapest plan with API access (Agency today). */
export function apiAccessPlan(): PlanType {
  return getMinimumPlan("api_access");
}

/**
 * The 403 body for a key, or a key request, on a plan without API access.
 * Same code as every other plan refusal, so a client that already handles
 * PLAN_UPGRADE_REQUIRED keeps working; the message and target are API-specific.
 */
export function apiAccessRequiredBody() {
  const plan = apiAccessPlan();
  return {
    error: `API access is included in ${PLAN_CONFIGS[plan].name}.`,
    code: PLAN_UPGRADE_REQUIRED,
    area: "public_api" as const,
    upgradeTo: plan,
  };
}
