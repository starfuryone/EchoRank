// Cancel / resume and the Stripe webhook, on ONE fake database.
//
// cancelTenantSubscription() writes the result to subscriptions (and, for an
// immediate cancel, tenants) at once, without waiting for Stripe's webhook.
// The webhook then arrives with the same facts. Whichever lands second must
// change nothing: same row, same tenant, no second audit row. Both orders are
// run here through the real handlers (src/lib/billing/cancellation.ts and
// src/app/api/webhooks/route.ts). Stripe is a stateful fake; nothing is called.

import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;

const { db, stripeMock, loggerFns, audits } = vi.hoisted(() => ({
  db: {
    tenants: new Map<string, Row>(),
    subs: new Map<string, Row>(),
    prices: [] as Row[],
    events: new Set<string>(),
  },
  stripeMock: {
    subscriptions: { retrieve: vi.fn(), update: vi.fn(), cancel: vi.fn() },
    webhooks: { constructEvent: vi.fn() },
  },
  loggerFns: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() },
  audits: [] as Row[],
}));
loggerFns.child.mockReturnValue(loggerFns);

const matches = (row: Row, where: Row) => Object.entries(where).every(([k, v]) => row[k] === v);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const t = db.tenants.get(where.id);
        return t ? { ...t, members: [] } : null;
      },
      findFirst: async ({ where }: { where: { stripeCustomerId?: string } }) => {
        const t = [...db.tenants.values()].find((x) => where.stripeCustomerId && x.stripeCustomerId === where.stripeCustomerId);
        return t ? { ...t } : null;
      },
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const row = db.tenants.get(where.id);
        if (!row) throw new Error("tenant not found");
        Object.assign(row, data);
        return { ...row };
      },
    },
    tenantMember: { findFirst: async () => ({ user: { name: "Ada Owner" } }) },
    subscription: {
      findUnique: async ({ where }: { where: { tenantId: string } }) => {
        const s = db.subs.get(where.tenantId);
        return s ? { ...s } : null;
      },
      upsert: async ({ where, create, update }: { where: { tenantId: string }; create: Row; update: Row }) => {
        const existing = db.subs.get(where.tenantId);
        const row = existing ? { ...existing, ...update } : { ...create };
        db.subs.set(where.tenantId, row);
        return row;
      },
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        let count = 0;
        for (const s of db.subs.values()) {
          if (matches(s, where)) {
            Object.assign(s, data);
            count++;
          }
        }
        return { count };
      },
    },
    stripePrice: { findFirst: async ({ where }: { where: Row }) => db.prices.find((r) => matches(r, where)) ?? null },
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
vi.mock("@/lib/audit", () => ({
  createAuditLog: async (e: Row) => {
    audits.push(e);
    return e;
  },
}));
vi.mock("@/lib/mailer", () => ({ isEmailConfigured: () => false, sendMail: vi.fn() }));
vi.mock("@/infrastructure/observability/logger", () => ({ logger: loggerFns }));
vi.mock("stripe", () => ({ default: class { constructor() { return stripeMock; } } }));
vi.mock("@/lib/stripe/client", () => ({ getStripe: () => stripeMock }));
vi.mock("@/lib/plan-change", () => ({ onPlanChange: vi.fn(async () => ({})) }));
vi.mock("@/lib/matrix-accounts", () => ({ reconcileTenantMatrixAccounts: vi.fn(async () => ({ checked: 0 })) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(async () => ({ success: true })) }));
vi.mock("@/infrastructure/metering/quota", () => ({ quotaEnforcer: { setQuota: vi.fn(), getDefaultQuotas: vi.fn(() => ({})) } }));
vi.mock("@/lib/billing/trial-notice", () => ({ cancelTrialEndingNotice: vi.fn(), scheduleTrialEndingNotice: vi.fn() }));
vi.mock("@/lib/billing/credit-webhook", async (orig) => {
  const real = (await orig()) as Record<string, unknown>;
  return { ...real, handleCreditPackCompleted: vi.fn() };
});

const { cancelTenantSubscription, resumeTenantSubscription } = await import("@/lib/billing/cancellation");

const T = "tenant_c";
const CUS = "cus_c";
const SUB = "sub_c";
const PRICE = { id: "price_starter_m", lookup_key: "echorank_starter_usd_month" };
const END = 1_900_000_000;
const OWNER = { kind: "member" as const, userId: "u_owner", role: "OWNER" as const };
const STAFF = { kind: "platform_admin" as const, userId: "u_staff", email: "staff@example.test" };

/** Stripe's copy of the subscription: the fake's state, mutated by update/cancel. */
let stripeSub: Row;

function freshStripeSub(over: Row = {}): Row {
  return {
    id: SUB,
    status: "active",
    customer: CUS,
    cancel_at_period_end: false,
    cancel_at: null,
    trial_end: null,
    items: { data: [{ current_period_start: END - 2_592_000, current_period_end: END, price: PRICE }] },
    metadata: { app: "echorank", tenantId: T, tier: "starter", interval: "month" },
    ...over,
  };
}

async function webhook(type: string, eventId: string) {
  stripeMock.webhooks.constructEvent.mockReturnValue({ id: eventId, type, data: { object: { ...stripeSub } } });
  const { POST } = await import("@/app/api/webhooks/route");
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  process.env.STRIPE_SECRET_KEY = "sk_test_x";
  const res = await POST({ headers: new Headers({ "stripe-signature": "sig", "x-forwarded-for": "1.2.3.4" }), text: async () => "{}" } as never);
  expect(res.status).toBe(200);
}

const snapshot = () => ({ sub: { ...db.subs.get(T) }, tenant: { ...db.tenants.get(T) } });
const subFields = (s: Row) => ({ status: s.status, cancelAtPeriodEnd: s.cancelAtPeriodEnd, currentPeriodEnd: (s.currentPeriodEnd as Date | null)?.toISOString() ?? null });

beforeEach(() => {
  vi.clearAllMocks();
  loggerFns.child.mockReturnValue(loggerFns);
  db.tenants.clear();
  db.subs.clear();
  db.prices.length = 0;
  db.events.clear();
  audits.length = 0;
  db.prices.push({ stripePriceId: PRICE.id, planTier: "starter", currency: "USD", interval: "month", active: true, createdAt: 1 });
  db.tenants.set(T, { id: T, planType: "STARTER", billingStatus: "ACTIVE", stripeCustomerId: CUS, stripeSubscriptionId: SUB });
  db.subs.set(T, {
    id: "row_c",
    tenantId: T,
    productKind: "PLAN",
    planType: "STARTER",
    status: "ACTIVE",
    cancelAtPeriodEnd: false,
    currentPeriodEnd: new Date(END * 1000),
    stripeSubscriptionId: SUB,
    stripePriceId: PRICE.id,
  });
  stripeSub = freshStripeSub();
  stripeMock.subscriptions.retrieve.mockImplementation(async () => ({ ...stripeSub }));
  stripeMock.subscriptions.update.mockImplementation(async (_id: string, p: Row) => {
    if ("cancel_at_period_end" in p) {
      stripeSub.cancel_at_period_end = p.cancel_at_period_end;
      stripeSub.cancel_at = p.cancel_at_period_end ? END : null;
    }
    if (p.cancel_at === "") stripeSub.cancel_at = null;
    return { ...stripeSub };
  });
  stripeMock.subscriptions.cancel.mockImplementation(async () => {
    stripeSub.status = "canceled";
    stripeSub.ended_at = END - 100;
    return { ...stripeSub };
  });
});

describe("period-end cancel, then customer.subscription.updated", () => {
  it("our write first: the webhook changes nothing, and no second audit row", async () => {
    const r = await cancelTenantSubscription(T, { when: "period_end", actor: OWNER });
    expect(r).toMatchObject({ ok: true, changed: true, state: { cancelAtPeriodEnd: true, status: "ACTIVE" } });
    const ours = snapshot();
    expect(subFields(ours.sub)).toEqual({ status: "ACTIVE", cancelAtPeriodEnd: true, currentPeriodEnd: new Date(END * 1000).toISOString() });
    expect(ours.tenant.billingStatus).toBe("ACTIVE"); // access lasts until the period ends

    await webhook("customer.subscription.updated", "evt_upd_1");
    const after = snapshot();
    expect(subFields(after.sub)).toEqual(subFields(ours.sub));
    expect(after.tenant).toMatchObject({ billingStatus: "ACTIVE", planType: "STARTER" });
    expect(audits.filter((a) => a.action === "billing.subscription.cancel")).toHaveLength(1);
  });

  it("the webhook first (a cancel made elsewhere): our cancel then calls Stripe for nothing", async () => {
    stripeSub.cancel_at_period_end = true;
    stripeSub.cancel_at = END;
    await webhook("customer.subscription.updated", "evt_upd_2");
    expect(db.subs.get(T)).toMatchObject({ cancelAtPeriodEnd: true });

    const r = await cancelTenantSubscription(T, { when: "period_end", actor: OWNER });
    expect(r).toMatchObject({ ok: true, changed: false });
    expect(stripeMock.subscriptions.update).not.toHaveBeenCalled();
    expect(audits).toHaveLength(0);
  });

  it("resume, then the webhook: renewing again on both sides", async () => {
    await cancelTenantSubscription(T, { when: "period_end", actor: OWNER });
    const r = await resumeTenantSubscription(T, OWNER, new Date((END - 86_400) * 1000));
    expect(r).toMatchObject({ ok: true, changed: true, state: { cancelAtPeriodEnd: false } });
    await webhook("customer.subscription.updated", "evt_upd_3");
    expect(db.subs.get(T)).toMatchObject({ cancelAtPeriodEnd: false, status: "ACTIVE" });
    expect(audits.map((a) => a.action)).toEqual(["billing.subscription.cancel", "billing.subscription.resume"]);
  });

  it("a trial cancels at trial end with no charge: Stripe's trial_end is the access date", async () => {
    stripeSub = freshStripeSub({ status: "trialing", trial_end: END - 3_600 });
    db.subs.get(T)!.status = "TRIALING";
    db.tenants.get(T)!.billingStatus = "TRIALING";
    stripeMock.subscriptions.update.mockImplementation(async (_id: string, p: Row) => {
      stripeSub.cancel_at_period_end = p.cancel_at_period_end;
      return { ...stripeSub };
    });
    const r = await cancelTenantSubscription(T, { when: "period_end", actor: OWNER });
    expect(r).toMatchObject({ ok: true, changed: true, state: { trial: true, periodEnd: new Date((END - 3_600) * 1000).toISOString() } });
    expect(stripeMock.subscriptions.update).toHaveBeenCalledWith(SUB, { cancel_at_period_end: true });
    expect(stripeMock.subscriptions.cancel).not.toHaveBeenCalled();
    expect(audits[0]).toMatchObject({ details: { trial: true } });
  });
});

describe("immediate cancel (staff), then customer.subscription.deleted", () => {
  it("our write first: CANCELED on both rows at once; the webhook changes nothing", async () => {
    const r = await cancelTenantSubscription(T, { when: "now", actor: STAFF, reason: { reason: "other", note: "contract ended" } });
    expect(r).toMatchObject({ ok: true, changed: true, state: { status: "CANCELED" } });
    expect(stripeMock.subscriptions.cancel).toHaveBeenCalledWith(SUB, {
      prorate: false,
      invoice_now: false,
      cancellation_details: { feedback: "other", comment: "contract ended" },
    });
    const ours = snapshot();
    expect(ours.sub).toMatchObject({ status: "CANCELED", cancelAtPeriodEnd: false });
    expect(ours.tenant).toMatchObject({ billingStatus: "CANCELED" });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      tenantId: T,
      userId: "u_staff",
      action: "billing.subscription.cancel_now",
      details: { actor: "platform_admin", adminEmail: "staff@example.test", when: "now", stripe: { status: "canceled" } },
    });

    await webhook("customer.subscription.deleted", "evt_del_1");
    const after = snapshot();
    expect(subFields(after.sub)).toEqual(subFields(ours.sub));
    expect(after.tenant.billingStatus).toBe("CANCELED");
    expect(audits).toHaveLength(1);
  });

  it("the webhook first: our cancel answers 409 ended and calls Stripe for nothing", async () => {
    stripeSub.status = "canceled";
    await webhook("customer.subscription.deleted", "evt_del_2");
    const r = await cancelTenantSubscription(T, { when: "now", actor: STAFF });
    expect(r).toMatchObject({ ok: false, status: 409, reason: "ended" });
    expect(stripeMock.subscriptions.cancel).not.toHaveBeenCalled();
  });

  it("a member can never end it now, whatever the role", async () => {
    const r = await cancelTenantSubscription(T, { when: "now", actor: OWNER });
    expect(r).toMatchObject({ ok: false, status: 403 });
    expect(stripeMock.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(db.subs.get(T)).toMatchObject({ status: "ACTIVE" });
  });

  it("a Stripe failure is audited and reported, and nothing is mirrored", async () => {
    stripeMock.subscriptions.cancel.mockRejectedValueOnce(new Error("card_declined? no: api_connection_error"));
    const r = await cancelTenantSubscription(T, { when: "now", actor: STAFF });
    expect(r).toMatchObject({ ok: false, status: 502, reason: "stripe_error" });
    expect(db.subs.get(T)).toMatchObject({ status: "ACTIVE" });
    expect(db.tenants.get(T)).toMatchObject({ billingStatus: "ACTIVE" });
    expect(audits[0]).toMatchObject({ action: "billing.subscription.cancel_failed", details: { when: "now", stripeError: expect.stringContaining("api_connection_error") } });
  });
});
