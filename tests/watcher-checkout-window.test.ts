// THE WINDOW BETWEEN THE TWO WEBHOOK EVENTS.
//
// A Stripe purchase delivers `checkout.session.completed` first and
// `customer.subscription.created` second, and only the second one writes the
// Subscription row that carries productKind. So between them a watcher buyer
// has no row at all — which means getBillingContext cannot see a WATCHER to
// discount, falls back to tenant.billingStatus, and returns whatever the
// checkout handler put there.
//
// The checkout handler used to put ACTIVE there unconditionally. That handed a
// $9 add-on buyer every paid tool in the product for the length of the window,
// and indefinitely whenever the second event was delayed, dropped or retried —
// the same hole productKind closed in the subscription handler, reached through
// the one that fires first. An end-state test cannot see it, because by the end
// state the row exists and the fallback is correctly bypassed.
//
// So this suite stops after event one, on purpose, and asks the real
// hasPaidPlan. The tenant store is a real read-after-write: the handler's write
// is what the gate then reads, rather than the test asserting on the arguments
// of a call it already knows it made.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { WATCHER_LOOKUP_KEYS } from "@/lib/plan-config";

// ─── Mocks ──────────────────────────────────────────────────────────────────

// The real key, imported rather than transcribed: a literal here would keep
// passing after someone renamed the SKU, by testing a string that is no longer
// a watcher against a productKindFor that correctly says PLAN.
const WATCHER_KEY = WATCHER_LOOKUP_KEYS.monthly;
const PLAN_KEY = "echorank_starter_usd_month";

/** What Stripe would return for the session's subscription. */
let stripeSubscription: { id: string; trial_end: number | null; items: unknown } | null = null;
/** Set to make subscriptions.retrieve throw, for the fail-closed case. */
let retrieveFails = false;

const subscriptionsRetrieve = vi.fn(async () => {
  if (retrieveFails) throw new Error("stripe is down");
  return stripeSubscription;
});

vi.mock("stripe", () => {
  class FakeStripe {
    webhooks = {
      // Signature verification is not what this suite is about; the real
      // constructEvent is exercised by the sandbox harness (scripts/watcher-e2e.ts),
      // which signs its payloads with the secret the handler verifies against.
      constructEvent: (raw: string) => JSON.parse(raw),
    };
    subscriptions = { retrieve: subscriptionsRetrieve, cancel: vi.fn() };
    balance = { retrieve: vi.fn() };
  }
  return { default: FakeStripe };
});

/** A one-tenant in-memory table, so the gate reads what the handler wrote. */
const TENANT_ID = "tenant_window";
let tenantRow: Record<string, unknown>;

const tenant = {
  findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
    where.id === TENANT_ID ? { ...tenantRow } : null,
  ),
  findFirst: vi.fn(async () => ({ ...tenantRow })),
  update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    tenantRow = { ...tenantRow, ...data };
    return { ...tenantRow };
  }),
};
// No row: that IS the window. The subscription handler has not run yet.
const subscription = { findUnique: vi.fn(async () => null), upsert: vi.fn() };
// The route writes an idempotency marker before dispatching. Omitting it from
// this mock made POST throw and return 500 before the handler ever ran — and
// the two watcher assertions still went green, because "billingStatus was not
// promoted" is equally true of a handler that never executed. Asserting the
// customer id got written is what caught it.
const processedWebhook = { create: vi.fn(async () => ({})), delete: vi.fn(async () => ({})) };

vi.mock("@/lib/prisma", () => ({ prisma: { tenant, subscription, processedWebhook } }));

vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => ({ success: true, remaining: 99 }) }));
vi.mock("@/lib/matrix-accounts", () => ({ reconcileTenantMatrixAccounts: vi.fn() }));
vi.mock("@/lib/stripe/prices", () => ({ resolvePlanFromPriceId: vi.fn(async () => null) }));
vi.mock("@/infrastructure/metering/quota", () => ({ quotaEnforcer: { provisionForPlan: vi.fn() } }));
vi.mock("@/lib/billing/trial-notice", () => ({
  scheduleTrialEndingNotice: vi.fn(),
  cancelTrialEndingNotice: vi.fn(),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Deliver checkout.session.completed — and ONLY that event. */
async function deliverCheckoutSession(opts: { lookupKey?: string; withSubscription?: boolean }) {
  const withSubscription = opts.withSubscription ?? true;
  stripeSubscription = withSubscription
    ? {
        id: "sub_test",
        trial_end: null,
        items: { data: [{ price: { id: "price_test", lookup_key: opts.lookupKey } }] },
      }
    : null;

  const { POST } = await import("@/app/api/webhooks/route");
  const body = JSON.stringify({
    id: "evt_test",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test",
        object: "checkout.session",
        client_reference_id: TENANT_ID,
        customer: "cus_test",
        subscription: withSubscription ? "sub_test" : null,
        mode: withSubscription ? "subscription" : "payment",
        status: "complete",
      },
    },
  });
  return POST(
    new Request("https://local/api/webhooks", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=stub", "content-type": "application/json" },
      body,
    }) as never,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  retrieveFails = false;
  // TRIALING is the Prisma default — the state a tenant is in before any
  // purchase, and not paid on its own without a Subscription row.
  tenantRow = {
    id: TENANT_ID,
    planType: "STARTER",
    billingStatus: "TRIALING",
    stripeCustomerId: null,
  };
  process.env.STRIPE_SECRET_KEY = "sk_test_stub";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_stub";
});

// ─── The window ─────────────────────────────────────────────────────────────

describe("after checkout.session.completed ALONE, with no subscription event yet", () => {
  it("leaves a watcher buyer unactivated and every paid feature locked", async () => {
    await deliverCheckoutSession({ lookupKey: WATCHER_KEY });

    expect(tenantRow.billingStatus).toBe("TRIALING");
    // The gate itself, through the real code path: no Subscription row exists,
    // so this falls back to the column the handler just declined to promote.
    const { hasPaidPlan } = await import("@/lib/paid-plan");
    expect(await hasPaidPlan(TENANT_ID)).toBe(false);
  });

  it("still records the customer id, so the subscription event can match", async () => {
    // Not promoting must not mean not writing: the customer id is how the
    // second event finds this tenant, and dropping it would strand the row.
    await deliverCheckoutSession({ lookupKey: WATCHER_KEY });

    expect(tenantRow.stripeCustomerId).toBe("cus_test");
    expect(tenantRow.stripeSubscriptionId).toBe("sub_test");
  });

  it("does not promote the tenant's tier either", async () => {
    await deliverCheckoutSession({ lookupKey: WATCHER_KEY });
    expect(tenantRow.planType).toBe("STARTER");
  });

  it("DOES activate a plan buyer in the same window", async () => {
    // The other half of the contract. A real plan purchase must not be made to
    // wait for the second event — the fix has to be narrow enough that the
    // ordinary path is untouched, and this is what pins that.
    await deliverCheckoutSession({ lookupKey: PLAN_KEY });

    expect(tenantRow.billingStatus).toBe("ACTIVE");
    const { hasPaidPlan } = await import("@/lib/paid-plan");
    expect(await hasPaidPlan(TENANT_ID)).toBe(true);
  });
});

describe("when the product kind cannot be resolved", () => {
  it("fails closed rather than guessing PLAN", async () => {
    // An unresolvable kind is indistinguishable from a watcher here, and the
    // costs are not symmetric: a plan customer activates seconds later when
    // customer.subscription.created lands, whereas assuming PLAN would hand a
    // watcher buyer the whole product on the strength of a network error.
    retrieveFails = true;
    await deliverCheckoutSession({ lookupKey: PLAN_KEY });

    expect(tenantRow.billingStatus).toBe("TRIALING");
    const { hasPaidPlan } = await import("@/lib/paid-plan");
    expect(await hasPaidPlan(TENANT_ID)).toBe(false);
  });

  it("keeps activating a session that has no subscription at all", async () => {
    // Not a watcher: that SKU is subscription-only. A one-off payment session
    // has no subscription to inspect, so the pre-existing behaviour stands
    // rather than being caught by a guard aimed at something else.
    await deliverCheckoutSession({ withSubscription: false });
    expect(tenantRow.billingStatus).toBe("ACTIVE");
  });
});
