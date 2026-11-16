// POST /api/billing/cancel and /api/billing/resume (CANCEL-FAIR-PLAY).
//
// Drives the real route handlers through the real cancellation module, with a
// stateful fake Prisma (two tenants) and a fake Stripe that records every
// update. Stripe is never reached: getStripe is mocked, and the test Stripe
// objects belong to fake customers.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ── fake session ────────────────────────────────────────────────────────────
const getCurrentTenant = vi.fn();
vi.mock("@/lib/tenant", () => ({ getCurrentTenant: () => getCurrentTenant() }));

// ── fake DB ─────────────────────────────────────────────────────────────────
type Row = {
  id: string;
  tenantId: string;
  productKind: "PLAN" | "WATCHER";
  planType: "STARTER" | "NOSY_BAT";
  status: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED";
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
  stripeSubscriptionId: string | null;
};
let subs: Row[] = [];
let tenants: { id: string; billingStatus: string; stripeCustomerId: string | null; defaultLanguage: string; timezone: string }[] = [];
const owners: Record<string, { name: string | null; email: string }> = {};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    subscription: {
      findUnique: async ({ where }: { where: { tenantId: string } }) => {
        const r = subs.find((s) => s.tenantId === where.tenantId);
        return r ? { ...r } : null;
      },
      updateMany: async ({ where, data }: { where: { tenantId: string; stripeSubscriptionId: string }; data: Partial<Row> }) => {
        let count = 0;
        for (const s of subs) {
          if (s.tenantId === where.tenantId && s.stripeSubscriptionId === where.stripeSubscriptionId) {
            Object.assign(s, data);
            count++;
          }
        }
        return { count };
      },
    },
    tenant: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const t = tenants.find((x) => x.id === where.id);
        if (!t) return null;
        const o = owners[t.id];
        return { ...t, members: o ? [{ user: { email: o.email } }] : [] };
      },
    },
    tenantMember: {
      findFirst: async ({ where }: { where: { tenantId: string } }) => {
        const o = owners[where.tenantId];
        return o ? { user: { name: o.name } } : null;
      },
    },
  },
}));

// Redis is not here; the limiter is a switch the 429 test flips.
const rateLimit = vi.fn<(key: string, limit?: number, windowMs?: number) => Promise<{ success: boolean; remaining: number }>>(async () => ({
  success: true,
  remaining: 9,
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: (k: string, l?: number, w?: number) => rateLimit(k, l, w) }));

const createAuditLog = vi.fn(async (entry: Record<string, unknown>) => entry);
vi.mock("@/lib/audit", () => ({ createAuditLog: (e: Record<string, unknown>) => createAuditLog(e) }));

type Mail = { to: string[]; subject: string; text?: string };
const sendMail = vi.fn<(m: Mail) => Promise<boolean>>(async () => true);
let mailConfigured = true;
vi.mock("@/lib/mailer", () => ({
  isEmailConfigured: () => mailConfigured,
  sendMail: (m: { to: string[]; subject: string; text?: string }) => sendMail(m),
}));

// ── fake Stripe ─────────────────────────────────────────────────────────────
const PERIOD_END = Math.floor(Date.parse("2026-11-20T13:18:06Z") / 1000);
type FakeSub = {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end: boolean;
  cancel_at: number | null;
  trial_end: number | null;
  items: { data: { current_period_end: number }[] };
};
let stripeSubs: Record<string, FakeSub> = {};
const retrieve = vi.fn(async (id: string) => {
  const s = stripeSubs[id];
  if (!s) throw new Error(`No such subscription: '${id}'`);
  return { ...s };
});
const update = vi.fn(async (id: string, params: Record<string, unknown>) => {
  const s = stripeSubs[id];
  if ("cancel_at_period_end" in params) {
    s.cancel_at_period_end = params.cancel_at_period_end as boolean;
    s.cancel_at = s.cancel_at_period_end ? s.items.data[0].current_period_end : null;
  }
  if (params.cancel_at === "") s.cancel_at = null;
  return { ...s };
});
vi.mock("@/lib/stripe/client", () => ({
  getStripe: () => ({ subscriptions: { retrieve, update } }),
}));

// ── helpers ─────────────────────────────────────────────────────────────────
function member(tenantId: string, role: "OWNER" | "ADMIN" | "MEMBER" = "OWNER") {
  return { tenantId, userId: `user_${tenantId}_${role}`, role, tenant: { id: tenantId } };
}

function req(path: string, body?: unknown, origin = "https://echorank360.com") {
  return new NextRequest(`https://echorank360.com${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin, host: "echorank360.com" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function cancel(body?: unknown, origin?: string) {
  const { POST } = await import("@/app/api/billing/cancel/route");
  return POST(req("/api/billing/cancel", body, origin));
}
async function resume(origin?: string) {
  const { POST } = await import("@/app/api/billing/resume/route");
  return POST(req("/api/billing/resume", undefined, origin));
}

beforeEach(() => {
  vi.clearAllMocks();
  mailConfigured = true;
  tenants = [
    { id: "tA", billingStatus: "TRIALING", stripeCustomerId: "cus_A", defaultLanguage: "en", timezone: "UTC" },
    { id: "tB", billingStatus: "ACTIVE", stripeCustomerId: "cus_B", defaultLanguage: "fr", timezone: "Europe/Zurich" },
    { id: "tNone", billingStatus: "NONE", stripeCustomerId: null, defaultLanguage: "en", timezone: "UTC" },
  ];
  owners.tA = { name: "Ada Owner", email: "owner-a@example.test" };
  owners.tB = { name: "Bea Owner", email: "owner-b@example.test" };
  delete owners.tNone;
  subs = [
    { id: "rowA", tenantId: "tA", productKind: "PLAN", planType: "NOSY_BAT", status: "TRIALING", cancelAtPeriodEnd: false, currentPeriodEnd: new Date(PERIOD_END * 1000), stripeSubscriptionId: "sub_A" },
    { id: "rowB", tenantId: "tB", productKind: "PLAN", planType: "STARTER", status: "ACTIVE", cancelAtPeriodEnd: false, currentPeriodEnd: new Date(PERIOD_END * 1000), stripeSubscriptionId: "sub_B" },
  ];
  stripeSubs = {
    sub_A: { id: "sub_A", customer: "cus_A", status: "trialing", cancel_at_period_end: false, cancel_at: null, trial_end: PERIOD_END, items: { data: [{ current_period_end: PERIOD_END }] } },
    sub_B: { id: "sub_B", customer: "cus_B", status: "active", cancel_at_period_end: false, cancel_at: null, trial_end: null, items: { data: [{ current_period_end: PERIOD_END }] } },
  };
});

describe("POST /api/billing/cancel", () => {
  it("cancels at period end, with no reason at all (the reason never blocks)", async () => {
    getCurrentTenant.mockResolvedValue(member("tA"));
    const res = await cancel();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, changed: true, state: { cancelAtPeriodEnd: true, trial: true } });
    expect(json.state.periodEnd).toBe("2026-11-20T13:18:06.000Z");
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0]).toEqual(["sub_A", { cancel_at_period_end: true }]);
    expect(subs[0].cancelAtPeriodEnd).toBe(true);
  });

  it("never cancels immediately", async () => {
    getCurrentTenant.mockResolvedValue(member("tB"));
    await cancel({ reason: "too_expensive" });
    const params = update.mock.calls[0][1] as Record<string, unknown>;
    expect(params.cancel_at_period_end).toBe(true);
    expect(params).not.toHaveProperty("cancel_at");
  });

  it("stores the optional reason and note in Stripe and the audit log", async () => {
    getCurrentTenant.mockResolvedValue(member("tB"));
    await cancel({ reason: "switching", note: "  moving to a bundle  " });
    expect(update.mock.calls[0][1]).toEqual({
      cancel_at_period_end: true,
      cancellation_details: { feedback: "switched_service", comment: "moving to a bundle" },
    });
    expect(createAuditLog).toHaveBeenCalledTimes(1);
    expect(createAuditLog.mock.calls[0][0]).toMatchObject({
      tenantId: "tB",
      action: "billing.subscription.cancel",
      entity: "Subscription",
      entityId: "rowB",
      details: { reason: "switching", note: "moving to a bundle", trial: false },
    });
  });

  it("drops an unknown reason instead of refusing", async () => {
    getCurrentTenant.mockResolvedValue(member("tB"));
    const res = await cancel({ reason: "<script>", note: "" });
    expect(res.status).toBe(200);
    expect(update.mock.calls[0][1]).toEqual({ cancel_at_period_end: true });
  });

  it("is idempotent: a second cancel calls Stripe for nothing, audits and emails once", async () => {
    getCurrentTenant.mockResolvedValue(member("tA"));
    expect((await cancel()).status).toBe(200);
    const second = await cancel();
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ ok: true, changed: false, state: { cancelAtPeriodEnd: true } });
    expect(update).toHaveBeenCalledTimes(1);
    expect(createAuditLog).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it("sends the owner a confirmation with the same facts", async () => {
    getCurrentTenant.mockResolvedValue(member("tA", "OWNER"));
    await cancel();
    expect(sendMail).toHaveBeenCalledTimes(1);
    const mail = sendMail.mock.calls[0][0];
    expect(mail.to).toEqual(["owner-a@example.test"]);
    expect(mail.text).toContain("You won't be charged.");
    expect(mail.text).toContain("You keep full access until");
    expect(mail.text).toContain("November 20, 2026");
    expect(mail.text).toMatch(/resume with one click/);
  });

  it("skips the email silently when SMTP is not configured, and still cancels", async () => {
    mailConfigured = false;
    getCurrentTenant.mockResolvedValue(member("tA"));
    const res = await cancel();
    expect(res.status).toBe(200);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("401s a signed-out caller", async () => {
    getCurrentTenant.mockResolvedValue(null);
    expect((await cancel()).status).toBe(401);
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("403s a cross-site POST (CSRF) before reading the session", async () => {
    getCurrentTenant.mockResolvedValue(member("tA"));
    const res = await cancel({}, "https://evil.example");
    expect(res.status).toBe(403);
    expect(getCurrentTenant).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("403s a MEMBER and names the owner who can", async () => {
    getCurrentTenant.mockResolvedValue(member("tA", "MEMBER"));
    const res = await cancel();
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ reason: "role", ownerName: "Ada Owner" });
    expect(retrieve).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("409s, not 500s, a tenant with no subscription row, with its billingStatus", async () => {
    getCurrentTenant.mockResolvedValue(member("tNone"));
    const res = await cancel();
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ reason: "no_subscription", billingStatus: "NONE" });
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("409s a watcher-only row: there is no plan to cancel here", async () => {
    subs[1].productKind = "WATCHER";
    getCurrentTenant.mockResolvedValue(member("tB"));
    const res = await cancel();
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ reason: "no_subscription", billingStatus: "ACTIVE" });
  });

  it("409s a subscription that already ended", async () => {
    subs[0].status = "CANCELED";
    getCurrentTenant.mockResolvedValue(member("tA"));
    const res = await cancel();
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ reason: "ended" });
  });

  it("only ever touches the caller's own subscription (tenant isolation)", async () => {
    getCurrentTenant.mockResolvedValue(member("tB"));
    await cancel();
    expect(retrieve.mock.calls.map((c) => c[0])).toEqual(["sub_B"]);
    expect(update.mock.calls.map((c) => c[0])).toEqual(["sub_B"]);
    expect(subs.find((s) => s.tenantId === "tA")!.cancelAtPeriodEnd).toBe(false);
    expect(stripeSubs.sub_A.cancel_at_period_end).toBe(false);
  });

  it("refuses a row that points at another customer's subscription", async () => {
    // A corrupted row on tenant B naming tenant A's subscription.
    subs[1].stripeSubscriptionId = "sub_A";
    getCurrentTenant.mockResolvedValue(member("tB"));
    const res = await cancel();
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ reason: "subscription_mismatch" });
    expect(update).not.toHaveBeenCalled();
    expect(stripeSubs.sub_A.cancel_at_period_end).toBe(false);
  });

  it("502s when Stripe cannot be reached, changes nothing, and records the failure", async () => {
    getCurrentTenant.mockResolvedValue(member("tB"));
    update.mockRejectedValueOnce(new Error("connection reset"));
    const res = await cancel();
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ reason: "stripe_error", error: expect.any(String) });
    expect(subs[1].cancelAtPeriodEnd).toBe(false);
    expect(createAuditLog).toHaveBeenCalledTimes(1);
    expect(createAuditLog.mock.calls[0][0]).toMatchObject({
      tenantId: "tB",
      action: "billing.subscription.cancel_failed",
      details: { stripeError: "connection reset", when: "period_end" },
    });
  });

  it("403s an ADMIN: cancelling is the OWNER's alone, and the answer names the owner", async () => {
    getCurrentTenant.mockResolvedValue(member("tA", "ADMIN"));
    const res = await cancel();
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ reason: "role", ownerName: "Ada Owner" });
    expect(retrieve).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("takes the tenant from the session only: a tenantId in the body is ignored", async () => {
    getCurrentTenant.mockResolvedValue(member("tA"));
    const res = await cancel({ tenantId: "tB", reason: "switching" });
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0]).toBe("sub_A");
    expect(subs.find((s) => s.tenantId === "tB")!.cancelAtPeriodEnd).toBe(false);
    expect(stripeSubs.sub_B.cancel_at_period_end).toBe(false);
  });

  it("429s past the rate limit, keyed per tenant and user, before touching Stripe", async () => {
    getCurrentTenant.mockResolvedValue(member("tA"));
    rateLimit.mockResolvedValueOnce({ success: false, remaining: 0 });
    const res = await cancel();
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ reason: "rate_limited" });
    expect(rateLimit.mock.calls[0][0]).toBe("billing-action:tA:user_tA_OWNER");
    expect(retrieve).not.toHaveBeenCalled();
    expect(subs[0].cancelAtPeriodEnd).toBe(false);
  });

  it("maps the reasons to Stripe's feedback, the old used_once included", async () => {
    getCurrentTenant.mockResolvedValue(member("tA"));
    await cancel({ reason: "not_using", note: "  seasonal business  " });
    expect(update.mock.calls[0][1]).toMatchObject({
      cancel_at_period_end: true,
      cancellation_details: { feedback: "unused", comment: "seasonal business" },
    });
    getCurrentTenant.mockResolvedValue(member("tB"));
    await cancel({ reason: "used_once" });
    expect(update.mock.calls[1][1]).toMatchObject({ cancellation_details: { feedback: "unused" } });
    expect(createAuditLog.mock.calls[1][0]).toMatchObject({ details: { reason: "not_using" } });
  });
});

describe("POST /api/billing/resume", () => {
  it("resumes a cancelling subscription in one call", async () => {
    getCurrentTenant.mockResolvedValue(member("tB"));
    await cancel();
    const res = await resume();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, changed: true, state: { cancelAtPeriodEnd: false } });
    expect(update.mock.calls[1]).toEqual(["sub_B", { cancel_at_period_end: false }]);
    expect(subs[1].cancelAtPeriodEnd).toBe(false);
    expect(createAuditLog.mock.calls[1][0]).toMatchObject({ action: "billing.subscription.resume" });
  });

  it("clears a bare cancel_at set outside the app", async () => {
    subs[1].cancelAtPeriodEnd = true;
    stripeSubs.sub_B.cancel_at = PERIOD_END;
    getCurrentTenant.mockResolvedValue(member("tB"));
    const res = await resume();
    expect(res.status).toBe(200);
    expect(update.mock.calls[0]).toEqual(["sub_B", { cancel_at: "" }]);
  });

  it("is idempotent: resuming a renewing subscription changes nothing", async () => {
    getCurrentTenant.mockResolvedValue(member("tB"));
    const res = await resume();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ changed: false });
    expect(retrieve).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("409s once the period has ended", async () => {
    subs[1].cancelAtPeriodEnd = true;
    subs[1].currentPeriodEnd = new Date(Date.now() - 60_000);
    getCurrentTenant.mockResolvedValue(member("tB"));
    const res = await resume();
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ reason: "period_ended" });
    expect(update).not.toHaveBeenCalled();
  });

  it("403s a MEMBER and an ADMIN (OWNER only), 403s CSRF, 409s no row", async () => {
    getCurrentTenant.mockResolvedValue(member("tB", "MEMBER"));
    expect((await resume()).status).toBe(403);
    getCurrentTenant.mockResolvedValue(member("tB", "ADMIN"));
    expect((await resume()).status).toBe(403);
    getCurrentTenant.mockResolvedValue(member("tB"));
    expect((await resume("https://evil.example")).status).toBe(403);
    getCurrentTenant.mockResolvedValue(member("tNone"));
    expect((await resume()).status).toBe(409);
    expect(update).not.toHaveBeenCalled();
  });
});
