// /admin/users and its APIs (staff only). The real allowlist guard
// (src/lib/platform-admin.ts) with a mocked session; a fake Prisma; a stateful
// fake Stripe. Nothing reaches Stripe or a database.
//
//   - not staff → 404 on the page and on both APIs (never 403);
//   - cancel with a Stripe subscription, at period end and now, through
//     cancelTenantSubscription; without one, billingStatus = CANCELED;
//   - every staff cancel writes admin.tenant.cancel (staff email, choice,
//     outcome), and failures are reported, not swallowed;
//   - the CSV: BOM, header, rows, formula guard, filters passed through.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type Row = Record<string, unknown>;

const { state, audits, stripeMock, session } = vi.hoisted(() => ({
  state: {
    tenants: new Map<string, Row>(),
    subs: new Map<string, Row>(),
    members: [] as Row[],
    logins: [] as Row[],
    lastFindMany: null as Row | null,
  },
  audits: [] as Row[],
  stripeMock: { subscriptions: { retrieve: vi.fn(), update: vi.fn(), cancel: vi.fn() } },
  session: { current: null as { user: { id: string; email: string } } | null },
}));

vi.mock("@/lib/auth", () => ({ auth: async () => session.current }));
vi.mock("@/lib/stripe/client", () => ({ getStripe: () => stripeMock }));
vi.mock("@/lib/mailer", () => ({ isEmailConfigured: () => false, sendMail: vi.fn() }));
vi.mock("@/lib/audit", () => ({
  createAuditLog: async (e: Row) => {
    audits.push(e);
    return e;
  },
}));

const tenantView = (id: string) => {
  const t = state.tenants.get(id);
  if (!t) return null;
  return { ...t, subscription: state.subs.get(id) ? { ...state.subs.get(id) } : null, members: [] };
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: {
      findUnique: async ({ where }: { where: { id: string } }) => tenantView(where.id),
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        Object.assign(state.tenants.get(where.id)!, data);
        return tenantView(where.id);
      },
      findMany: async () => [],
    },
    tenantMember: {
      findFirst: async () => ({ user: { name: "Ada Owner" } }),
      count: async () => state.members.length,
      findMany: async (args: Row) => {
        state.lastFindMany = args;
        return state.members.map((m) => ({ ...m, tenant: tenantView(m.tenantId as string) }));
      },
    },
    subscription: {
      findUnique: async ({ where }: { where: { tenantId: string } }) => (state.subs.get(where.tenantId) ? { ...state.subs.get(where.tenantId) } : null),
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        const s = state.subs.get(where.tenantId as string);
        if (s && s.stripeSubscriptionId === where.stripeSubscriptionId) Object.assign(s, data);
        return { count: s ? 1 : 0 };
      },
    },
    loginEvent: {
      groupBy: async () => state.logins,
    },
  },
}));

const STAFF = { user: { id: "u_staff", email: "staff@echorank360.com" } };
const OWNER = { user: { id: "u_owner", email: "owner@tenant.example" } };
const END = 1_900_000_000;
let stripeSub: Row;

function req(path: string, init: { method?: string; body?: unknown; origin?: string } = {}) {
  return new NextRequest(`https://echorank360.com${path}`, {
    method: init.method ?? "GET",
    headers: { "content-type": "application/json", origin: init.origin ?? "https://echorank360.com", host: "echorank360.com" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}
async function cancel(body: unknown, origin?: string) {
  const { POST } = await import("@/app/api/admin/users/cancel/route");
  return POST(req("/api/admin/users/cancel", { method: "POST", body, origin }));
}
async function exportCsv(qs = "") {
  const { GET } = await import("@/app/api/admin/users/export/route");
  return GET(req(`/api/admin/users/export${qs}`));
}

beforeEach(() => {
  vi.stubEnv("PLATFORM_ADMIN_EMAILS", "staff@echorank360.com");
  vi.clearAllMocks();
  audits.length = 0;
  session.current = STAFF;
  state.tenants.clear();
  state.subs.clear();
  state.members.length = 0;
  state.logins.length = 0;
  state.lastFindMany = null;
  // A paying tenant, through Stripe.
  state.tenants.set("t_paid", { id: "t_paid", name: "Paid Co", slug: "paid-co", planType: "GROWTH", billingStatus: "ACTIVE", stripeCustomerId: "cus_paid" });
  state.subs.set("t_paid", {
    id: "row_paid",
    tenantId: "t_paid",
    productKind: "PLAN",
    planType: "GROWTH",
    status: "ACTIVE",
    cancelAtPeriodEnd: false,
    currentPeriodEnd: new Date(END * 1000),
    stripeSubscriptionId: "sub_paid",
  });
  // A plan given by hand: no Stripe subscription.
  state.tenants.set("t_manual", { id: "t_manual", name: "Test Agency", slug: "test-agency", planType: "AGENCY", billingStatus: "ACTIVE", stripeCustomerId: null });
  // Never subscribed.
  state.tenants.set("t_none", { id: "t_none", name: "Free Co", slug: "free-co", planType: "STARTER", billingStatus: "NONE", stripeCustomerId: null });

  stripeSub = {
    id: "sub_paid",
    customer: "cus_paid",
    status: "active",
    cancel_at_period_end: false,
    cancel_at: null,
    trial_end: null,
    items: { data: [{ current_period_end: END }] },
  };
  stripeMock.subscriptions.retrieve.mockImplementation(async () => ({ ...stripeSub }));
  stripeMock.subscriptions.update.mockImplementation(async (_id: string, p: Row) => {
    stripeSub.cancel_at_period_end = p.cancel_at_period_end;
    stripeSub.cancel_at = p.cancel_at_period_end ? END : null;
    return { ...stripeSub };
  });
  stripeMock.subscriptions.cancel.mockImplementation(async () => {
    stripeSub.status = "canceled";
    return { ...stripeSub };
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("not staff: 404, never 403", () => {
  it.each([
    ["signed out", null],
    ["a tenant owner", OWNER],
  ])("%s gets a 404 from the page and from both APIs", async (_label, who) => {
    session.current = who;
    const { default: Page } = await import("@/app/admin/users/page");
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toMatchObject({ digest: expect.stringContaining("404") });

    const c = await cancel({ tenantId: "t_paid", when: "now" });
    expect(c.status).toBe(404);
    expect(await c.json()).toEqual({ error: "not_found" });
    const e = await exportCsv();
    expect(e.status).toBe(404);

    expect(stripeMock.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(state.tenants.get("t_paid")!.billingStatus).toBe("ACTIVE");
    expect(audits).toHaveLength(0);
  });

  it("staff with an unset allowlist are nobody", async () => {
    vi.stubEnv("PLATFORM_ADMIN_EMAILS", "");
    expect((await cancel({ tenantId: "t_paid", when: "now" })).status).toBe(404);
  });

  it("staff reach the page", async () => {
    const { default: Page } = await import("@/app/admin/users/page");
    await expect(Page({ searchParams: Promise.resolve({}) })).resolves.toBeTruthy();
  });
});

describe("POST /api/admin/users/cancel", () => {
  it("at period end, through Stripe: cancel_at_period_end, the new state returned, two audit rows", async () => {
    const res = await cancel({ tenantId: "t_paid", when: "period_end" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, path: "stripe", changed: true, tenant: { tenantId: "t_paid", billingStatus: "ACTIVE", cancelAtPeriodEnd: true } });
    expect(stripeMock.subscriptions.update).toHaveBeenCalledWith("sub_paid", { cancel_at_period_end: true });
    expect(stripeMock.subscriptions.cancel).not.toHaveBeenCalled();
    expect(audits.map((a) => a.action)).toEqual(["billing.subscription.cancel", "admin.tenant.cancel"]);
    expect(audits[0]).toMatchObject({ userId: "u_staff", details: { actor: "platform_admin", adminEmail: "staff@echorank360.com" } });
    expect(audits[1]).toMatchObject({
      tenantId: "t_paid",
      userId: "u_staff",
      entity: "Tenant",
      details: { adminEmail: "staff@echorank360.com", choice: "period_end", path: "stripe", outcome: "changed", stripe: { cancelAtPeriodEnd: true } },
    });
  });

  it("immediately, through Stripe: no proration, no invoice; CANCELED in both tables at once", async () => {
    const res = await cancel({ tenantId: "t_paid", when: "now" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, path: "stripe", tenant: { billingStatus: "CANCELED", subscriptionStatus: "CANCELED" } });
    expect(stripeMock.subscriptions.cancel).toHaveBeenCalledWith("sub_paid", { prorate: false, invoice_now: false });
    expect(state.tenants.get("t_paid")!.billingStatus).toBe("CANCELED");
    expect(state.subs.get("t_paid")).toMatchObject({ status: "CANCELED" });
    expect(audits.map((a) => a.action)).toEqual(["billing.subscription.cancel_now", "admin.tenant.cancel"]);
    expect(audits[1]).toMatchObject({ details: { choice: "now", outcome: "changed" } });
  });

  it("no Stripe subscription: billingStatus = CANCELED in the database, Stripe never called, audited", async () => {
    const res = await cancel({ tenantId: "t_manual", when: "period_end" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, path: "manual", changed: true, tenant: { billingStatus: "CANCELED", hasStripeSubscription: false } });
    expect(state.tenants.get("t_manual")!.billingStatus).toBe("CANCELED");
    expect(stripeMock.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ action: "admin.tenant.cancel", details: { path: "manual", choice: "period_end", before: { billingStatus: "ACTIVE" } } });
  });

  it("nothing to cancel (never subscribed): a 409 that says so, and the attempt is audited", async () => {
    const res = await cancel({ tenantId: "t_none", when: "now" });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ reason: "nothing_to_cancel", error: expect.stringContaining("NONE") });
    expect(state.tenants.get("t_none")!.billingStatus).toBe("NONE");
    expect(audits[0]).toMatchObject({ action: "admin.tenant.cancel", details: { outcome: "refused" } });
  });

  it("a Stripe failure: 502 with the error, nothing mirrored, audited twice", async () => {
    stripeMock.subscriptions.cancel.mockRejectedValueOnce(new Error("api_connection_error"));
    const res = await cancel({ tenantId: "t_paid", when: "now" });
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ reason: "stripe_error", error: expect.any(String) });
    expect(state.tenants.get("t_paid")!.billingStatus).toBe("ACTIVE");
    expect(audits.map((a) => a.action)).toEqual(["billing.subscription.cancel_failed", "admin.tenant.cancel"]);
    expect(audits[1]).toMatchObject({ details: { outcome: "failed", reason: "stripe_error" } });
  });

  it("refuses a bad body (400), an unknown tenant (404) and a cross-site POST (403 CSRF)", async () => {
    expect((await cancel({ tenantId: "t_paid", when: "tomorrow" })).status).toBe(400);
    expect((await cancel({ when: "now" })).status).toBe(400);
    expect((await cancel({ tenantId: "t_gone", when: "now" })).status).toBe(404);
    expect((await cancel({ tenantId: "t_paid", when: "now" }, "https://evil.example")).status).toBe(403);
    expect(stripeMock.subscriptions.cancel).not.toHaveBeenCalled();
  });
});

describe("the users list and its CSV", () => {
  beforeEach(() => {
    state.members.push(
      { id: "m1", role: "OWNER", tenantId: "t_paid", user: { id: "u1", name: "=HYPERLINK(\"http://x\")", email: "ada@paid.example", createdAt: new Date("2026-10-01T00:00:00Z") } },
      { id: "m2", role: "MEMBER", tenantId: "t_manual", user: { id: "u2", name: "Bo", email: "bo@agency.example", createdAt: new Date("2026-09-01T00:00:00Z") } },
    );
    state.logins.push({ userId: "u1", _max: { createdAt: new Date("2026-11-15T10:00:00Z") } });
  });

  it("returns plain rows with the Stripe link, period end and last login", async () => {
    const { listAdminUsers, parseAdminUserFilters } = await import("@/lib/admin/users");
    const { rows, total } = await listAdminUsers(parseAdminUserFilters(new URLSearchParams("q=paid&plan=growth&status=active&page=2")));
    expect(total).toBe(2);
    expect(rows[0]).toMatchObject({
      email: "ada@paid.example",
      tenantName: "Paid Co",
      role: "OWNER",
      plan: "GROWTH",
      billingStatus: "ACTIVE",
      subscriptionStatus: "ACTIVE",
      periodEnd: new Date(END * 1000).toISOString(),
      hasStripeSubscription: true,
      lastLoginAt: "2026-11-15T10:00:00.000Z",
      stripeCustomerUrl: "https://dashboard.stripe.com/customers/cus_paid",
    });
    expect(rows[1]).toMatchObject({ tenantSlug: "test-agency", hasStripeSubscription: false, stripeCustomerUrl: null, lastLoginAt: null });
    // Every value is data: it crosses into the client table as is.
    expect(JSON.parse(JSON.stringify(rows))).toEqual(rows);
    const args = state.lastFindMany as { where: { AND: Row[] }; skip: number; take: number };
    expect(args.skip).toBe(50);
    expect(JSON.stringify(args.where)).toContain('"contains":"paid","mode":"insensitive"');
    expect(args.where.AND).toEqual(expect.arrayContaining([{ tenant: { planType: "GROWTH" } }, { tenant: { billingStatus: "ACTIVE" } }]));
  });

  it("drops unknown filters instead of failing", async () => {
    const { parseAdminUserFilters } = await import("@/lib/admin/users");
    expect(parseAdminUserFilters({ plan: "GOLD", status: "x", page: "-3" })).toEqual({ q: null, plan: null, status: null, page: 1 });
  });

  it("exports CSV through csv-export: BOM, header, rows, formulas defused", async () => {
    const res = await exportCsv("?plan=GROWTH");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="echorank-admin-users-\d{4}-\d{2}-\d{2}\.csv"$/);
    // Response.text() would decode the BOM away; the bytes keep it.
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const lines = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes).slice(1).split("\r\n");
    expect(lines[0]).toBe(
      "Name,Email,Tenant,Tenant slug,Tenant ID,Role,Plan,Billing status,Subscription status,Cancel at period end,Trial end / period end,Created,Last login,Stripe customer,Stripe dashboard",
    );
    expect(lines[1]).toContain("ada@paid.example");
    expect(lines[1]).toContain("https://dashboard.stripe.com/customers/cus_paid");
    expect(lines[1].startsWith('"\'=HYPERLINK')).toBe(true);
    expect(lines[2]).toContain("bo@agency.example");
    expect(JSON.stringify((state.lastFindMany as { where: Row }).where)).toContain('"planType":"GROWTH"');
  });
});
