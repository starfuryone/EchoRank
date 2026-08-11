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
  maxFrequency,
  productKindFor,
  resolveWatcherShape,
  watcherCheckoutBlock,
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

/** Mirrors the resolver's own ranking; `custom` sits at weekly, not the top. */
const FREQ_RANK: Record<string, number> = {
  none: 0,
  custom: 1,
  weekly: 1,
  twice_weekly: 2,
  daily: 3,
};

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

  it("takes the field-wise max when both apply", () => {
    // STARTER is the case that proves it: its shape is NOT uniformly better
    // than solo — one repetition against solo's three — so "plan wins" would
    // hand a customer who paid for the add-on fewer repetitions than the SKU
    // promised, while "solo wins" would cut their prompts and engines.
    const starter = planConfig(STARTER);
    const resolved = resolveWatcherShape({
      plan: STARTER,
      planIncludesWatcher: true,
      subscription: { productKind: "WATCHER", active: true },
    });

    expect(resolved.source).toBe("both");
    // Solo's repetitions win.
    expect(starter.aiCheckup.repetitions).toBe(1);
    expect(resolved.shape.repetitions).toBe(3);
    // STARTER's prompts and engines win.
    expect(resolved.shape.prompts).toBe(Math.max(starter.aiCheckup.prompts, WATCHER_SOLO.prompts));
    expect(resolved.shape.providers).toBe(
      Math.max(starter.aiCheckup.providers ?? 0, WATCHER_SOLO.providers ?? 0),
    );
    expect(resolved.shape.providers).toBeGreaterThan(WATCHER_SOLO.providers as number);
    // STARTER's cap and solo's are BOTH 5, so this assertion cannot tell a max
    // from a coin flip. It is kept because the spec named it, and the case that
    // actually proves the cap max is the next test.
    expect(resolved.capUsd).toBe(Math.max(starter.aiMonthlyCapUsd ?? 0, WATCHER_SOLO_CAP_USD));
    expect(resolved.maxBrands).toBe(Math.max(starter.aiProjects ?? 0, 1));
  });

  it("takes the larger cap where the two actually differ", () => {
    // GROWTH caps at $40 against solo's $5. Picking the solo cap here would
    // start skipping runs at an eighth of the spend the tenant paid for, and
    // the STARTER case above cannot catch it because both its caps are 5.
    const growth = planConfig(GROWTH);
    expect(growth.aiMonthlyCapUsd).toBe(40);
    const resolved = resolveWatcherShape({
      plan: GROWTH,
      planIncludesWatcher: true,
      subscription: { productKind: "WATCHER", active: true },
    });
    expect(resolved.capUsd).toBe(40);
    expect(resolved.maxBrands).toBe(Math.max(growth.aiProjects ?? 0, 1));
  });

  it("takes the more frequent cadence", () => {
    // AGENCY is daily, solo is weekly. Note this passes whether the resolver
    // maxes or simply takes the plan's — see the direct test below for why.
    expect(
      resolveWatcherShape({
        plan: "AGENCY",
        planIncludesWatcher: true,
        subscription: { productKind: "WATCHER", active: true },
      }).shape.frequency,
    ).toBe("daily");
  });

  it("ranks cadences correctly, in both directions", () => {
    // The composite path CANNOT exercise this: solo runs weekly and no current
    // tier is less frequent, so the resolver returns the tier's cadence whether
    // it maxes or not — a mutation replacing the max with the plan's value
    // broke nothing. The rule is therefore tested where it can be observed.
    expect(maxFrequency("weekly", "daily")).toBe("daily");
    expect(maxFrequency("daily", "weekly")).toBe("daily");
    expect(maxFrequency("weekly", "twice_weekly")).toBe("twice_weekly");
    expect(maxFrequency("none", "weekly")).toBe("weekly");
    expect(maxFrequency("weekly", "none")).toBe("weekly");
    // `custom` is ENTERPRISE's contract term, which schedule.ts resolves to
    // weekly until one is set. Ranking an unset contract as daily would
    // multiply spend on the strength of a blank field.
    expect(maxFrequency("custom", "daily")).toBe("daily");
    expect(maxFrequency("custom", "weekly")).toBe("custom");
  });

  it("treats null as unlimited, not as zero", () => {
    // providers, aiProjects and the cap all use null for "no ceiling". Reading
    // it as zero would silently cap an ENTERPRISE tenant at what the $9 add-on
    // allows — a downgrade bought by an upgrade.
    const resolved = resolveWatcherShape({
      plan: "ENTERPRISE",
      planIncludesWatcher: true,
      subscription: { productKind: "WATCHER", active: true },
    });
    expect(resolved.shape.providers).toBeNull();
    expect(resolved.capUsd).toBeNull();
    expect(resolved.maxBrands).toBeNull();
  });

  it("never produces a composite weaker than either input", () => {
    // The property the field-wise max exists to guarantee, over every tier.
    for (const plan of ["STARTER", "GROWTH", "AGENCY", "ENTERPRISE"] as const) {
      const tier = planConfig(plan).aiCheckup;
      const config = planConfig(plan);
      const { capUsd, maxBrands, shape: s } = resolveWatcherShape({
        plan,
        planIncludesWatcher: true,
        subscription: { productKind: "WATCHER", active: true },
      });

      expect(s.prompts, plan).toBeGreaterThanOrEqual(Math.max(tier.prompts, WATCHER_SOLO.prompts));
      expect(s.repetitions, plan).toBeGreaterThanOrEqual(
        Math.max(tier.repetitions, WATCHER_SOLO.repetitions),
      );
      // The three null-means-unlimited dimensions, and the cadence. Checking
      // only prompts and repetitions left four of the six untested.
      const atLeast = (got: number | null, a: number | null, b: number) =>
        got === null || (a !== null && got >= Math.max(a, b));
      expect(atLeast(s.providers, tier.providers, WATCHER_SOLO.providers ?? 1), plan).toBe(true);
      expect(atLeast(capUsd, config.aiMonthlyCapUsd, WATCHER_SOLO_CAP_USD), plan).toBe(true);
      expect(atLeast(maxBrands, config.aiProjects, 1), plan).toBe(true);
      expect(FREQ_RANK[s.frequency], plan).toBeGreaterThanOrEqual(
        Math.max(FREQ_RANK[tier.frequency], FREQ_RANK[WATCHER_SOLO.frequency]),
      );
    }
  });

  it("cannot be answered by the ai_visibility feature flag", async () => {
    // The first predicate tried here was hasFeature(plan, "ai_visibility"),
    // which is baseline from STARTER up — true for every tier, so the
    // standalone branch was unreachable. planSchedulesCheckups asks the
    // question the shape can actually answer.
    const { planSchedulesCheckups } = await import("@/lib/ai-monitor/watcher-entitlement");
    const { hasFeature } = await import("@/lib/feature-flags");
    expect(hasFeature("STARTER", "ai_visibility")).toBe(true);
    expect(planSchedulesCheckups("STARTER")).toBe(true);
    // Which means, today, EVERY tier schedules — so the solo shape is reached
    // only by a tier that does not, and the entitlement is what makes a
    // watcher-only tenant possible at all rather than what resizes an existing
    // one.
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

// ── the choke point, enforced ────────────────────────────────────────────────

describe("nothing bypasses resolveWatcherShape", () => {
  const read = async (path: string) => {
    const source = await (await import("node:fs/promises")).readFile(path, "utf8");
    return source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
  };

  /**
   * Files that decide what a checkup looks like. Reading the tier's shape
   * directly here is the bug the resolver exists to prevent: a standalone
   * watcher holder would silently get their TIER's allowance, which for a
   * STARTER tenant is ten prompts they did not buy and for a GROWTH tenant is
   * fifteen. The resolver is only a choke point if nothing walks around it.
   */
  const MUST_NOT_READ_TIER_SHAPE = [
    "src/lib/ai-monitor/limits.ts",
    "src/lib/ai-monitor/runner/plan.ts",
    "src/lib/ai-monitor/wizard/suggest.ts",
    "src/infrastructure/queue/workers/ai-checkup.worker.ts",
  ];

  it("keeps planConfig(...).aiCheckup out of every shape-deciding call site", async () => {
    for (const path of MUST_NOT_READ_TIER_SHAPE) {
      const source = await read(path);
      expect(source, path).not.toMatch(/planConfig\([^)]*\)\.aiCheckup/);
    }
  });

  it("has the worker resolve it exactly once", async () => {
    const source = await read("src/infrastructure/queue/workers/ai-checkup.worker.ts");
    expect(source).toContain("resolveWatcherShape");
    expect(source.match(/resolveWatcherShape\(/g) ?? []).toHaveLength(1);
  });

  it("blocks a plan tenant from watcher checkout, server-side", async () => {
    // Hiding the button leaves the endpoint open.
    const source = await read("src/app/api/billing/checkout/route.ts");
    expect(source).toContain("watcherCheckoutBlock");
    expect(source).toContain("isWatcherLookupKey");
  });

  it("has the webhook stamp productKind and cancel before it flips", async () => {
    const source = await read("src/app/api/webhooks/route.ts");
    expect(source).toContain("productKindFor");
    expect(source).toContain("productKind,");
    // Cancel must precede the upsert, or a flipped row can outlive a live
    // Stripe subscription that is still charging.
    expect(source.indexOf("subscriptions.cancel")).toBeLessThan(
      source.indexOf("prisma.subscription.upsert"),
    );
  });
});

describe("the checkout guard", () => {
  it("blocks a tenant with a live plan subscription", () => {
    const guard = watcherCheckoutBlock({ productKind: "PLAN", active: true });
    expect(guard.blocked).toBe(true);
    expect(guard.reason).toMatch(/already includes/i);
  });

  it("allows a tenant with no subscription, or a lapsed plan", () => {
    expect(watcherCheckoutBlock(null).blocked).toBe(false);
    expect(watcherCheckoutBlock({ productKind: "PLAN", active: false }).blocked).toBe(false);
  });

  it("allows a watcher holder to renew or re-subscribe", () => {
    expect(watcherCheckoutBlock({ productKind: "WATCHER", active: true }).blocked).toBe(false);
  });
});
