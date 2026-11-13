// tests/webhook-plan-mapping.test.ts
//
// WHICH PLAN A STRIPE PRICE PUTS A TENANT ON (NOSY-BAT-BLANK, 2026-11-13).
//
// The first real Nosy Bat purchase ($15/mo, 7-day trial, card required) moved
// an Agency tenant to NOSY_BAT through the stripe_prices row for its price id.
// That worked; this file pins it, and the case it did NOT cover: a price with
// no catalog row (a reprice whose row the seed has not written yet). The webhook
// used to fall through to the env-var ids, which know no NOSY_BAT, so the tenant
// kept its old plan and the Subscription row was stamped with it — a $15 trial
// with Agency access. The lookup key, ours and stable, now maps it.
//
// Unlike tests/webhook-event-order.test.ts, src/lib/stripe/prices.ts is NOT
// mocked: the fake Prisma below keeps a stripe_prices table and filters on every
// field of the `where`, so the real resolvePlanFromPriceId and TIER_TO_PLAN run,
// and an `active` filter creeping back into the reverse lookup fails here.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { isPaidStatus } from "@/lib/paid-plan";
import { PLAN_PRICE_SPECS, lookupKeyFor } from "@/lib/stripe/plan-price-spec";
import { planTypeForLookupKey } from "@/lib/stripe/lookup-keys";

type Row = Record<string, unknown>;

const { db, stripeMock, loggerFns, onPlanChange } = vi.hoisted(() => ({
  db: {
    tenants: new Map<string, Row>(),
    subs: new Map<string, Row>(),
    prices: [] as Row[],
    events: new Set<string>(),
  },
  stripeMock: {
    subscriptions: { retrieve: vi.fn(), cancel: vi.fn() },
    webhooks: { constructEvent: vi.fn() },
  },
  loggerFns: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() },
  onPlanChange: vi.fn(async () => ({})),
}));
loggerFns.child.mockReturnValue(loggerFns);

const matches = (row: Row, where: Row) => Object.entries(where).every(([k, v]) => row[k] === v);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: {
      // Copies, as Prisma returns: the handler compares the tenant it read with
      // the plan it wrote, and a shared reference would hide the change.
      findUnique: async ({ where }: { where: { id: string } }) => {
        const t = db.tenants.get(where.id);
        return t ? { ...t } : null;
      },
      findFirst: async ({ where }: { where: { stripeCustomerId?: string } }) => {
        const t = [...db.tenants.values()].find((x) => where.stripeCustomerId && x.stripeCustomerId === where.stripeCustomerId);
        return t ? { ...t } : null;
      },
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const row = db.tenants.get(where.id);
        if (!row) throw new Error("tenant not found");
        Object.assign(row, data);
        return row;
      },
    },
    subscription: {
      findUnique: async ({ where }: { where: { tenantId: string } }) => db.subs.get(where.tenantId) ?? null,
      upsert: async ({ where, create, update }: { where: { tenantId: string }; create: Row; update: Row }) => {
        const existing = db.subs.get(where.tenantId);
        const row = existing ? { ...existing, ...update } : { ...create };
        db.subs.set(where.tenantId, row);
        return row;
      },
    },
    stripePrice: {
      findFirst: async ({ where }: { where: Row }) => db.prices.find((r) => matches(r, where)) ?? null,
    },
    auditLog: { findFirst: async () => null },
    processedWebhook: {
      create: async ({ data }: { data: { stripeEventId: string } }) => {
        if (db.events.has(data.stripeEventId)) throw Object.assign(new Error("dup"), { code: "P2002" });
        db.events.add(data.stripeEventId);
        return data;
      },
      delete: async ({ where }: { where: { stripeEventId: string } }) => {
        db.events.delete(where.stripeEventId);
        return {};
      },
    },
  },
}));
vi.mock("@/infrastructure/observability/logger", () => ({ logger: loggerFns }));
vi.mock("stripe", () => ({ default: class { constructor() { return stripeMock; } } }));
vi.mock("@/lib/stripe/client", () => ({ getStripe: () => stripeMock }));
vi.mock("@/lib/plan-change", () => ({ onPlanChange }));
vi.mock("@/lib/matrix-accounts", () => ({ reconcileTenantMatrixAccounts: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(async () => ({ success: true })) }));
vi.mock("@/infrastructure/metering/quota", () => ({
  quotaEnforcer: { setQuota: vi.fn(), getDefaultQuotas: vi.fn(() => ({})) },
}));
vi.mock("@/lib/billing/trial-notice", () => ({
  cancelTrialEndingNotice: vi.fn(),
  scheduleTrialEndingNotice: vi.fn(),
}));
vi.mock("@/lib/billing/credit-webhook", async (orig) => {
  const real = (await orig()) as Record<string, unknown>;
  return { ...real, handleCreditPackCompleted: vi.fn() };
});

const TENANT = "tenant_nb";
const CUS = "cus_nb";
const SUB = "sub_nb";

/** The $15 monthly and $144 yearly prices, and the $22.40 one they replaced. */
const NB_MONTH = "price_nb_1500_m";
const NB_YEAR = "price_nb_14400_y";
const NB_OLD = "price_nb_2240_m";

function catalog() {
  db.prices.push(
    { stripePriceId: NB_MONTH, planTier: "nosy_bat", currency: "USD", interval: "month", active: true, createdAt: 3 },
    { stripePriceId: NB_YEAR, planTier: "nosy_bat", currency: "USD", interval: "year", active: true, createdAt: 3 },
    // Retired by the 2026-11-12 reprice, kept so its subscribers still map.
    { stripePriceId: NB_OLD, planTier: "nosy_bat", currency: "USD", interval: "month", active: false, createdAt: 1 },
  );
}

function subscriptionObject(price: { id: string; lookup_key?: string | null }, over: Row = {}) {
  return {
    id: SUB,
    status: "trialing",
    customer: CUS,
    cancel_at_period_end: false,
    trial_end: 1_900_000_000,
    items: { data: [{ current_period_start: 1_800_000_000, current_period_end: 1_900_000_000, price }] },
    metadata: { app: "echorank", tenantId: TENANT, tier: "nosy_bat", interval: "month" },
    ...over,
  };
}

function checkoutSession() {
  return {
    id: "cs_test_nb",
    mode: "subscription",
    status: "complete",
    client_reference_id: TENANT,
    customer: CUS,
    subscription: SUB,
    customer_details: { email: "buyer@example.test" },
    metadata: { app: "echorank", flow: "upgrade", tenantId: TENANT, tier: "nosy_bat", interval: "month", locale: "en" },
  };
}

async function post(type: string, object: unknown, eventId: string) {
  stripeMock.webhooks.constructEvent.mockReturnValue({ id: eventId, type, data: { object } });
  const { POST } = await import("@/app/api/webhooks/route");
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  process.env.STRIPE_SECRET_KEY = "sk_test_x";
  return POST({
    headers: new Headers({ "stripe-signature": "sig", "x-forwarded-for": "1.2.3.4" }),
    text: async () => "{}",
  } as never);
}

const MONTH_PRICE = { id: NB_MONTH, lookup_key: "echorank_nosy_bat_usd_month" };

const completed = (id = "evt_completed") => post("checkout.session.completed", checkoutSession(), id);
const created = (price: { id: string; lookup_key?: string | null } = MONTH_PRICE, id = "evt_created") => {
  stripeMock.subscriptions.retrieve.mockResolvedValue(subscriptionObject(price));
  return post("customer.subscription.created", subscriptionObject(price), id);
};

const updatedLog = () => loggerFns.info.mock.calls.find((c) => c[1] === "Subscription updated")?.[0] as Row | undefined;
const paid = () => {
  const row = db.subs.get(TENANT);
  return isPaidStatus((row?.status as never) ?? null, row?.productKind === "PLAN");
};

function tenant(planType: string, billingStatus: string) {
  db.tenants.set(TENANT, { id: TENANT, planType, billingStatus, stripeCustomerId: null, stripeSubscriptionId: null });
}

beforeEach(() => {
  vi.clearAllMocks();
  db.tenants.clear();
  db.subs.clear();
  db.prices.length = 0;
  db.events.clear();
  stripeMock.subscriptions.retrieve.mockResolvedValue(subscriptionObject(MONTH_PRICE));
});

describe("the $15 Nosy Bat prices map to NOSY_BAT", () => {
  it.each([
    ["the $15 monthly price", { id: NB_MONTH, lookup_key: "echorank_nosy_bat_usd_month" }],
    ["the $144 yearly price", { id: NB_YEAR, lookup_key: "echorank_nosy_bat_usd_year" }],
  ])("%s, from its catalog row: an Agency tenant moves to NOSY_BAT, trialing, paid", async (_l, price) => {
    catalog();
    tenant("AGENCY", "ACTIVE");
    expect((await completed()).status).toBe(200);
    expect((await created(price)).status).toBe(200);

    expect(db.tenants.get(TENANT)).toMatchObject({ planType: "NOSY_BAT", billingStatus: "TRIALING" });
    expect(db.subs.get(TENANT)).toMatchObject({ planType: "NOSY_BAT", status: "TRIALING", productKind: "PLAN", stripePriceId: price.id });
    expect(updatedLog()).toMatchObject({ planType: "NOSY_BAT", planSource: "catalog", priceId: price.id });
    expect(onPlanChange).toHaveBeenCalledWith(TENANT, "AGENCY", "NOSY_BAT");
    expect(paid()).toBe(true);
  });

  it("the retired $22.40 price still maps (no `active` filter on the reverse lookup)", async () => {
    catalog();
    tenant("NOSY_BAT", "TRIALING");
    // Superseded: the lookup key moved to the $15 price, so this one has none.
    await created({ id: NB_OLD, lookup_key: null });
    expect(db.subs.get(TENANT)).toMatchObject({ planType: "NOSY_BAT", stripePriceId: NB_OLD });
    expect(updatedLog()).toMatchObject({ planSource: "catalog" });
  });
});

describe("a price with no catalog row", () => {
  it("maps by its lookup key: the tenant does NOT keep its old plan", async () => {
    // THE REGRESSION. No stripe_prices rows at all: before the fix this fell to
    // the env ids, planType was null, and the row was stamped AGENCY.
    tenant("AGENCY", "ACTIVE");
    await completed();
    await created({ id: "price_not_in_catalog", lookup_key: "echorank_nosy_bat_usd_month" });

    expect(db.tenants.get(TENANT)!.planType).toBe("NOSY_BAT");
    expect(db.subs.get(TENANT)).toMatchObject({ planType: "NOSY_BAT", status: "TRIALING", productKind: "PLAN" });
    expect(updatedLog()).toMatchObject({ planSource: "lookup_key" });
    expect(loggerFns.warn.mock.calls.some((c) => String(c[1]).startsWith("Subscription price maps to no plan"))).toBe(false);
  });

  it("with no lookup key either: the plan is left unchanged and the miss is logged with the price id", async () => {
    tenant("AGENCY", "ACTIVE");
    await created({ id: "price_mystery", lookup_key: null });

    expect(db.tenants.get(TENANT)!.planType).toBe("AGENCY");
    expect(onPlanChange).not.toHaveBeenCalled();
    const warn = loggerFns.warn.mock.calls.find((c) => String(c[1]).startsWith("Subscription price maps to no plan"));
    expect(warn?.[0]).toMatchObject({ tenantId: TENANT, priceId: "price_mystery", lookupKey: null, keptPlan: "AGENCY" });
    expect(updatedLog()).toMatchObject({ planSource: "none" });
  });

  it("a foreign lookup key is not ours to map", async () => {
    tenant("STARTER", "ACTIVE");
    await created({ id: "price_other_app", lookup_key: "agoraiq_pro_usd_month" });
    expect(db.tenants.get(TENANT)!.planType).toBe("STARTER");
    expect(updatedLog()).toMatchObject({ planSource: "none" });
  });
});

describe("a brand-new tenant buying Nosy Bat, mid-transition and after", () => {
  it("between the two events: checkout.session.completed alone activates billing, the plan waits for the subscription event", async () => {
    catalog();
    tenant("STARTER", "NONE");
    await completed();
    expect(db.tenants.get(TENANT)).toMatchObject({ billingStatus: "ACTIVE", planType: "STARTER", stripeCustomerId: CUS });
    expect(db.subs.size).toBe(0);
  });

  it.each([
    ["completed then created", async () => { await completed(); await created(); }],
    ["created then completed", async () => { await created(); await completed(); }],
  ])("ends NOSY_BAT with a PLAN row, paid, in either order (%s)", async (_l, run) => {
    catalog();
    tenant("STARTER", "NONE");
    await run();
    expect(db.tenants.get(TENANT)!.planType).toBe("NOSY_BAT");
    expect(db.subs.get(TENANT)).toMatchObject({ planType: "NOSY_BAT", productKind: "PLAN" });
    expect(paid()).toBe(true);
  });
});

describe("every seeded tier maps back to its plan", () => {
  // The Jul 27 class of bug (ai_visibility missing from the reverse map): the
  // seed writes stripe_prices.plan_tier = spec.planTier and the lookup key from
  // it; both reverse paths must land on spec.plan.
  it.each(PLAN_PRICE_SPECS.flatMap((s) => (["month", "year"] as const).map((i) => [s.plan, i, s] as const)))(
    "%s %s: lookup key and catalog row agree",
    async (plan, interval, spec) => {
      expect(planTypeForLookupKey(lookupKeyFor(spec, interval))).toBe(plan);
      db.prices.push({ stripePriceId: `price_${spec.planTier}_${interval}`, planTier: spec.planTier, currency: "USD", interval, active: true });
      const { resolvePlanFromPriceId } = await import("@/lib/stripe/prices");
      expect(await resolvePlanFromPriceId(`price_${spec.planTier}_${interval}`)).toEqual({ planType: plan, currency: "USD" });
    },
  );
});

describe("a cancelling subscription is stored as cancelling (CANCEL-FAIR-PLAY)", () => {
  const updated = (over: Row) => {
    const obj = subscriptionObject(MONTH_PRICE, over);
    stripeMock.subscriptions.retrieve.mockResolvedValue(obj);
    return post("customer.subscription.updated", obj, `evt_upd_${JSON.stringify(over)}`);
  };

  it.each([
    ["cancel_at_period_end (our Cancel button)", { cancel_at_period_end: true, cancel_at: 1_900_000_000 }, true],
    ["a bare cancel_at (a portal or dashboard schedule)", { cancel_at_period_end: false, cancel_at: 1_900_000_000 }, true],
    ["neither (renewing, or resumed)", { cancel_at_period_end: false, cancel_at: null }, false],
  ])("%s", async (_l, over, expected) => {
    catalog();
    tenant("NOSY_BAT", "TRIALING");
    expect((await updated(over)).status).toBe(200);
    expect(db.subs.get(TENANT)).toMatchObject({ cancelAtPeriodEnd: expected, status: "TRIALING" });
    // Cancelling is not cancelled: access holds until Stripe deletes it.
    expect(paid()).toBe(true);
  });
});
