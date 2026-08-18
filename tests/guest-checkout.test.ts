// tests/guest-checkout.test.ts
//
// THE INVERSION, AT THE CHECKOUT ROUTE.
//
// An anonymous caller used to get 401 and be sent to /register. It now gets a
// Checkout Session, and three properties of that session are what the rest of
// the flow is built on. All three are asserted here because all three are
// silent when wrong:
//
//   1. metadata.flow === "guest_signup". The webhook's three-way dispatch and
//      /welcome's "is this session id a credential?" question both read it. A
//      session without it is provisioned as nothing and confirms as nothing.
//   2. NO client_reference_id. Its presence is how the webhook's upgrade path
//      decides a tenant already exists; an empty string sends it looking for a
//      tenant named "".
//   3. THE CARD IS STILL REQUIRED — neither payment_method_collection nor
//      trial_settings appears. Naming either is what makes a Stripe trial
//      card-optional, and a card-optional guest trial provisions a real account
//      for someone who typed an email and nothing else.
//
// The logged-in upgrade branch is asserted alongside, in the same file, because
// the regression that matters is "the guest branch ate the upgrade branch".

import { beforeEach, describe, expect, it, vi } from "vitest";

const { sessionsCreate, pricesList, consentEvent, subscription, getCurrentTenant, authFn, loggerFns } =
  vi.hoisted(() => ({
    sessionsCreate: vi.fn(),
    pricesList: vi.fn(),
    consentEvent: { create: vi.fn() },
    subscription: { findUnique: vi.fn() },
    getCurrentTenant: vi.fn(),
    authFn: vi.fn(),
    loggerFns: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() },
  }));
loggerFns.child.mockReturnValue(loggerFns);

vi.mock("@/lib/prisma", () => ({ prisma: { consentEvent, subscription } }));
vi.mock("@/infrastructure/observability/logger", () => ({ logger: loggerFns }));
vi.mock("@/lib/stripe/client", () => ({
  getStripe: () => ({
    prices: { list: pricesList },
    checkout: { sessions: { create: sessionsCreate } },
  }),
}));
vi.mock("@/lib/tenant", () => ({ getCurrentTenant }));
vi.mock("@/lib/auth", () => ({ auth: authFn }));

import { CONSENT_DOCUMENT_IDS, CONSENT_VERSION } from "@/lib/consent-config";
import { TRIAL_DAYS } from "@/lib/plan-config";

const CONSENT = {
  accepted: true,
  version: CONSENT_VERSION,
  timestamp: "2026-08-18T00:00:00.000Z",
  documents: [...CONSENT_DOCUMENT_IDS],
};

function req(body: unknown) {
  return { json: async () => body } as never;
}

/** The session argument the route handed Stripe. */
function createdSession() {
  expect(sessionsCreate).toHaveBeenCalledTimes(1);
  return sessionsCreate.mock.calls[0][0] as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentTenant.mockResolvedValue(null);
  authFn.mockResolvedValue(null);
  pricesList.mockResolvedValue({ data: [{ id: "price_1" }] });
  sessionsCreate.mockResolvedValue({ id: "cs_test_guest_1", url: "https://checkout.stripe.com/c/pay/cs_test_guest_1" });
  consentEvent.create.mockResolvedValue({});
  subscription.findUnique.mockResolvedValue(null);
});

// ─── The guest branch ───────────────────────────────────────────────────────

describe("an anonymous caller gets a checkout session, not a 401", () => {
  it("returns the Stripe url", async () => {
    const { POST } = await import("@/app/api/billing/checkout/route");
    const res = await POST(req({ tier: "starter", interval: "month", consent: CONSENT }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: expect.stringContaining("cs_test_guest_1") });
  });

  it("stamps metadata.flow = guest_signup on the session and the subscription", async () => {
    const { POST } = await import("@/app/api/billing/checkout/route");
    await POST(req({ tier: "starter", interval: "month", consent: CONSENT }));

    const s = createdSession();
    expect((s.metadata as Record<string, string>).flow).toBe("guest_signup");
    // subscription_data carries its own copy: the tenant-facing events that
    // arrive later see the subscription's metadata, not the session's.
    const subData = s.subscription_data as { metadata: Record<string, string> };
    expect(subData.metadata.flow).toBe("guest_signup");
  });

  it("omits client_reference_id entirely rather than sending it empty", async () => {
    const { POST } = await import("@/app/api/billing/checkout/route");
    await POST(req({ tier: "growth", interval: "year", consent: CONSENT }));

    const s = createdSession();
    // Absent, not null and not "" — the webhook branches on presence.
    expect("client_reference_id" in s).toBe(false);
  });

  it("leaves the email to Stripe Checkout to collect", async () => {
    const { POST } = await import("@/app/api/billing/checkout/route");
    await POST(req({ tier: "starter", interval: "month", consent: CONSENT }));

    const s = createdSession();
    // The address the account is provisioned under must be the one the buyer
    // actually typed on Stripe's page, so we must not pre-seed it.
    expect("customer_email" in s).toBe(false);
    expect("customer" in s).toBe(false);
  });

  it("REQUIRES THE CARD — no payment_method_collection, no trial_settings", async () => {
    const { POST } = await import("@/app/api/billing/checkout/route");
    await POST(req({ tier: "starter", interval: "month", consent: CONSENT }));

    const s = createdSession();
    // Stripe's default collects the card. Naming EITHER of these is what turns
    // a trial card-optional, so their absence is the assertion.
    expect("payment_method_collection" in s).toBe(false);
    const subData = s.subscription_data as Record<string, unknown>;
    expect("trial_settings" in subData).toBe(false);
    expect(subData.trial_period_days).toBe(TRIAL_DAYS);
  });

  it("records the consent with a null tenant, user and email", async () => {
    const { POST } = await import("@/app/api/billing/checkout/route");
    await POST(req({ tier: "agency", interval: "year", consent: CONSENT }));

    expect(consentEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: null,
        userId: null,
        email: null,
        stripeSessionId: "cs_test_guest_1",
        flow: "guest_signup",
        plan: "agency",
        interval: "year",
        version: CONSENT_VERSION,
      }),
    });
  });

  it("still refuses a guest without valid consent", async () => {
    // The gate sits above the auth branch precisely so the new flow inherits
    // it. If the guest branch were reachable without consent, §8.1 would be
    // satisfied for signed-in buyers only.
    const { POST } = await import("@/app/api/billing/checkout/route");
    const res = await POST(req({ tier: "starter", interval: "month" }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "consent_required" });
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("still refuses a stale consent version", async () => {
    const { POST } = await import("@/app/api/billing/checkout/route");
    const res = await POST(
      req({ tier: "starter", interval: "month", consent: { ...CONSENT, version: "2026-01-01" } }),
    );

    expect(res.status).toBe(400);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("keeps 401 for the standalone watcher, which has no tenant to gate on", async () => {
    // /watcher's client depends on this 401 to reach
    // /register?plan=watcher_pro&checkout=1. The watcher is an entitlement, not
    // a tier: there is no planType to provision a guest tenant with.
    const { POST } = await import("@/app/api/billing/checkout/route");
    const res = await POST(req({ tier: "watcher_pro", interval: "month", consent: CONSENT }));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual(expect.objectContaining({ reason: "unauthenticated" }));
    expect(sessionsCreate).not.toHaveBeenCalled();
  });
});

// ─── The upgrade branch, unchanged ──────────────────────────────────────────

describe("the logged-in upgrade branch is untouched", () => {
  beforeEach(() => {
    getCurrentTenant.mockResolvedValue({
      tenant: { id: "tenant_a", stripeCustomerId: "cus_existing" },
    });
    authFn.mockResolvedValue({ user: { id: "user_a", email: "owner@example.com" } });
  });

  it("still stamps client_reference_id with the tenant id", async () => {
    const { POST } = await import("@/app/api/billing/checkout/route");
    await POST(req({ tier: "starter", interval: "month", consent: CONSENT }));

    const s = createdSession();
    expect(s.client_reference_id).toBe("tenant_a");
    expect(s.customer).toBe("cus_existing");
  });

  it("is stamped flow = upgrade, so /welcome keeps its display-hint contract", async () => {
    const { POST } = await import("@/app/api/billing/checkout/route");
    await POST(req({ tier: "starter", interval: "month", consent: CONSENT }));

    expect((createdSession().metadata as Record<string, string>).flow).toBe("upgrade");
  });

  it("writes the ConsentEvent against the real tenant and user", async () => {
    const { POST } = await import("@/app/api/billing/checkout/route");
    await POST(req({ tier: "starter", interval: "month", consent: CONSENT }));

    expect(consentEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant_a",
        userId: "user_a",
        email: "owner@example.com",
        flow: "upgrade",
      }),
    });
  });

  it("still lets a signed-in tenant with no plan buy the watcher", async () => {
    const { POST } = await import("@/app/api/billing/checkout/route");
    const res = await POST(req({ tier: "watcher_pro", interval: "month", consent: CONSENT }));

    expect(res.status).toBe(200);
    expect(createdSession().client_reference_id).toBe("tenant_a");
  });

  it("still blocks the watcher for a tenant whose plan includes it", async () => {
    subscription.findUnique.mockResolvedValue({ productKind: "PLAN", status: "ACTIVE" });
    const { POST } = await import("@/app/api/billing/checkout/route");
    const res = await POST(req({ tier: "watcher_pro", interval: "month", consent: CONSENT }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(
      expect.objectContaining({ reason: "plan_includes_watcher" }),
    );
  });
});
