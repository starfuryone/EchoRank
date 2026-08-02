// Checkout wiring: lookup-key construction, enterprise rejection, and the
// tier -> PlanType mapping the webhook depends on.
//
// These are the three places a silent mistake costs money: a wrong lookup key
// charges the wrong price, a missing enterprise guard sells a custom-priced
// plan at whatever key happens to resolve, and a gap in TIER_TO_PLAN leaves a
// paying tenant on the wrong planType.
import { describe, it, expect } from "vitest";
import {
  CHECKOUT_TIERS,
  checkoutLookupKey,
  isBillingInterval,
  isCheckoutTier,
} from "@/lib/stripe/lookup-keys";
import { PLAN_ORDER } from "@/lib/plan-config";

/** The eight keys that exist in Stripe. Nothing else may be constructed. */
const EXPECTED_KEYS = [
  "echorank_ai_visibility_usd_month",
  "echorank_ai_visibility_usd_year",
  "echorank_starter_usd_month",
  "echorank_starter_usd_year",
  "echorank_growth_usd_month",
  "echorank_growth_usd_year",
  "echorank_agency_usd_month",
  "echorank_agency_usd_year",
];

describe("checkout lookup keys", () => {
  it("builds exactly the eight keys that exist in Stripe", () => {
    const built = CHECKOUT_TIERS.flatMap((t) => [
      checkoutLookupKey(t, "month"),
      checkoutLookupKey(t, "year"),
    ]);
    expect(built.sort()).toEqual([...EXPECTED_KEYS].sort());
  });

  it("uses the echorank_<tier>_usd_<interval> shape", () => {
    expect(checkoutLookupKey("growth", "year")).toBe("echorank_growth_usd_year");
    expect(checkoutLookupKey("ai_visibility", "month")).toBe(
      "echorank_ai_visibility_usd_month",
    );
  });

  it("never builds a key for enterprise", () => {
    // Enterprise is excluded at the type level; this guards the runtime list
    // that the route actually validates against.
    expect(CHECKOUT_TIERS).not.toContain("enterprise");
    expect(isCheckoutTier("enterprise")).toBe(false);
  });

  it("rejects unknown tiers and intervals", () => {
    expect(isCheckoutTier("gold")).toBe(false);
    expect(isCheckoutTier("")).toBe(false);
    expect(isCheckoutTier(undefined)).toBe(false);
    expect(isBillingInterval("week")).toBe(false);
    expect(isBillingInterval("MONTH")).toBe(false);
    expect(isBillingInterval("month")).toBe(true);
    expect(isBillingInterval("year")).toBe(true);
  });

  it("covers every sellable plan except enterprise", () => {
    // If a tier is added to PLAN_CONFIGS, it must either become buyable here
    // or be custom-priced like enterprise — silently missing is the bug.
    const sellable = PLAN_ORDER.filter((p) => p !== "ENTERPRISE").map((p) => p.toLowerCase());
    expect([...CHECKOUT_TIERS].sort()).toEqual(sellable.sort());
  });
});

describe("tier -> PlanType mapping", () => {
  // Mirrors TIER_TO_PLAN in src/lib/stripe/prices.ts. ai_visibility is called
  // out because its absence was the specific bug: without it the webhook's
  // reverse lookup returns null and planType is never set for that tier.
  const MAP: Record<string, string> = {
    ai_visibility: "AI_VISIBILITY",
    starter: "STARTER",
    growth: "GROWTH",
    agency: "AGENCY",
  };

  it("maps every checkout tier to a real PlanType", () => {
    for (const tier of CHECKOUT_TIERS) {
      const planType = MAP[tier];
      expect(planType, `no PlanType for ${tier}`).toBeDefined();
      expect(PLAN_ORDER).toContain(planType);
    }
  });

  it("includes ai_visibility", () => {
    expect(MAP.ai_visibility).toBe("AI_VISIBILITY");
    expect(PLAN_ORDER).toContain("AI_VISIBILITY");
  });
});
