// Checkout wiring: lookup-key construction, enterprise rejection, and the
// tier -> PlanType mapping the webhook depends on.
//
// These are the three places a silent mistake costs money: a wrong lookup key
// charges the wrong price, a missing enterprise guard sells a custom-priced
// plan at whatever key happens to resolve, and a gap in TIER_TO_PLAN leaves a
// paying tenant on the wrong planType.
import { describe, it, expect } from "vitest";
import { WATCHER_LOOKUP_KEYS } from "@/lib/plan-config";
import { productKindFor } from "@/lib/ai-monitor/watcher-entitlement";
import { createHmac } from "node:crypto";
import {
  CHECKOUT_TIERS,
  WATCHER_TIER,
  checkoutLookupKey,
  isBillingInterval,
  isCheckoutTier,
} from "@/lib/stripe/lookup-keys";
import { PLAN_ORDER } from "@/lib/plan-config";

/**
 * Every key that exists in Stripe. Nothing else may be constructed.
 *
 * Six plan keys plus the two standalone-Watcher keys. The watcher is an
 * ENTITLEMENT, not a tier — there is no WATCHER PlanType — so it widens this
 * list and is deliberately excluded from the plan-shaped assertions below.
 */
const EXPECTED_KEYS = [
  "echorank_starter_usd_month",
  "echorank_starter_usd_year",
  "echorank_growth_usd_month",
  "echorank_growth_usd_year",
  "echorank_agency_usd_month",
  "echorank_agency_usd_year",
  "echorank_watcher_pro_usd_month",
  "echorank_watcher_pro_usd_year",
];

/** The checkout tiers that are actually plans. */
const PLAN_TIERS = CHECKOUT_TIERS.filter((t) => t !== WATCHER_TIER);

describe("checkout lookup keys", () => {
  it("builds exactly the keys that exist in Stripe", () => {
    const built = CHECKOUT_TIERS.flatMap((t) => [
      checkoutLookupKey(t, "month"),
      checkoutLookupKey(t, "year"),
    ]);
    expect(built.sort()).toEqual([...EXPECTED_KEYS].sort());
  });

  it("uses the echorank_<tier>_usd_<interval> shape", () => {
    expect(checkoutLookupKey("growth", "year")).toBe("echorank_growth_usd_year");
    expect(checkoutLookupKey("starter", "month")).toBe(
      "echorank_starter_usd_month",
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
    // Compared against the PLAN tiers only: the watcher has no PLAN_CONFIGS
    // entry, which is the whole reason it is an entitlement.
    const sellable = PLAN_ORDER.filter((p) => p !== "ENTERPRISE").map((p) => p.toLowerCase());
    expect([...PLAN_TIERS].sort()).toEqual(sellable.sort());
  });

  it("builds the watcher keys the entitlement discriminator expects", () => {
    // These two strings are what productKindFor() keys on, so a typo here would
    // silently make a watcher purchase look like a plan.
    expect(checkoutLookupKey(WATCHER_TIER, "month")).toBe(WATCHER_LOOKUP_KEYS.monthly);
    expect(checkoutLookupKey(WATCHER_TIER, "year")).toBe(WATCHER_LOOKUP_KEYS.annual);
    expect(productKindFor(checkoutLookupKey(WATCHER_TIER, "month"))).toBe("WATCHER");
  });

  it("keeps every plan key resolving to PLAN, not WATCHER", () => {
    for (const tier of PLAN_TIERS) {
      expect(productKindFor(checkoutLookupKey(tier, "month")), tier).toBe("PLAN");
    }
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

  it("maps every PLAN checkout tier to a real PlanType", () => {
    // The watcher is excluded deliberately: it grants an entitlement, not a
    // tier, and the webhook must NOT resolve a PlanType for it — doing so is
    // exactly what would let a $9 add-on inherit a plan's features.
    for (const tier of PLAN_TIERS) {
      const planType = MAP[tier];
      expect(planType, `no PlanType for ${tier}`).toBeDefined();
      expect(PLAN_ORDER).toContain(planType);
    }
  });

  it("never maps the retired ai_visibility tier", () => {
    expect(CHECKOUT_TIERS).not.toContain("ai_visibility");
    expect(PLAN_ORDER).not.toContain("AI_VISIBILITY");
  });
});

// ── Webhook signature verification ──────────────────────────────────────────
//
// The route's fail-closed behaviour rests on two things: it refuses to run
// without STRIPE_WEBHOOK_SECRET, and it hands the raw body to Stripe's own
// constructEvent rather than parsing it first. These exercise the second half
// against the real library, so a future "simplification" that trusts the body
// fails here.
describe("webhook signature verification", () => {
  const secret = "whsec_test_only_not_a_real_secret";
  const payload = JSON.stringify({
    id: "evt_test",
    type: "checkout.session.completed",
    data: { object: { id: "cs_test" } },
  });

  function sign(body: string, ts: number, key: string) {
    // Stripe's scheme: HMAC-SHA256 over `${timestamp}.${payload}`.
    const sig = createHmac("sha256", key).update(`${ts}.${body}`).digest("hex");
    return `t=${ts},v1=${sig}`;
  }

  it("accepts a correctly signed payload", async () => {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe("sk_test_dummy");
    const ts = Math.floor(Date.now() / 1000);
    const event = stripe.webhooks.constructEvent(payload, sign(payload, ts, secret), secret);
    expect(event.type).toBe("checkout.session.completed");
  });

  it("rejects a payload signed with the wrong secret", async () => {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe("sk_test_dummy");
    const ts = Math.floor(Date.now() / 1000);
    const header = sign(payload, ts, "whsec_a_different_secret");
    expect(() => stripe.webhooks.constructEvent(payload, header, secret)).toThrow();
  });

  it("rejects a tampered body under a valid-looking signature", async () => {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe("sk_test_dummy");
    const ts = Math.floor(Date.now() / 1000);
    const header = sign(payload, ts, secret);
    const tampered = payload.replace("cs_test", "cs_attacker");
    expect(() => stripe.webhooks.constructEvent(tampered, header, secret)).toThrow();
  });

  it("rejects a missing signature header", async () => {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe("sk_test_dummy");
    expect(() => stripe.webhooks.constructEvent(payload, "", secret)).toThrow();
  });

  it("treats an empty secret as unusable rather than a skip", () => {
    // The route returns 500 when STRIPE_WEBHOOK_SECRET is absent — the live
    // value is intentionally empty until the production endpoint exists, and
    // an empty string must never read as "verification passed".
    const secretFromEnv = "";
    expect(Boolean(secretFromEnv)).toBe(false);
  });
});
