// lib/entitlements.ts
// Single source of truth for plan gating. Replace scattered
// `plan === 'AGENCY'` checks with hasFeature(plan, '...').

export const PLANS = ['FREE', 'AI_VISIBILITY', 'PRO', 'AGENCY'] as const;
export type Plan = (typeof PLANS)[number];

export const FEATURES = [
  // AI visibility
  'answer_tracking',        // AnswerTrackingCard
  'prompt_trends',          // PromptTrends sparklines
  'visibility_alerts',      // recordPromptAlerts / digest
  'trust_score',            // TrustScoreSnapshot (read-only on AI_VISIBILITY)
  // Reputation / higher tiers
  'review_management',
  'csv_import',
  'multi_location',
  'api_access',
  'white_label',
  'agency_dashboard',
] as const;
export type Feature = (typeof FEATURES)[number];

const PLAN_FEATURES: Record<Plan, ReadonlySet<Feature>> = {
  FREE: new Set<Feature>([]),
  AI_VISIBILITY: new Set<Feature>([
    'answer_tracking',
    'prompt_trends',
    'visibility_alerts',
    'trust_score',
  ]),
  PRO: new Set<Feature>([
    'answer_tracking',
    'prompt_trends',
    'visibility_alerts',
    'trust_score',
    'review_management',
    'csv_import',
  ]),
  AGENCY: new Set<Feature>(FEATURES), // everything
};

export interface PlanLimits {
  brands: number;
  trackedPrompts: number;
  seats: number;
  refreshCadence: 'weekly' | 'nightly';
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  FREE:          { brands: 1,  trackedPrompts: 5,   seats: 1,  refreshCadence: 'weekly'  },
  AI_VISIBILITY: { brands: 1,  trackedPrompts: 25,  seats: 1,  refreshCadence: 'weekly'  },
  PRO:           { brands: 3,  trackedPrompts: 100, seats: 3,  refreshCadence: 'nightly' },
  AGENCY:        { brands: 25, trackedPrompts: 500, seats: 10, refreshCadence: 'nightly' },
};

// Stripe price IDs — fill in after creating the products.
export const STRIPE_PRICES: Partial<Record<Plan, { monthly: string; annual?: string }>> = {
  AI_VISIBILITY: { monthly: 'price_XXX_ai_visibility_29', annual: 'price_XXX_ai_visibility_290' },
  // PRO: { ... }, AGENCY: { ... }
};

export function hasFeature(plan: Plan | null | undefined, feature: Feature): boolean {
  if (!plan) return false;
  return PLAN_FEATURES[plan]?.has(feature) ?? false;
}

export function getLimits(plan: Plan | null | undefined): PlanLimits {
  return PLAN_LIMITS[plan ?? 'FREE'];
}

export function withinLimit(
  plan: Plan | null | undefined,
  key: keyof Omit<PlanLimits, 'refreshCadence'>,
  currentCount: number,
): boolean {
  return currentCount < getLimits(plan)[key];
}

/** Cheapest plan that unlocks a feature — for upsell CTAs. */
export function minPlanFor(feature: Feature): Plan | null {
  for (const plan of PLANS) {
    if (PLAN_FEATURES[plan].has(feature)) return plan;
  }
  return null;
}

/** Server-side guard for route handlers / server actions. Throws 403-style error. */
export function requireFeature(plan: Plan | null | undefined, feature: Feature): void {
  if (!hasFeature(plan, feature)) {
    const needed = minPlanFor(feature);
    const err = new Error(
      `Feature "${feature}" requires the ${needed ?? 'a higher'} plan.`,
    ) as Error & { status: number; code: string };
    err.status = 403;
    err.code = 'PLAN_UPGRADE_REQUIRED';
    throw err;
  }
}
