// No new customers from the EU/EEA/UK (Switzerland allowed): the one list, signup, the
// checkout refusal in the Stripe webhook, and the email-gated free-tool unlocks.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), create: vi.fn() },
  tenant: { findUnique: vi.fn(), create: vi.fn() },
  tenantMember: { create: vi.fn() },
  tenantQuota: { create: vi.fn() },
  emailTemplate: { createMany: vi.fn(), create: vi.fn() },
  auditLog: { create: vi.fn(), findFirst: vi.fn() },
  stripe: {
    subscriptions: { cancel: vi.fn() },
    refunds: { create: vi.fn() },
    invoicePayments: { list: vi.fn() },
  },
  sendMail: vi.fn(async () => true),
  rateLimit: vi.fn(async () => ({ success: true })),
  snapshot: {
    getSnapshot: vi.fn(),
    unlock: vi.fn(),
    unlockShareOnly: vi.fn(),
  },
  enqueueSnapshotEmail: vi.fn(),
  recordLead: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const prisma = {
    user: m.user,
    tenant: m.tenant,
    tenantMember: m.tenantMember,
    tenantQuota: m.tenantQuota,
    emailTemplate: m.emailTemplate,
    auditLog: m.auditLog,
    $transaction: async (fn: (tx: unknown) => unknown) => fn(prisma),
  };
  return { prisma };
});
vi.mock("@/lib/stripe/client", () => ({ getStripe: () => m.stripe }));
vi.mock("@/lib/mailer", () => ({ sendMail: m.sendMail }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: m.rateLimit }));
vi.mock("@/lib/password", () => ({ hashPassword: async () => "hash" }));
vi.mock("@/lib/i18n/resolve-request-locale", () => ({ resolveRequestLocale: async () => "en" }));
vi.mock("@/lib/onboarding-drip", () => ({ enqueueOnboardingDrip: vi.fn(async () => {}) }));
vi.mock("@/lib/snapshot/store", () => m.snapshot);
vi.mock("@/lib/snapshot/job", () => ({ enqueueSnapshotEmail: m.enqueueSnapshotEmail }));
vi.mock("@/lib/snapshot/limits", () => ({ hashIp: (s: string) => s, takePrefillAllowance: async () => true }));
vi.mock("@/lib/flags", () => ({ flag: () => true }));
vi.mock("@/lib/free-tools/limits", () => ({
  visitorIp: () => "203.0.113.9",
  consumeDailyLimit: async () => ({ ok: true }),
}));
vi.mock("@/lib/site-crawler/free-result", () => ({
  freeCrawlByToken: async () => ({ id: "fc1" }),
  unlockCookie: () => "fc=1",
  recordLead: m.recordLead,
}));

import {
  BLOCKED_COUNTRIES,
  COUNTRY_NOT_AVAILABLE,
  EU_MEMBER_STATES,
  cfCountry,
  isBlockedCountry,
  isSignupCountry,
} from "@/lib/geo/blocked-countries";
import { refuseBlockedCheckout, wasRefusedAtCheckout, BLOCKED_CHECKOUT_ACTION } from "@/lib/billing/blocked-checkout";

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

beforeEach(() => {
  vi.clearAllMocks();
  m.user.findUnique.mockResolvedValue(null);
  m.tenant.findUnique.mockResolvedValue(null);
  m.user.create.mockResolvedValue({ id: "u1" });
  m.tenant.create.mockResolvedValue({ id: "t1" });
  m.stripe.refunds.create.mockImplementation(async (p: { payment_intent?: string }) => ({ amount: p.payment_intent === "pi_pack" ? 1900 : 4900 }));
  m.stripe.invoicePayments.list.mockResolvedValue({ data: [] });
});

describe("the blocked-country list", () => {
  it("is the 27 EU states, IS, LI, NO and GB — and not Switzerland", () => {
    expect(EU_MEMBER_STATES).toHaveLength(27);
    expect(BLOCKED_COUNTRIES.size).toBe(31);
    for (const c of ["FR", "DE", "IE", "PL", "SE", "IS", "LI", "NO", "GB", "gb"]) expect(isBlockedCountry(c), c).toBe(true);
    for (const c of ["CH", "US", "CA", "AU", "JE", "", null, undefined]) expect(isBlockedCountry(c), String(c)).toBe(false);
  });

  it("reads CF-IPCountry, ignoring unknown (XX) and Tor (T1)", () => {
    expect(cfCountry(new Headers({ "cf-ipcountry": "de" }))).toBe("DE");
    expect(cfCountry(new Headers({ "cf-ipcountry": "XX" }))).toBeNull();
    expect(cfCountry(new Headers({ "cf-ipcountry": "T1" }))).toBeNull();
    expect(cfCountry(new Headers())).toBeNull();
  });

  it("the signup list has the blocked ones too (refused with the message), plus CH", () => {
    expect(isSignupCountry("CH")).toBe(true);
    expect(isSignupCountry("FR")).toBe(true);
    expect(isSignupCountry("ZZ")).toBe(false);
    expect(COUNTRY_NOT_AVAILABLE.en).toBe("Echorank isn't available in your country yet.");
    expect(COUNTRY_NOT_AVAILABLE["de-CH"]).not.toContain("ß");
  });
});

describe("signup: POST /api/auth/register", () => {
  const body = (country?: string) => ({
    name: "A", email: "a@example.com", password: "password1", businessName: "Acme", acceptedTerms: true,
    ...(country === undefined ? {} : { country }),
  });
  const call = async (b: unknown, ipCountry?: string) => {
    const { POST } = await import("@/app/api/auth/register/route");
    return POST(new Request("https://echorank360.com/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json", ...(ipCountry ? { "cf-ipcountry": ipCountry } : {}) },
      body: JSON.stringify(b),
    }));
  };

  it("requires a country", async () => {
    expect((await call(body())).status).toBe(400);
    expect((await call(body("ZZ"))).status).toBe(400);
    expect(m.user.create).not.toHaveBeenCalled();
  });

  it.each([["FR", "US"], ["GB", undefined], ["US", "DE"], ["CH", "NO"]])(
    "refuses declared %s / IP %s with the message, writing nothing",
    async (declared, ip) => {
      const res = await call(body(declared), ip);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: COUNTRY_NOT_AVAILABLE.en, code: "COUNTRY_NOT_AVAILABLE" });
      expect(m.user.findUnique).not.toHaveBeenCalled();
      expect(m.user.create).not.toHaveBeenCalled();
      expect(m.tenant.create).not.toHaveBeenCalled();
    },
  );

  it("lets Switzerland (and the rest) through, storing both countries on the tenant", async () => {
    const res = await call(body("ch"), "CH");
    expect(res.status).toBeLessThan(300);
    expect(m.tenant.create.mock.calls[0][0].data).toMatchObject({ signupCountry: "CH", signupIpCountry: "CH" });
    m.tenant.create.mockClear();
    await call(body("US"));
    expect(m.tenant.create.mock.calls[0][0].data).toMatchObject({ signupCountry: "US", signupIpCountry: null });
  });

  it("the form asks for the country, required, and sends it", () => {
    const form = read("src/app/(auth)/register/register-form.tsx");
    expect(form).toMatch(/<select\s+id="country"[^>]*?[\s\S]*?required/);
    expect(form).toContain("acceptedTerms, country, marketingConsent })");
  });

  it("invitations into an existing workspace are not checked (no country on the invite path)", () => {
    expect(read("src/app/api/team/route.ts")).not.toMatch(/isBlockedCountry|cf-ipcountry/i);
  });
});

describe("checkout: the webhook refuses an EU/EEA/UK billing country", () => {
  const session = (over: Record<string, unknown>) =>
    ({
      id: "cs_1", mode: "subscription", subscription: "sub_1", invoice: "in_1", payment_intent: null,
      payment_status: "paid", client_reference_id: "t1", metadata: { locale: "fr" },
      customer_details: { email: "buyer@example.com", address: { country: "FR" } },
      ...over,
    }) as never;

  it("subscription (trial, nothing paid): cancelled now, nothing to refund, emailed, logged", async () => {
    m.tenant.findUnique.mockResolvedValue({ id: "t1" });
    const out = await refuseBlockedCheckout(session({}));
    expect(out).toMatchObject({ refused: true, country: "FR", cancelled: true, refundedCents: 0, emailed: true });
    expect(m.stripe.subscriptions.cancel).toHaveBeenCalledWith("sub_1");
    expect(m.stripe.refunds.create).not.toHaveBeenCalled();
    const mail = (m.sendMail.mock.calls[0] as unknown as [{ to: string[]; subject: string; text: string }])[0];
    expect(mail.to).toEqual(["buyer@example.com"]);
    expect(mail.subject).toBe(COUNTRY_NOT_AVAILABLE.fr);
    expect(m.auditLog.create.mock.calls[0][0].data).toMatchObject({
      tenantId: "t1", action: BLOCKED_CHECKOUT_ACTION, entityId: "sub_1",
      details: { country: "FR", cancelled: true, refundedCents: 0, emailed: true },
    });
    // No email or address in the audit row.
    expect(JSON.stringify(m.auditLog.create.mock.calls[0][0])).not.toContain("buyer@");
  });

  it("subscription charged up front: every paid invoice payment refunded in full", async () => {
    m.stripe.invoicePayments.list.mockResolvedValue({
      data: [{ status: "paid", amount_paid: 4900, payment: { type: "payment_intent", payment_intent: "pi_sub" } }],
    });
    const out = await refuseBlockedCheckout(session({ customer_details: { email: "b@x.io", address: { country: "GB" } } }));
    expect(m.stripe.refunds.create).toHaveBeenCalledWith({ payment_intent: "pi_sub" }, { idempotencyKey: "blocked-country:cs_1:pi_sub" });
    expect(out.refundedCents).toBe(4900);
  });

  it("credit pack (one-off payment): refunded, no subscription to cancel", async () => {
    const out = await refuseBlockedCheckout(
      session({ mode: "payment", subscription: null, invoice: null, payment_intent: "pi_pack", customer_details: { email: "c@x.io", address: { country: "de" } } }),
    );
    expect(m.stripe.subscriptions.cancel).not.toHaveBeenCalled();
    expect(m.stripe.refunds.create).toHaveBeenCalledWith({ payment_intent: "pi_pack" }, expect.anything());
    expect(out).toMatchObject({ refused: true, refundedCents: 1900 });
  });

  it("an allowed country (CH, US) or no address: untouched", async () => {
    for (const country of ["CH", "US", undefined]) {
      const out = await refuseBlockedCheckout(session({ customer_details: { email: "d@x.io", address: country ? { country } : null } }));
      expect(out.refused).toBe(false);
    }
    expect(m.stripe.subscriptions.cancel).not.toHaveBeenCalled();
    expect(m.stripe.refunds.create).not.toHaveBeenCalled();
    expect(m.sendMail).not.toHaveBeenCalled();
    expect(m.auditLog.create).not.toHaveBeenCalled();
  });

  it("a failing step does not stop the others", async () => {
    m.stripe.subscriptions.cancel.mockRejectedValueOnce(new Error("already cancelled"));
    const out = await refuseBlockedCheckout(session({}));
    expect(out.cancelled).toBe(false);
    expect(out.emailed).toBe(true);
  });

  it("a late subscription event for a refused subscription is recognised", async () => {
    m.auditLog.findFirst.mockResolvedValueOnce({ id: "a1" });
    expect(await wasRefusedAtCheckout("t1", "sub_1")).toBe(true);
    expect(m.auditLog.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: "t1", action: BLOCKED_CHECKOUT_ACTION, entityId: "sub_1" } }));
    m.auditLog.findFirst.mockRejectedValueOnce(new Error("db"));
    expect(await wasRefusedAtCheckout("t1", "sub_1")).toBe(false);
  });

  it("the webhook refuses BEFORE the credit-pack and plan arms, and the subscription handler checks it", () => {
    const src = read("src/app/api/webhooks/route.ts");
    const refuse = src.indexOf("if ((await refuseBlockedCheckout(session)).refused) return;");
    expect(refuse).toBeGreaterThan(0);
    expect(refuse).toBeLessThan(src.indexOf("if (isCreditPackSession(session))"));
    expect(src).toMatch(/subscription\.status !== "canceled" && \(await wasRefusedAtCheckout\(tenant\.id, subscription\.id\)\)/);
  });

  it("both checkout routes require the billing address", () => {
    for (const f of ["src/app/api/billing/checkout/route.ts", "src/app/api/billing/credits/checkout/route.ts"]) {
      expect(read(f), f).toContain('billing_address_collection: "required"');
    }
  });
});

describe("free tools stay open; EU/EEA/UK leads are not stored", () => {
  const unlockReq = (country?: string) =>
    new Request("https://echorank360.com/x", {
      method: "POST",
      headers: { "content-type": "application/json", ...(country ? { "cf-ipcountry": country } : {}) },
      body: JSON.stringify({ email: "lead@example.com", consent: true, locale: "en" }),
    });

  it("AI visibility check: a blocked visitor gets the report, no lead row, no email", async () => {
    m.snapshot.getSnapshot.mockResolvedValue({ id: "abcdefghijklmnopqrstu", status: "done", report: { r: 1 } });
    m.snapshot.unlockShareOnly.mockResolvedValue({ token: "tok", expiresAt: new Date("2026-12-01") });
    const { POST } = await import("@/app/api/free/v1/snapshot/[id]/unlock/route");
    const res = await POST(unlockReq("IE"), { params: Promise.resolve({ id: "abcdefghijklmnopqrstu" }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ token: "tok", report: { r: 1 }, emailed: false });
    expect(m.snapshot.unlock).not.toHaveBeenCalled();
    expect(m.enqueueSnapshotEmail).not.toHaveBeenCalled();
  });

  it("AI visibility check: an allowed visitor is stored and emailed as before", async () => {
    m.snapshot.getSnapshot.mockResolvedValue({ id: "abcdefghijklmnopqrstu", status: "done", report: { r: 1 } });
    m.snapshot.unlock.mockResolvedValue({ token: "tok", leadId: "lead1", expiresAt: new Date("2026-12-01") });
    const { POST } = await import("@/app/api/free/v1/snapshot/[id]/unlock/route");
    await POST(unlockReq("CH"), { params: Promise.resolve({ id: "abcdefghijklmnopqrstu" }) });
    expect(m.snapshot.unlock).toHaveBeenCalled();
    expect(m.enqueueSnapshotEmail).toHaveBeenCalledWith("lead1");
  });

  it("site crawler: a blocked visitor is unlocked without recording the lead", async () => {
    const { POST } = await import("@/app/api/free/v1/site-crawler/[token]/unlock/route");
    const blocked = await POST(unlockReq("NL"), { params: Promise.resolve({ token: "t" }) });
    expect(blocked.status).toBe(200);
    expect(blocked.headers.get("set-cookie")).toBe("fc=1");
    expect(m.recordLead).not.toHaveBeenCalled();
    await POST(unlockReq("US"), { params: Promise.resolve({ token: "t" }) });
    expect(m.recordLead).toHaveBeenCalledTimes(1);
  });

  it("the check's page does not say 'sent' when nothing was emailed", () => {
    expect(read("src/components/snapshot/SnapshotCheck.tsx")).toContain("setSent(d.emailed !== false)");
  });
});
