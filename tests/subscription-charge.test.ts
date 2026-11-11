// tests/subscription-charge.test.ts
//
// What a subscription is actually charged (src/lib/billing/subscription-charge.ts),
// and the billing page's use of it. Since the 2026-11-11 price change the plan
// config holds the price on SALE; a subscriber or trialist from before it keeps
// their own price, and the surfaces that state "what you pay" read that one.

import { describe, expect, it, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  requireTenant: vi.fn(),
  tenantFind: vi.fn(),
  subscriptionFind: vi.fn(),
  feedbackCount: vi.fn(),
  chargeForPrice: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: { findUnique: m.tenantFind },
    subscription: { findUnique: m.subscriptionFind },
    feedback: { count: m.feedbackCount },
    stripePrice: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/tenant", () => ({ requireTenant: m.requireTenant }));
vi.mock("@/lib/site-crawler/page-allowance", () => ({ pageAllowance: vi.fn(async () => null) }));

import { chargeForPrice } from "@/lib/billing/subscription-charge";

describe("chargeForPrice", () => {
  const deps = (over: Partial<Parameters<typeof chargeForPrice>[1]> = {}) => ({
    retrieve: vi.fn(async () => ({ unit_amount: 7_900, recurring: { interval: "month" } })),
    isOnSale: vi.fn(async () => false),
    ...over,
  });

  it("reads the amount and interval off the subscription's own Stripe price", async () => {
    expect(await chargeForPrice("price_old_starter", deps())).toEqual({ kind: "charge", charge: { cents: 7_900, interval: "month" } });
    const year = deps({ retrieve: vi.fn(async () => ({ unit_amount: 75_600, recurring: { interval: "year" } })) });
    expect(await chargeForPrice("price_old_starter_year", year)).toEqual({ kind: "charge", charge: { cents: 75_600, interval: "year" } });
  });

  it("Stripe unreachable: a price still on sale may quote the config, a retired one is unknown", async () => {
    const down = vi.fn(async () => {
      throw new Error("stripe down");
    });
    expect(await chargeForPrice("price_new", deps({ retrieve: down, isOnSale: vi.fn(async () => true) }))).toEqual({ kind: "config" });
    expect(await chargeForPrice("price_old", deps({ retrieve: down, isOnSale: vi.fn(async () => false) }))).toEqual({ kind: "unknown" });
    const dbDown = vi.fn(async () => {
      throw new Error("db down");
    });
    expect(await chargeForPrice("price_old", deps({ retrieve: down, isOnSale: dbDown }))).toEqual({ kind: "unknown" });
  });

  it("no price id, or a price that is not recurring, is unknown", async () => {
    expect(await chargeForPrice(null, deps())).toEqual({ kind: "unknown" });
    const oneOff = deps({ retrieve: vi.fn(async () => ({ unit_amount: 1_900, recurring: null })) });
    expect(await chargeForPrice("price_pack", oneOff)).toEqual({ kind: "unknown" });
  });
});

describe("GET /api/billing", () => {
  beforeEach(async () => {
    vi.resetModules();
    m.requireTenant.mockResolvedValue({ tenantId: "t1" });
    m.tenantFind.mockResolvedValue({ id: "t1", planType: "STARTER", billingStatus: "ACTIVE", monthlyRequestLimit: 500 });
    m.subscriptionFind.mockResolvedValue({ id: "s1", status: "ACTIVE", stripePriceId: "price_old_starter", cancelAtPeriodEnd: false });
    m.feedbackCount.mockResolvedValue(0);
  });

  async function get(answer: unknown) {
    vi.resetModules();
    vi.doMock("@/lib/billing/subscription-charge", () => ({ chargeForPrice: vi.fn(async () => answer) }));
    const { GET } = await import("@/app/api/billing/route");
    return (await GET()).json();
  }

  it("returns the subscription's own charge beside the price on sale", async () => {
    const body = await get({ kind: "charge", charge: { cents: 7_900, interval: "month" } });
    expect(body.plan.price).toBe(78); // on sale
    expect(body.plan.charge).toEqual({ cents: 7_900, interval: "month" }); // what this subscriber pays
    expect(body.plan.chargeIsConfig).toBe(false);
  });

  it("says when the config price is the charged one, and gives no charge when unknown", async () => {
    expect((await get({ kind: "config" })).plan).toMatchObject({ charge: null, chargeIsConfig: true });
    expect((await get({ kind: "unknown" })).plan).toMatchObject({ charge: null, chargeIsConfig: false });
  });
});
