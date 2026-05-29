import type { PlanType } from "@/generated/prisma";

export interface PlanConfig {
  name: string;
  slug: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number; // per month when billed annually
  isCustomPricing: boolean;
  features: string[];
  quotaDefaults: {
    maxLocations: number;
    maxRequestsPerMonth: number;
    maxEmailsPerMonth: number;
    maxSmsPerMonth: number;
    maxWebhooksPerMonth: number;
    maxAiInferencesPerMonth: number;
    maxMonitoringChecks: number;
    maxApiRequestsPerDay: number;
  };
  highlighted: boolean;
  cta: string;
  ctaLink: string;
}

export const PLAN_CONFIGS: Record<PlanType, PlanConfig> = {
  STARTER: {
    name: "Starter",
    slug: "starter",
    description: "For small businesses getting started with reputation management",
    monthlyPrice: 49,
    annualPrice: 39,
    isCustomPricing: false,
    features: [
      "1 location",
      "500 feedback requests/month",
      "Email review requests",
      "Basic dashboard",
      "Email support",
      "Review authenticity verification",
    ],
    quotaDefaults: {
      maxLocations: 1,
      maxRequestsPerMonth: 500,
      maxEmailsPerMonth: 500,
      maxSmsPerMonth: 0,
      maxWebhooksPerMonth: 1000,
      maxAiInferencesPerMonth: 0,
      maxMonitoringChecks: 0,
      maxApiRequestsPerDay: 0,
    },
    highlighted: false,
    cta: "Start Free Trial",
    ctaLink: "/register?plan=starter",
  },

  GROWTH: {
    name: "Growth",
    slug: "growth",
    description: "For growing businesses that need AI-powered insights",
    monthlyPrice: 149,
    annualPrice: 129,
    isCustomPricing: false,
    features: [
      "5 locations",
      "5,000 feedback requests/month",
      "Email + SMS channels",
      "AI risk scoring & sentiment analysis",
      "Recovery tickets & workflows",
      "Advanced analytics",
      "Escalation prediction",
      "Priority support",
    ],
    quotaDefaults: {
      maxLocations: 5,
      maxRequestsPerMonth: 5000,
      maxEmailsPerMonth: 5000,
      maxSmsPerMonth: 1000,
      maxWebhooksPerMonth: 5000,
      maxAiInferencesPerMonth: 500,
      maxMonitoringChecks: 0,
      maxApiRequestsPerDay: 1000,
    },
    highlighted: true,
    cta: "Start Free Trial",
    ctaLink: "/register?plan=growth",
  },

  AGENCY: {
    name: "Agency",
    slug: "agency",
    description: "For agencies managing multiple client accounts",
    monthlyPrice: 349,
    annualPrice: 299,
    isCustomPricing: false,
    features: [
      "25 locations",
      "15,000 feedback requests/month",
      "White-label dashboard",
      "Client management",
      "Custom domain support",
      "Full API access",
      "All AI features",
      "Priority support",
    ],
    quotaDefaults: {
      maxLocations: 25,
      maxRequestsPerMonth: 15000,
      maxEmailsPerMonth: 15000,
      maxSmsPerMonth: 5000,
      maxWebhooksPerMonth: 20000,
      maxAiInferencesPerMonth: 2000,
      maxMonitoringChecks: 500,
      maxApiRequestsPerDay: 10000,
    },
    highlighted: false,
    cta: "Start Free Trial",
    ctaLink: "/register?plan=agency",
  },

  ENTERPRISE: {
    name: "Enterprise",
    slug: "enterprise",
    description: "For organizations that need full reputation intelligence at scale",
    monthlyPrice: 999,
    annualPrice: 0, // Custom pricing for annual
    isCustomPricing: false,
    features: [
      "Unlimited locations",
      "Custom request volume",
      "Full AI intelligence suite",
      "Real-time reputation monitoring",
      "SSO / SAML authentication",
      "SLA guarantee (99.9% uptime)",
      "Dedicated account manager",
      "Executive dashboards",
      "Custom integrations",
      "Compliance exports",
      "Multi-location intelligence",
    ],
    quotaDefaults: {
      maxLocations: -1, // Unlimited
      maxRequestsPerMonth: 100000,
      maxEmailsPerMonth: 100000,
      maxSmsPerMonth: 25000,
      maxWebhooksPerMonth: 100000,
      maxAiInferencesPerMonth: 10000,
      maxMonitoringChecks: 5000,
      maxApiRequestsPerDay: 100000,
    },
    highlighted: false,
    cta: "Book Enterprise Demo",
    ctaLink: "/enterprise",
  },
};

/**
 * The metering-relevant subset of a plan's quota defaults, in the shape the
 * metering layer (TenantQuota / MeteringService) consumes. plan-config.ts is
 * the single source of truth; quota.ts and service.ts derive from this.
 */
export interface MeteringQuotaDefaults {
  maxEmailsPerMonth: number;
  maxSmsPerMonth: number;
  maxWebhooksPerMonth: number;
  maxApiRequestsPerDay: number;
  maxAiInferencesPerMonth: number;
  maxMonitoringChecks: number;
}

export function planQuotaDefaults(planType: PlanType): MeteringQuotaDefaults {
  const q = PLAN_CONFIGS[planType].quotaDefaults;
  return {
    maxEmailsPerMonth: q.maxEmailsPerMonth,
    maxSmsPerMonth: q.maxSmsPerMonth,
    maxWebhooksPerMonth: q.maxWebhooksPerMonth,
    maxApiRequestsPerDay: q.maxApiRequestsPerDay,
    maxAiInferencesPerMonth: q.maxAiInferencesPerMonth,
    maxMonitoringChecks: q.maxMonitoringChecks,
  };
}

/**
 * Get the upgrade path from a given plan.
 */
export function getUpgradePath(currentPlan: PlanType): PlanType | null {
  const upgradeMap: Record<PlanType, PlanType | null> = {
    STARTER: "GROWTH",
    GROWTH: "AGENCY",
    AGENCY: "ENTERPRISE",
    ENTERPRISE: null,
  };
  return upgradeMap[currentPlan];
}

/**
 * Get enterprise contact information.
 */
export function getEnterpriseContact() {
  return {
    email: "enterprise@echorank.io",
    phone: "+1 (888) 324-6726",
    calendlyUrl: "https://calendly.com/echorank/enterprise-demo",
    salesTeam: "Enterprise Solutions",
  };
}

/**
 * Check if a plan is at or above a target plan.
 */
export function isPlanAtLeast(
  currentPlan: PlanType,
  targetPlan: PlanType
): boolean {
  const order: PlanType[] = ["STARTER", "GROWTH", "AGENCY", "ENTERPRISE"];
  return order.indexOf(currentPlan) >= order.indexOf(targetPlan);
}
