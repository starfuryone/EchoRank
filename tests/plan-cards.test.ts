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
import { isUpgrade } from "@/lib/plan-config";
import type { PlanType } from "@/generated/prisma";

const CARDS: PlanType[] = ["STARTER", "GROWTH", "AGENCY"];
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

  it("offers a button on exactly STARTER and GROWTH, whichever way it points", () => {
    // Tenant on ENTERPRISE so nothing is masked by the current-tier rule. Both
    // cards are BELOW enterprise, so both are downgrades — this assertion used
    // to require "upgrade" for both, which is the bug.
    const withButton = ALL.filter((p) =>
      ["upgrade", "downgrade"].includes(planCardAction(p, "ENTERPRISE")),
    );
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


// ─── Direction, from each tier a tenant can actually be on ──────────────────
//
// The rule: the label describes the move RELATIVE TO WHAT THEY HOLD. Before
// this, every sellable card said "Upgrade to …", so a Growth subscriber was
// invited to "Upgrade to Starter" — a cheaper, smaller plan — and an Agency
// subscriber was told the same about both tiers beneath them.
//
// Asserted per tenant tier rather than per pair, because the failure is always
// "what does THIS customer see on THIS page".

describe("direction relative to the tenant's own tier", () => {
  it("STARTER tenant: Growth is up, own tier is current", () => {
    expect(planCardAction("STARTER", "STARTER")).toBe("current");
    expect(planCardAction("GROWTH", "STARTER")).toBe("upgrade");
    expect(planCardAction("ENTERPRISE", "STARTER")).toBe("contact");
  });

  it("GROWTH tenant: Starter is DOWN, not up", () => {
    // The headline case.
    expect(planCardAction("STARTER", "GROWTH")).toBe("downgrade");
    expect(planCardAction("GROWTH", "GROWTH")).toBe("current");
    expect(planCardAction("ENTERPRISE", "GROWTH")).toBe("contact");
  });

  it("AGENCY tenant: both cheaper tiers are downgrades", () => {
    expect(planCardAction("STARTER", "AGENCY")).toBe("downgrade");
    expect(planCardAction("GROWTH", "AGENCY")).toBe("downgrade");
    expect(planCardAction("AGENCY", "AGENCY")).toBe("current");
    expect(planCardAction("ENTERPRISE", "AGENCY")).toBe("contact");
  });

  it("never calls a lower tier an upgrade, for any pair", () => {
    // The invariant behind the three cases above, stated once so a new tier
    // added to PLAN_ORDER cannot reintroduce the bug in a pair nobody listed.
    for (const current of ALL) {
      for (const target of ALL) {
        if (current === target) continue;
        const action = planCardAction(target, current);
        if (action === "upgrade") {
          expect(isUpgrade(current, target), `${current} -> ${target}`).toBe(true);
        }
        if (action === "downgrade") {
          expect(isUpgrade(current, target), `${current} -> ${target}`).toBe(false);
        }
      }
    }
  });

  it("calls everything an upgrade for a tenant with no plan to compare against", () => {
    // A never-subscribed tenant is buying, not moving; "downgrade" would be
    // meaningless with nothing to be below.
    for (const target of UPGRADEABLE_PLANS) {
      expect(planCardAction(target, null)).toBe("upgrade");
      expect(planCardAction(target, "GROWTH", false)).toBe("upgrade");
    }
  });

  it("folds the retired AI_VISIBILITY tier rather than mislabelling it", () => {
    // It ranks as STARTER, so Growth is genuinely up from it. Left outside the
    // order it would compare as index -1 and read as an upgrade to everything,
    // including Starter.
    expect(planCardAction("GROWTH", "AI_VISIBILITY")).toBe("upgrade");
    expect(planCardAction("STARTER", "AI_VISIBILITY")).toBe("downgrade");
  });

  it("builds a checkout key for a downgrade too", () => {
    // Both directions POST a checkout for the target tier, so a downgrade card
    // that could not build its key would render a button that cannot fire.
    expect(planCheckoutLookupKey("STARTER", "GROWTH", "month")).toBe(
      "echorank_starter_usd_month",
    );
    expect(planCheckoutLookupKey("STARTER", "AGENCY", "year")).toBe(
      "echorank_starter_usd_year",
    );
  });
});
