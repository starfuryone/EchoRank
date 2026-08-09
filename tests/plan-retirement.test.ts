// The AI_VISIBILITY tier is retired: its capabilities are baseline on every
// sellable tier, and the enum value survives only so stored rows still resolve.
//
// These are the invariants that keep it retired. Each one is a way the tier
// could come back by accident — a card, a checkout key, an upgrade target, a
// 404 on a link that is still live out in the world.
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

const SELLABLE: SellablePlanType[] = ["STARTER", "GROWTH", "AGENCY", "ENTERPRISE"];

describe("ai_visibility + answer_tracking are baseline", () => {
  it("grants both features on every sellable tier", () => {
    for (const plan of SELLABLE) {
      expect(hasFeature(plan, "ai_visibility"), plan).toBe(true);
      expect(hasFeature(plan, "answer_tracking"), plan).toBe(true);
    }
  });

  it("resolves the cheapest tier carrying them to STARTER, never the retired tier", () => {
    expect(getMinimumPlan("ai_visibility")).toBe("STARTER");
    expect(getMinimumPlan("answer_tracking")).toBe("STARTER");
  });

  it("backs the grant with a real budget on every tier", () => {
    // Granting the feature with a zero allowance would gate every monitor
    // route on an empty budget — the feature would be sold but unusable.
    for (const plan of SELLABLE) {
      const c = PLAN_CONFIGS[plan];
      expect(c.aiCheckup.frequency, plan).not.toBe("none");
      expect(c.aiCheckup.prompts, plan).toBeGreaterThan(0);
      expect(c.quotaDefaults.maxAiInferencesPerMonth, plan).toBeGreaterThan(0);
      expect(c.aiMonthlyCapUsd === null || c.aiMonthlyCapUsd > 0, plan).toBe(true);
    }
  });
});

describe("the tier is unsellable", () => {
  it("has no card, no price and no config entry", () => {
    expect(PLAN_ORDER).not.toContain("AI_VISIBILITY");
    expect(Object.keys(PLAN_CONFIGS)).not.toContain("AI_VISIBILITY");
  });

  it("has no Stripe checkout tier or lookup key", () => {
    expect(CHECKOUT_TIERS).not.toContain("ai_visibility");
    expect(tierKeyFor("AI_VISIBILITY")).toBeNull();
  });

  it("is never offered as an upgrade target", () => {
    expect(UPGRADEABLE_PLANS).not.toContain("AI_VISIBILITY");
    for (const plan of SELLABLE) {
      expect(getUpgradePath(plan), plan).not.toBe("AI_VISIBILITY");
    }
  });
});

describe("legacy values still resolve", () => {
  it("folds the stored enum value onto STARTER", () => {
    expect(sellablePlan("AI_VISIBILITY")).toBe("STARTER");
    expect(planConfig("AI_VISIBILITY")).toBe(PLAN_CONFIGS.STARTER);
  });

  it("normalizes ?plan=ai_visibility to STARTER rather than 404ing", () => {
    // Live external links still carry this parameter. Returning null would
    // silently drop it; resolving it to the retired tier would resurrect it.
    for (const raw of ["ai_visibility", "AI_VISIBILITY", " Ai_Visibility "]) {
      expect(planFromParam(raw), raw).toBe("STARTER");
    }
  });

  it("lands every signup on /dashboard", () => {
    expect(postSignupRedirect("ai_visibility")).toBe("/dashboard");
    expect(postSignupRedirect("starter")).toBe("/dashboard");
    expect(postSignupRedirect(null)).toBe("/dashboard");
    for (const home of Object.values(PLAN_HOME)) expect(home).toBe("/dashboard");
  });
});
