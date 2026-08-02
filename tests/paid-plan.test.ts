// The four combinations of billing status and Subscription-row provenance.
//
// The narrow trial rule exists because TRIALING is ALSO the Prisma default for
// Tenant.billingStatus. Accepting it unconditionally would grant tool access to
// every tenant created outside Stripe. A Subscription row only exists because
// the webhook wrote one, so it is the thing that distinguishes a real trial
// with a card on file from a column default nobody set.
import { describe, it, expect } from "vitest";
import { isPaidStatus } from "@/lib/paid-plan";

describe("isPaidStatus — the four combinations", () => {
  it("ACTIVE + Subscription row → paid", () => {
    expect(isPaidStatus("ACTIVE", true)).toBe(true);
  });

  it("ACTIVE without a row → paid", () => {
    // This is the case that must not regress: all seven ACTIVE production
    // tenants predate Stripe checkout and have no Subscription row. Narrowing
    // the trial rule must not touch them.
    expect(isPaidStatus("ACTIVE", false)).toBe(true);
  });

  it("TRIALING + Subscription row → paid", () => {
    // A real Stripe trial: the webhook wrote the row, the card is on file, and
    // the charge lands automatically at trial end.
    expect(isPaidStatus("TRIALING", true)).toBe(true);
  });

  it("TRIALING without a row → NOT paid", () => {
    // The Prisma default. Granting access here is exactly the hole the narrow
    // rule closes.
    expect(isPaidStatus("TRIALING", false)).toBe(false);
  });
});

describe("isPaidStatus — everything else stays denied", () => {
  it("denies PAST_DUE and CANCELED regardless of provenance", () => {
    for (const row of [true, false]) {
      expect(isPaidStatus("PAST_DUE", row)).toBe(false);
      expect(isPaidStatus("CANCELED", row)).toBe(false);
    }
  });

  it("denies null and undefined", () => {
    expect(isPaidStatus(null, true)).toBe(false);
    expect(isPaidStatus(undefined, true)).toBe(false);
    expect(isPaidStatus(null)).toBe(false);
    expect(isPaidStatus(undefined)).toBe(false);
  });

  it("defaults to the strict reading when provenance is omitted", () => {
    // Callers that only have a status must not accidentally widen the gate.
    expect(isPaidStatus("TRIALING")).toBe(false);
    expect(isPaidStatus("ACTIVE")).toBe(true);
  });
});

describe("production tenants resolve unchanged", () => {
  // Snapshot of live state at the time of the change: seven ACTIVE and one
  // TRIALING, none with a Subscription row. Pinned so the intent — "this
  // change moves nobody" — is checkable rather than asserted in a commit
  // message.
  const PRODUCTION_SNAPSHOT: Array<{
    status: "ACTIVE" | "TRIALING";
    hasSubscriptionRow: boolean;
    paidToday: boolean;
  }> = [
    { status: "ACTIVE", hasSubscriptionRow: false, paidToday: true },
    { status: "ACTIVE", hasSubscriptionRow: false, paidToday: true },
    { status: "ACTIVE", hasSubscriptionRow: false, paidToday: true },
    { status: "ACTIVE", hasSubscriptionRow: false, paidToday: true },
    { status: "ACTIVE", hasSubscriptionRow: false, paidToday: true },
    { status: "ACTIVE", hasSubscriptionRow: false, paidToday: true },
    { status: "ACTIVE", hasSubscriptionRow: false, paidToday: true },
    // Was denied before the change (TRIALING was never paid) and is still
    // denied after it, because it has no Subscription row.
    { status: "TRIALING", hasSubscriptionRow: false, paidToday: false },
  ];

  it("gives every existing tenant the same answer as before", () => {
    for (const t of PRODUCTION_SNAPSHOT) {
      expect(isPaidStatus(t.status, t.hasSubscriptionRow)).toBe(t.paidToday);
    }
  });
});
