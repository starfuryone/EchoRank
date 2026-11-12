// tests/legal-subscription-plans.test.ts
//
// §1.1 of the Subscription Agreement — the plan table — against the plans the
// checkout sells, and the root drafting snapshot against the served document.
//
// WHY. A legal document that offers a plan nobody can buy is not a typo; it is
// an offer. The standalone "$29 AI Visibility" tier was retired on 2026-08-09
// and folded into STARTER, but the Aug-2026 drafting snapshot at the repo root
// kept selling it in a price table for weeks, because markdown cannot read
// PLAN_CONFIGS. (The AI Visibility plan was reinstated on 2026-11-07 and is on
// sale again, so its NAME is no longer a retired-tier marker; the retired
// tier's PRICE forms still are.)
//
// Two different guarantees are asserted here:
//
//  1. THE SERVED DOCUMENT names exactly the plans on sale, in the order the
//     cards show them. Its §1.1 lines are pinned text since 2026-11-11 (the
//     prices are held byte for byte by tests/subscription-agreement-pinned.test.ts),
//     so what can rot here is the SHAPE: a plan missing, a plan nobody sells.
//  2. THE ROOT SNAPSHOT (echorank360-subscription-agreement.md) is a plain-text
//     copy of the served document, re-cut from agreementMarkdown()
//     (tests/helpers/agreement-snapshot.ts). Restored 2026-11-12. It is
//     compared byte for byte; when it fails, re-cut the file, do not relax this.
//
// The consent modal is covered too, because that — not the /legal route — is
// the copy a customer is actually made to accept at checkout.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PLAN_CONFIGS, PLAN_ORDER } from "@/lib/plan-config";
import { AGREEMENT_PLAN_LINES_2026_11_12, buildSubscriptionAgreement } from "@/app/[locale]/legal/_content/subscription-agreement";
import { CATALOG_GATED_PLANS } from "@/lib/plan-launch";
import { loadLegalDoc } from "@/app/[locale]/legal/_content/registry";
import { CONSENT_DOCUMENT_IDS } from "@/lib/consent-config";
import type { LegalDoc } from "@/app/[locale]/legal/_content/types";
import { agreementMarkdown, planRow } from "./helpers/agreement-snapshot";

const ROOT = process.cwd();
const SNAPSHOT = join(ROOT, "echorank360-subscription-agreement.md");

/**
 * The retired 2026-08 tier ($29 a month, $288 a year, $24 a month yearly), in
 * every price form a document could still be selling it.
 */
const RETIRED_TIER = [/\$\s*29\b/, /\$\s*288\b/, /\$\s*24\/mo\b/];

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

/** The served §1.1 plan lines, in document order. */
function servedPlanLines(doc: LegalDoc): string[] {
  return planSection(doc).filter((l) => /^[A-Z][A-Za-z ]+: (custom pricing|\$)/.test(l));
}

describe("the served Subscription Agreement", () => {
  const doc = buildSubscriptionAgreement("en");

  it("enumerates exactly the plans on sale, cheapest first, Enterprise last", () => {
    // Not "contains Starter": a plan that is not on sale must not have a line
    // at all. On sale: the ladder, plus the catalog-gated plans, on sale from
    // the release that seeds them (Nosy Bat since 2026-11-12).
    const onSale = [...PLAN_ORDER, ...CATALOG_GATED_PLANS].map((plan) => PLAN_CONFIGS[plan].name);
    const named = servedPlanLines(doc).map((l) => l.slice(0, l.indexOf(":")));
    expect([...named].sort()).toEqual([...onSale].sort());

    // Ascending monthly price, like the plan cards (owner, 2026-11-12); the
    // ladder plans keep their relative order, so "e.g., Starter to Growth" in
    // §5.1 still reads as an upgrade top to bottom.
    const byName = new Map([...PLAN_ORDER, ...CATALOG_GATED_PLANS].map((p) => [PLAN_CONFIGS[p].name, PLAN_CONFIGS[p]]));
    const priced = named.filter((n) => !byName.get(n)!.isCustomPricing).map((n) => Math.round(byName.get(n)!.monthlyPrice * 100));
    expect(priced).toEqual([...priced].sort((a, b) => a - b));
    expect(byName.get(named.at(-1)!)!.isCustomPricing).toBe(true);
    const ladder = named.filter((n) => PLAN_ORDER.some((p) => PLAN_CONFIGS[p].name === n));
    expect(ladder).toEqual(PLAN_ORDER.map((p) => PLAN_CONFIGS[p].name));
  });

  it("quotes the pinned 2026-11-12 lines", () => {
    // §1.1 is pinned text, not generated from PLAN_CONFIGS (since 2026-11-11).
    // Live: the owner-approved draft of the 2026-11-11 price change; the
    // 2026-11-07 lines are kept for the subscriptions that consented to them.
    // tests/subscription-agreement-pinned.test.ts holds both byte for byte.
    expect(servedPlanLines(doc)).toEqual([...AGREEMENT_PLAN_LINES_2026_11_12]);
  });

  it("offers the AI Visibility plan, because it is on sale again (reinstated 2026-11-07)", () => {
    expect(PLAN_ORDER).toContain("AI_VISIBILITY");
    expect(servedPlanLines(doc).some((l) => l.startsWith(`${PLAN_CONFIGS.AI_VISIBILITY.name}: $`))).toBe(true);
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
  it("is the same body the /legal route renders", async () => {
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
  const doc = buildSubscriptionAgreement("en");
  /** Everything after the hand-written header comment. */
  const body = md.slice(md.indexOf("-->") + 3).replace(/^\n+/, "");

  /** The §1.1 pipe table's rows, as written. */
  function tableRows(): string[] {
    const after = md.split("\n### 1.1 Available Plans\n")[1] ?? "";
    return after.split("\n").filter((l) => l.startsWith("|") && !/^\|\s*-|^\| Plan \|/.test(l));
  }

  it("is the served document, re-cut, byte for byte", () => {
    expect(body).toBe(agreementMarkdown(doc));
  });

  it("lists exactly the served plans, in the served order", () => {
    expect(tableRows().map((r) => r.split("|")[1].trim())).toEqual(
      servedPlanLines(doc).map((l) => l.slice(0, l.indexOf(":"))),
    );
  });

  it("quotes the served price for every plan", () => {
    // The assertion the retired $29 row would have failed. Each row is the
    // served line, reformatted; nothing is retyped.
    expect(tableRows()).toEqual(servedPlanLines(doc).map((l) => planRow(l)));
  });

  it.each(RETIRED_TIER.map((r) => [r.source, r] as const))(
    "does not still offer the retired tier (%s)",
    (_label, pattern) => {
      // Scoped to the document body: the header comment may name what was
      // removed, and banning the string there would delete the explanation.
      expect(body).not.toMatch(pattern);
    },
  );

  it("carries the served document's last-updated date", () => {
    expect(body.split("\n")).toContain(doc.updated);
  });
});
