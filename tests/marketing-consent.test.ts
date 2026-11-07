// Marketing email only with an explicit opt-in, and one-click unsubscribe on
// every marketing email (RFC 8058). Product and billing email are unaffected.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), create: vi.fn() },
  tenant: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  tenantMember: { create: vi.fn() },
  tenantQuota: { create: vi.fn() },
  emailTemplate: { createMany: vi.fn(), create: vi.fn() },
  visibilityAudit: { findFirst: vi.fn() },
  promptRun: { findMany: vi.fn() },
  snapshot: { get: vi.fn() },
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() },
}));
m.log.child.mockReturnValue(m.log);

vi.mock("@/lib/prisma", () => {
  const prisma = {
    user: m.user,
    tenant: m.tenant,
    tenantMember: m.tenantMember,
    tenantQuota: m.tenantQuota,
    emailTemplate: m.emailTemplate,
    visibilityAudit: m.visibilityAudit,
    promptRun: m.promptRun,
    $transaction: async (fn: (tx: unknown) => unknown) => fn(prisma),
  };
  return { prisma };
});
vi.mock("@/infrastructure/observability/logger", () => ({ logger: m.log }));
vi.mock("@/lib/onboarding", async (orig) => ({
  ...(await orig<typeof import("@/lib/onboarding")>()),
  getOnboardingSnapshot: m.snapshot.get,
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => ({ success: true }) }));
vi.mock("@/lib/password", () => ({ hashPassword: async () => "hash" }));
vi.mock("@/lib/i18n/resolve-request-locale", () => ({ resolveRequestLocale: async () => "en" }));
vi.mock("@/lib/onboarding-drip", () => ({ enqueueOnboardingDrip: vi.fn(async () => {}) }));
vi.mock("@/lib/mailer", () => ({ sendMail: vi.fn(async () => true) }));

import {
  oneClickUnsubscribeHeaders,
  unsubscribeToken,
  unsubscribeUrl,
  verifyUnsubscribeToken,
} from "@/lib/email/unsubscribe";
import { UNSUBSCRIBE_COPY } from "@/lib/email/unsubscribe-copy";
import { AUTH_CONTENT } from "@/lib/i18n/auth-content";

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const KEY = "test-auth-secret";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AUTH_SECRET", KEY);
  m.user.findUnique.mockResolvedValue(null);
  m.tenant.findUnique.mockResolvedValue(null);
  m.user.create.mockResolvedValue({ id: "u1" });
  m.tenant.create.mockResolvedValue({ id: "t1" });
});
afterEach(() => vi.unstubAllEnvs());

describe("the unsubscribe token", () => {
  it("round-trips, and refuses a tampered or foreign token", () => {
    const t = unsubscribeToken("tenant_1")!;
    expect(verifyUnsubscribeToken(t)).toBe("tenant_1");
    expect(verifyUnsubscribeToken(t, "other-key")).toBeNull();
    const other = unsubscribeToken("tenant_2")!;
    expect(verifyUnsubscribeToken(`${t.split(".")[0]}.${other.split(".")[1]}`)).toBeNull();
    for (const bad of ["", "x", ".abc", "abc.", null, undefined]) expect(verifyUnsubscribeToken(bad)).toBeNull();
  });

  it("gives the RFC 8058 headers, and none without AUTH_SECRET", () => {
    const h = oneClickUnsubscribeHeaders("tenant_1");
    expect(h["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(h["List-Unsubscribe"]).toBe(`<${unsubscribeUrl("tenant_1")}>`);
    expect(h["List-Unsubscribe"]).toMatch(/^<https:\/\/echorank360\.com\/api\/email\/unsubscribe\?t=/);
    vi.stubEnv("AUTH_SECRET", "");
    expect(oneClickUnsubscribeHeaders("tenant_1")).toEqual({});
  });
});

describe("/api/email/unsubscribe", () => {
  const url = (t: string) => `https://echorank360.com/api/email/unsubscribe?t=${encodeURIComponent(t)}`;

  it("GET shows the button and changes nothing (link scanners)", async () => {
    m.tenant.findUnique.mockResolvedValue({ id: "tenant_1", defaultLanguage: "fr" });
    const { GET } = await import("@/app/api/email/unsubscribe/route");
    const res = await GET(new Request(url(unsubscribeToken("tenant_1")!)));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<form method="post"');
    expect(html).toContain(UNSUBSCRIBE_COPY.fr.button);
    expect(m.tenant.update).not.toHaveBeenCalled();
  });

  it("one-click POST turns marketing off", async () => {
    m.tenant.findUnique.mockResolvedValue({ id: "tenant_1", defaultLanguage: "en" });
    const { POST } = await import("@/app/api/email/unsubscribe/route");
    const res = await POST(
      new Request(url(unsubscribeToken("tenant_1")!), {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "List-Unsubscribe=One-Click",
      }),
    );
    expect(res.status).toBe(200);
    expect(m.tenant.update).toHaveBeenCalledWith({ where: { id: "tenant_1" }, data: { marketingConsent: false } });
  });

  it("a bad token changes nothing", async () => {
    const { POST } = await import("@/app/api/email/unsubscribe/route");
    const res = await POST(new Request(url("forged.token"), { method: "POST" }));
    expect(res.status).toBe(400);
    expect(m.tenant.update).not.toHaveBeenCalled();
  });

  it("the proxy lets it through signed out and without an Origin (exact path only)", () => {
    const proxy = read("src/proxy.ts");
    expect(proxy).toContain('  "/api/email/unsubscribe",\n]);');
    expect(proxy).toContain('pathname !== "/api/email/unsubscribe" &&');
  });
});

describe("signup: the opt-in box", () => {
  const call = async (extra: Record<string, unknown>) => {
    const { POST } = await import("@/app/api/auth/register/route");
    return POST(
      new Request("https://echorank360.com/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "A", email: "a@example.com", password: "password1", businessName: "Acme",
          acceptedTerms: true, country: "US", ...extra,
        }),
      }),
    );
  };

  it("unticked or absent: no marketing", async () => {
    const res = await call({});
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    expect(m.tenant.create.mock.calls[0][0].data).toMatchObject({ marketingConsent: false });
    expect(m.tenant.create.mock.calls[0][0].data.marketingConsentAt).toBeUndefined();
    m.tenant.create.mockClear();
    await call({ marketingConsent: false });
    expect(m.tenant.create.mock.calls[0][0].data).toMatchObject({ marketingConsent: false });
  });

  it("ticked: opted in, with the date and the source", async () => {
    await call({ marketingConsent: true });
    const data = m.tenant.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ marketingConsent: true, marketingConsentSource: "signup" });
    expect(data.marketingConsentAt).toBeInstanceOf(Date);
  });

  it("the form's box starts unticked, is optional, and is in every locale", () => {
    const form = read("src/app/(auth)/register/register-form.tsx");
    expect(form).toContain("useState(false);\n  const [showTerms");
    expect(form).toMatch(/name="marketingConsent"(?![\s\S]*?required[\s\S]*?\{c\.marketingLabel\})/);
    expect(form).toContain("acceptedTerms, country, marketingConsent })");
    for (const [loc, c] of Object.entries(AUTH_CONTENT)) expect(c.register.marketingLabel, loc).toBeTruthy();
    expect(AUTH_CONTENT["de-CH"].register.marketingLabel).not.toContain("ß");
  });

  it("the schema defaults to opted out; the migration keeps only recorded opt-ins", () => {
    const schema = read("prisma/schema.prisma");
    expect(schema).toMatch(/marketingConsent\s+Boolean\s+@default\(false\)\n\s+marketingConsentAt/);
    const sql = read("prisma/migrations/20261122090000_marketing_consent_opt_in/migration.sql");
    expect(sql).toContain('UPDATE "tenants" SET "marketingConsent" = false WHERE "marketingConsentAt" IS NULL;');
  });
});

describe("the onboarding drip (the marketing email)", () => {
  beforeEach(() => {
    m.tenant.findUnique.mockResolvedValue({
      id: "tenant_1", name: "Acme", planType: "GROWTH", billingStatus: "TRIALING", marketingConsent: true,
      defaultLanguage: "en", members: [{ user: { id: "u1", name: "Dana", email: "dana@example.test" } }],
      subscription: null,
    });
    m.visibilityAudit.findFirst.mockResolvedValue(null);
    m.promptRun.findMany.mockResolvedValue([]);
    m.snapshot.get.mockResolvedValue({ completedCount: 0, steps: [] });
  });

  it("carries the one-click headers and the footer link", async () => {
    const { sendOnboardingEmail } = await import("@/lib/onboarding-email");
    const out = await sendOnboardingEmail("tenant_1", "d2");
    if (out.status !== "dry_run") throw new Error(out.status);
    const p = out.payload as { headers: Record<string, string>; params: Record<string, unknown> };
    expect(p.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(p.params.unsubscribeUrl).toBe(unsubscribeUrl("tenant_1"));
  });

  it("is not sent without consent, nor without an unsubscribe link", async () => {
    const { sendOnboardingEmail } = await import("@/lib/onboarding-email");
    m.tenant.findUnique.mockResolvedValueOnce({ ...(await m.tenant.findUnique()), marketingConsent: false });
    expect(await sendOnboardingEmail("tenant_1", "d2")).toEqual({ status: "skipped", reason: "unsubscribed" });
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BREVO_API_KEY", "x");
    vi.stubEnv("AUTH_SECRET", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await sendOnboardingEmail("tenant_1", "d2")).toEqual({ status: "skipped", reason: "no_unsubscribe_link" });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("product and billing email never read marketingConsent", () => {
    for (const f of ["src/lib/billing/trial-ending-email.ts", "src/lib/privacy/deletion.ts", "src/lib/billing/blocked-checkout.ts"]) {
      expect(read(f), f).not.toContain("marketingConsent");
    }
  });
});
