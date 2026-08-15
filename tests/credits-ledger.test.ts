// tests/credits-ledger.test.ts
//
// The credit arithmetic and the pack catalogue: the two things that decide how
// much a customer is charged and how much they get back.
//
// EVERY EXPECTED NUMBER IS A HAND-COMPUTED LITERAL, never a recomputation from
// the code under test — the convention tests/sov-weighting.test.ts sets. Here
// it matters more than usual: writing `expect(releaseDelta(a, b)).toBe(a - b)`
// would assert the implementation against itself and pass any sign error.

import { describe, expect, it } from "vitest";
import {
  balanceOf,
  canAfford,
  consumedCredit,
  isCredit,
  releaseDelta,
  reserveDelta,
  type LedgerEntry,
} from "@/lib/credits/ledger";
import {
  CREDIT_PACKS,
  CREDIT_PRODUCT_ID,
  allCreditPackLookupKeys,
  creditPackLookupKey,
  unitUsdFor,
} from "@/lib/credit-packs";

const entry = (delta: number, over: Partial<LedgerEntry> = {}): LedgerEntry => ({
  delta,
  reason: "PURCHASE",
  ref: "ref_1",
  ...over,
});

// ─── Balance ────────────────────────────────────────────────────────────────

describe("balance", () => {
  it("is the sum of the deltas", () => {
    expect(
      balanceOf([
        entry(500),
        entry(-120, { reason: "RESERVE", ref: "b1" }),
        entry(40, { reason: "CONSUME_RELEASE", ref: "b1" }),
      ]),
    ).toBe(420);
  });

  it("is zero for a tenant with no rows", () => {
    expect(balanceOf([])).toBe(0);
  });

  it("can go negative, and is reported rather than clamped", () => {
    // An ADMIN correction can legitimately overdraw. Hiding that behind a
    // Math.max would make the ledger and the balance disagree, which is the one
    // thing an append-only ledger exists to prevent.
    expect(balanceOf([entry(100), entry(-250, { reason: "ADMIN", ref: "fix" })])).toBe(-150);
  });
});

// ─── The affordability gate ─────────────────────────────────────────────────

describe("canAfford", () => {
  it("allows a batch that lands exactly on the balance", () => {
    // `>=`, not `>`. Refusing this would strand the last pack at the size we
    // sold it, and the client's `insufficient` flag mirrors this exactly.
    expect(canAfford(250, 250)).toBe(true);
  });

  it("refuses a batch one row over", () => {
    expect(canAfford(250, 251)).toBe(false);
  });

  it("allows any batch when nothing is being spent", () => {
    // A Places-off batch reserves nothing, so a zero balance must not block it.
    expect(canAfford(0, 0)).toBe(true);
    expect(canAfford(-40, 0)).toBe(true);
  });
});

// ─── Reserve ────────────────────────────────────────────────────────────────

describe("reserveDelta", () => {
  it("holds the FULL row count, negative", () => {
    expect(reserveDelta(250)).toBe(-250);
  });

  it("holds nothing for an empty batch", () => {
    expect(reserveDelta(0)).toBe(0);
    expect(reserveDelta(-5)).toBe(0);
  });

  it("floors a fractional count rather than holding a fraction of a credit", () => {
    expect(reserveDelta(10.9)).toBe(-10);
  });
});

// ─── Release ────────────────────────────────────────────────────────────────

describe("releaseDelta", () => {
  it("gives back the part of the hold that was never spent", () => {
    expect(releaseDelta(250, 90)).toBe(160);
  });

  it("gives back everything when the batch spent nothing", () => {
    // Every row skipped — Places unconfigured, or the batch failed before the
    // lookup step. The customer is charged for none of it.
    expect(releaseDelta(250, 0)).toBe(250);
  });

  it("gives back nothing when the batch spent its whole hold", () => {
    expect(releaseDelta(250, 250)).toBe(0);
  });

  it("NEVER returns a negative, even if more was consumed than reserved", () => {
    // That combination is a bug. Quietly taking the excess out of the balance
    // would bill the customer for it and hide the bug behind a plausible
    // number, so it clamps and the discrepancy stays visible in the ledger.
    expect(releaseDelta(250, 400)).toBe(0);
  });

  it("NEVER returns more than was held, which would mint credits", () => {
    expect(releaseDelta(100, -50)).toBe(100);
  });

  it("holds nothing back for a batch that reserved nothing", () => {
    expect(releaseDelta(0, 0)).toBe(0);
  });
});

// ─── Consumption ────────────────────────────────────────────────────────────

describe("consumedCredit", () => {
  // The single rule, and it is the upstream's own answer: costUsd > 0 means a
  // request left the building.
  it("counts a lookup that cost money", () => {
    expect(consumedCredit(0.032)).toBe(true);
  });

  it("does not count a lookup that was skipped", () => {
    // disabled / not_configured / cap_reached / empty query all report zero.
    expect(consumedCredit(0)).toBe(false);
  });

  it("counts an upstream failure, because Google still billed the search", () => {
    // lookupPlace returns PLACES_TEXTSEARCH_USD with reason "upstream_failed".
    // Refunding these would mean eating the cost of every prospect with no
    // listing, which on a SaaS list is most of them.
    expect(consumedCredit(0.032)).toBe(true);
  });
});

describe("isCredit", () => {
  it.each([
    ["PURCHASE", true],
    ["CONSUME_RELEASE", true],
    ["REFUND", true],
    ["RESERVE", false],
    ["ADMIN", false],
  ] as const)("%s adds credits: %s", (reason, expected) => {
    expect(isCredit(reason)).toBe(expected);
  });
});

// ─── The pack catalogue is a single source ──────────────────────────────────

describe("credit packs", () => {
  // These are the keys seeded in Stripe. If this list changes without the
  // catalogue changing, the pack silently disappears from /credits — pricing.ts
  // drops what it cannot resolve — and this test is the warning.
  const SEEDED_KEYS = [
    "echorank_credits_100_usd",
    "echorank_credits_500_usd",
    "echorank_credits_2000_usd",
  ];

  it("builds exactly the keys that exist in Stripe", () => {
    expect([...allCreditPackLookupKeys()].sort()).toEqual([...SEEDED_KEYS].sort());
  });

  it("uses the echorank_credits_<n>_usd shape", () => {
    expect(creditPackLookupKey(500)).toBe("echorank_credits_500_usd");
  });

  it("names the seeded product", () => {
    expect(CREDIT_PRODUCT_ID).toBe("prod_V4nFl2plt0kVJW");
  });

  it("defines each size exactly once", () => {
    const sizes = CREDIT_PACKS.map((p) => p.credits);
    expect(new Set(sizes).size).toBe(sizes.length);
  });

  it("holds NO prices — Stripe is the source of truth", () => {
    // The drift this whole arrangement prevents: a page advertising $50 while
    // Stripe charges $79. If a `usd` key ever appears here, the page and the
    // charge have two sources again.
    for (const pack of CREDIT_PACKS) {
      expect(pack).not.toHaveProperty("usd");
      expect(pack).not.toHaveProperty("priceCents");
    }
  });

  it("marks exactly one pack featured", () => {
    expect(CREDIT_PACKS.filter((p) => p.featured)).toHaveLength(1);
  });

  it("lists packs smallest first, so the cards read as a ladder", () => {
    const sizes = CREDIT_PACKS.map((p) => p.credits);
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
  });

  it("computes a per-lookup price that falls with volume", () => {
    // The sandbox amounts, hand-entered: $19 / $79 / $249.
    expect(unitUsdFor(100, 19)).toBeCloseTo(0.19, 4);
    expect(unitUsdFor(500, 79)).toBeCloseTo(0.158, 4);
    expect(unitUsdFor(2000, 249)).toBeCloseTo(0.1245, 4);
  });

  it("does not divide by zero for a nonsense size", () => {
    expect(unitUsdFor(0, 19)).toBe(0);
  });
});
