import type { PlanType } from "@/generated/prisma";

export type Feature =
  | "ai_analysis"
  | "ai_visibility"
  | "reputation_monitoring"
  | "sso"
  | "api_access"
  | "whitelabel"
  | "custom_domain"
  | "compliance_exports"
  | "executive_dashboard"
  | "sla_guarantee"
  | "custom_integrations"
  | "advanced_analytics"
  | "escalation_prediction"
  | "review_authenticity"
  | "multi_location_intelligence"
  | "answer_tracking"
  | "marketing_studio"
  | "matrix_chat";

const ALL_FEATURES: Feature[] = [
  "review_authenticity",
  "ai_analysis",
  "ai_visibility",
  "advanced_analytics",
  "escalation_prediction",
  "whitelabel",
  "custom_domain",
  "api_access",
  "reputation_monitoring",
  "sso",
  "compliance_exports",
  "executive_dashboard",
  "sla_guarantee",
  "custom_integrations",
  "answer_tracking",
  "multi_location_intelligence",
  "marketing_studio",
  "matrix_chat",
];

// STARTER's set, named because the retired AI_VISIBILITY key aliases it.
// ai_visibility and answer_tracking are baseline from STARTER up: the
// standalone $29 AI Visibility tier was retired and its capabilities folded
// into every tier, so the ladder is STARTER→ENTERPRISE with no side product.
const STARTER_FEATURES: Feature[] = [
  "review_authenticity",
  "marketing_studio",
  "ai_visibility",
  "answer_tracking",
];

const PLAN_FEATURES: Record<PlanType, Set<Feature>> = {
  /**
   * @deprecated The AI_VISIBILITY tier is retired. The enum value survives for
   * legacy rows only — nothing sells it (see plan-config.ts) and no tenant is
   * on it. It resolves to STARTER's set so a stray row keeps working rather
   * than losing every feature.
   */
  AI_VISIBILITY: new Set<Feature>(STARTER_FEATURES),
  STARTER: new Set<Feature>(STARTER_FEATURES),
  GROWTH: new Set<Feature>([
    "review_authenticity",
    "ai_analysis",
    "ai_visibility",
    "answer_tracking",
    "advanced_analytics",
    // Matrix team chat: GROWTH and up. AGENCY/ENTERPRISE inherit it through
    // ALL_FEATURES, so this is the only tier that has to name it.
    "matrix_chat",
    "escalation_prediction",
    "marketing_studio",
  ]),
  AGENCY: new Set<Feature>(ALL_FEATURES),
  ENTERPRISE: new Set<Feature>(ALL_FEATURES),
};

export function hasFeature(planType: PlanType, feature: Feature): boolean {
  const features = PLAN_FEATURES[planType];
  if (!features) return false;
  return features.has(feature);
}

export function getFeaturesForPlan(planType: PlanType): Feature[] {
  const features = PLAN_FEATURES[planType];
  if (!features) return [];
  return Array.from(features);
}

export function getMinimumPlan(feature: Feature): PlanType {
  // Cheapest-first. The retired AI_VISIBILITY tier is absent: it is not
  // sellable, so it must never be the answer to "what do I upgrade to?".
  const planOrder: PlanType[] = [
    "STARTER",
    "GROWTH",
    "AGENCY",
    "ENTERPRISE",
  ];
  for (const plan of planOrder) {
    if (PLAN_FEATURES[plan].has(feature)) {
      return plan;
    }
  }
  return "ENTERPRISE";
}

export function getNewFeatures(
  currentPlan: PlanType,
  targetPlan: PlanType
): Feature[] {
  const currentFeatures = PLAN_FEATURES[currentPlan] ?? new Set();
  const targetFeatures = PLAN_FEATURES[targetPlan] ?? new Set();
  return Array.from(targetFeatures).filter((f) => !currentFeatures.has(f));
}
