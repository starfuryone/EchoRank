import type { PlanType } from "@/generated/prisma";
import { hasFeature } from "./feature-flags";

/**
 * The tiers that actually exist as products.
 *
 * PlanType still carries AI_VISIBILITY because the Prisma enum value survives
 * for legacy rows — dropping an enum value needs a migration, and there is
 * nothing to gain from one. But it is not sellable, has no price, no card and
 * no config, so every pricing/config surface is keyed by this narrower type.
 * Anything holding a raw PlanType goes through sellablePlan() first.
 */
export type SellablePlanType = Exclude<PlanType, "AI_VISIBILITY">;

/**
 * Fold a stored plan value onto a sellable tier.
 *
 * AI_VISIBILITY maps to STARTER, which absorbed its capabilities wholesale
 * (ai_visibility + answer_tracking, same checkup shape, same AI allowances).
 * No tenant is on it, so this is belt-and-braces for stale rows.
 */
export function sellablePlan(plan: PlanType): SellablePlanType {
  return plan === "AI_VISIBILITY" ? "STARTER" : plan;
}

/** PLAN_CONFIGS lookup that tolerates a legacy AI_VISIBILITY value. */
export function planConfig(plan: PlanType): PlanConfig {
  return PLAN_CONFIGS[sellablePlan(plan)];
}

/**
 * Free-trial length in days. THE source for the number — marketing copy,
 * legal terms and any future trial-expiry logic all mean this value.
 *
 * There is no code that enforces it today: Stripe checkout does not exist in
 * this app (see docs/agents/integrations.md), so nothing sets
 * trial_period_days and nothing computes a trial end date. Tenants are created
 * with billingStatus TRIALING and no length attached. If a trial is configured
 * on a Stripe price or product, that is a dashboard setting and this constant
 * cannot reach it — they have to be changed together.
 *
 * Catalog strings are prose in five locales and are not templated, so they
 * cannot interpolate this. tests/trial-days.test.ts asserts they agree with it
 * instead, which is what stops the two drifting apart.
 */
export const TRIAL_DAYS = 7;

/**
 * Monthly Marketing Studio output-token budget, per tenant, by tier.
 *
 * An abuse guard, not a margin lever. Every generation runs on Haiku with a
 * 1500-2500 token ceiling, so a tenant would have to sit on the button all
 * month to approach even the STARTER cap — at Haiku rates the worst case is
 * comfortably under a dollar. The cap exists so a scripted loop cannot run up
 * a bill unnoticed, and it counts OUTPUT tokens because that is the expensive
 * half and the half a caller controls.
 *
 * null = unlimited (ENTERPRISE is contract-priced; a hard stop would be the
 * wrong failure mode there).
 */
export const MARKETING_MONTHLY_OUTPUT_TOKENS: Record<SellablePlanType, number | null> = {
  STARTER: 200_000,
  GROWTH: 500_000,
  AGENCY: 2_000_000,
  ENTERPRISE: null,
};

/**
 * How often a brand's checkup runs. "none" = the tier has no monitor at all.
 *
 * Every sellable tier carries the `ai_visibility` feature, so every tier has a
 * real checkup shape. "none" is reserved for a tier that genuinely has no
 * monitor; none currently does. STARTER inherits the shape the retired $29 AI
 * Visibility tier used to sell, which is what makes "everything in the old AI
 * Visibility plan" true rather than marketing.
 */
export type CheckupFrequency = "none" | "weekly" | "twice_weekly" | "daily" | "custom";

export interface AiCheckupShape {
  frequency: CheckupFrequency;
  /**
   * How many providers a checkup queries. `null` = every provider that is
   * currently AVAILABLE, which is a runtime fact (an adapter is available when
   * its API key is set), not a number we can pin here.
   */
  providers: number | null;
  /** Prompts selected for the brand. */
  prompts: number;
  /**
   * Times each prompt is asked, per provider. >1 is what makes the
   * repeatability score meaningful: the same question asked twice and answered
   * differently is the signal.
   */
  repetitions: number;
}

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
  /**
   * Successful DataForSEO SEARCH results per calendar month (UTC), pooled
   * across Site Explorer, SERP Checker, Backlinks and Keyword Research.
   * `null` = unlimited.
   *
   * This is a CEILING OVER the existing per-tool allowances, not a replacement
   * for them: a request is denied if the per-tool cap, this pool, or the
   * per-tenant USD cap says so. It cannot grant a tier access its per-tool cap
   * withholds — STARTER's Backlinks allowance is 0 and stays 0 whatever this
   * number is.
   *
   * Site Audit and Content Explorer are deliberately outside the pool: the
   * first is priced per crawled page rather than per search, and the second
   * already carries its own tighter monthly cap.
   */
  seoSearchesPerMonth: number | null;
  /**
   * Active tracked keywords allowed at once. `null` = unlimited.
   *
   * A cap on CURRENT STATE, not on spend — it is the figure that falls again
   * when a tenant deletes keywords. Spend is bounded separately by the monthly
   * check counter in rank-tracker/options.ts.
   */
  trackedKeywords: number | null;
  /**
   * URLs a single Site Crawler run may fetch. 0 = the tool is locked.
   *
   * A per-RUN ceiling, not a monthly pool: the cost of a crawl is our own
   * bandwidth and worker time, both of which are bounded per run rather than
   * accumulated. Copied onto the CrawlJob row at creation so a crawl keeps
   * reporting the cap it actually ran under after a tier change.
   */
  crawlUrlCap: number;
  /**
   * Site Crawler runs per calendar month (UTC). `null` = unlimited.
   *
   * Counted from CrawlJob rows rather than a counter, for the same reason
   * seo-quota.ts counts SeoApiCall rows: this box restarts several times a day
   * and an in-process tally would hand every tenant a fresh allowance.
   * CANCELLED and FAILED runs are excluded from the count — see
   * src/lib/site-crawler/quota.ts.
   */
  crawlsPerMonth: number | null;
  /** Shape of one AI Visibility checkup for this tier. */
  aiCheckup: AiCheckupShape;
  /**
   * Per-tenant AI provider spend per calendar month (UTC), in USD.
   * `null` = uncapped (ENTERPRISE is contract-priced). 0 = no monitor.
   *
   * THE ARITHMETIC, so these stay adjustable with the reasoning visible.
   * One prompt-run costs an answer call plus an analysis call. Measured
   * against Anthropic's published rates (Haiku 4.5 at $1/$5 per MTok) a
   * ~300-in/600-out answer is $0.0033 on Haiku and ~5x that on an Opus-class
   * model; the ~1200-in/400-out analysis pass is $0.0032 on Haiku. Blended
   * across the provider mix that is roughly **$0.013 per prompt-run**.
   *
   * Runs per month = frequency x prompts x repetitions x providers:
   *   STARTER        4.3 x 10 x 1 x 2 =    87  ~= $1.13/mo
   *   GROWTH         8.7 x 15 x 2 x 4 = 1,040  ~= $13.50/mo
   *   AGENCY          30 x 20 x 3 x 6 = 10,800 ~= $140/mo
   *
   * STARTER and GROWTH carry 3-4x headroom over the modelled cost, so
   * the cap only bites on abuse. AGENCY's does NOT: $150 is about what one
   * fully-provisioned brand costs, so an agency tracking several brands will
   * reach it and later checkups stop with CAPPED. That is the intended
   * guardrail on a $499 tier, but it is a pricing decision — raising it raises
   * the worst-case monthly bill dollar for dollar.
   */
  aiMonthlyCapUsd: number | null;
  highlighted: boolean;
  cta: string;
  ctaLink: string;
}

export const PLAN_CONFIGS: Record<SellablePlanType, PlanConfig> = {
  STARTER: {
    name: "Starter",
    slug: "starter",
    // Positioned as a strict superset of the retired $29 AI Visibility tier:
    // it carries that tier's whole feature set plus the reputation engine.
    description:
      "AI answer tracking plus the reputation engine, for small businesses getting started",
    monthlyPrice: 79,
    annualPrice: 63,
    isCustomPricing: false,
    features: [
      "1 location",
      "AI answer tracking across 4 engines",
      "Lost-recommendation alerts",
      "AI Trust Score",
      "500 feedback requests/month",
      "Email review requests",
      "Basic dashboard",
      "Email support",
      "Review authenticity verification",
      "250 SEO searches/mo",
    ],
    quotaDefaults: {
      maxLocations: 1,
      maxRequestsPerMonth: 500,
      maxEmailsPerMonth: 500,
      maxSmsPerMonth: 0,
      maxWebhooksPerMonth: 1000,
      // AI inference + monitoring allowances inherited from the retired $29 AI
      // Visibility tier, whose capabilities STARTER now absorbs. Granting the
      // ai_visibility feature without these would gate every monitor route on
      // a zero budget.
      maxAiInferencesPerMonth: 200,
      maxMonitoringChecks: 120,
      maxApiRequestsPerDay: 0,
    },
    seoSearchesPerMonth: 250,
    trackedKeywords: 0,
    crawlUrlCap: 500,
    crawlsPerMonth: 4,
    // The shape the retired AI Visibility tier sold: two providers and one
    // repetition. Repeatability needs >1 and stays a GROWTH feature.
    aiCheckup: { frequency: "weekly", providers: 2, prompts: 10, repetitions: 1 },
    aiMonthlyCapUsd: 5,
    highlighted: false,
    cta: "Start Free Trial",
    ctaLink: "/register?plan=starter",
  },

  GROWTH: {
    name: "Growth",
    slug: "growth",
    description: "For growing businesses that need AI-powered insights",
    monthlyPrice: 199,
    annualPrice: 159,
    isCustomPricing: false,
    features: [
      "5 locations",
      "AI answer tracking across 4 engines",
      "5,000 feedback requests/month",
      "Email + SMS channels",
      "AI risk scoring & sentiment analysis",
      "Recovery tickets & workflows",
      "Advanced analytics",
      "Escalation prediction",
      "1,000 SEO searches/mo",
      "Priority support",
    ],
    quotaDefaults: {
      maxLocations: 5,
      maxRequestsPerMonth: 5000,
      maxEmailsPerMonth: 5000,
      maxSmsPerMonth: 1000,
      maxWebhooksPerMonth: 5000,
      maxAiInferencesPerMonth: 500,
      maxMonitoringChecks: 60,
      maxApiRequestsPerDay: 1000,
    },
    seoSearchesPerMonth: 1000,
    trackedKeywords: 50,
    crawlUrlCap: 5_000,
    crawlsPerMonth: 20,
    aiCheckup: { frequency: "twice_weekly", providers: 4, prompts: 15, repetitions: 2 },
    aiMonthlyCapUsd: 40,
    highlighted: true,
    cta: "Start Free Trial",
    ctaLink: "/register?plan=growth",
  },

  AGENCY: {
    name: "Agency",
    slug: "agency",
    description: "For agencies managing multiple client accounts",
    monthlyPrice: 499,
    annualPrice: 399,
    isCustomPricing: false,
    features: [
      "25 locations",
      "AI answer tracking across 4 engines",
      "15,000 feedback requests/month",
      "White-label dashboard",
      "Client management",
      "Custom domain support",
      "Full API access",
      "All AI features",
      "5,000 SEO searches/mo",
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
    seoSearchesPerMonth: 5000,
    trackedKeywords: 250,
    crawlUrlCap: 25_000,
    crawlsPerMonth: null,
    aiCheckup: { frequency: "daily", providers: null, prompts: 20, repetitions: 3 },
    aiMonthlyCapUsd: 150,
    highlighted: false,
    cta: "Start Free Trial",
    ctaLink: "/register?plan=agency",
  },

  ENTERPRISE: {
    name: "Enterprise",
    slug: "enterprise",
    description: "For organizations that need full reputation intelligence at scale",
    monthlyPrice: 0,
    annualPrice: 0, // Custom pricing — see isCustomPricing; render "Contact us"
    isCustomPricing: true,
    features: [
      "Unlimited locations",
      "AI answer tracking across 4 engines",
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
    seoSearchesPerMonth: null,
    trackedKeywords: 1000,
    crawlUrlCap: 25_000,
    crawlsPerMonth: null,
    // "custom": the schedule is set per contract, so the scheduler reads the
    // brand profile rather than a cadence baked in here.
    aiCheckup: { frequency: "custom", providers: null, prompts: 20, repetitions: 3 },
    aiMonthlyCapUsd: null,
    highlighted: false,
    cta: "Book Enterprise Demo",
    ctaLink: "/enterprise",
  },
};

// ─── Derived views (single source of truth lives in PLAN_CONFIGS above) ──────

const ALL_PLANS = Object.keys(PLAN_CONFIGS) as SellablePlanType[];

export interface PlanLimit {
  locations: number;
  requests: number;
  sms: boolean;
  whitelabel: boolean;
  aiAnalysis: boolean;
  monitoring: boolean;
}

/** Feature/limit summary per plan, derived from PLAN_CONFIGS + the feature matrix. */
export const PLAN_LIMITS: Record<SellablePlanType, PlanLimit> = Object.fromEntries(
  ALL_PLANS.map((plan) => {
    const q = PLAN_CONFIGS[plan].quotaDefaults;
    return [
      plan,
      {
        locations: q.maxLocations,
        requests: q.maxRequestsPerMonth,
        sms: q.maxSmsPerMonth > 0,
        whitelabel: hasFeature(plan, "whitelabel"),
        aiAnalysis: hasFeature(plan, "ai_analysis"),
        monitoring: hasFeature(plan, "reputation_monitoring"),
      } satisfies PlanLimit,
    ];
  }),
) as Record<SellablePlanType, PlanLimit>;

/** Monthly USD price per plan, derived from PLAN_CONFIGS. */
export const PLAN_PRICES: Record<SellablePlanType, number> = Object.fromEntries(
  ALL_PLANS.map((plan) => [plan, PLAN_CONFIGS[plan].monthlyPrice]),
) as Record<SellablePlanType, number>;

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
  const q = planConfig(planType).quotaDefaults;
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
    // Legacy rows only; STARTER is a strict superset of the retired tier.
    AI_VISIBILITY: "STARTER",
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

/** Canonical tier ordering, low to high. The retired AI_VISIBILITY tier is
 *  absent — it is not sellable, so it must never appear in a pricing surface
 *  or be the answer to "what do I upgrade to?". Enterprise is custom-priced,
 *  so rank, not monthlyPrice, decides what counts as an upgrade. */
export const PLAN_ORDER: SellablePlanType[] = [
  "STARTER",
  "GROWTH",
  "AGENCY",
  "ENTERPRISE",
];

/** True when `target` is a higher tier than `current`. */
export function isUpgrade(current: PlanType, target: PlanType): boolean {
  return (
    PLAN_ORDER.indexOf(sellablePlan(target)) >
    PLAN_ORDER.indexOf(sellablePlan(current))
  );
}

export function isPlanAtLeast(
  currentPlan: PlanType,
  targetPlan: PlanType
): boolean {
  return (
    PLAN_ORDER.indexOf(sellablePlan(currentPlan)) >=
    PLAN_ORDER.indexOf(sellablePlan(targetPlan))
  );
}
