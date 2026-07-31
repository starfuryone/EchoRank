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
});
