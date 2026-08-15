// tests/credits-checkout.route.test.ts
//
// The credit-pack checkout route: the pack guard, the session shape the webhook
// depends on, and the ConsentEvent row.
//
// THE CONSENT ROW IS THE REASON THIS FILE EXISTS. There is no modal and no
// gate on a one-time payment, so nothing on screen would break if the row
// stopped being written — it would simply stop existing, and nobody would find
// out until someone asked for a compliance log. §8.1 requires consent "before
// starting a trial or completing any purchase or plan change"; this is what
// makes that true for packs, so it is asserted rather than trusted.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaFns, stripeMock, authFns, loggerFns } = vi.hoisted(() => ({
  prismaFns: { consentEvent: { create: vi.fn() } },
  stripeMock: {
    prices: { list: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
  },
  authFns: { auth: vi.fn(), getCurrentTenant: vi.fn() },
  loggerFns: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  },
}));
loggerFns.child.mockReturnValue(loggerFns);

vi.mock("@/lib/prisma", () => ({ prisma: prismaFns }));
vi.mock("@/lib/stripe/client", () => ({ getStripe: () => stripeMock }));
vi.mock("@/lib/auth", () => ({ auth: authFns.auth }));
vi.mock("@/lib/tenant", () => ({ getCurrentTenant: authFns.getCurrentTenant }));
vi.mock("@/infrastructure/observability/logger", () => ({ logger: loggerFns }));

import { CREDIT_PACKS, creditPackLookupKey } from "@/lib/credit-packs";
import { CONSENT_VERSION } from "@/lib/consent-config";

const TENANT = "tenant_a";
const USER = "user_1";
const PACK = CREDIT_PACKS[0].credits;

function post(body: unknown) {
  return new Request("https://echorank360.com/api/billing/credits/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  authFns.getCurrentTenant.mockResolvedValue({
    tenantId: TENANT,
    tenant: { id: TENANT, stripeCustomerId: "cus_1", planType: "AGENCY" },
  });
  authFns.auth.mockResolvedValue({ user: { id: USER, email: "buyer@example.com" } });
  stripeMock.prices.list.mockResolvedValue({ data: [{ id: "price_1" }] });
  stripeMock.checkout.sessions.create.mockResolvedValue({
    id: "cs_1",
    url: "https://checkout.stripe.com/c/pay/cs_1",
  });
  prismaFns.consentEvent.create.mockResolvedValue({});
});

// ─── The consent record ─────────────────────────────────────────────────────

describe("the ConsentEvent row", () => {
  it("is written for every completed checkout start", async () => {
    const { POST } = await import("@/app/api/billing/credits/checkout/route");
    await POST(post({ credits: PACK, locale: "en" }));

    expect(prismaFns.consentEvent.create).toHaveBeenCalledTimes(1);
  });

  it("records the session id, so a retry cannot write a second row", async () => {
    // ConsentEvent.stripeSessionId is @unique — one row per act of consent.
    const { POST } = await import("@/app/api/billing/credits/checkout/route");
    await POST(post({ credits: PACK, locale: "en" }));

    const { data } = prismaFns.consentEvent.create.mock.calls[0][0];
    expect(data.stripeSessionId).toBe("cs_1");
  });

  it("records who consented, not just which tenant", async () => {
    // §8.2 names the user id as part of a consent record.
    const { POST } = await import("@/app/api/billing/credits/checkout/route");
    await POST(post({ credits: PACK, locale: "en" }));

    const { data } = prismaFns.consentEvent.create.mock.calls[0][0];
    expect(data.tenantId).toBe(TENANT);
    expect(data.userId).toBe(USER);
    expect(data.email).toBe("buyer@example.com");
  });

  it("records ONLY the two documents the page actually shows", async () => {
    // The buy buttons carry a Terms + Privacy line. Recording the Subscription
    // Agreement as well would assert the buyer saw something they did not,
    // which is worse than a thinner log.
    const { POST } = await import("@/app/api/billing/credits/checkout/route");
    await POST(post({ credits: PACK, locale: "en" }));

    const { data } = prismaFns.consentEvent.create.mock.calls[0][0];
    expect(data.documents).toEqual(["terms", "privacy"]);
  });

  it("names the pack and marks it one-time, rather than leaving them blank", async () => {
    const { POST } = await import("@/app/api/billing/credits/checkout/route");
    await POST(post({ credits: PACK, locale: "en" }));

    const { data } = prismaFns.consentEvent.create.mock.calls[0][0];
    expect(data.plan).toBe(`credits_${PACK}`);
    expect(data.interval).toBe("one_time");
    expect(data.flow).toBe("credit_pack");
    expect(data.version).toBe(CONSENT_VERSION);
  });

  it("does NOT fail the checkout when the row cannot be written", async () => {
    // The buyer has a valid session. Losing the log is an alert, not a reason
    // to refuse a paying customer.
    prismaFns.consentEvent.create.mockRejectedValue(new Error("db down"));
    const { POST } = await import("@/app/api/billing/credits/checkout/route");

    const res = await POST(post({ credits: PACK, locale: "en" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://checkout.stripe.com/c/pay/cs_1" });
    expect(loggerFns.error).toHaveBeenCalled();
  });

  it("writes nothing when checkout never started", async () => {
    stripeMock.prices.list.mockResolvedValue({ data: [] });
    const { POST } = await import("@/app/api/billing/credits/checkout/route");

    const res = await POST(post({ credits: PACK, locale: "en" }));

    expect(res.status).toBe(404);
    expect(prismaFns.consentEvent.create).not.toHaveBeenCalled();
  });
});

// ─── The session the webhook depends on ─────────────────────────────────────

describe("the checkout session", () => {
  it("is mode=payment and carries the flow the webhook branches on", async () => {
    const { POST } = await import("@/app/api/billing/credits/checkout/route");
    await POST(post({ credits: PACK, locale: "en" }));

    const args = stripeMock.checkout.sessions.create.mock.calls[0][0];
    expect(args.mode).toBe("payment");
    expect(args.metadata.flow).toBe("credit_pack");
    // Without this the webhook cannot find a tenant that has no Stripe customer.
    expect(args.client_reference_id).toBe(TENANT);
    // The shared live account requires it on everything we create.
    expect(args.metadata.app).toBe("echorank");
  });

  it("resolves the price live by lookup key and never hardcodes an id", async () => {
    const { POST } = await import("@/app/api/billing/credits/checkout/route");
    await POST(post({ credits: PACK, locale: "en" }));

    expect(stripeMock.prices.list).toHaveBeenCalledWith({
      lookup_keys: [creditPackLookupKey(PACK)],
      active: true,
      limit: 1,
    });
  });
});

// ─── Guards ─────────────────────────────────────────────────────────────────

describe("guards", () => {
  it("refuses a pack size we do not sell", async () => {
    const { POST } = await import("@/app/api/billing/credits/checkout/route");
    const res = await POST(post({ credits: 999999, locale: "en" }));

    expect(res.status).toBe(400);
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("401s an anonymous caller, carrying the pack back for the login redirect", async () => {
    authFns.getCurrentTenant.mockResolvedValue(null);
    const { POST } = await import("@/app/api/billing/credits/checkout/route");

    const res = await POST(post({ credits: PACK, locale: "en" }));

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ reason: "unauthenticated", credits: PACK });
  });

  it("sells to a sub-Agency tenant rather than refusing them", async () => {
    // Money accepted, never misleading: /credits tells them the tool that
    // spends lookups is not on their plan, and the credits do not expire.
    authFns.getCurrentTenant.mockResolvedValue({
      tenantId: TENANT,
      tenant: { id: TENANT, stripeCustomerId: null, planType: "STARTER" },
    });
    const { POST } = await import("@/app/api/billing/credits/checkout/route");

    const res = await POST(post({ credits: PACK, locale: "en" }));

    expect(res.status).toBe(200);
  });
});
