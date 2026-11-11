// tests/subscription-agreement-pinned.test.ts
//
// The live Subscription Agreement's §1.1 plan lines are PINNED to the text
// consented to under CONSENT_VERSION 2026-11-07.
//
// WHY. Until 2026-11-11 the lines were generated from PLAN_CONFIGS. The price
// change of that day moved the config, and the owner's instruction was to
// DRAFT the agreement's price table change (/opt/echorank/prompts/legal-drafts/
// subscription-agreement-price-change-2026-11-11.md), not publish it. A
// generated table would have published it on the next deploy, without review
// and without a consent bump. So the lines are text again, and this file fails
// on ANY change to them.
//
// WHEN THIS FAILS because the reviewed draft is being published: update the
// expected lines below, the "Last updated" date, and bump CONSENT_VERSION in
// src/lib/consent-config.ts, all in the same commit.

import { describe, expect, it } from "vitest";
import {
  AGREEMENT_PLAN_LINES_2026_11_07,
  buildSubscriptionAgreement,
} from "@/app/[locale]/legal/_content/subscription-agreement";
import { CONSENT_VERSION } from "@/lib/consent-config";
import { PLAN_CONFIGS } from "@/lib/plan-config";

/** Byte for byte, the §1.1 lines the 2026-11-07 version rendered from the config of that day. */
const LINES_2026_11_07 = [
  "AI Visibility: $29/month, or $276/year ($23/month equivalent).",
  "Starter: $79/month, or $756/year ($63/month equivalent).",
  "Growth: $199/month, or $1908/year ($159/month equivalent).",
  "Agency: $499/month, or $4788/year ($399/month equivalent).",
  "Enterprise: custom pricing — contact us.",
];

/** The old generator, with the 2026-11-07 prices: what the live text was built from. */
function generated20261107(): string[] {
  const old: [string, number, number][] = [
    ["AI Visibility", 29, 23],
    ["Starter", 79, 63],
    ["Growth", 199, 159],
    ["Agency", 499, 399],
  ];
  return [
    ...old.map(([name, m, a]) => `${name}: $${m}/month, or $${a * 12}/year ($${a}/month equivalent).`),
    "Enterprise: custom pricing — contact us.",
  ];
}

function planLines(): string[] {
  const s = buildSubscriptionAgreement("en").sections.find((x) => x.h === "1. Plans and Pricing")!;
  return s.ps.filter((p): p is string => typeof p === "string");
}

describe("the live Subscription Agreement's §1.1", () => {
  it("is the 2026-11-07 text, byte for byte", () => {
    expect([...AGREEMENT_PLAN_LINES_2026_11_07]).toEqual(LINES_2026_11_07);
    expect(LINES_2026_11_07).toEqual(generated20261107());
    const lines = planLines();
    const at = lines.indexOf(LINES_2026_11_07[0]);
    expect(at).toBeGreaterThan(0);
    expect(lines.slice(at, at + LINES_2026_11_07.length)).toEqual(LINES_2026_11_07);
  });

  it("does not follow the config (the 2026-11-11 prices are drafted, not published)", () => {
    const text = planLines().join("\n");
    for (const plan of ["AI_VISIBILITY", "STARTER", "GROWTH", "AGENCY"] as const) {
      expect(text).not.toContain(`${PLAN_CONFIGS[plan].name}: $${PLAN_CONFIGS[plan].monthlyPrice}/month`);
    }
    expect(buildSubscriptionAgreement("en").updated).toBe("Last updated: November 7, 2026");
  });

  it("is still the version buyers consent to", () => {
    expect(CONSENT_VERSION).toBe("2026-11-07");
  });
});
