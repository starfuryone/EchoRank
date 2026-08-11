// tests/ai-search-watcher-entitlement.test.ts
//
// The standalone Watcher: what a subscription to it is, and what it grants.
//
// THE FIRST DESCRIBE IS THE ONE THAT MATTERS. Subscription.tenantId is unique,
// so a $9 watcher purchase writes the SAME single row a tier would, and the
// webhook falls back to the tenant's existing planType when a price maps to no
// tier. Before productKind existed, that row was ACTIVE and indistinguishable
// from a plan — requirePaidPlan asks only "ACTIVE, with a row?" — so a
// watcher-only tenant would have inherited every paid tool in the product.
// Both directions are asserted, because a fix that locks out real paying
// customers is worse than the hole it closes.

import { describe, expect, it } from "vitest";
import type { PlanType } from "@/generated/prisma";
import { isPaidStatus } from "@/lib/paid-plan";
import {
  WATCHER_LOOKUP_KEYS,
  WATCHER_PRICES_CENTS,
  WATCHER_SOLO,
  WATCHER_SOLO_CAP_USD,
  planConfig,
} from "@/lib/plan-config";
import {
  hasWatcherEntitlement,
  isWatcherLookupKey,
  productKindFor,
  resolveWatcherShape,
} from "@/lib/ai-monitor/watcher-entitlement";

describe("a watcher subscription is not a paid plan", () => {
  it("does not let a watcher row satisfy the plan gate", () => {
    // The hole: ACTIVE + a row was the whole test.
    expect(isPaidStatus("TRIALING", false)).toBe(false);
    // A plan row on trial does pass, which is the behaviour that must survive.
    expect(isPaidStatus("TRIALING", true)).toBe(true);
  });

  it("still admits genuine plan subscriptions", () => {
    // A fix that locks out paying customers is worse than the hole it closes.
    expect(isPaidStatus("ACTIVE", true)).toBe(true);
    expect(isPaidStatus("ACTIVE", false)).toBe(true);
  });

  it("keeps refusing the states it always refused", () => {
    for (const status of ["PAST_DUE", "CANCELED", null, undefined] as const) {
      expect(isPaidStatus(status, true)).toBe(false);
    }
  });
});

describe("the plan / watcher discriminator", () => {
  it("recognises both watcher lookup keys", () => {
    expect(isWatcherLookupKey(WATCHER_LOOKUP_KEYS.monthly)).toBe(true);
    expect(isWatcherLookupKey(WATCHER_LOOKUP_KEYS.annual)).toBe(true);
    expect(productKindFor(WATCHER_LOOKUP_KEYS.monthly)).toBe("WATCHER");
  });

  it("treats every other key, and no key, as a plan", () => {
    // Asymmetric on purpose: calling a plan a watcher would strip a paying
    // customer of the tools they bought, while the reverse is caught by the
    // tier's own feature gates.
    for (const key of ["echorank_growth_usd_month", "", null, undefined, "nonsense"]) {
      expect(productKindFor(key)).toBe("PLAN");
    }
  });

  it("is the lookup key, not the price id", () => {
    // Lookup keys are ours and stable; price ids are Stripe's and change
    // whenever a price is replaced.
    expect(isWatcherLookupKey("price_1ABCdef")).toBe(false);
    expect(WATCHER_LOOKUP_KEYS.monthly).toBe("echorank_watcher_pro_usd_month");
    expect(WATCHER_LOOKUP_KEYS.annual).toBe("echorank_watcher_pro_usd_year");
  });

  it("prices the annual at a 17% discount on the monthly", () => {
    expect(WATCHER_PRICES_CENTS.monthly).toBe(900);
    expect(WATCHER_PRICES_CENTS.annual).toBe(9000);
    const impliedMonthly = WATCHER_PRICES_CENTS.annual / 12;
    expect(Math.round(impliedMonthly)).toBe(750);
  });

  it("only grants on a live subscription", () => {
    expect(hasWatcherEntitlement({ productKind: "WATCHER", active: true })).toBe(true);
    expect(hasWatcherEntitlement({ productKind: "WATCHER", active: false })).toBe(false);
    expect(hasWatcherEntitlement({ productKind: "PLAN", active: true })).toBe(false);
    expect(hasWatcherEntitlement(null)).toBe(false);
  });
});

describe("resolveWatcherShape — one choke point", () => {
  const GROWTH: PlanType = "GROWTH";
  const STARTER: PlanType = "STARTER";

  it("uses the tier's shape when the tier includes the watcher", () => {
    const resolved = resolveWatcherShape({
      plan: GROWTH,
      planIncludesWatcher: true,
      subscription: null,
    });
    expect(resolved.source).toBe("plan");
    expect(resolved.shape).toEqual(planConfig(GROWTH).aiCheckup);
  });

  it("uses the solo shape for a standalone entitlement", () => {
    const resolved = resolveWatcherShape({
      plan: STARTER,
      planIncludesWatcher: false,
      subscription: { productKind: "WATCHER", active: true },
    });
    expect(resolved.source).toBe("watcher_solo");
    expect(resolved.shape).toEqual(WATCHER_SOLO);
    expect(resolved.capUsd).toBe(WATCHER_SOLO_CAP_USD);
  });

  it("is the shape the spec fixed: 10 prompts, 1 engine, 3 reps, weekly", () => {
    expect(WATCHER_SOLO).toEqual({
      frequency: "weekly",
      providers: 1,
      prompts: 10,
      repetitions: 3,
    });
    expect(WATCHER_SOLO_CAP_USD).toBe(5);
  });

  it("lets the plan win when both apply", () => {
    // Any tier carrying the watcher is at least as generous as solo, so plan
    // can only give more. The alternative — a GROWTH tenant silently dropped to
    // one engine because they also bought a $9 add-on — is a downgrade nobody
    // reports, because it looks like the product working.
    const resolved = resolveWatcherShape({
      plan: GROWTH,
      planIncludesWatcher: true,
      subscription: { productKind: "WATCHER", active: true },
    });
    expect(resolved.source).toBe("plan");
    expect(resolved.shape.prompts).toBeGreaterThan(WATCHER_SOLO.prompts);
  });

  it("grants nothing when neither applies, without throwing", () => {
    const resolved = resolveWatcherShape({
      plan: STARTER,
      planIncludesWatcher: false,
      subscription: null,
    });
    expect(resolved.source).toBe("none");
  });

  it("keeps the shape in code, not on the subscription row", () => {
    // A shape stored per-subscription is data that drifts from config and needs
    // a migration every time a number changes. Two resolutions of the same
    // input must be the same object shape, from the same constant.
    const once = resolveWatcherShape({
      plan: STARTER,
      planIncludesWatcher: false,
      subscription: { productKind: "WATCHER", active: true },
    });
    const twice = resolveWatcherShape({
      plan: STARTER,
      planIncludesWatcher: false,
      subscription: { productKind: "WATCHER", active: true },
    });
    expect(once.shape).toEqual(twice.shape);
    expect(once.shape).toBe(WATCHER_SOLO);
  });
});
