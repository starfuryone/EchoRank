import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { meteringService } from "@/infrastructure/metering/service";
import { QuotaExceededError } from "@/infrastructure/metering/quota";
import { hasFeature, type Feature } from "@/lib/feature-flags";
import { PaidPlanRequiredError } from "@/lib/paid-plan";
import type { PlanType, MeterType } from "@/generated/prisma";

export { QuotaExceededError };

// ─── Plan hierarchy ─────────────────────────────────────────────────────────

// Ranked by price, low to high. The retired AI_VISIBILITY tier shares
// STARTER's rank rather than sitting below it: STARTER absorbed it wholesale,
// so a legacy row should carry exactly STARTER's authority. AI-visibility
// surfaces are gated with requireFeature(), never with requirePlan().
const PLAN_RANK: Record<PlanType, number> = {
  /** @deprecated Retired tier; ranks as STARTER for legacy rows. */
  AI_VISIBILITY: 1,
  STARTER: 1,
  GROWTH: 2,
  AGENCY: 3,
  ENTERPRISE: 4,
};

// ─── Custom error classes ───────────────────────────────────────────────────

export class PlanRequiredError extends Error {
  public readonly statusCode = 403;
  public readonly currentPlan: PlanType;
  public readonly requiredPlan: PlanType;

  constructor(currentPlan: PlanType, requiredPlan: PlanType) {
    super(
      `Plan ${requiredPlan} or higher is required. Current plan: ${currentPlan}.`
    );
    this.name = "PlanRequiredError";
    this.currentPlan = currentPlan;
    this.requiredPlan = requiredPlan;
  }
}

export class FeatureNotAvailableError extends Error {
  public readonly statusCode = 403;
  public readonly feature: string;
  public readonly currentPlan: PlanType;

  constructor(feature: string, currentPlan: PlanType) {
    super(
      `Feature "${feature}" is not available on the ${currentPlan} plan.`
    );
    this.name = "FeatureNotAvailableError";
    this.feature = feature;
    this.currentPlan = currentPlan;
  }
}

// ─── Enforcement functions ──────────────────────────────────────────────────

/**
 * Checks that the current tenant's plan meets or exceeds the minimum plan.
 * Throws PlanRequiredError if the tenant's plan is below the minimum.
 */
export async function requirePlan(minimumPlan: PlanType): Promise<void> {
  const membership = await requireTenant();
  const currentPlan = membership.tenant.planType;

  if (PLAN_RANK[currentPlan] < PLAN_RANK[minimumPlan]) {
    throw new PlanRequiredError(currentPlan, minimumPlan);
  }
}

/**
 * Checks that the current tenant has remaining quota for the specified meter type.
 * Throws QuotaExceededError if the quota would be exceeded.
 */
export async function requireQuota(
  meterType: MeterType,
  quantity: number = 1
): Promise<void> {
  const membership = await requireTenant();
  const tenantId = membership.tenantId;

  const result = await meteringService.checkQuota(tenantId, meterType, quantity);

  if (!result.allowed) {
    throw new QuotaExceededError(
      tenantId,
      meterType,
      result.limit,
      result.limit - result.remaining,
    );
  }
}

/**
 * Checks that the current tenant's plan includes the specified feature.
 * Throws FeatureNotAvailableError if the feature is not available.
 */
export async function requireFeature(feature: Feature): Promise<void> {
  const membership = await requireTenant();
  const currentPlan = membership.tenant.planType;

  if (!hasFeature(currentPlan, feature)) {
    throw new FeatureNotAvailableError(feature, currentPlan);
  }
}

/**
 * Maps a plan-enforcement error to an HTTP response (403 for plan/feature, 429
 * for quota). Returns null for any other error so callers fall through to their
 * own handling. Lets routes gate without duplicating status-code logic.
 */
export function enforcementErrorResponse(
  error: unknown,
): NextResponse | null {
  if (
    error instanceof PlanRequiredError ||
    error instanceof FeatureNotAvailableError ||
    error instanceof PaidPlanRequiredError ||
    error instanceof QuotaExceededError
  ) {
    return NextResponse.json(
      { error: error.message, code: error.name },
      { status: error.statusCode },
    );
  }
  return null;
}
