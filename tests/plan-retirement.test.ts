// The AI_VISIBILITY plan: retired 2026-08-09 (b4fd801), reinstated 2026-11-07
// as the $29 AI-only plan (ECHORANK-AI-TIER.md). This file used to hold the
// invariants that kept it retired; it now holds the ones that keep the
// reinstatement whole — a card, a checkout key, an upgrade path, a home, and
// ai_visibility + answer_tracking still baseline on every plan.
import { describe, it, expect } from "vitest";
import { hasFeature, getMinimumPlan } from "@/lib/feature-flags";
import {
  PLAN_ORDER,
  PLAN_CONFIGS,
  planConfig,
  sellablePlan,
  getUpgradePath,
  type SellablePlanType,
} from "@/lib/plan-config";
import { planFromParam, postSignupRedirect, PLAN_HOME } from "@/lib/plan-routing";
import { CHECKOUT_TIERS } from "@/lib/stripe/lookup-keys";
import { UPGRADEABLE_PLANS, tierKeyFor } from "@/components/billing/plan-actions";

const SELLABLE: SellablePlanType[] = ["AI_VISIBILITY", "STARTER", "GROWTH", "AGENCY", "ENTERPRISE"];

describe("ai_visibility + answer_tracking are baseline", () => {
  it("grants both features on every plan, the AI-only one included", () => {
    for (const plan of SELLABLE) {
      expect(hasFeature(plan, "ai_visibility"), plan).toBe(true);
      expect(hasFeature(plan, "answer_tracking"), plan).toBe(true);
    }
  });

  it("the AI-only plan has nothing else", () => {
    for (const f of ["marketing_studio", "review_authenticity", "ai_analysis", "api_access", "whitelabel"] as const) {
      expect(hasFeature("AI_VISIBILITY", f), f).toBe(false);
    }
  });

  it("resolves the cheapest plan carrying them to AI_VISIBILITY", () => {
    expect(getMinimumPlan("ai_visibility")).toBe("AI_VISIBILITY");
    expect(getMinimumPlan("answer_tracking")).toBe("AI_VISIBILITY");
  });

  it("backs the grant with a real budget on every plan", () => {
    for (const plan of SELLABLE) {
      const c = PLAN_CONFIGS[plan];
      expect(c.aiCheckup.frequency, plan).not.toBe("none");
      expect(c.aiCheckup.prompts, plan).toBeGreaterThan(0);
      expect(c.quotaDefaults.maxAiInferencesPerMonth, plan).toBeGreaterThan(0);
      expect(c.aiMonthlyCapUsd === null || c.aiMonthlyCapUsd > 0, plan).toBe(true);
    }
  });
});

describe("the plan is sellable", () => {
  it("has a card, a price and its own config, first on the ladder", () => {
    expect(PLAN_ORDER[0]).toBe("AI_VISIBILITY");
    // The 2026-11-11 price change: $28, $22.40 a month billed yearly.
    expect(PLAN_CONFIGS.AI_VISIBILITY.monthlyPrice).toBe(28);
    expect(PLAN_CONFIGS.AI_VISIBILITY.annualPrice).toBe(22.4);
    expect(planConfig("AI_VISIBILITY")).toBe(PLAN_CONFIGS.AI_VISIBILITY);
    expect(sellablePlan("AI_VISIBILITY")).toBe("AI_VISIBILITY");
  });

  it("has a Stripe checkout tier and lookup keys", () => {
    expect(CHECKOUT_TIERS).toContain("ai_visibility");
    expect(tierKeyFor("AI_VISIBILITY")).toBe("ai_visibility");
  });

  it("upgrades to Starter, and can be switched to and from by checkout", () => {
    expect(getUpgradePath("AI_VISIBILITY")).toBe("STARTER");
    expect(UPGRADEABLE_PLANS).toContain("AI_VISIBILITY");
    expect(UPGRADEABLE_PLANS).toContain("STARTER");
  });
});

describe("routing", () => {
  it("?plan=ai_visibility is the AI Visibility plan", () => {
    for (const raw of ["ai_visibility", "AI_VISIBILITY", " Ai_Visibility "]) {
      expect(planFromParam(raw), raw).toBe("AI_VISIBILITY");
    }
  });

  it("lands the AI-only plan on /visibility and every other plan on /dashboard", () => {
    expect(PLAN_HOME.AI_VISIBILITY).toBe("/visibility");
    expect(postSignupRedirect("ai_visibility")).toBe("/visibility");
    expect(postSignupRedirect("starter")).toBe("/dashboard");
    expect(postSignupRedirect(null)).toBe("/dashboard");
    for (const plan of ["STARTER", "GROWTH", "AGENCY", "ENTERPRISE"] as const) expect(PLAN_HOME[plan]).toBe("/dashboard");
  });
});
