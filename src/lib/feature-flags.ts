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

const PLAN_FEATURES: Record<PlanType, Set<Feature>> = {
  // Standalone $29/mo tier: AI visibility only. Deliberately excludes
  // review_authenticity and everything reputation-side — it is not a rung on
  // the STARTER→ENTERPRISE ladder, it is a separate product.
  AI_VISIBILITY: new Set<Feature>(["ai_visibility", "answer_tracking"]),
  // marketing_studio starts at STARTER. AI_VISIBILITY is deliberately excluded
  // above: it is a standalone product, not the bottom rung of the ladder, and
  // the studio is reputation/content-side. Those tenants still reach the
  // landing page — it renders locked cards as the upsell rather than a 404.
  STARTER: new Set<Feature>(["review_authenticity", "marketing_studio"]),
  GROWTH: new Set<Feature>([
    "review_authenticity",
    "ai_analysis",
    "ai_visibility",
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
  // Cheapest-first, so the AI-visibility features resolve to the $29 tier
  // rather than to GROWTH ($149), which also carries them.
  const planOrder: PlanType[] = [
    "AI_VISIBILITY",
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
