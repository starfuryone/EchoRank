// Guards the SoftwareApplication offers against the drift this file exists
// because of: src/lib/seo/constants.ts used to carry a hand-kept copy of the
// prices, and it published 49/149/349 plus a 999 Enterprise long after the real
// tiers had moved to 79/199/499 with Enterprise on custom pricing.
//
// These assertions deliberately name NO price. Hardcoding 29/79/199/499 here
// would rebuild the same duplicate one layer up and drift the same way; the
// point is that the offers are derived from PLAN_CONFIGS.
import { describe, it, expect } from "vitest";
import { softwareApplication } from "@/lib/seo/jsonld";
import { PLAN_CONFIGS } from "@/lib/plan-config";

interface Offer {
  "@type": string;
  name: string;
  price: string;
  priceCurrency: string;
}

function offers(): Offer[] {
  const node = softwareApplication("en") as unknown as { offers: Offer[] };
  return node.offers;
}

const listed = Object.values(PLAN_CONFIGS).filter(
  (p) => !p.isCustomPricing && p.monthlyPrice > 0,
);
const custom = Object.values(PLAN_CONFIGS).filter((p) => p.isCustomPricing);

describe("SoftwareApplication offers", () => {
  it("emits one offer per list-priced plan, and no others", () => {
    expect(offers().map((o) => o.name).sort()).toEqual(
      listed.map((p) => p.name).sort(),
    );
  });

  it("prices every offer from PLAN_CONFIGS", () => {
    for (const offer of offers()) {
      const plan = listed.find((p) => p.name === offer.name);
      expect(plan, `no PLAN_CONFIGS entry named ${offer.name}`).toBeDefined();
      expect(offer.price).toBe(String(plan!.monthlyPrice));
    }
  });

  it("omits custom-priced plans rather than inventing a number", () => {
    // Enterprise carries monthlyPrice 0. Publishing that as an Offer would
    // advertise a free enterprise tier; publishing a guess is worse.
    expect(custom.length).toBeGreaterThan(0); // fixture sanity
    for (const plan of custom) {
      expect(offers().some((o) => o.name === plan.name)).toBe(false);
    }
  });

  it("quotes a currency on every offer", () => {
    for (const offer of offers()) {
      expect(offer.priceCurrency).toBe("USD");
      expect(offer["@type"]).toBe("Offer");
    }
  });

  // ── Anchor pricing must not reach structured data ────────────────────────
  //
  // The homepage cards show a struck-through anchor on the ANNUAL toggle. It is
  // the plan's real monthly price, so unlike a computed "was" figure it is a
  // number Google may legitimately see — but only ever as the MONTHLY offer it
  // actually is. What must never appear is the annual per-month rate published
  // as the price of the plan: that is a number nobody can pay on its own, and
  // emitting it would advertise $24/mo for a plan that bills $29 monthly.
  //
  // Still named no price. The assertions derive both sides from PLAN_CONFIGS.
  it("publishes the monthly price, never the annual per-month rate", () => {
    for (const offer of offers()) {
      const plan = listed.find((p) => p.name === offer.name)!;
      expect(offer.price).toBe(String(plan.monthlyPrice));
      // annualPrice is ALREADY the per-month figure (see plan-config.ts), so
      // there is no /12 here — dividing would compare against a number nothing
      // renders and pass for the wrong reason.
      if (plan.annualPrice && plan.annualPrice !== plan.monthlyPrice) {
        expect(offer.price, `${offer.name} published its annual rate`).not.toBe(
          String(plan.annualPrice),
        );
      }
    }
  });

  it("emits no offer priced below the plan's monthly rate", () => {
    // A discounted-looking figure in structured data is the drift that matters:
    // rich results would quote a price the checkout does not honour.
    for (const offer of offers()) {
      const plan = listed.find((p) => p.name === offer.name)!;
      expect(Number(offer.price)).toBeGreaterThanOrEqual(plan.monthlyPrice);
    }
  });

  it("carries no anchor, strike or discount markup of any kind", () => {
    // The anchor is presentational and belongs to the card, not the graph.
    const serialized = JSON.stringify(softwareApplication("en"));
    for (const term of ["<s>", "priceAnchor", "anchorLabel", "strikethrough", "wasPrice"]) {
      expect(serialized).not.toContain(term);
    }
  });
});
