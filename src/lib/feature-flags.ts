import type { PlanType } from "@/generated/prisma";

export type Feature =
  | "ai_analysis"
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
  | "multi_location_intelligence";

const ALL_FEATURES: Feature[] = [
  "review_authenticity",
  "ai_analysis",
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
  "multi_location_intelligence",
];

const PLAN_FEATURES: Record<PlanType, Set<Feature>> = {
  STARTER: new Set<Feature>(["review_authenticity"]),
  GROWTH: new Set<Feature>([
    "review_authenticity",
    "ai_analysis",
    "advanced_analytics",
    "escalation_prediction",
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
  const planOrder: PlanType[] = ["STARTER", "GROWTH", "AGENCY", "ENTERPRISE"];
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
