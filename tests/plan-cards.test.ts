// Plan-card rules. These are the parts that decide what a tenant is offered
// and what a click costs, so they are tested as pure functions rather than
// through rendered markup.
import { describe, it, expect } from "vitest";
import {
  UPGRADEABLE_PLANS,
  planCardAction,
  planCheckoutLookupKey,
  tierKeyFor,
} from "@/components/billing/plan-actions";
import type { PlanType } from "@/generated/prisma";

const CARDS: PlanType[] = ["AI_VISIBILITY", "STARTER", "GROWTH", "AGENCY"];
const ALL: PlanType[] = [...CARDS, "ENTERPRISE"];

describe("current-plan badge", () => {
  it("marks exactly one card for any tenant tier", () => {
    for (const current of ALL) {
      const marked = ALL.filter((p) => planCardAction(p, current) === "current");
      expect(marked, `tenant on ${current}`).toEqual([current]);
    }
  });

  it("marks no card when the tenant has no plan", () => {
    expect(ALL.filter((p) => planCardAction(p, null) === "current")).toEqual([]);
    expect(ALL.filter((p) => planCardAction(p, undefined) === "current")).toEqual([]);
  });
});

describe("upgrade buttons", () => {
  it("never offers a button on the tenant's own tier", () => {
    // The rule that matters most: selling someone what they already have.
    for (const current of ALL) {
      expect(planCardAction(current, current)).toBe("current");
      expect(planCheckoutLookupKey(current, current, "month")).toBeNull();
    }
  });

  it("offers buttons only on AI_VISIBILITY, STARTER and GROWTH", () => {
    // Tenant on ENTERPRISE so nothing is masked by the current-tier rule.
    const withButton = ALL.filter((p) => planCardAction(p, "ENTERPRISE") === "upgrade");
    expect(withButton.sort()).toEqual([...UPGRADEABLE_PLANS].sort());
  });

  it("never offers a button on AGENCY", () => {
    for (const current of ALL) {
      expect(planCardAction("AGENCY", current)).not.toBe("upgrade");
    }
  });

  it("gives ENTERPRISE a contact link, not a button", () => {
    for (const current of CARDS) {
      expect(planCardAction("ENTERPRISE", current)).toBe("contact");
    }
    expect(planCheckoutLookupKey("ENTERPRISE", "STARTER", "month")).toBeNull();
    expect(tierKeyFor("ENTERPRISE")).toBeNull();
  });
});

describe("each rendered button hits checkout with the right lookup key", () => {
  it("builds the monthly key per tier", () => {
    // Tenant on ENTERPRISE: every self-serve card shows a button.
    expect(planCheckoutLookupKey("AI_VISIBILITY", "ENTERPRISE", "month")).toBe(
      "echorank_ai_visibility_usd_month",
    );
    expect(planCheckoutLookupKey("STARTER", "ENTERPRISE", "month")).toBe(
      "echorank_starter_usd_month",
    );
    expect(planCheckoutLookupKey("GROWTH", "ENTERPRISE", "month")).toBe(
      "echorank_growth_usd_month",
    );
  });

  it("builds the annual key when the interval is year", () => {
    expect(planCheckoutLookupKey("GROWTH", "STARTER", "year")).toBe(
      "echorank_growth_usd_year",
    );
  });

  it("returns no key for a card with no button", () => {
    // AGENCY has no button, so no key may be built for it — this is what stops
    // a caller wiring a checkout to a card that does not sell one.
    expect(planCheckoutLookupKey("AGENCY", "STARTER", "month")).toBeNull();
  });

  it("only ever builds keys that exist in Stripe", () => {
    const EXISTING = new Set([
      "echorank_ai_visibility_usd_month",
      "echorank_ai_visibility_usd_year",
      "echorank_starter_usd_month",
      "echorank_starter_usd_year",
      "echorank_growth_usd_month",
      "echorank_growth_usd_year",
      "echorank_agency_usd_month",
      "echorank_agency_usd_year",
    ]);
    for (const current of ALL) {
      for (const plan of ALL) {
        for (const interval of ["month", "year"] as const) {
          const key = planCheckoutLookupKey(plan, current, interval);
          if (key) expect(EXISTING.has(key), key).toBe(true);
        }
      }
    }
  });
});
