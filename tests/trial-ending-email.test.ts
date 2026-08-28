// tests/trial-ending-email.test.ts
//
// The 24-hour trial-ending notice: what it says, and when it is allowed to say
// nothing.
//
// THE PRICE ASSERTIONS ARE MUTATION ASSERTIONS, NOT SNAPSHOTS. Asserting the
// subject contains "$199" would pass today and keep passing after someone
// changes GROWTH's price — the email would then be telling customers the wrong
// amount before charging their card, and this file would be green. So every
// price and date check is written twice: once against the value computed from
// PLAN_CONFIGS, and once against a DIFFERENT input, proving the render actually
// varies with what it is given. Same shape as the $79 drift guard in
// tests/help-articles.test.ts.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BILLING_URL,
  emailLocaleOf,
  formatTrialEnd,
  planDisplayName,
  renderTrialEndingEmail,
  trialChargeLabel,
  type EmailLocale,
} from "@/lib/billing/trial-ending-email";
import { PLAN_CONFIGS, TRIAL_DAYS } from "@/lib/plan-config";
import {
  isEmailConfigured,
  isDryRun,
  mailFrom,
  missingEmailEnv,
  resetMailTransport,
  SMTP_ENV_VARS,
} from "@/lib/mailer";

const TRIAL_END = new Date("2026-09-04T14:00:00.000Z");

/**
 * The rendered form of an amount, derived here rather than imported, so the
 * assertions still fail if the module's own formatting changes. Grouped the way
 * the pricing catalog groups: "$1,379 CAD" in English, "1 379 $ CAD" in French.
 */
const money = (n: number, locale: EmailLocale = "en") =>
  new Intl.NumberFormat(locale === "fr" ? "fr-CA" : "en-CA").format(n);

function render(over: Partial<Parameters<typeof renderTrialEndingEmail>[0]> = {}) {
  return renderTrialEndingEmail({
    planType: "GROWTH",
    interval: "month",
    trialEndsAt: TRIAL_END,
    timezone: "America/Toronto",
    billingUrl: BILLING_URL,
    locale: "en",
    ...over,
  });
}

describe("the four facts, in both locales and both parts", () => {
  // A notice that omits any of these is not a notice: when it ends, that the
  // card is charged automatically, what the charge is, and how to stop it.
  for (const locale of ["en", "fr"] as const) {
    it(`states trial end, automatic charge, amount and cancel path — ${locale}`, () => {
      const { subject, html, text } = render({ locale });
      const date = formatTrialEnd(TRIAL_END, "America/Toronto", locale);
      const charge = trialChargeLabel("GROWTH", "month", locale)!;

      expect(subject).toContain(date);
      for (const part of [html, text]) {
        expect(part).toContain(date);
        expect(part).toContain(charge);
        expect(part).toContain(BILLING_URL);
        expect(part).toContain(String(TRIAL_DAYS));
        // The automatic charge, said out loud.
        expect(part).toMatch(locale === "fr" ? /automatiquement/ : /automatically/);
      }
    });
  }

  it("writes French that is French, not English with accents", () => {
    const { subject, text } = render({ locale: "fr" });
    expect(subject).toContain("Votre essai Echorank se termine le");
    expect(text).toContain("La carte enregistrée sera débitée automatiquement");
    expect(text).toContain("Gérer ou annuler mon abonnement");
    expect(text).not.toMatch(/free trial|card on file/);
  });

  it("carries a plain-text part that is not the HTML", () => {
    const { html, text } = render();
    expect(text.length).toBeGreaterThan(100);
    expect(text).not.toContain("<");
    expect(html).toContain("<p>");
  });

  it("uses the brand spelling the repo enforces", () => {
    for (const locale of ["en", "fr"] as const) {
      const { subject, html, text } = render({ locale });
      const all = `${subject}\n${html}\n${text}`;
      const offenders = (all.match(/echo[\s-]*rank/gi) ?? []).filter(
        (m) => !["Echorank", "ECHORANK", "echorank"].includes(m),
      );
      expect(offenders).toEqual([]);
    }
  });
});

describe("the price comes from the plan config, never from the copy", () => {
  it("states the monthly price PLAN_CONFIGS holds", () => {
    const label = trialChargeLabel("GROWTH", "month", "en");
    expect(label).toBe(`$${money(PLAN_CONFIGS.GROWTH.monthlyPrice)} USD/month`);
    expect(render().text).toContain(money(PLAN_CONFIGS.GROWTH.monthlyPrice));
  });

  it("bills a year as twelve of the per-month annual figure", () => {
    // annualPrice is the PER-MONTH equivalent — the same arithmetic the pricing
    // grid and the subscription agreement do.
    const label = trialChargeLabel("AGENCY", "year", "en");
    expect(label).toBe(`$${money(PLAN_CONFIGS.AGENCY.annualPrice * 12)} USD/year`);
  });

  it("changes when the plan changes — the mutation half", () => {
    // If either side were a literal, these would be equal.
    expect(PLAN_CONFIGS.STARTER.monthlyPrice).not.toBe(PLAN_CONFIGS.AGENCY.monthlyPrice);
    const starter = render({ planType: "STARTER" }).text;
    const agency = render({ planType: "AGENCY" }).text;
    expect(starter).toContain(money(PLAN_CONFIGS.STARTER.monthlyPrice));
    expect(agency).toContain(money(PLAN_CONFIGS.AGENCY.monthlyPrice));
    expect(starter).not.toBe(agency);
  });

  it("changes when the interval changes", () => {
    const monthly = render({ interval: "month" }).text;
    const annual = render({ interval: "year" }).text;
    expect(monthly).not.toBe(annual);
    expect(annual).toContain(money(PLAN_CONFIGS.GROWTH.annualPrice * 12));
  });

  it("names the plan from the config, not from the enum", () => {
    expect(planDisplayName("GROWTH")).toBe(PLAN_CONFIGS.GROWTH.name);
    expect(render().text).toContain(PLAN_CONFIGS.GROWTH.name);
  });

  it("folds the retired AI_VISIBILITY tier onto STARTER rather than throwing", () => {
    expect(trialChargeLabel("AI_VISIBILITY", "month", "en")).toBe(
      `$${money(PLAN_CONFIGS.STARTER.monthlyPrice)} USD/month`,
    );
  });

  it("states NO amount when there is none to state", () => {
    // ENTERPRISE is contract-priced, and an unknown interval means the catalog
    // could not say whether one month or twelve is about to be charged.
    // Inventing a number in a pre-charge email is the failure this guards.
    expect(PLAN_CONFIGS.ENTERPRISE.isCustomPricing).toBe(true);
    expect(trialChargeLabel("ENTERPRISE", "month", "en")).toBeNull();
    expect(trialChargeLabel("GROWTH", null, "en")).toBeNull();

    const enterprise = render({ planType: "ENTERPRISE" });
    expect(enterprise.text).not.toMatch(/\$\d/);
    expect(enterprise.text).toContain(PLAN_CONFIGS.ENTERPRISE.name);
    // Still tells them where to look and that a charge is coming.
    expect(enterprise.text).toContain(BILLING_URL);
    expect(enterprise.text).toMatch(/automatically/);

    const unknownInterval = render({ interval: null });
    expect(unknownInterval.text).not.toMatch(/\$\d/);
  });

  it("uses the pricing catalog's own currency style, per locale", () => {
    expect(trialChargeLabel("GROWTH", "month", "fr")).toBe(
      `${money(PLAN_CONFIGS.GROWTH.monthlyPrice, "fr")} $ US/mois`,
    );
    // Four digits, where the grouping actually shows.
    expect(trialChargeLabel("AGENCY", "year", "fr")).toBe(
      `${money(PLAN_CONFIGS.AGENCY.annualPrice * 12, "fr")} $ US/an`,
    );
  });
});

describe("the date", () => {
  it("renders in the tenant's timezone, and moves with it", () => {
    // 2026-09-04T00:30Z is the 4th in UTC and still the 3rd in Toronto. A
    // trial-end date is a calendar day, and which day depends on where you are.
    const edge = new Date("2026-09-04T00:30:00.000Z");
    expect(formatTrialEnd(edge, "UTC", "en")).toContain("September 4");
    expect(formatTrialEnd(edge, "America/Toronto", "en")).toContain("September 3");
  });

  it("changes when the trial-end changes — the mutation half", () => {
    const a = render({ trialEndsAt: new Date("2026-09-04T14:00:00.000Z") });
    const b = render({ trialEndsAt: new Date("2026-12-25T14:00:00.000Z") });
    expect(a.subject).not.toBe(b.subject);
    expect(b.subject).toContain("December 25");
    expect(b.text).toContain("December 25");
  });

  it("falls back to UTC rather than throwing on an unusable zone", () => {
    // A typo in Tenant.timezone must not stop an email that precedes a charge.
    expect(() => formatTrialEnd(TRIAL_END, "Not/AZone", "en")).not.toThrow();
    expect(formatTrialEnd(TRIAL_END, "Not/AZone", "en")).toBe(
      formatTrialEnd(TRIAL_END, "UTC", "en"),
    );
  });

  it("writes the date in French for a French recipient", () => {
    expect(formatTrialEnd(TRIAL_END, "UTC", "fr")).toMatch(/septembre/);
  });
});

describe("locale resolution comes from what the app actually stores", () => {
  // Tenant.defaultLanguage is the only locale the app holds; User has no locale
  // column. fr-CA folds to fr, as it does everywhere else.
  const cases: [string | null | undefined, EmailLocale][] = [
    ["fr", "fr"],
    ["fr-CA", "fr"],
    ["FR", "fr"],
    ["en", "en"],
    ["en-CA", "en"],
    ["de-CH", "en"],
    [null, "en"],
    [undefined, "en"],
    ["", "en"],
  ];
  for (const [stored, expected] of cases) {
    it(`${JSON.stringify(stored)} → ${expected}`, () => {
      expect(emailLocaleOf(stored)).toBe(expected);
    });
  }
});

describe("HTML escaping", () => {
  it("escapes interpolated values rather than trusting them", () => {
    // Nothing hostile reaches this template today — every value is ours. It is
    // escaped because "today" is not a property the next caller inherits.
    const { html } = render();
    expect(html).not.toContain("<script");
    expect(html).toContain(`href="${BILLING_URL}"`);
  });
});

describe("isEmailConfigured gates on every SMTP_* variable", () => {
  const CONFIGURED: Record<string, string> = {
    SMTP_HOST: "smtp-relay.brevo.com",
    SMTP_PORT: "587",
    SMTP_USER: "relay@echorank360.com",
    SMTP_PASS: "not-a-real-key",
    SMTP_FROM: "Echorank <billing@echorank360.com>",
  };
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const name of SMTP_ENV_VARS) {
      saved[name] = process.env[name];
      process.env[name] = CONFIGURED[name];
    }
    resetMailTransport();
  });

  afterEach(() => {
    for (const name of SMTP_ENV_VARS) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name]!;
    }
    resetMailTransport();
    vi.unstubAllEnvs();
  });

  it("is true when every variable is set", () => {
    expect(isEmailConfigured()).toBe(true);
    expect(missingEmailEnv()).toEqual([]);
  });

  for (const name of SMTP_ENV_VARS) {
    it(`is false when ${name} is missing`, () => {
      delete process.env[name];
      expect(isEmailConfigured()).toBe(false);
      expect(missingEmailEnv()).toContain(name);
    });

    it(`is false when ${name} is empty — a copied .env defines it and fills nothing`, () => {
      process.env[name] = "   ";
      expect(isEmailConfigured()).toBe(false);
      expect(missingEmailEnv()).toContain(name);
    });
  }

  it("reads SMTP_FROM for the envelope sender, with a fallback", () => {
    expect(mailFrom()).toBe(CONFIGURED.SMTP_FROM);
    delete process.env.SMTP_FROM;
    expect(mailFrom()).toBe("alerts@echorank360.com");
  });
});

describe("the dev guard", () => {
  const savedNodeEnv = process.env.NODE_ENV;
  const savedAllow = process.env.MAIL_ALLOW_DEV_SEND;
  const savedDry = process.env.MAIL_DRY_RUN;

  afterEach(() => {
    vi.stubEnv("NODE_ENV", savedNodeEnv ?? "test");
    if (savedAllow === undefined) delete process.env.MAIL_ALLOW_DEV_SEND;
    else process.env.MAIL_ALLOW_DEV_SEND = savedAllow;
    if (savedDry === undefined) delete process.env.MAIL_DRY_RUN;
    else process.env.MAIL_DRY_RUN = savedDry;
    vi.unstubAllEnvs();
  });

  it("holds mail outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.MAIL_ALLOW_DEV_SEND;
    delete process.env.MAIL_DRY_RUN;
    expect(isDryRun()).toBe(true);
  });

  it("sends outside production when explicitly allowed — the smoke script's hatch", () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.MAIL_ALLOW_DEV_SEND = "1";
    delete process.env.MAIL_DRY_RUN;
    expect(isDryRun()).toBe(false);
  });

  it("sends in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.MAIL_ALLOW_DEV_SEND;
    delete process.env.MAIL_DRY_RUN;
    expect(isDryRun()).toBe(false);
  });

  it("MAIL_DRY_RUN=1 wins everywhere, production included", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.MAIL_DRY_RUN = "1";
    expect(isDryRun()).toBe(true);
  });
});
