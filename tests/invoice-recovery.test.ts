// tests/invoice-recovery.test.ts
//
// PAST_DUE -> ACTIVE when an invoice is paid, from EITHER event type.
//
// This recovery had never run in the sandbox: the switch handled only
// `invoice.payment_succeeded` while the Stripe destination was subscribed to
// only `invoice.paid`, so every payment fell through to `default:` and logged as
// an unhandled type. Nothing failed loudly — a tenant simply stayed PAST_DUE
// after paying, which reads as a billing bug on our side.
//
// Stripe sends BOTH events for one successful invoice, so the pair is also a
// duplicate-delivery test: the second must change nothing. That property comes
// from the handler's existing `=== "PAST_DUE"` guard, not from a dedupe layer —
// the route's idempotency marker is keyed on event id and these are two
// different events, so both genuinely reach the handler.
//
// A stateful tenant map, for the same reason tests/webhook-event-order.test.ts
// uses one: "the second delivery is a no-op" is only meaningful if the first
// delivery's write is what the second one reads.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, writes, stripeMock, loggerFns } = vi.hoisted(() => ({
  db: { tenants: new Map<string, Record<string, unknown>>(), events: new Set<string>() },
  writes: { count: 0 },
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
      findUnique: async ({ where }: { where: { id: string } }) => db.tenants.get(where.id) ?? null,
      findFirst: async ({ where }: { where: { stripeCustomerId?: string } }) =>
        [...db.tenants.values()].find(
          (t) => where.stripeCustomerId && t.stripeCustomerId === where.stripeCustomerId,
        ) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        writes.count += 1;
        const row = db.tenants.get(where.id);
        if (!row) throw new Error("tenant not found");
        Object.assign(row, data);
        return row;
      },
    },
    subscription: { findUnique: async () => null, upsert: async () => ({}) },
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

const TENANT = "tenant_invoice";
const CUS = "cus_invoice";

function invoice(over: Record<string, unknown> = {}) {
  return { id: "in_test_1", customer: CUS, amount_paid: 7900, ...over };
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

const status = () => db.tenants.get(TENANT)!.billingStatus;
const recoveryLogs = () =>
  loggerFns.info.mock.calls.filter((c) => c[1] === "Invoice paid — tenant re-activated").length;

beforeEach(() => {
  vi.clearAllMocks();
  db.tenants.clear();
  db.events.clear();
  writes.count = 0;
  db.tenants.set(TENANT, {
    id: TENANT,
    planType: "STARTER",
    billingStatus: "PAST_DUE",
    stripeCustomerId: CUS,
  });
});

// ─── Either event recovers the tenant ───────────────────────────────────────

describe("a PAST_DUE tenant recovers when an invoice is paid", () => {
  it.each(["invoice.paid", "invoice.payment_succeeded"] as const)(
    "recovers on %s",
    async (type) => {
      const res = await post(type, invoice(), `evt_${type}`);

      expect(res.status).toBe(200);
      expect(status()).toBe("ACTIVE");
      expect(recoveryLogs()).toBe(1);
    },
  );

  it.each(["invoice.paid", "invoice.payment_succeeded"] as const)(
    "does NOT log %s as an unhandled event type",
    async (type) => {
      // The original symptom: the event arrived, was accepted with 200, and did
      // nothing but hit `default:`. A green "recovers" test above would not have
      // caught the reverse mistake of handling it in two places, so the absence
      // of the unhandled log is asserted directly.
      await post(type, invoice(), `evt_unhandled_${type}`);

      const unhandled = loggerFns.debug.mock.calls.filter(
        (c) => c[1] === "Unhandled Stripe event type",
      );
      expect(unhandled).toHaveLength(0);
    },
  );
});

// ─── The duplicate delivery must change nothing ─────────────────────────────

describe("the second of the pair is a no-op", () => {
  it.each([
    ["invoice.paid", "invoice.payment_succeeded"],
    ["invoice.payment_succeeded", "invoice.paid"],
  ] as const)("%s then %s writes once and logs once", async (first, second) => {
    await post(first, invoice(), `evt_first_${first}`);
    expect(status()).toBe("ACTIVE");
    const writesAfterFirst = writes.count;

    // Same invoice, the other event type, a different event id — so the route's
    // id-keyed idempotency marker does not stop it. Only the handler's guard does.
    await post(second, invoice(), `evt_second_${second}`);

    expect(status()).toBe("ACTIVE");
    expect(writes.count).toBe(writesAfterFirst);
    expect(recoveryLogs()).toBe(1);
  });

  it("leaves an already-ACTIVE tenant completely untouched", async () => {
    db.tenants.get(TENANT)!.billingStatus = "ACTIVE";

    await post("invoice.paid", invoice(), "evt_already_active");

    expect(status()).toBe("ACTIVE");
    expect(writes.count).toBe(0);
    expect(recoveryLogs()).toBe(0);
  });
});

// ─── What it must not do ────────────────────────────────────────────────────

describe("statuses it must not touch", () => {
  it.each(["NONE", "CANCELED", "TRIALING"] as const)(
    "does not promote a %s tenant",
    async (billingStatus) => {
      // The guard is PAST_DUE specifically. A paid invoice must not, for example,
      // lift a never-subscribed tenant into ACTIVE.
      db.tenants.get(TENANT)!.billingStatus = billingStatus;

      await post("invoice.paid", invoice(), `evt_${billingStatus}`);

      expect(status()).toBe(billingStatus);
      expect(writes.count).toBe(0);
    },
  );

  it("ignores an invoice for a customer we do not know", async () => {
    const res = await post("invoice.paid", invoice({ customer: "cus_foreign" }), "evt_foreign");

    expect(res.status).toBe(200);
    expect(status()).toBe("PAST_DUE");
    expect(writes.count).toBe(0);
  });
});
