// tests/legal-subscription-plans.test.ts
//
// §1.1 of the Subscription Agreement — the plan table — against the config the
// checkout actually charges from.
//
// WHY. A legal document that offers a plan nobody can buy is not a typo; it is
// an offer. The standalone "$29 AI Visibility" tier was retired and folded into
// STARTER (see plan-config.ts and feature-flags.ts), and PLAN_ORDER has excluded
// it since — but the Aug-2026 drafting snapshot at the repo root kept selling it
// in a price table for weeks, because markdown cannot read PLAN_CONFIGS.
//
// Two different guarantees are asserted here, and they are not the same one:
//
//  1. THE SERVED DOCUMENT is generated. buildSubscriptionAgreement() maps
//     PLAN_ORDER -> PLAN_CONFIGS, so it cannot quote a price the checkout does
//     not charge. What can still rot is the SHAPE — someone hard-coding a line
//     back in, or a retired tier reappearing in PLAN_ORDER. Nothing below
//     retypes a price; every expectation is derived from the config, the same
//     way tests/help-articles.test.ts derives its expectation from PLAN_PRICES.
//  2. THE ROOT SNAPSHOT is hand-written prose and cannot be generated. It is
//     parsed and compared to PLAN_CONFIGS instead. This is the tripwire the
//     retired row got past; when it fails, re-cut the table, do not relax it.
//
// The consent modal is covered too, because that — not the /legal route — is
// the copy a customer is actually made to accept at checkout.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PLAN_CONFIGS, PLAN_ORDER } from "@/lib/plan-config";
import { buildSubscriptionAgreement } from "@/app/[locale]/legal/_content/subscription-agreement";
import { loadLegalDoc } from "@/app/[locale]/legal/_content/registry";
import { CONSENT_DOCUMENT_IDS } from "@/lib/consent-config";
import type { LegalDoc } from "@/app/[locale]/legal/_content/types";

const ROOT = process.cwd();
const SNAPSHOT = join(ROOT, "echorank360-subscription-agreement.md");

/** The retired tier, in every form a document could still be selling it. */
const RETIRED_TIER = [/\$\s*29\b/, /\bAI Visibility\b/, /\$\s*288\b/, /\$\s*24\/mo\b/];

/** Every paragraph of a document, flattened. Non-string nodes are links only. */
function docText(doc: LegalDoc): string {
  return doc.sections
    .flatMap((s) => [s.h, ...s.ps.map((p) => (typeof p === "string" ? p : ""))])
    .join("\n");
}

function planSection(doc: LegalDoc): string[] {
  const section = doc.sections.find((s) => s.h === "1. Plans and Pricing");
  if (!section) throw new Error("no §1.1 plan section");
  return section.ps.filter((p): p is string => typeof p === "string");
}

describe("the served Subscription Agreement", () => {
  const doc = buildSubscriptionAgreement("en");

  it("enumerates exactly the sellable tiers, in config order", () => {
    // Not "contains Starter" — the whole point is that a tier which is not in
    // PLAN_ORDER must not have a line at all.
    const lines = planSection(doc);
    const named = PLAN_ORDER.map((plan) => PLAN_CONFIGS[plan].name).map(
      (name) => lines.find((l) => l.startsWith(`${name}:`)),
    );
    expect(named.every(Boolean), "a configured tier has no line in §1.1").toBe(true);

    // Order in the document follows PLAN_ORDER, so "e.g., Starter to Growth" in
    // §5.1 still reads as an upgrade to someone reading top to bottom.
    const positions = named.map((l) => lines.indexOf(l!));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));

    // And nothing else claims to be a plan line.
    const planLines = lines.filter((l) => /^[A-Z][A-Za-z ]+: (custom pricing|\$)/.test(l));
    expect(planLines).toHaveLength(PLAN_ORDER.length);
  });

  it("quotes the price the checkout charges, for every tier", () => {
    const lines = planSection(doc);
    for (const plan of PLAN_ORDER) {
      const c = PLAN_CONFIGS[plan];
      const line = lines.find((l) => l.startsWith(`${c.name}:`))!;
      if (c.isCustomPricing) {
        expect(line, plan).toMatch(/custom pricing/i);
        continue;
      }
      expect(line, plan).toContain(`$${c.monthlyPrice}/month`);
      expect(line, plan).toContain(`$${c.annualPrice * 12}/year`);
      expect(line, plan).toContain(`$${c.annualPrice}/month equivalent`);
    }
  });

  it.each(RETIRED_TIER.map((r) => [r.source, r] as const))(
    "does not still offer the retired tier (%s)",
    (_label, pattern) => {
      expect(docText(doc)).not.toMatch(pattern);
    },
  );
});

describe("the document the checkout consent gate shows", () => {
  // The gate is what a customer is made to accept; the /legal route is only
  // where they can go read it afterwards. LegalDocModal renders whatever
  // loadLegalDoc() returns, so this is the copy that legally binds.
  it("is the same generated body the /legal route renders", async () => {
    expect(CONSENT_DOCUMENT_IDS).toContain("subscription_agreement");
    const viaModal = await loadLegalDoc("subscription_agreement", "en");
    expect(docText(viaModal)).toBe(docText(buildSubscriptionAgreement("en")));
  });

  it.each(RETIRED_TIER.map((r) => [r.source, r] as const))(
    "shows no consent document still offering the retired tier (%s)",
    async (_label, pattern) => {
      for (const id of CONSENT_DOCUMENT_IDS) {
        const doc = await loadLegalDoc(id, "en");
        expect(docText(doc), id).not.toMatch(pattern);
      }
    },
  );
});

describe("the root drafting snapshot", () => {
  const md = readFileSync(SNAPSHOT, "utf8");

  /** The §1.1 pipe table, as { plan, monthly, yearly } rows. */
  function tableRows() {
    const body = md.split("\n### 1.1 Available Plans\n")[1] ?? "";
    return body
      .split("\n")
      .filter((l) => l.startsWith("|") && !/^\|\s*-|^\| Plan \|/.test(l))
      .map((l) => {
        const [, plan, monthly, yearly] = l.split("|").map((c) => c.trim());
        return { plan, monthly, yearly };
      });
  }

  it("lists exactly the sellable tiers, in config order", () => {
    expect(tableRows().map((r) => r.plan)).toEqual(
      PLAN_ORDER.map((plan) => PLAN_CONFIGS[plan].name),
    );
  });

  it("quotes the price the checkout charges, for every tier", () => {
    // The assertion the retired $29 row would have failed. Prices are derived,
    // never retyped — a hand-kept expectation drifts the way the table does.
    const rows = tableRows();
    for (const [i, plan] of PLAN_ORDER.entries()) {
      const c = PLAN_CONFIGS[plan];
      const row = rows[i];
      if (c.isCustomPricing) {
        expect(row.monthly, plan).toMatch(/custom pricing/i);
        expect(row.yearly, plan).toMatch(/custom pricing/i);
        continue;
      }
      const yearly = (c.annualPrice * 12).toLocaleString("en-US");
      expect(row.monthly, plan).toBe(`$${c.monthlyPrice}/month`);
      expect(row.yearly, plan).toBe(`$${yearly}/year ($${c.annualPrice}/mo equivalent)`);
    }
  });

  it.each(RETIRED_TIER.map((r) => [r.source, r] as const))(
    "does not still offer the retired tier (%s)",
    (_label, pattern) => {
      // Scoped to the document body: the header comment names "$29 AI
      // Visibility" in order to explain what was removed, and banning the
      // string there would delete the explanation.
      expect(md.split("-->").slice(1).join("-->")).not.toMatch(pattern);
    },
  );

  it("carries a bumped last-updated date", () => {
    expect(md).toMatch(/^Last updated: August 30, 2026$/m);
  });
});
