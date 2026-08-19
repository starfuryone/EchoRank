// tests/webhook-event-order.test.ts
//
// THE EVENT-ORDERING RACE, REPLAYED BOTH WAYS.
//
// Stripe does not guarantee the order of `checkout.session.completed` and
// `customer.subscription.created`. Observed in the sandbox on 2026-08-19:
//
//   08:33:45.453  customer.subscription.created   -> "No tenant found"
//   08:33:45.753  checkout.session.completed      -> tenant activated
//
// 300ms apart, wrong way round. handleSubscriptionUpdated resolved its tenant by
// stripeCustomerId — a column the OTHER handler writes — so when `created` won it
// found nothing, warned, and returned 200. Stripe never retried, because 200
// means handled. The Subscription row was permanently absent for a customer who
// had just paid, and since requirePaidPlan grants TRIALING only when a row
// exists, that customer was denied every paid feature they had bought.
//
// ── WHY THIS FILE USES A STATEFUL FAKE ──────────────────────────────────────
//
// A race cannot be tested with fixed mocks. The bug only exists because one
// handler's WRITE is what the other handler READS, so the fake below keeps real
// tenant and subscription maps: `tenant.update` mutates them and a later
// `findFirst` sees the result. Mocking findFirst to a constant would make both
// orders pass and prove nothing.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, stripeMock, loggerFns } = vi.hoisted(() => ({
  db: {
    tenants: new Map<string, Record<string, unknown>>(),
    subs: new Map<string, Record<string, unknown>>(),
    events: new Set<string>(),
  },
  stripeMock: {
    subscriptions: { retrieve: vi.fn(), cancel: vi.fn() },
    webhooks: { constructEvent: vi.fn() },
  },
  loggerFns: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() },
}));
loggerFns.child.mockReturnValue(loggerFns);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        db.tenants.get(where.id) ?? null,
      findFirst: async ({ where }: { where: { stripeCustomerId?: string } }) =>
        [...db.tenants.values()].find(
          (t) => where.stripeCustomerId && t.stripeCustomerId === where.stripeCustomerId,
        ) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = db.tenants.get(where.id);
        if (!row) throw new Error("tenant not found");
        Object.assign(row, data);
        return row;
      },
    },
    subscription: {
      findUnique: async ({ where }: { where: { tenantId: string } }) =>
        db.subs.get(where.tenantId) ?? null,
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { tenantId: string };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        const existing = db.subs.get(where.tenantId);
        const row = existing ? { ...existing, ...update } : { ...create };
        db.subs.set(where.tenantId, row);
        return row;
      },
    },
    processedWebhook: {
      create: async ({ data }: { data: { stripeEventId: string } }) => {
        if (db.events.has(data.stripeEventId)) {
          throw Object.assign(new Error("dup"), { code: "P2002" });
        }
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
vi.mock("@/lib/stripe/prices", () => ({ resolvePlanFromPriceId: vi.fn(async () => null) }));
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

const TENANT = "tenant_race";
const CUS = "cus_race";
const SUB = "sub_race";

/** The Subscription object, carrying the metadata checkout now stamps. */
function subscriptionObject(over: Record<string, unknown> = {}) {
  return {
    id: SUB,
    status: "trialing",
    customer: CUS,
    cancel_at_period_end: false,
    trial_end: 1_900_000_000,
    items: {
      data: [
        {
          current_period_start: 1_800_000_000,
          current_period_end: 1_900_000_000,
          price: { id: "price_starter_m", lookup_key: "echorank_starter_usd_month" },
        },
      ],
    },
    metadata: { app: "echorank", tenantId: TENANT, tier: "starter", interval: "month" },
    ...over,
  };
}

function checkoutSession() {
  return {
    id: "cs_test_race",
    mode: "subscription",
    status: "complete",
    client_reference_id: TENANT,
    customer: CUS,
    subscription: SUB,
    customer_details: { email: "racer@example.test" },
    metadata: {
      app: "echorank",
      flow: "upgrade",
      tenantId: TENANT,
      tier: "starter",
      interval: "month",
      locale: "en",
    },
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

const completed = (id = "evt_completed") => post("checkout.session.completed", checkoutSession(), id);
const created = (over = {}, id = "evt_created") =>
  post("customer.subscription.created", subscriptionObject(over), id);

beforeEach(() => {
  vi.clearAllMocks();
  db.tenants.clear();
  db.subs.clear();
  db.events.clear();
  // A brand-new tenant, exactly as registration leaves it: NONE, and — the
  // crux — NO stripeCustomerId yet. That column is what the old lookup needed.
  db.tenants.set(TENANT, {
    id: TENANT,
    planType: "STARTER",
    billingStatus: "NONE",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
  });
  stripeMock.subscriptions.retrieve.mockResolvedValue(subscriptionObject());
});

// ─── The row must exist in BOTH orders ──────────────────────────────────────

describe("the two events, in both orders", () => {
  it("writes the Subscription row when checkout.session.completed arrives FIRST", async () => {
    expect((await completed()).status).toBe(200);
    expect((await created()).status).toBe(200);

    const row = db.subs.get(TENANT);
    expect(row).toBeDefined();
    expect(row).toMatchObject({ status: "TRIALING", productKind: "PLAN" });
  });

  it("writes the Subscription row when customer.subscription.created arrives FIRST", async () => {
    // THE REGRESSION TEST. Before the fix this order left db.subs empty, because
    // the handler looked the tenant up by a stripeCustomerId that had not been
    // written yet, warned, and returned 200 so Stripe never retried.
    expect((await created()).status).toBe(200);
    expect((await completed()).status).toBe(200);

    const row = db.subs.get(TENANT);
    expect(row).toBeDefined();
    expect(row).toMatchObject({ status: "TRIALING", productKind: "PLAN" });
  });

  it.each([
    ["completed then created", async () => { await completed(); await created(); }],
    ["created then completed", async () => { await created(); await completed(); }],
  ])("leaves the tenant on a PAID footing either way (%s)", async (_label, run) => {
    await run();

    const tenant = db.tenants.get(TENANT)!;
    const row = db.subs.get(TENANT)!;
    // The pair requirePaidPlan actually reads: a PLAN row whose status is
    // TRIALING or ACTIVE. Whichever order ran, this must hold — otherwise the
    // customer paid and is denied the product.
    expect(row.productKind).toBe("PLAN");
    expect(["TRIALING", "ACTIVE"]).toContain(row.status as string);
    expect(tenant.billingStatus).not.toBe("NONE");
    expect(tenant.stripeSubscriptionId).toBe(SUB);
  });

  it("records the customer id whichever event lands first", async () => {
    // The invoice handlers find their tenant by this column alone, so if only
    // checkout.session.completed wrote it the race would simply move downstream.
    await created();
    expect(db.tenants.get(TENANT)!.stripeCustomerId).toBe(CUS);
  });

  it("resolves by metadata, not by the customer column, when it arrives first", async () => {
    await created();
    const updated = loggerFns.info.mock.calls.find(
      (c) => c[1] === "Subscription updated",
    );
    expect(updated?.[0]).toMatchObject({ resolvedBy: "metadata" });
  });
});

// ─── Not every unresolved subscription is our problem ───────────────────────

describe("subscriptions that cannot be attached", () => {
  it("IGNORES a foreign product's subscription with 200 — no retry storm", async () => {
    // The live Stripe account is shared with 7+ other products, so this endpoint
    // is routinely handed subscriptions that never had a tenant. Making those
    // retryable would put every one into a three-day loop.
    const res = await created(
      { metadata: {}, customer: "cus_someone_elses_product" },
      "evt_foreign",
    );

    expect(res.status).toBe(200);
    expect(db.subs.size).toBe(0);
  });

  it("RETRIES one of ours that cannot be attached — non-2xx, marker cleared", async () => {
    // Our subscription, no tenantId stamped (in flight across the deploy that
    // added it), customer id not yet written. A retry after
    // checkout.session.completed lands will succeed, so Stripe must be asked.
    const res = await created(
      { metadata: { app: "echorank" }, customer: "cus_not_written_yet" },
      "evt_ours_unattached",
    );

    expect(res.status).toBeGreaterThanOrEqual(400);
    // The idempotency marker must be rolled back or the retry is a no-op.
    expect(db.events.has("evt_ours_unattached")).toBe(false);
  });

  it("does NOT retry when the named tenant is genuinely gone", async () => {
    // Retrying cannot resurrect a deleted tenant; 200 stops the loop.
    db.tenants.clear();
    const res = await created({ metadata: { app: "echorank", tenantId: "tenant_deleted" } }, "evt_gone");

    expect(res.status).toBe(200);
    expect(db.subs.size).toBe(0);
  });
});
