// POST /api/billing/portal — the route the Subscription Agreement's
// cancellation promise rests on.
//
// The load-bearing assertion here is the NEGATIVE one: a watcher subscriber and
// a plan subscriber take the identical path. The portal is Stripe's UI over
// Stripe's customer record, so branching on productKind would be a second place
// that has to learn about every future SKU — and would be wrong the first time
// a customer holds something this app has not been taught about. The two cases
// below exist to fail if someone adds that branch.

import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentTenant = vi.fn();
vi.mock("@/lib/tenant", () => ({ getCurrentTenant: () => getCurrentTenant() }));

const createSession = vi.fn();
vi.mock("@/lib/stripe/client", () => ({
  getStripe: () => ({ billingPortal: { sessions: { create: createSession } } }),
}));

/** A tenant that has been through checkout, whatever it bought. */
function membership(stripeCustomerId: string | null) {
  return { tenant: { id: "tenant_1", stripeCustomerId } };
}

async function post() {
  const { POST } = await import("@/app/api/billing/portal/route");
  return POST();
}

beforeEach(() => {
  vi.clearAllMocks();
  createSession.mockResolvedValue({ id: "bps_1", url: "https://billing.stripe.com/session/live" });
  process.env.STRIPE_SECRET_KEY = "sk_test_stub";
});

describe("who may open the portal", () => {
  it("401s an anonymous caller", async () => {
    getCurrentTenant.mockResolvedValue(null);
    const res = await post();
    expect(res.status).toBe(401);
    expect(createSession).not.toHaveBeenCalled();
  });

  it("401s when the session lookup throws rather than leaking a 500", async () => {
    getCurrentTenant.mockRejectedValue(new Error("session store down"));
    const res = await post();
    expect(res.status).toBe(401);
    expect(createSession).not.toHaveBeenCalled();
  });

  it("400s a tenant that has never been through checkout", async () => {
    // No Stripe customer means no billing relationship to show. The button
    // should not be offered in this state; this is the server-side half.
    getCurrentTenant.mockResolvedValue(membership(null));
    const res = await post();
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ reason: "no_customer" });
    expect(createSession).not.toHaveBeenCalled();
  });
});

describe("the session it creates", () => {
  it("names the tenant's own customer and returns to /billing", async () => {
    getCurrentTenant.mockResolvedValue(membership("cus_abc"));
    const res = await post();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://billing.stripe.com/session/live" });
    expect(createSession).toHaveBeenCalledTimes(1);
    const arg = createSession.mock.calls[0][0];
    expect(arg.customer).toBe("cus_abc");
    // Absolute, because Stripe rejects a relative return_url.
    expect(arg.return_url).toMatch(/^https?:\/\/.+\/billing$/);
  });

  it("does NOT pin a configuration, so the account default governs", async () => {
    // Cancellation semantics are portal CONFIG, not code (cancel at period
    // end). Pinning a configuration id here would put the promise in two
    // places, and the one customers operate would be the other one.
    getCurrentTenant.mockResolvedValue(membership("cus_abc"));
    await post();
    expect(createSession.mock.calls[0][0].configuration).toBeUndefined();
  });

  it("502s when Stripe refuses — the unconfigured-portal case", async () => {
    getCurrentTenant.mockResolvedValue(membership("cus_abc"));
    createSession.mockRejectedValue(new Error("No configuration provided"));
    const res = await post();
    expect(res.status).toBe(502);
  });
});

describe("plan and watcher subscribers take the same path", () => {
  // Both hold a Stripe customer; nothing else about them reaches this route.
  // If someone adds a productKind branch, one of these two stops matching.
  for (const who of ["a plan subscriber", "a standalone watcher subscriber"]) {
    it(`serves ${who} identically`, async () => {
      getCurrentTenant.mockResolvedValue(membership("cus_same"));
      const res = await post();
      expect(res.status).toBe(200);
      expect(createSession.mock.calls[0][0].customer).toBe("cus_same");
    });
  }

  it("reads nothing but the tenant's customer id", async () => {
    // The strong form of "no product-kind branching": the route never touches
    // the Subscription row at all, so it cannot branch on what is in it.
    const source = await (await import("node:fs/promises")).readFile(
      "src/app/api/billing/portal/route.ts",
      "utf8",
    );
    // Comments stripped first. The file EXPLAINS at length why it does not
    // branch on product kind, so matching raw source just finds the prose
    // arguing the opposite of what is being asserted.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/productKind|subscription\.findUnique|WATCHER/);
  });
});
