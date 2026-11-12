// tests/subscription-agreement-pinned.test.ts
//
// The Subscription Agreement's §1.1 plan lines are PINNED TEXT, not generated
// from PLAN_CONFIGS (since 2026-11-11): the document moves only when a reviewed
// version is published, with a CONSENT_VERSION bump in the same commit.
//
// LIVE: the 2026-11-12 lines, the owner-approved draft of the 2026-11-11 price
// change (/opt/echorank/prompts/legal-drafts/subscription-agreement-price-
// change-2026-11-11.md), Nosy Bat included.
// KEPT: the 2026-11-07 lines, what subscriptions started under that consent
// version agreed to. They keep those prices, so the text is a record, not dead
// code.
//
// WHEN THIS FAILS because a newer reviewed version is being published: add a
// new dated constant, keep the old one, update the "Last updated" date and
// bump CONSENT_VERSION in src/lib/consent-config.ts, all in the same commit.

import { describe, expect, it } from "vitest";
import {
  AGREEMENT_PLAN_LINES_2026_11_07,
  AGREEMENT_PLAN_LINES_2026_11_12,
  buildSubscriptionAgreement,
} from "@/app/[locale]/legal/_content/subscription-agreement";
import { CONSENT_VERSION } from "@/lib/consent-config";
import { usd, usdCents } from "@/lib/pricing-page/format";

/** Byte for byte, the §1.1 lines the 2026-11-07 version rendered from the config of that day. */
const LINES_2026_11_07 = [
  "AI Visibility: $29/month, or $276/year ($23/month equivalent).",
  "Starter: $79/month, or $756/year ($63/month equivalent).",
  "Growth: $199/month, or $1908/year ($159/month equivalent).",
  "Agency: $499/month, or $4788/year ($399/month equivalent).",
  "Enterprise: custom pricing — contact us.",
];

/**
 * Byte for byte, §2 of the approved draft, in ascending monthly price with
 * Enterprise last, like the plan cards (owner, 2026-11-12): Nosy Bat first.
 */
const LINES_2026_11_12 = [
  "Nosy Bat: $15/month, or $144.00/year ($12.00/month equivalent).",
  "AI Visibility: $28/month, or $268.80/year ($22.40/month equivalent).",
  "Starter: $78/month, or $748.80/year ($62.40/month equivalent).",
  "Growth: $177/month, or $1,699.20/year ($141.60/month equivalent).",
  "Agency: $488/month, or $4,684.80/year ($390.40/month equivalent).",
  "Enterprise: custom pricing — contact us.",
];

/** §3 of the approved draft: what a list-price change does to an existing subscription. */
const OLD_PRICE_SENTENCE =
  "A change to our list prices applies to new subscriptions. An existing subscription, including one in its free trial, keeps the price in effect when it started until you change plan or billing interval, or we give you notice of a change as described above.";

/** The old generator, with the 2026-11-07 prices: what that text was built from. */
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

function section11(): string[] {
  const s = buildSubscriptionAgreement("en").sections.find((x) => x.h === "1. Plans and Pricing")!;
  return s.ps.filter((p): p is string => typeof p === "string");
}

describe("the live Subscription Agreement's §1.1 (2026-11-12)", () => {
  it("is the approved draft, byte for byte, in the served document", () => {
    expect([...AGREEMENT_PLAN_LINES_2026_11_12]).toEqual(LINES_2026_11_12);
    const lines = section11();
    const at = lines.indexOf(LINES_2026_11_12[0]);
    expect(at).toBe(1); // right after "1.1 Available Plans. …"
    expect(lines.slice(at, at + LINES_2026_11_12.length)).toEqual(LINES_2026_11_12);
  });

  it("lists the priced plans cheapest first, like the cards, and Enterprise last", () => {
    const cents = (l: string) => Math.round(Number(l.match(/: \$([\d,]+)\/month/)![1].replace(/,/g, "")) * 100);
    const priced = LINES_2026_11_12.slice(0, -1).map(cents);
    expect(priced).toEqual([...priced].sort((a, b) => a - b));
    expect(LINES_2026_11_12.at(-1)).toMatch(/^Enterprise: custom pricing/);
  });

  it("serves none of the 2026-11-07 lines", () => {
    const lines = section11();
    for (const old of LINES_2026_11_07.slice(0, 4)) expect(lines).not.toContain(old);
  });

  it("says an existing subscription keeps its price, right after the currency sentence", () => {
    const lines = section11();
    const currency = lines.findIndex((l) => l.startsWith("Prices are in US Dollars"));
    expect(currency).toBe(1 + LINES_2026_11_12.length);
    expect(lines[currency + 1]).toBe(OLD_PRICE_SENTENCE);
    expect(lines[currency + 2]).toMatch(/^1\.2 Plan Limits\./);
  });

  it("adds up: 20% off monthly, twelve months a year, in cents, printed as the pricing page prints", () => {
    // Monthly whole (usd), yearly figures with both decimals (usdCents). Parsed
    // in cents, never multiplied in floating point (17.60 × 12 is 211.20000000000002).
    for (const line of LINES_2026_11_12.slice(0, -1)) {
      const m = line.match(/^[A-Za-z ]+: \$([\d,]+)\/month, or \$([\d,]+\.\d\d)\/year \(\$([\d,]+\.\d\d)\/month equivalent\)\.$/);
      expect(m, line).not.toBeNull();
      const cents = (s: string) => Math.round(Number(s.replace(/,/g, "")) * 100);
      const [monthly, yearly, perMonth] = [cents(m![1]), cents(m![2]), cents(m![3])];
      expect(perMonth * 5, line).toBe(monthly * 4);
      expect(yearly, line).toBe(perMonth * 12);
      expect(`$${m![1]}`).toBe(usd(monthly / 100, "en"));
      expect(`$${m![2]}`).toBe(usdCents(yearly / 100, "en"));
      expect(`$${m![3]}`).toBe(usdCents(perMonth / 100, "en"));
    }
  });

  it("is dated, and is the version buyers now consent to", () => {
    expect(buildSubscriptionAgreement("en").updated).toBe("Last updated: November 12, 2026");
    expect(CONSENT_VERSION).toBe("2026-11-12");
  });
});

describe("the 2026-11-07 lines, kept for the subscriptions that consented to them", () => {
  it("are unchanged, byte for byte", () => {
    expect([...AGREEMENT_PLAN_LINES_2026_11_07]).toEqual(LINES_2026_11_07);
    expect(LINES_2026_11_07).toEqual(generated20261107());
  });
});
