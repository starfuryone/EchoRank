// The onboarding drip's emails are HTML kept in the repo and sent as
// htmlContent through Brevo's transactional endpoint (2026-11-14). Nothing
// depends on a template stored in Brevo, which holds none.
//
// Every email: a "See your plan" button (planUrl, falling back to
// https://echorank360.com/plan), the ECHORANK™ wordmark, "Cancel anytime", and
// the footer (unsubscribe, privacy, terms, the company email line from
// src/lib/brand/company.ts). A service email: no promotion in any of them.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { tenant, visibilityAudit, promptRun, snapshot, loggerFns } = vi.hoisted(() => ({
  tenant: { findUnique: vi.fn() },
  visibilityAudit: { findFirst: vi.fn() },
  promptRun: { findMany: vi.fn() },
  snapshot: { get: vi.fn() },
  loggerFns: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() },
}));
loggerFns.child.mockReturnValue(loggerFns);
vi.mock("@/lib/prisma", () => ({ prisma: { tenant, visibilityAudit, promptRun } }));
vi.mock("@/lib/onboarding", () => ({ getOnboardingSnapshot: snapshot.get }));
vi.mock("@/infrastructure/observability/logger", () => ({ logger: loggerFns }));

import { COMPANY_EMAIL_LINE, COMPANY_LINE } from "@/lib/brand/company";
import { HOME_PRICING_CHROME } from "@/lib/i18n/content";
import { ONBOARDING_SENDER, sendOnboardingEmail } from "@/lib/onboarding-email";
import {
  PLAN_URL_FALLBACK,
  renderOnboardingEmail,
  type OnboardingLocale,
  type OnboardingParams,
  type OnboardingStage,
} from "@/lib/onboarding-email-render";

const STAGES: OnboardingStage[] = ["d0", "d2", "d5", "d10"];
const LOCALES: OnboardingLocale[] = ["en", "fr"];
const SEE_PLAN: Record<OnboardingLocale, string> = { en: "See your plan", fr: "Voir votre forfait" };
const escAmp = (s: string) => s.replace(/&/g, "&amp;");

const PARAMS: OnboardingParams = {
  firstName: "Dana",
  brand: "Acme Dental",
  hasScore: true,
  score: 62,
  grade: "C",
  topFixTitle: "Structured data",
  topFixAction: "Add LocalBusiness schema to your home page.",
  visibilityUrl: "https://echorank360.com/visibility",
  dashboardUrl: "https://echorank360.com/dashboard",
  planUrl: "https://echorank360.com/plan",
  unsubscribeUrl: "https://echorank360.com/api/email/unsubscribe?t=abc",
  hasDoneCount: true,
  doneCount: 2,
  totalCount: 5,
  nextStepLabel: "Add 3 tracked prompts",
  nextStepUrl: "https://echorank360.com/visibility",
  hasCompetitors: true,
  competitorNames: "Bright Smiles, Tooth Co",
  isGrowthPlus: false,
  ctaUrl: "https://echorank360.com/visibility",
  planName: "Growth",
  billingUrl: "https://echorank360.com/billing",
};

describe("every stage, every locale", () => {
  for (const stage of STAGES) {
    for (const locale of LOCALES) {
      it(`${stage} ${locale}`, () => {
        const { subject, html, text } = renderOnboardingEmail(stage, locale, PARAMS);
        expect(subject.length).toBeGreaterThan(5);
        // "See your plan" → planUrl
        expect(html).toMatch(new RegExp(`<a href="${PARAMS.planUrl}"[^>]*>${SEE_PLAN[locale]}</a>`));
        expect(text).toContain(`${SEE_PLAN[locale]}: ${PARAMS.planUrl}`);
        // The ECHORANK™ wordmark
        expect(html).toContain(">ECHORANK</span>");
        expect(html).toContain("&trade;");
        // Cancel anytime, from the pricing cards' source
        expect(html).toContain(escAmp(HOME_PRICING_CHROME[locale].cancelAnytime));
        expect(text).toContain(HOME_PRICING_CHROME[locale].cancelAnytime);
        // The footer: unsubscribe, privacy, terms, the company email line
        expect(html).toContain(`href="${escAmp(PARAMS.unsubscribeUrl!)}"`);
        expect(html).toContain(`https://echorank360.com/${locale}/legal/privacy`);
        expect(html).toContain(`https://echorank360.com/${locale}/legal/terms`);
        expect(html).toContain(escAmp(COMPANY_EMAIL_LINE));
        expect(text).toContain(COMPANY_EMAIL_LINE);
        expect(html).not.toContain(escAmp(COMPANY_LINE));
        // No template syntax left for Brevo to fill, and no camel-case brand
        expect(html).not.toMatch(/\{\{|\{%/);
        expect(html + text + subject).not.toMatch(/EchoRank|Echo Rank/);
        // A service email: no upgrade pitch, no offer, no link to buy
        expect(html + text + subject).not.toMatch(/upgrade|mise à niveau|discount|réduction|offer|offre|% off|included from|incluse à partir/i);
        expect(html).not.toContain("/billing\"");
      });
    }
  }
});

describe("See your plan falls back to https://echorank360.com/plan", () => {
  it.each([undefined, null, "", "javascript:alert(1)", "/plan"])("planUrl = %s", (planUrl) => {
    const { html, text } = renderOnboardingEmail("d0", "en", { ...PARAMS, planUrl });
    expect(PLAN_URL_FALLBACK).toBe("https://echorank360.com/plan");
    expect(html).toContain(`<a href="${PLAN_URL_FALLBACK}"`);
    expect(text).toContain(`See your plan: ${PLAN_URL_FALLBACK}`);
  });
});

describe("content", () => {
  it("escapes what the database supplies", () => {
    const { html } = renderOnboardingEmail("d0", "en", { ...PARAMS, brand: `<img src=x onerror=alert(1)>`, firstName: `"Dana"` });
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("Hi &quot;Dana&quot;,");
  });

  it("renders no number without its has* flag", () => {
    const { html } = renderOnboardingEmail("d0", "en", { ...PARAMS, hasScore: false });
    expect(html).not.toContain("62/100");
    expect(html).toContain("Run my first audit");
    const d2 = renderOnboardingEmail("d2", "en", { ...PARAMS, hasDoneCount: false });
    expect(d2.html).not.toContain("2 of 5");
  });

  it("the company line is the one company.ts holds, word for word", () => {
    expect(COMPANY_EMAIL_LINE).toBe(
      "ChatLogic Insights Ltd · Registered in England & Wales No. 15593166 · Registered office: 82a James Carter Road, Mildenhall, IP28 7DE, United Kingdom · US mailing address: 1321 Upland Dr. PMB 10673, Houston, TX 77043, US",
    );
    const src = readFileSync(join(process.cwd(), "src/lib/onboarding-email-render.ts"), "utf8");
    expect(src).not.toContain("Upland");
    expect(src).not.toContain("Mildenhall");
    expect(src).not.toContain("15593166");
  });

  it("d5 without competitor intelligence points at the tenant's own results, never an upgrade", () => {
    for (const locale of LOCALES) {
      const { html, text } = renderOnboardingEmail("d5", locale, PARAMS);
      expect(html).toContain(`<a href="${PARAMS.visibilityUrl}"`);
      expect(text).not.toMatch(/billing|forfait (Growth|Agency)/i);
    }
    expect(renderOnboardingEmail("d5", "en", PARAMS).html).toContain("See your AI Visibility results");
    const plus = renderOnboardingEmail("d5", "en", { ...PARAMS, isGrowthPlus: true, ctaUrl: "https://echorank360.com/intelligence/competitors" });
    expect(plus.html).toContain('<a href="https://echorank360.com/intelligence/competitors"');
    expect(plus.html).toContain("Compare with competitors");
  });

  it("d10 is a recap with no date", () => {
    const { html } = renderOnboardingEmail("d10", "en", PARAMS);
    expect(html).toContain("Setup: 2 of 5 steps done.");
    expect(html).toContain("Your Growth plan carries on after the trial");
    expect(html).not.toMatch(/trial (ends|runs until)/);
  });
});

describe("the send: htmlContent through the same transactional endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tenant.findUnique.mockResolvedValue({
      // No marketing consent: the drip is a service email and goes out anyway.
      id: "tenant_1", name: "Acme Dental", planType: "STARTER", billingStatus: "TRIALING", marketingConsent: false,
      onboardingEmailsOptedOutAt: null, defaultLanguage: "fr", members: [{ user: { id: "u1", name: "Dana Reyes", email: "dana@example.test" } }],
      subscription: null,
    });
    visibilityAudit.findFirst.mockResolvedValue({ score: 62, grade: "C", checks: [] });
    promptRun.findMany.mockResolvedValue([]);
    snapshot.get.mockResolvedValue({ completedCount: 0, steps: [{ key: "first_audit", done: false, href: "/visibility" }] });
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ONBOARDING_EMAIL_DRY_RUN", "");
    vi.stubEnv("BREVO_API_KEY", "test-key");
    vi.stubEnv("AUTH_SECRET", "test-secret");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it.each(STAGES)("%s posts rendered HTML, no template id, and needs no BREVO_ONBOARDING_* env", async (stage) => {
    for (const k of Object.keys(process.env)) if (k.startsWith("BREVO_ONBOARDING_")) vi.stubEnv(k, "");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 201 }));
    const out = await sendOnboardingEmail("tenant_1", stage);
    expect(out).toEqual({ status: "sent" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body).not.toHaveProperty("templateId");
    expect(body).not.toHaveProperty("params");
    expect(body.sender).toEqual(ONBOARDING_SENDER);
    expect(body.to).toEqual([{ email: "dana@example.test", name: "Dana Reyes" }]);
    expect(body.subject.length).toBeGreaterThan(5);
    expect(body.htmlContent).toContain(`<a href="https://echorank360.com/plan"`);
    expect(body.htmlContent).toContain("Voir votre forfait");
    expect(body.textContent).toContain("https://echorank360.com/plan");
    expect(body.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    // Its own list: the link stops onboarding email, not marketing consent.
    expect(body.headers["List-Unsubscribe"]).toMatch(/\/api\/email\/unsubscribe\?t=[^>]+&l=onboarding>$/);
    expect(body.htmlContent).toContain("&amp;l=onboarding");
  });

  it("a Brevo refusal still throws, so BullMQ retries", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("bad", { status: 400 }));
    await expect(sendOnboardingEmail("tenant_1", "d0")).rejects.toThrow(/Brevo send failed \(400\)/);
  });

  it("the sender no longer reads a template id", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/onboarding-email.ts"), "utf8");
    expect(src).not.toContain("templateId");
    expect(src).not.toMatch(/process\.env\[[^\]]*BREVO_ONBOARDING|`BREVO_ONBOARDING_\$\{/);
    expect(src).toContain("htmlContent: email.html");
  });
});
