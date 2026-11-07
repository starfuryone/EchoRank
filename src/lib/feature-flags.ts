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
  // Citation Finder and Citation Opportunities: which sources the engines cite
  // and which of them to get listed on. Part of AI visibility, so every plan
  // from the $29 AI Visibility plan up (2026-11-07; Growth+ before).
  | "citation_tracking"
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
  "citation_tracking",
  "multi_location_intelligence",
  "marketing_studio",
  "matrix_chat",
];

// STARTER's set. ai_visibility, answer_tracking and citation_tracking are on
// every plan, including the $29 AI Visibility plan (reinstated 2026-11-07),
// which has nothing else.
const STARTER_FEATURES: Feature[] = [
  "review_authenticity",
  "marketing_studio",
  "ai_visibility",
  "answer_tracking",
  "citation_tracking",
];

const PLAN_FEATURES: Record<PlanType, Set<Feature>> = {
  // The $29 AI-only plan: AI visibility, answer tracking and the citation
  // tools, nothing else. src/lib/plan-access.ts is the allowlist every gate reads.
  AI_VISIBILITY: new Set<Feature>(["ai_visibility", "answer_tracking", "citation_tracking"]),
  STARTER: new Set<Feature>(STARTER_FEATURES),
  GROWTH: new Set<Feature>([
    "review_authenticity",
    "ai_analysis",
    "ai_visibility",
    "answer_tracking",
    "citation_tracking",
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
  // Cheapest-first, the $29 AI-only plan included since its reinstatement.
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
