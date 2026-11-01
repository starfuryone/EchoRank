// tests/billing-none.test.ts
//
// BillingStatus.NONE — "registered, never subscribed" — and the routing gate
// built on it.
//
// THE POINT OF NONE is that it stops a never-subscribed tenant masquerading as
// a trial. The tests that matter are therefore about what did NOT change:
//
//   • the legacy TRIALING-with-no-Subscription-row tenants are still denied.
//     They were not backfilled, so requirePaidPlan's `TRIALING && a row exists`
//     clause is still the only thing holding them out, and "NONE exists now" is
//     not a reason to relax it. If someone simplifies that condition, the
//     legacy assertions here go red.
//   • NONE is denied paid access without needing a case of its own.
//
// and about the one thing that did: needsPlanSelection, the single field both
// the gate and requirePaidPlan read, so the two cannot disagree.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { subscription, tenant } = vi.hoisted(() => ({
  subscription: { findUnique: vi.fn() },
  tenant: { findUnique: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { subscription, tenant } }));

import { getBillingContext, isPaidStatus, canBuyCredits } from "@/lib/paid-plan";
import { isNoneAllowedPath } from "@/lib/billing-gate";

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── The predicate ──────────────────────────────────────────────────────────

describe("isPaidStatus", () => {
  it("denies NONE, with or without a claimed subscription row", () => {
    expect(isPaidStatus("NONE")).toBe(false);
    // Belt and braces: a NONE status can never come with a real row, but the
    // predicate must not become true if one is ever passed by mistake.
    expect(isPaidStatus("NONE", true)).toBe(false);
  });

  it("STILL denies bare TRIALING — the legacy rule is load-bearing", () => {
    // Every tenant that predates the NONE migration is TRIALING with no
    // Subscription row, because the migration deliberately backfilled nothing.
    // This clause is the only thing between those rows and the paid product.
    expect(isPaidStatus("TRIALING")).toBe(false);
    expect(isPaidStatus("TRIALING", false)).toBe(false);
  });

  it("still allows a real Stripe trial and an active plan", () => {
    expect(isPaidStatus("TRIALING", true)).toBe(true);
    expect(isPaidStatus("ACTIVE")).toBe(true);
  });
});

// ─── needsPlanSelection: one field, two callers ─────────────────────────────

describe("getBillingContext().needsPlanSelection", () => {
  it("is true for a tenant with NONE and no subscription row", async () => {
    subscription.findUnique.mockResolvedValue(null);
    tenant.findUnique.mockResolvedValue({ billingStatus: "NONE" });

    const ctx = await getBillingContext("t1");
    expect(ctx.needsPlanSelection).toBe(true);
    // And it is not paid either — the gate and the paid check agree.
    expect(isPaidStatus(ctx.status, ctx.hasSubscriptionRow)).toBe(false);
  });

  it("is FALSE for a legacy TRIALING tenant — they are not NONE", async () => {
    // The distinction the whole migration rests on: a legacy tenant keeps its
    // status and must NOT be swept into NONE, redirected to /pricing, or have
    // its access changed. It stays denied paid features by the row rule, and
    // stays inside the app.
    subscription.findUnique.mockResolvedValue(null);
    tenant.findUnique.mockResolvedValue({ billingStatus: "TRIALING" });

    const ctx = await getBillingContext("t_legacy");
    expect(ctx.needsPlanSelection).toBe(false);
    expect(isPaidStatus(ctx.status, ctx.hasSubscriptionRow)).toBe(false);
  });

  it("is false for a tenant with a PLAN subscription row, whatever the column says", async () => {
    subscription.findUnique.mockResolvedValue({ status: "ACTIVE", productKind: "PLAN" });

    const ctx = await getBillingContext("t2");
    expect(ctx.needsPlanSelection).toBe(false);
    // The tenant row is not even consulted on this path.
    expect(tenant.findUnique).not.toHaveBeenCalled();
  });

  it("is true for a NONE tenant whose only purchase is the standalone watcher", async () => {
    // A $9 add-on is not a plan. `status` is blanked to null for a watcher-only
    // tenant, which is why needsPlanSelection reads the column rather than the
    // status — otherwise the add-on would suppress the gate.
    subscription.findUnique.mockResolvedValue({ status: "ACTIVE", productKind: "WATCHER" });
    tenant.findUnique.mockResolvedValue({ billingStatus: "NONE" });

    const ctx = await getBillingContext("t3");
    expect(ctx.watcherOnly).toBe(true);
    expect(ctx.needsPlanSelection).toBe(true);
  });
});

// ─── Credits ────────────────────────────────────────────────────────────────

describe("canBuyCredits", () => {
  it("refuses a tenant that has never subscribed", async () => {
    subscription.findUnique.mockResolvedValue(null);
    tenant.findUnique.mockResolvedValue({ billingStatus: "NONE" });

    expect(await canBuyCredits("t1")).toBe(false);
  });

  it.each(["ACTIVE", "TRIALING", "PAST_DUE", "CANCELED"] as const)(
    "allows a %s tenant — the rule narrows NONE only",
    async (billingStatus) => {
      // PAST_DUE and CANCELED are the deliberate carve-outs: a customer whose
      // card failed, topping up, is someone trying to keep using us.
      subscription.findUnique.mockResolvedValue(null);
      tenant.findUnique.mockResolvedValue({ billingStatus });

      expect(await canBuyCredits("t1")).toBe(true);
    },
  );
});

// ─── The exemption list ─────────────────────────────────────────────────────

describe("isNoneAllowedPath", () => {
  it("lets a NONE tenant reach its own account page", () => {
    // Someone who cannot see their account cannot cancel or delete it.
    expect(isNoneAllowedPath("/settings/account")).toBe(true);
    expect(isNoneAllowedPath("/settings/account/anything")).toBe(true);
  });

  it("matches on a path boundary, not a bare prefix", () => {
    // "/settings/accountant" must not inherit the exemption.
    expect(isNoneAllowedPath("/settings/accountant")).toBe(false);
  });

  it("gates the rest of the dashboard", () => {
    for (const p of ["/dashboard", "/billing", "/settings", "/visibility/tools", "/team"]) {
      expect(isNoneAllowedPath(p)).toBe(false);
    }
  });

  it("fails closed on a missing pathname", () => {
    // The layout redirects when this is false, so an absent x-pathname header
    // must not silently switch the gate off.
    expect(isNoneAllowedPath(null)).toBe(false);
    expect(isNoneAllowedPath(undefined)).toBe(false);
    expect(isNoneAllowedPath("")).toBe(false);
  });
});
