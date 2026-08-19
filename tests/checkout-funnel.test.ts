// tests/checkout-funnel.test.ts
//
// THE FUNNEL, AT THE CHECKOUT ROUTE: register -> checkout -> Stripe.
//
// This file replaces tests/guest-checkout.test.ts, which asserted the opposite
// contract — that an anonymous caller got a Checkout Session and the webhook
// provisioned an account from it. That inversion is reversed; an account always
// exists before Stripe is contacted. The properties worth asserting are the
// ones that fail SILENTLY:
//
//   1. ANONYMOUS GETS 401, AND THE 401 CARRIES THE PLAN. The pricing card turns
//      it into /register?plan=&interval=&checkout=1. Without tier and interval
//      in the body an annual buyer silently restarts on monthly.
//   2. THE CONSENT GATE SITS ABOVE THE AUTH BRANCH. It has to, or the resumed
//      call made after signup is refused — the single most likely bug in this
//      change, and invisible from both ends when it happens.
//   3. THE CARD IS STILL REQUIRED — neither payment_method_collection nor
//      trial_settings appears. Naming either is what makes a Stripe trial
//      card-optional.
//   4. client_reference_id IS ALWAYS STAMPED. It is the only way the webhook
//      can find a tenant that has no Stripe customer id yet, which is every
//      tenant until its first completed checkout.

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
  timestamp: "2026-08-19T00:00:00.000Z",
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
  sessionsCreate.mockResolvedValue({
    id: "cs_test_1",
    url: "https://checkout.stripe.com/c/pay/cs_test_1",
  });
  consentEvent.create.mockResolvedValue({});
  subscription.findUnique.mockResolvedValue(null);
});

// ─── Anonymous is an error again ────────────────────────────────────────────

describe("an anonymous caller is refused, and told enough to recover", () => {
  it("answers 401 rather than creating a guest session", async () => {
    const { POST } = await import("@/app/api/billing/checkout/route");
    const res = await POST(req({ tier: "starter", interval: "month", consent: CONSENT }));

    expect(res.status).toBe(401);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("carries tier AND interval back, so the register hop can resume both", async () => {
    // Losing the interval is the quiet one: an annual buyer restarts on
    // monthly and nothing anywhere reports a problem.
    const { POST } = await import("@/app/api/billing/checkout/route");
    const res = await POST(req({ tier: "growth", interval: "year", consent: CONSENT }));

    expect(await res.json()).toEqual(
      expect.objectContaining({ reason: "unauthenticated", tier: "growth", interval: "year" }),
    );
  });

  it("writes no ConsentEvent for a checkout that never started", async () => {
    const { POST } = await import("@/app/api/billing/checkout/route");
    await POST(req({ tier: "starter", interval: "month", consent: CONSENT }));

    expect(consentEvent.create).not.toHaveBeenCalled();
  });

  it("keeps 401 for the standalone watcher, as it always has", async () => {
    // /watcher's client depends on this to reach
    // /register?plan=watcher_pro&checkout=1. It is now the same 401 every other
    // tier gets rather than a special case.
    const { POST } = await import("@/app/api/billing/checkout/route");
    const res = await POST(req({ tier: "watcher_pro", interval: "month", consent: CONSENT }));

    expect(res.status).toBe(401);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });
});

// ─── The consent gate, and why its position matters ─────────────────────────

describe("consent is checked before the auth branch", () => {
  it("refuses a request with no consent — BEFORE deciding who is asking", async () => {
    // The ordering IS the assertion: a caller with no session and no consent
    // must get consent_required, not unauthenticated. That is what proves the
    // gate is above the auth branch, and therefore that the resumed call made
    // after signup is subject to it too.
    const { POST } = await import("@/app/api/billing/checkout/route");
    const res = await POST(req({ tier: "starter", interval: "month" }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "consent_required" });
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("refuses a stale consent version", async () => {
    // An old tab left open across a version bump must re-consent. This is also
    // what a stale payload carried through registration would hit — hence the
    // register form needing a fallback rather than assuming the resume works.
    const { POST } = await import("@/app/api/billing/checkout/route");
    const res = await POST(
      req({ tier: "starter", interval: "month", consent: { ...CONSENT, version: "2026-01-01" } }),
    );

    expect(res.status).toBe(400);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("refuses when a required document is missing from the payload", async () => {
    const { POST } = await import("@/app/api/billing/checkout/route");
    const res = await POST(
      req({
        tier: "starter",
        interval: "month",
        consent: { ...CONSENT, documents: [CONSENT_DOCUMENT_IDS[0]] },
      }),
    );

    expect(res.status).toBe(400);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });
});

// ─── The signed-in flow: what registration resumes into ─────────────────────

describe("the signed-in checkout", () => {
  beforeEach(() => {
    getCurrentTenant.mockResolvedValue({
      tenant: { id: "tenant_a", stripeCustomerId: "cus_existing" },
    });
    authFn.mockResolvedValue({ user: { id: "user_a", email: "owner@example.com" } });
  });

  it("returns the Stripe url", async () => {
    const { POST } = await import("@/app/api/billing/checkout/route");
    const res = await POST(req({ tier: "starter", interval: "month", consent: CONSENT }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: expect.stringContaining("cs_test_1") });
  });

  it("ALWAYS stamps client_reference_id with the tenant id", async () => {
    // Not conditional any more: there is no anonymous path to omit it on, and
    // a tenant has no stripeCustomerId until its first completed checkout, so
    // this is the only handle the webhook has the first time round.
    const { POST } = await import("@/app/api/billing/checkout/route");
    await POST(req({ tier: "starter", interval: "month", consent: CONSENT }));

    const s = createdSession();
    expect(s.client_reference_id).toBe("tenant_a");
    expect(s.customer).toBe("cus_existing");
  });

  it("stamps flow = upgrade on the session AND the subscription", async () => {
    // subscription_data carries its own copy: the events that arrive later see
    // the subscription's metadata, not the session's.
    const { POST } = await import("@/app/api/billing/checkout/route");
    await POST(req({ tier: "starter", interval: "month", consent: CONSENT }));

    const s = createdSession();
    expect((s.metadata as Record<string, string>).flow).toBe("upgrade");
    const subData = s.subscription_data as { metadata: Record<string, string> };
    expect(subData.metadata.flow).toBe("upgrade");
  });

  it("never stamps guest_signup — that flow no longer exists", async () => {
    const { POST } = await import("@/app/api/billing/checkout/route");
    await POST(req({ tier: "starter", interval: "month", consent: CONSENT }));

    const s = createdSession();
    expect((s.metadata as Record<string, string>).flow).not.toBe("guest_signup");
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

  it("resolves the price by lookup key and never takes an id from the client", async () => {
    const { POST } = await import("@/app/api/billing/checkout/route");
    await POST(
      // A client-supplied price id must be ignored, not honoured.
      req({ tier: "growth", interval: "year", consent: CONSENT, price: "price_attacker" }),
    );

    expect(pricesList).toHaveBeenCalledWith(
      expect.objectContaining({ lookup_keys: [expect.any(String)], active: true }),
    );
    const line = (createdSession().line_items as Array<{ price: string }>)[0];
    expect(line.price).toBe("price_1");
  });

  it("keeps /welcome as the success_url", async () => {
    const { POST } = await import("@/app/api/billing/checkout/route");
    await POST(req({ tier: "starter", interval: "month", locale: "en", consent: CONSENT }));

    expect(createdSession().success_url).toContain("/en/welcome?s=");
  });

  it("writes the ConsentEvent against the real tenant and user", async () => {
    const { POST } = await import("@/app/api/billing/checkout/route");
    await POST(req({ tier: "agency", interval: "year", consent: CONSENT }));

    expect(consentEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant_a",
        userId: "user_a",
        email: "owner@example.com",
        stripeSessionId: "cs_test_1",
        flow: "upgrade",
        plan: "agency",
        interval: "year",
        version: CONSENT_VERSION,
      }),
    });
  });

  it("rejects Enterprise — it stays a contact-us conversation", async () => {
    const { POST } = await import("@/app/api/billing/checkout/route");
    const res = await POST(req({ tier: "enterprise", interval: "month", consent: CONSENT }));

    expect(res.status).toBe(400);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });
});
