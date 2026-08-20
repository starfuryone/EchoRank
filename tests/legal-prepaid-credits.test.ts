// tests/legal-prepaid-credits.test.ts
//
// The prepaid-credit clause, in both consent documents that carry it.
//
// WHY THIS IS TESTED AT ALL. It is copy, and copy is not usually worth a test —
// but this copy makes a factual promise about how the product behaves ("credits
// consumed by batches in which the listing search never executed are
// automatically re-credited"), it is legally operative, and the /credits page
// deep-links into it by anchor from another part of the app. Three things that
// break silently: the anchor, the locale coverage, and the promise drifting
// away from the code that implements it.
//
// The behaviour behind the promise lives in releaseUnconsumed() /
// settleBatchCredits(); `consumed` counts only rows with placesCharged = true,
// which is set from costUsd > 0 — so a search that never ran is never charged.
// If that ever changes, this clause becomes false and needs rewriting, not
// deleting.

import { describe, expect, it } from "vitest";
import { buildTerms } from "@/app/[locale]/legal/_content/terms";
import { buildSubscriptionAgreement } from "@/app/[locale]/legal/_content/subscription-agreement";
import { CONSENT_VERSION } from "@/lib/consent-config";
import type { LegalDoc } from "@/app/[locale]/legal/_content/types";

/** Every paragraph of a section, flattened to searchable text. */
function sectionText(doc: LegalDoc, id: string): string {
  const section = doc.sections.find((s) => s.id === id);
  if (!section) throw new Error(`no section with id "${id}"`);
  return section.ps.map((p) => (typeof p === "string" ? p : "")).join(" ");
}

describe("the anchor the /credits footer links to", () => {
  it.each(["en", "fr"])("exists in Terms for %s", (locale) => {
    // /credits renders <Link href={`/${locale}/legal/terms#prepaid-credits`}>.
    // A missing id here is a link that silently lands at the top of a
    // sixteen-section document instead of the clause it promised.
    const doc = buildTerms(locale);
    expect(doc.sections.some((s) => s.id === "prepaid-credits")).toBe(true);
  });

  it("exists in the Subscription Agreement", () => {
    const doc = buildSubscriptionAgreement("en");
    expect(doc.sections.some((s) => s.id === "prepaid-credits")).toBe(true);
  });

  it("is unique within each document", () => {
    // Two sections sharing an id makes the jump target arbitrary.
    for (const doc of [buildTerms("en"), buildTerms("fr"), buildSubscriptionAgreement("en")]) {
      const ids = doc.sections.map((s) => s.id).filter(Boolean);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe("what the clause has to say", () => {
  const CLAIMS_EN: Array<[string, RegExp]> = [
    ["never expires", /do not expire/i],
    ["is not a subscription", /not a subscription/i],
    ["needs an active qualifying plan", /active subscription to a plan that includes the Opportunity Scanner/i],
    ["survives cancellation on the balance", /remain on your account|remain on the account/i],
    ["re-credits an unexecuted search", /never executed are automatically re-credited/i],
    ["calls that an adjustment, not a refund", /balance adjustment, not a monetary refund/i],
    ["is otherwise non-refundable", /non-refundable and non-transferable/i],
    ["preserves the consumer-law carve-out", /required by applicable consumer law/i],
    ["is not refunded on cancellation or downgrade", /not refunded on cancellation or downgrade/i],
    ["does not convert to cash", /not converted to cash/i],
  ];

  it.each(CLAIMS_EN)("Terms (en) %s", (_label, pattern) => {
    expect(sectionText(buildTerms("en"), "prepaid-credits")).toMatch(pattern);
  });

  it.each(CLAIMS_EN)("Subscription Agreement %s", (_label, pattern) => {
    expect(sectionText(buildSubscriptionAgreement("en"), "prepaid-credits")).toMatch(pattern);
  });

  it("says a search that ran but found nothing is still consumed", () => {
    // The single most likely dispute, and the one the code is unambiguous
    // about: placesCharged comes from costUsd > 0, not from whether a listing
    // was found.
    for (const doc of [buildTerms("en"), buildSubscriptionAgreement("en")]) {
      expect(sectionText(doc, "prepaid-credits")).toMatch(
        /whether or not it finds a matching business/i,
      );
    }
  });
});

describe("French", () => {
  const text = () => sectionText(buildTerms("fr"), "prepaid-credits");

  it("is a real translation, not the English text", () => {
    expect(text()).not.toMatch(/non-refundable/i);
    expect(text()).toMatch(/ne sont ni remboursables ni transférables/i);
  });

  it("keeps the adjustment-not-a-refund distinction", () => {
    expect(text()).toMatch(/ajustement de solde et non d'un remboursement/i);
  });

  it("keeps the consumer-law carve-out", () => {
    expect(text()).toMatch(/droit de la consommation applicable/i);
  });
});

describe("the consent version", () => {
  it("was bumped past the date these documents last said", () => {
    // Adding operative language to two of the four consent documents makes
    // every consent recorded under the old version stale. consent-config.ts
    // states the rule; this asserts somebody followed it.
    expect(CONSENT_VERSION).toBe("2026-08-20");
    expect(buildTerms("en").updated).toContain("August 20, 2026");
    expect(buildTerms("fr").updated).toContain("20 août 2026");
    expect(buildSubscriptionAgreement("en").updated).toContain("August 20, 2026");
  });
});
