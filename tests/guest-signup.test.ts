// tests/guest-signup.test.ts
//
// The webhook half of the inversion: a completed guest Checkout Session has to
// become a whole account — user, tenant, OWNER membership, quota, Subscription
// row, ConsentEvent — and has to become exactly ONE of each no matter how many
// times Stripe delivers the event.
//
// TWO THINGS ARE UNDER TEST AND THEY ARE DIFFERENT THINGS:
//
//   1. WHERE the branch sits. handleCheckoutCompleted is a three-way dispatch
//      and both early returns exist to keep a session away from
//      `if (subscriptionId ? productKind === "PLAN" : true)`. credit_pack must
//      miss it because it would wrongly GRANT; guest_signup must miss it
//      because, having no client_reference_id, it would wrongly DO NOTHING.
//      Driven through the real POST so the ordering itself is the subject.
//
//   2. WHAT the branch writes, and how it behaves on a replay. The interesting
//      case is not the second delivery of the same event — ProcessedWebhook
//      stops that before the handler runs — but the retry AFTER a throw, when
//      the dispatcher has deleted that marker on purpose.

// NOTE (2026-08-19): the guest-signup FLOW is reversed — the funnel is
// register -> checkout again, and the webhook's guest_signup dispatch arm is
// removed. The dispatch tests below now assert that reversal. The rest of this
// file still exercises src/lib/billing/guest-signup.ts directly; that module is
// unreferenced by the app and is deleted, with this file, in its own commit.

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  tenant,
  user,
  tenantMember,
  tenantQuota,
  subscription,
  consentEvent,
  processedWebhook,
  stripeMock,
  loggerFns,
  txFail,
} = vi.hoisted(() => ({
  tenant: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  user: { findUnique: vi.fn(), create: vi.fn() },
  tenantMember: { create: vi.fn() },
  tenantQuota: { create: vi.fn() },
  subscription: { findUnique: vi.fn(), create: vi.fn(), upsert: vi.fn() },
  consentEvent: { findUnique: vi.fn(), upsert: vi.fn() },
  processedWebhook: { create: vi.fn(), delete: vi.fn() },
  stripeMock: {
    subscriptions: { retrieve: vi.fn(), cancel: vi.fn() },
    checkout: { sessions: { listLineItems: vi.fn() } },
    webhooks: { constructEvent: vi.fn() },
  },
  loggerFns: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() },
  txFail: { value: null as null | unknown },
}));
loggerFns.child.mockReturnValue(loggerFns);

const tx = { tenant, user, tenantMember, tenantQuota, subscription, consentEvent };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant,
    user,
    tenantMember,
    tenantQuota,
    subscription,
    consentEvent,
    processedWebhook,
    creditLedger: { create: vi.fn(), aggregate: vi.fn() },
    $transaction: async (fn: (t: unknown) => Promise<unknown>) => {
      const out = await fn(tx);
      // Lets a test make the COMMIT fail, which is where a concurrent
      // provisioning race actually loses — not on an individual write.
      if (txFail.value) throw txFail.value;
      return out;
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
  quotaEnforcer: { setQuota: vi.fn(), getDefaultQuotas: vi.fn(() => ({})), reset: vi.fn() },
}));
vi.mock("@/lib/billing/trial-notice", () => ({
  cancelTrialEndingNotice: vi.fn(),
  scheduleTrialEndingNotice: vi.fn(),
}));
vi.mock("@/lib/billing/credit-webhook", async (orig) => {
  const real = (await orig()) as Record<string, unknown>;
  return { ...real, handleCreditPackCompleted: vi.fn() };
});

import { CHECKOUT_TIERS, WATCHER_TIER, checkoutLookupKey, planTypeForLookupKey } from "@/lib/stripe/lookup-keys";

const EMAIL = "guest@example.com";
const SESSION_ID = "cs_test_guest_abc123def456";

/** A completed guest Checkout Session, as Stripe sends it. */
function guestSession(over: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    mode: "subscription",
    status: "complete",
    payment_status: "paid",
    client_reference_id: null,
    customer: "cus_guest",
    subscription: "sub_guest",
    customer_email: null,
    customer_details: { email: EMAIL, name: "Dana Reyes" },
    metadata: {
      app: "echorank",
      flow: "guest_signup",
      tier: "starter",
      interval: "month",
      locale: "en",
      consent_version: "2026-08-12",
      consent_ts: "2026-08-18T10:00:00.000Z",
      consent_docs: "subscription_agreement,terms,privacy,cookies",
    },
    ...over,
  };
}

function stripeSubscription(over: Record<string, unknown> = {}) {
  return {
    id: "sub_guest",
    status: "trialing",
    cancel_at_period_end: false,
    trial_end: 1_800_000_000,
    items: {
      data: [
        {
          current_period_start: 1_700_000_000,
          current_period_end: 1_702_000_000,
          price: {
            id: "price_starter_m",
            lookup_key: "echorank_starter_usd_month",
            recurring: { interval: "month" },
          },
        },
      ],
    },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  txFail.value = null;
  consentEvent.findUnique.mockResolvedValue(null);
  consentEvent.upsert.mockResolvedValue({});
  user.findUnique.mockResolvedValue(null);
  user.create.mockResolvedValue({ id: "user_new" });
  tenant.create.mockResolvedValue({ id: "tenant_new" });
  tenant.findUnique.mockResolvedValue(null);
  tenant.findFirst.mockResolvedValue(null);
  tenant.update.mockResolvedValue({ id: "tenant_new" });
  tenantMember.create.mockResolvedValue({});
  tenantQuota.create.mockResolvedValue({});
  subscription.create.mockResolvedValue({});
  subscription.findUnique.mockResolvedValue(null);
  processedWebhook.create.mockResolvedValue({});
  stripeMock.subscriptions.retrieve.mockResolvedValue(stripeSubscription());
});

// ─── 1. Where the branch sits ───────────────────────────────────────────────

describe("the dispatch, driven through the real route", () => {
  async function post(session: Record<string, unknown>, eventId = "evt_1") {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: eventId,
      type: "checkout.session.completed",
      data: { object: session },
    });
    const { POST } = await import("@/app/api/webhooks/route");
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    return POST({
      headers: new Headers({ "stripe-signature": "sig", "x-forwarded-for": "1.2.3.4" }),
      text: async () => "{}",
    } as never);
  }

  // ── THE GUEST ARM IS GONE, AND THIS IS WHAT REPLACED IT ──────────────────
  //
  // The funnel is register -> checkout again, so every session this app creates
  // carries a client_reference_id. A session arriving WITHOUT one is what it
  // was before the inversion: something started outside this app — a payment
  // link, the Stripe dashboard — and the handler warns and returns.
  //
  // PROVISIONING FROM A PAYMENT MUST NOT HAPPEN. That is the whole reversal, so
  // it is asserted directly rather than left to the absence of a branch: no
  // tenant is created, and none is updated either.
  it("provisions NOTHING from a session with no client_reference_id", async () => {
    const res = await post(guestSession());

    // Still 200: Stripe must not retry an event there is nothing to do with.
    expect(res.status).toBe(200);
    expect(tenant.create).not.toHaveBeenCalled();
    expect(tenant.update).not.toHaveBeenCalled();
  });

  it("does not activate a tenant it cannot identify", async () => {
    // With no client_reference_id the lookup falls back to the customer id, and
    // when that finds nothing the handler returns before the billingStatus
    // ternary. Nothing is granted on the strength of a payment alone.
    tenant.findFirst.mockResolvedValue(null);
    await post(guestSession());

    expect(tenant.update).not.toHaveBeenCalled();
  });

  it("still routes a credit_pack session to the credit branch, first", async () => {
    const { handleCreditPackCompleted } = await import("@/lib/billing/credit-webhook");
    await post(
      guestSession({
        mode: "payment",
        subscription: null,
        metadata: { flow: "credit_pack", tenantId: "tenant_a" },
      }),
      "evt_credit",
    );

    expect(handleCreditPackCompleted).toHaveBeenCalledTimes(1);
    expect(tenant.create).not.toHaveBeenCalled();
    expect(tenant.update).not.toHaveBeenCalled();
  });

  it("still routes an upgrade session down the original path", async () => {
    tenant.findUnique.mockResolvedValue({ id: "tenant_a", stripeCustomerId: null });
    await post(
      guestSession({
        client_reference_id: "tenant_a",
        metadata: { flow: "upgrade", tier: "starter", interval: "month" },
      }),
      "evt_upgrade",
    );

    // The pre-inversion behaviour, untouched: it activates the tenant it found.
    expect(tenant.create).not.toHaveBeenCalled();
    expect(tenant.update).toHaveBeenCalledTimes(1);
    expect(tenant.update.mock.calls[0][0].data).toHaveProperty("billingStatus", "ACTIVE");
  });

  it("treats a session with no flow at all as an upgrade, as before", async () => {
    // Sessions created before flow was stamped, and anything made in the Stripe
    // dashboard. They must keep the old behaviour rather than being provisioned.
    tenant.findUnique.mockResolvedValue({ id: "tenant_a", stripeCustomerId: null });
    await post(
      guestSession({ client_reference_id: "tenant_a", metadata: { tier: "starter" } }),
      "evt_noflow",
    );

    expect(tenant.create).not.toHaveBeenCalled();
    expect(tenant.update).toHaveBeenCalledTimes(1);
  });
});

// ─── 2. What it writes ──────────────────────────────────────────────────────

describe("provisioning writes exactly one of everything", () => {
  it("creates the user password-less — that NULL is the single-use marker", async () => {
    const { handleGuestSignupCompleted } = await import("@/lib/billing/guest-signup");
    await handleGuestSignupCompleted(guestSession() as never);

    expect(user.create).toHaveBeenCalledTimes(1);
    const data = user.create.mock.calls[0][0].data;
    expect(data.email).toBe(EMAIL);
    // /welcome may only set a password while this is null; that is what makes
    // the session id single-use without a second table to keep in step.
    expect(data.passwordHash).toBeNull();
    expect(data.termsAcceptedAt).toBeInstanceOf(Date);
  });

  it("creates the tenant on the plan the PRICE names, not the metadata", async () => {
    const { handleGuestSignupCompleted } = await import("@/lib/billing/guest-signup");
    await handleGuestSignupCompleted(
      // Metadata lies: it says starter, the lookup key says agency.
      guestSession({ metadata: { ...guestSession().metadata, tier: "starter" } }) as never,
    );
    expect(tenant.create.mock.calls[0][0].data.planType).toBe("STARTER");

    vi.clearAllMocks();
    tenant.create.mockResolvedValue({ id: "t2" });
    user.create.mockResolvedValue({ id: "u2" });
    user.findUnique.mockResolvedValue(null);
    consentEvent.findUnique.mockResolvedValue(null);
    stripeMock.subscriptions.retrieve.mockResolvedValue(
      stripeSubscription({
        items: {
          data: [
            {
              price: { id: "price_agency_y", lookup_key: "echorank_agency_usd_year", recurring: { interval: "year" } },
            },
          ],
        },
      }),
    );
    await handleGuestSignupCompleted(guestSession() as never);
    expect(tenant.create.mock.calls[0][0].data.planType).toBe("AGENCY");
  });

  it("makes the buyer the OWNER, and meters the tenant from day one", async () => {
    const { handleGuestSignupCompleted } = await import("@/lib/billing/guest-signup");
    await handleGuestSignupCompleted(guestSession() as never);

    expect(tenantMember.create).toHaveBeenCalledTimes(1);
    expect(tenantMember.create.mock.calls[0][0].data).toMatchObject({
      tenantId: "tenant_new",
      userId: "user_new",
      role: "OWNER",
    });
    expect(tenantQuota.create).toHaveBeenCalledTimes(1);
  });

  it("writes the Subscription row requirePaidPlan looks for", async () => {
    // TRIALING is the Prisma default on every tenant ever created, so it is
    // this row — written only because Stripe said so — that lets the gate tell
    // a card-backed trial from the column default. Without it: paywall.
    const { handleGuestSignupCompleted } = await import("@/lib/billing/guest-signup");
    await handleGuestSignupCompleted(guestSession() as never);

    expect(subscription.create).toHaveBeenCalledTimes(1);
    expect(subscription.create.mock.calls[0][0].data).toMatchObject({
      tenantId: "tenant_new",
      planType: "STARTER",
      productKind: "PLAN",
      status: "TRIALING",
      stripeSubscriptionId: "sub_guest",
    });
    expect(tenant.create.mock.calls[0][0].data.billingStatus).toBe("TRIALING");
  });

  it("backfills the ConsentEvent written at checkout — one consent, one row", async () => {
    const { handleGuestSignupCompleted } = await import("@/lib/billing/guest-signup");
    await handleGuestSignupCompleted(guestSession() as never);

    expect(consentEvent.upsert).toHaveBeenCalledTimes(1);
    const call = consentEvent.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ stripeSessionId: SESSION_ID });
    expect(call.update).toEqual({ tenantId: "tenant_new", userId: "user_new", email: EMAIL });
    // ...and can rebuild it from the session metadata if that write never landed.
    expect(call.create).toMatchObject({
      flow: "guest_signup",
      plan: "starter",
      interval: "month",
      version: "2026-08-12",
      documents: ["subscription_agreement", "terms", "privacy", "cookies"],
    });
  });

  it("carries the checkout locale onto the tenant", async () => {
    const { handleGuestSignupCompleted } = await import("@/lib/billing/guest-signup");
    await handleGuestSignupCompleted(
      guestSession({ metadata: { ...guestSession().metadata, locale: "fr-CA" } }) as never,
    );

    expect(tenant.create.mock.calls[0][0].data.defaultLanguage).toBe("fr");
  });

  it("reuses an existing account rather than refusing the purchase", async () => {
    user.findUnique.mockResolvedValue({ id: "user_existing" });
    const { handleGuestSignupCompleted } = await import("@/lib/billing/guest-signup");
    await handleGuestSignupCompleted(guestSession() as never);

    expect(user.create).not.toHaveBeenCalled();
    // They paid for a plan; they get a tenant for it. They cannot set a
    // password through /welcome because theirs is not null.
    expect(tenant.create).toHaveBeenCalledTimes(1);
    expect(tenantMember.create.mock.calls[0][0].data.userId).toBe("user_existing");
  });
});

// ─── 3. Replay and races ────────────────────────────────────────────────────

describe("a replayed delivery provisions nothing twice", () => {
  it("returns early when the ConsentEvent already carries a tenantId", async () => {
    consentEvent.findUnique.mockResolvedValue({ tenantId: "tenant_new" });
    const { handleGuestSignupCompleted } = await import("@/lib/billing/guest-signup");
    await handleGuestSignupCompleted(guestSession() as never);

    for (const m of [user.create, tenant.create, tenantMember.create, subscription.create]) {
      expect(m).not.toHaveBeenCalled();
    }
    expect(consentEvent.upsert).not.toHaveBeenCalled();
  });

  it("survives three deliveries with exactly one of everything", async () => {
    const { handleGuestSignupCompleted } = await import("@/lib/billing/guest-signup");

    await handleGuestSignupCompleted(guestSession() as never);
    // After the first, the row exists — which is what the next two see.
    consentEvent.findUnique.mockResolvedValue({ tenantId: "tenant_new" });
    await handleGuestSignupCompleted(guestSession() as never);
    await handleGuestSignupCompleted(guestSession() as never);

    expect(user.create).toHaveBeenCalledTimes(1);
    expect(tenant.create).toHaveBeenCalledTimes(1);
    expect(tenantMember.create).toHaveBeenCalledTimes(1);
    expect(subscription.create).toHaveBeenCalledTimes(1);
    expect(consentEvent.upsert).toHaveBeenCalledTimes(1);
  });

  it("swallows the unique violation when a concurrent delivery won the race", async () => {
    // The loser must NOT hand Stripe a 500: the work succeeded, just not in
    // this transaction, and a retry storm over it is pure noise.
    txFail.value = { code: "P2002", meta: { target: ["email"] } };
    consentEvent.findUnique
      .mockResolvedValueOnce(null) // the pre-check, before the race is lost
      .mockResolvedValueOnce({ tenantId: "tenant_winner" }); // the re-read after

    const { handleGuestSignupCompleted } = await import("@/lib/billing/guest-signup");
    await expect(handleGuestSignupCompleted(guestSession() as never)).resolves.toBeUndefined();
  });

  it("rethrows a unique violation that was NOT this session's own race", async () => {
    // Nothing provisioned this session, so the collision is somebody else's
    // problem and must reach Stripe as a retry rather than being filed as done.
    txFail.value = { code: "P2002", meta: { target: ["slug"] } };
    consentEvent.findUnique.mockResolvedValue(null);

    const { handleGuestSignupCompleted } = await import("@/lib/billing/guest-signup");
    await expect(handleGuestSignupCompleted(guestSession() as never)).rejects.toMatchObject({
      code: "P2002",
    });
  });

  it("rethrows a Stripe read failure so the dispatcher rolls the marker back", async () => {
    stripeMock.subscriptions.retrieve.mockRejectedValue(new Error("network"));
    const { handleGuestSignupCompleted } = await import("@/lib/billing/guest-signup");

    await expect(handleGuestSignupCompleted(guestSession() as never)).rejects.toThrow("network");
    expect(tenant.create).not.toHaveBeenCalled();
  });
});

// ─── 4. Guards: what must never be provisioned ──────────────────────────────

describe("guards", () => {
  const cases: Array<[string, Record<string, unknown>]> = [
    ["no email to provision under", { customer_details: { email: null }, customer_email: null }],
    ["no subscription on a subscription flow", { subscription: null }],
  ];

  for (const [label, over] of cases) {
    it(`provisions nothing for a session with ${label}`, async () => {
      const { handleGuestSignupCompleted } = await import("@/lib/billing/guest-signup");
      await handleGuestSignupCompleted(guestSession(over) as never);

      expect(user.create).not.toHaveBeenCalled();
      expect(tenant.create).not.toHaveBeenCalled();
    });
  }

  it("provisions nothing for the standalone watcher, which is not a tier", async () => {
    stripeMock.subscriptions.retrieve.mockResolvedValue(
      stripeSubscription({
        items: { data: [{ price: { id: "p_w", lookup_key: "echorank_watcher_pro_usd_month" } }] },
      }),
    );
    const { handleGuestSignupCompleted } = await import("@/lib/billing/guest-signup");
    await handleGuestSignupCompleted(guestSession() as never);

    expect(tenant.create).not.toHaveBeenCalled();
  });

  it("provisions nothing for a price that maps to no plan we sell", async () => {
    stripeMock.subscriptions.retrieve.mockResolvedValue(
      stripeSubscription({
        items: { data: [{ price: { id: "p_x", lookup_key: "echorank_platinum_usd_month" } }] },
      }),
    );
    const { handleGuestSignupCompleted } = await import("@/lib/billing/guest-signup");
    await handleGuestSignupCompleted(guestSession() as never);

    expect(tenant.create).not.toHaveBeenCalled();
  });
});

// ─── 5. The reverse mapping agrees with the forward one ─────────────────────

describe("planTypeForLookupKey is the exact reverse of checkoutLookupKey", () => {
  it("maps every plan tier's keys, and no watcher key", () => {
    for (const tier of CHECKOUT_TIERS) {
      for (const interval of ["month", "year"] as const) {
        const key = checkoutLookupKey(tier, interval);
        const plan = planTypeForLookupKey(key);
        if (tier === WATCHER_TIER) {
          // An entitlement, not a tier: there is no PlanType to provision with.
          expect(plan, `${key} must not resolve to a plan`).toBeNull();
        } else {
          expect(plan, `${key} must resolve to a plan`).toBe(tier.toUpperCase());
        }
      }
    }
  });

  it("returns null rather than guessing for anything unknown", () => {
    for (const k of [null, undefined, "", "echorank_enterprise_usd_month", "price_123"]) {
      expect(planTypeForLookupKey(k)).toBeNull();
    }
  });
});
