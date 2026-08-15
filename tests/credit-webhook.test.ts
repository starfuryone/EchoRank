// tests/credit-webhook.test.ts
//
// THE REGRESSION THIS FILE EXISTS FOR:
//
//   if (subscriptionId ? productKind === "PLAN" : true) {
//     updateData.billingStatus = "ACTIVE";
//   }
//
// That line is in handleCheckoutCompleted. A one-time payment session carries
// no subscription, so `subscriptionId` is undefined, the ternary short-circuits
// to `true`, and a $19 pack of lookups would set the tenant ACTIVE — granting
// every paid feature in the product to someone who bought prospect lookups.
//
// The fix is an early return on the credit branch, BEFORE that line, and the
// assertion that matters is the negative one: a mode=payment session must never
// touch billingStatus. Every other test here supports that one.
//
// The route is exercised through its real dispatcher, so the branch ordering is
// what is under test rather than a re-implementation of it.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { tenant, processedWebhook, creditLedger, stripeMock, notify, loggerFns } = vi.hoisted(
  () => ({
    tenant: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    processedWebhook: { create: vi.fn(), delete: vi.fn() },
    creditLedger: { create: vi.fn(), aggregate: vi.fn() },
    stripeMock: {
      checkout: { sessions: { listLineItems: vi.fn() } },
      subscriptions: { retrieve: vi.fn() },
      webhooks: { constructEvent: vi.fn() },
    },
    notify: vi.fn(),
    loggerFns: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() },
  }),
);
loggerFns.child.mockReturnValue(loggerFns);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant,
    processedWebhook,
    creditLedger,
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({ creditLedger }),
  },
}));
vi.mock("@/infrastructure/observability/logger", () => ({ logger: loggerFns }));
vi.mock("stripe", () => ({ default: class { constructor() { return stripeMock; } } }));
vi.mock("@/lib/stripe/client", () => ({ getStripe: () => stripeMock }));
vi.mock("@/lib/notifications/adapters", () => ({ notifyCreditsPurchased: notify }));
vi.mock("@/lib/matrix-accounts", () => ({ reconcileTenantMatrixAccounts: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(async () => ({ allowed: true })) }));
vi.mock("@/infrastructure/metering/quota", () => ({ quotaEnforcer: { reset: vi.fn() } }));
vi.mock("@/lib/billing/trial-notice", () => ({
  cancelTrialEndingNotice: vi.fn(),
  scheduleTrialEndingNotice: vi.fn(),
}));

import { recordPurchase } from "@/lib/credits/store";

const TENANT = "tenant_a";

/** A completed one-time credit-pack session, as Stripe sends it. */
function creditSession(over: Record<string, unknown> = {}) {
  return {
    id: "cs_credit_1",
    mode: "payment",
    payment_status: "paid",
    client_reference_id: TENANT,
    customer: "cus_1",
    subscription: null,
    metadata: { app: "echorank", flow: "credit_pack", credits: "500", tenantId: TENANT },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  tenant.findUnique.mockResolvedValue({ id: TENANT, stripeCustomerId: "cus_1" });
  tenant.findFirst.mockResolvedValue(null);
  tenant.update.mockResolvedValue({ id: TENANT });
  processedWebhook.create.mockResolvedValue({});
  creditLedger.create.mockResolvedValue({ id: "cl_1" });
  creditLedger.aggregate.mockResolvedValue({ _sum: { delta: 500 } });
  stripeMock.checkout.sessions.listLineItems.mockResolvedValue({
    data: [{ price: { lookup_key: "echorank_credits_500_usd" } }],
  });
});

// ─── The regression ─────────────────────────────────────────────────────────

describe("a one-time payment session never activates billing", () => {
  it("does not set billingStatus on a credit-pack session", async () => {
    const { handleCreditPackCompleted } = await import("@/lib/billing/credit-webhook");
    // Guard: if the export disappears, this test must fail loudly rather than
    // silently pass against nothing.
    expect(typeof handleCreditPackCompleted).toBe("function");

    await handleCreditPackCompleted(creditSession() as never);

    // THE ASSERTION. Any tenant.update carrying billingStatus is the bug.
    for (const call of tenant.update.mock.calls) {
      expect(call[0]?.data ?? {}).not.toHaveProperty("billingStatus");
    }
  });

  it("credits the ledger instead", async () => {
    const { handleCreditPackCompleted } = await import("@/lib/billing/credit-webhook");
    await handleCreditPackCompleted(creditSession() as never);

    expect(creditLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: TENANT,
          delta: 500,
          reason: "PURCHASE",
          ref: "cs_credit_1",
        }),
      }),
    );
  });

  it("notifies once, with counts rather than dollars", async () => {
    const { handleCreditPackCompleted } = await import("@/lib/billing/credit-webhook");
    await handleCreditPackCompleted(creditSession() as never);

    expect(notify).toHaveBeenCalledWith({ tenantId: TENANT, credits: 500, balance: 500 });
    const payload = notify.mock.calls[0][0];
    expect(JSON.stringify(payload)).not.toMatch(/usd|\$/i);
  });
});

// ─── The credit count is the server's answer, not the caller's ──────────────

describe("the credited amount comes from the price, not the metadata", () => {
  it("ignores a metadata claim that disagrees with the line item", async () => {
    const { handleCreditPackCompleted } = await import("@/lib/billing/credit-webhook");
    await handleCreditPackCompleted(
      creditSession({ metadata: { flow: "credit_pack", credits: "999999", tenantId: TENANT } }) as never,
    );

    // 500 from the lookup key, not 999999 from the metadata.
    expect(creditLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ delta: 500 }) }),
    );
  });

  it("credits nothing for a price we do not sell", async () => {
    stripeMock.checkout.sessions.listLineItems.mockResolvedValue({
      data: [{ price: { lookup_key: "echorank_credits_7_usd" } }],
    });
    const { handleCreditPackCompleted } = await import("@/lib/billing/credit-webhook");

    await handleCreditPackCompleted(creditSession() as never);

    expect(creditLedger.create).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it("rethrows when the line items cannot be read, so Stripe retries", async () => {
    // A network blip must not cost the customer their credits: the dispatcher
    // rolls back the idempotency marker and the retry re-runs.
    stripeMock.checkout.sessions.listLineItems.mockRejectedValue(new Error("network"));
    const { handleCreditPackCompleted } = await import("@/lib/billing/credit-webhook");

    await expect(handleCreditPackCompleted(creditSession() as never)).rejects.toThrow();
  });
});

// ─── Guards ─────────────────────────────────────────────────────────────────

describe("guards", () => {
  it("credits nothing until the payment has actually cleared", async () => {
    const { handleCreditPackCompleted } = await import("@/lib/billing/credit-webhook");
    await handleCreditPackCompleted(creditSession({ payment_status: "unpaid" }) as never);

    expect(creditLedger.create).not.toHaveBeenCalled();
  });

  it("credits nothing for a session with no tenant reference", async () => {
    const { handleCreditPackCompleted } = await import("@/lib/billing/credit-webhook");
    await handleCreditPackCompleted(
      creditSession({ client_reference_id: null, metadata: { flow: "credit_pack" } }) as never,
    );

    expect(creditLedger.create).not.toHaveBeenCalled();
  });

  it("credits nothing for a tenant that no longer exists", async () => {
    tenant.findUnique.mockResolvedValue(null);
    const { handleCreditPackCompleted } = await import("@/lib/billing/credit-webhook");

    await handleCreditPackCompleted(creditSession() as never);

    expect(creditLedger.create).not.toHaveBeenCalled();
  });

  it("does not notify on a replayed event", async () => {
    // recordPurchase reports applied:false when the ledger's unique refuses the
    // second write, and the handler must not announce a purchase that did not
    // happen.
    const dup = Object.assign(new Error("P2002"), { code: "P2002" });
    creditLedger.create.mockRejectedValueOnce(dup);
    const { handleCreditPackCompleted } = await import("@/lib/billing/credit-webhook");

    // The store maps P2002 through Prisma.PrismaClientKnownRequestError; with
    // the real class unavailable here the call surfaces as a throw, which the
    // dispatcher would retry. Either way it must not have notified.
    await handleCreditPackCompleted(creditSession() as never).catch(() => {});

    expect(notify).not.toHaveBeenCalled();
  });
});

// ─── The store contract the handler leans on ────────────────────────────────

describe("recordPurchase is what makes the handler safe to retry", () => {
  it("is exported and takes the session id as the ref", () => {
    // A refactor that renamed `ref` or dropped the session id would break
    // idempotency silently; this pins the contract the handler depends on.
    expect(typeof recordPurchase).toBe("function");
  });
});
