// /welcome as the post-checkout handoff (PLAN-HUB Part 1). Stripe is mocked:
// nothing here reaches the network.
//
//   own verified session        → state (a) ready, or (b) pending
//   webhook late                → (b), then ready once the status flips
//   timeout                     → (c)
//   another tenant / garbage /
//   incomplete / logged out     → the generic state, nothing leaked
//   credit pack                 → back to /credits, never the plan hub
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

const m = vi.hoisted(() => ({
  retrieve: vi.fn(),
  billing: vi.fn(),
  auth: vi.fn(),
  currentTenant: vi.fn(),
  requireTenant: vi.fn(),
  tenantFind: vi.fn(),
  subFind: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/stripe/client", () => ({ getStripe: () => ({ checkout: { sessions: { retrieve: m.retrieve } } }) }));
vi.mock("@/lib/paid-plan", async (orig) => ({
  ...(await orig<typeof import("@/lib/paid-plan")>()),
  getBillingContext: m.billing,
}));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/tenant", () => ({ getCurrentTenant: m.currentTenant, requireTenant: m.requireTenant }));
vi.mock("@/lib/billing/guest-welcome", () => ({ resolveGuestSession: async () => ({ kind: "invalid" }) }));
vi.mock("@/lib/prisma", () => ({ prisma: { tenant: { findUnique: m.tenantFind }, subscription: { findUnique: m.subFind } } }));
vi.mock("next/navigation", async (orig) => ({
  ...(await orig<typeof import("next/navigation")>()),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/en/welcome",
}));

import { conversionOf, resolveHandoff, sessionBelongsTo } from "@/lib/billing/checkout-handoff";
import { HANDOFF_MAX_ATTEMPTS, handoffReady, pollUntilReady, type BillingStatusBody } from "@/lib/billing/handoff-poll";

const TENANT = { tenantId: "t_own", planType: "STARTER" as const, stripeCustomerId: "cus_own" };

function session(over: Record<string, unknown> = {}) {
  return {
    id: "cs_test_own",
    status: "complete",
    mode: "subscription",
    client_reference_id: "t_own",
    customer: "cus_own",
    currency: "usd",
    amount_total: 0,
    metadata: { app: "echorank", flow: "upgrade", tier: "starter" },
    subscription: { status: "trialing", metadata: { tier: "starter" }, items: { data: [{ price: { unit_amount: 7800 } }] } },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.billing.mockResolvedValue({ status: "NONE", hasSubscriptionRow: false, watcherOnly: false, needsPlanSelection: true });
});

describe("resolveHandoff", () => {
  it("own verified session, webhook already in → ready (state a)", async () => {
    m.retrieve.mockResolvedValue(session());
    m.billing.mockResolvedValue({ status: "TRIALING", hasSubscriptionRow: true, watcherOnly: false, needsPlanSelection: false });
    expect(await resolveHandoff("cs_test_own", TENANT)).toMatchObject({ kind: "ready", plan: "STARTER" });
  });

  it("own verified session, webhook late → pending (state b)", async () => {
    m.retrieve.mockResolvedValue(session());
    expect(await resolveHandoff("cs_test_own", TENANT)).toMatchObject({ kind: "pending", plan: "STARTER" });
  });

  it("the default planType STARTER is not 'already on Starter' while the status says NONE", async () => {
    m.retrieve.mockResolvedValue(session());
    m.billing.mockResolvedValue({ status: "TRIALING", hasSubscriptionRow: false, watcherOnly: false, needsPlanSelection: false });
    // TRIALING without a Stripe row is the legacy column default, not a trial.
    expect((await resolveHandoff("cs_test_own", TENANT)).kind).toBe("pending");
  });

  it("matches on the Stripe customer when client_reference_id is absent", async () => {
    m.retrieve.mockResolvedValue(session({ client_reference_id: null }));
    expect((await resolveHandoff("cs_test_own", TENANT)).kind).toBe("pending");
  });

  it("another tenant's session → generic", async () => {
    m.retrieve.mockResolvedValue(session({ client_reference_id: "t_other", customer: "cus_other" }));
    expect(await resolveHandoff("cs_test_other", TENANT)).toEqual({ kind: "generic" });
  });

  it("an incomplete session → generic", async () => {
    m.retrieve.mockResolvedValue(session({ status: "open" }));
    expect(await resolveHandoff("cs_test_own", TENANT)).toEqual({ kind: "generic" });
  });

  it("a garbage or expired id → generic, and Stripe is not asked about a non-cs_ id", async () => {
    expect(await resolveHandoff("garbage", TENANT)).toEqual({ kind: "generic" });
    expect(m.retrieve).not.toHaveBeenCalled();
    m.retrieve.mockRejectedValue(new Error("No such checkout.session: cs_live_secretdetail"));
    expect(await resolveHandoff("cs_live_secretdetail", TENANT)).toEqual({ kind: "generic" });
  });

  it("logged out → generic, without calling Stripe", async () => {
    expect(await resolveHandoff("cs_test_own", null)).toEqual({ kind: "generic" });
    expect(m.retrieve).not.toHaveBeenCalled();
  });

  it("a credit-pack session → credits, never the plan hub", async () => {
    m.retrieve.mockResolvedValue(session({ mode: "payment", metadata: { flow: "credit_pack" }, subscription: null }));
    expect(await resolveHandoff("cs_test_own", TENANT)).toEqual({ kind: "credits", sessionId: "cs_test_own" });
  });

  it("sessionBelongsTo needs a match, not just presence", () => {
    expect(sessionBelongsTo(session({ client_reference_id: null, customer: null }) as never, TENANT)).toBe(false);
    expect(sessionBelongsTo(session({ client_reference_id: null }) as never, { ...TENANT, stripeCustomerId: null })).toBe(false);
  });
});

describe("conversionOf (GA4)", () => {
  it("a trial reports trial_start at the subscription's own price", () => {
    expect(conversionOf(session() as never)).toEqual({ event: "trial_start", value: 78, currency: "USD", transactionId: "cs_test_own" });
  });
  it("a paid checkout reports purchase at amount_total", () => {
    expect(conversionOf(session({ amount_total: 6240, subscription: null }) as never)).toEqual({
      event: "purchase", value: 62.4, currency: "USD", transactionId: "cs_test_own",
    });
  });
});

describe("the wait (state b → a, or c)", () => {
  const status = (over: Partial<BillingStatusBody>): BillingStatusBody => ({
    planType: "STARTER", billingStatus: "NONE", trialEnd: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, ...over,
  });

  it("is ready on ACTIVE, or TRIALING with a trial end, for the bought plan only", () => {
    expect(handoffReady(status({ billingStatus: "ACTIVE" }), "STARTER")).toBe(true);
    expect(handoffReady(status({ billingStatus: "TRIALING", trialEnd: "2026-11-21T00:00:00Z" }), "STARTER")).toBe(true);
    expect(handoffReady(status({ billingStatus: "TRIALING" }), "STARTER")).toBe(false);
    expect(handoffReady(status({ billingStatus: "ACTIVE" }), "GROWTH")).toBe(false);
  });

  it("flips to ready when the webhook lands, every 2 s", async () => {
    const replies = [null, status({}), status({ billingStatus: "TRIALING", trialEnd: "2026-11-21T00:00:00Z" })];
    const sleeps: number[] = [];
    const out = await pollUntilReady({
      plan: "STARTER",
      fetchStatus: async () => replies.shift() ?? null,
      sleep: async (ms) => void sleeps.push(ms),
    });
    expect(out).toBe("ready");
    expect(sleeps).toEqual([2000, 2000]);
  });

  it("times out after ~60 s (30 polls), and a failed fetch does not end the wait early", async () => {
    let calls = 0;
    const out = await pollUntilReady({
      plan: "STARTER",
      fetchStatus: async () => {
        calls++;
        if (calls % 2) throw new Error("network");
        return status({});
      },
      sleep: async () => {},
    });
    expect(out).toBe("timeout");
    expect(calls).toBe(HANDOFF_MAX_ATTEMPTS);
    expect(HANDOFF_MAX_ATTEMPTS * 2).toBe(60);
  });
});

describe("the page", () => {
  const render = async (s?: string) => {
    const { default: WelcomePage } = await import("@/app/[locale]/welcome/page");
    return renderToStaticMarkup((await WelcomePage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve(s ? { s } : {}),
    })) as ReactElement);
  };
  const redirectOf = async (s: string) => {
    try {
      await render(s);
    } catch (e) {
      return String((e as { digest?: string }).digest ?? e);
    }
    return null;
  };

  it("logged out → the generic state, linking to sign-in with /plan as the way back", async () => {
    m.auth.mockResolvedValue(null);
    const html = await render("cs_test_own");
    expect(html).toContain('data-testid="welcome-generic"');
    expect(html).toContain("Thanks. Sign in to see your plan.");
    expect(html).toContain('href="/login?callbackUrl=%2Fplan"');
    expect(m.retrieve).not.toHaveBeenCalled();
  });

  it("another tenant's session renders the very same generic state, no Stripe detail", async () => {
    m.auth.mockResolvedValue({ user: { id: "u1" } });
    m.currentTenant.mockResolvedValue({ tenantId: "t_own", tenant: { planType: "STARTER", stripeCustomerId: "cus_own" } });
    m.retrieve.mockRejectedValue(new Error("No such checkout.session: cs_test_x; request_id=req_123"));
    const html = await render("cs_test_x");
    expect(html).toContain('data-testid="welcome-generic"');
    expect(html).not.toMatch(/No such|req_123|cs_test_x/);
  });

  it("state (b) renders 'Payment confirmed. Setting up your Starter…'", async () => {
    m.auth.mockResolvedValue({ user: { id: "u1" } });
    m.currentTenant.mockResolvedValue({ tenantId: "t_own", tenant: { planType: "STARTER", stripeCustomerId: "cus_own" } });
    m.retrieve.mockResolvedValue(session());
    const html = await render("cs_test_own");
    expect(html).toContain('data-testid="welcome-pending"');
    expect(html).toContain("Payment confirmed. Setting up your Starter…");
  });

  it("state (a) without a conversion to report redirects to /plan?welcome=1 at once", async () => {
    m.auth.mockResolvedValue({ user: { id: "u1" } });
    m.currentTenant.mockResolvedValue({ tenantId: "t_own", tenant: { planType: "STARTER", stripeCustomerId: "cus_own" } });
    m.retrieve.mockResolvedValue(session({ currency: null }));
    m.billing.mockResolvedValue({ status: "ACTIVE", hasSubscriptionRow: true, watcherOnly: false, needsPlanSelection: false });
    expect(await redirectOf("cs_test_own")).toContain("/plan?welcome=1");
  });

  it("a credit-pack session goes back to /credits", async () => {
    m.auth.mockResolvedValue({ user: { id: "u1" } });
    m.currentTenant.mockResolvedValue({ tenantId: "t_own", tenant: { planType: "STARTER", stripeCustomerId: "cus_own" } });
    m.retrieve.mockResolvedValue(session({ mode: "payment", metadata: { flow: "credit_pack" }, subscription: null }));
    expect(await redirectOf("cs_test_own")).toContain("/en/credits?purchased=cs_test_own");
  });
});

describe("GET /api/billing/status", () => {
  it("answers for the session's tenant only, with five fields", async () => {
    m.requireTenant.mockResolvedValue({ tenantId: "t_own" });
    m.tenantFind.mockResolvedValue({ planType: "GROWTH" });
    m.billing.mockResolvedValue({ status: "TRIALING", hasSubscriptionRow: true, watcherOnly: false, needsPlanSelection: false });
    m.subFind.mockResolvedValue({ productKind: "PLAN", status: "TRIALING", currentPeriodEnd: new Date("2026-11-21T00:00:00Z"), cancelAtPeriodEnd: false });
    const { GET } = await import("@/app/api/billing/status/route");
    const body = await (await GET()).json();
    expect(Object.keys(body).sort()).toEqual(["billingStatus", "cancelAtPeriodEnd", "currentPeriodEnd", "planType", "trialEnd"]);
    expect(body).toMatchObject({ planType: "GROWTH", billingStatus: "TRIALING", trialEnd: "2026-11-21T00:00:00.000Z" });
    expect(m.tenantFind).toHaveBeenCalledWith({ where: { id: "t_own" }, select: { planType: true } });
    expect(m.subFind.mock.calls[0][0].where).toEqual({ tenantId: "t_own" });
    expect(m.billing).toHaveBeenCalledWith("t_own");
  });

  it("takes no tenant from the request, and is 401 without a session", async () => {
    const src = (await import("node:fs")).readFileSync("src/app/api/billing/status/route.ts", "utf8");
    // The handler takes no request at all, so no id can come from it.
    expect(src).toContain("export async function GET() {");
    m.requireTenant.mockRejectedValue(new Error("Not authenticated or no tenant access"));
    const { GET } = await import("@/app/api/billing/status/route");
    expect((await GET()).status).toBe(401);
  });
});
