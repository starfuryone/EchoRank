// CANCEL-FAIR-PLAY, part 3: cancelling is visible outside Billing too, and
// every surface that describes it describes the in-app flow.

import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

vi.mock("@/app/(dashboard)/settings/account/actions", () => ({
  updateTenantNameAction: async () => ({ status: "idle" }),
  updateRevenueAssumptionsAction: async () => ({ status: "idle" }),
}));
vi.mock("@/components/account/TeamChatSection", () => ({ TeamChatSection: () => null }));
vi.mock("@/components/account/DataRequestsSection", () => ({ DataRequestsSection: () => null }));

import { AccountPageClient } from "@/app/(dashboard)/settings/account/page-client";
import { HELP_ARTICLES } from "@/lib/help-articles";
import { AUTH_CONTENT } from "@/lib/i18n/auth-content";
import { HOME_PRICING_CHROME } from "@/lib/i18n/content";

const ROOT = process.cwd();

function account(cancel: { canManage: boolean; ownerName: string | null } | null) {
  return renderToStaticMarkup(
    createElement(AccountPageClient, {
      locale: "en",
      user: { name: "U", email: "u@example.test" },
      tenant: { name: "T", createdAt: null, planType: "NOSY_BAT", billingStatus: "TRIALING", convRate: 0.1, avgSaleValue: 100 },
      subscription: { planType: "NOSY_BAT", status: "TRIALING" },
      price: { currency: "USD", interval: "month" },
      cancel,
      chat: { eligible: false, existingMxid: null, elementUrl: "" },
    }),
  );
}

describe("/settings/account plan section", () => {
  it("links to the same /billing/cancel page", () => {
    const html = account({ canManage: true, ownerName: null });
    expect(html).toContain('href="/billing/cancel"');
    expect(html).toContain("Cancel subscription");
  });

  it("tells a role that cannot cancel who can, with no link", () => {
    const html = account({ canManage: false, ownerName: "Ada Owner" });
    expect(html).not.toContain('href="/billing/cancel"');
    expect(html).toContain("Only Ada Owner can cancel this subscription.");
  });

  it("shows nothing when there is nothing to cancel", () => {
    expect(account(null)).not.toContain("/billing/cancel");
  });

  it("is decided server-side: a live plan that is not already cancelling", () => {
    const page = readFileSync(join(ROOT, "src/app/(dashboard)/settings/account/page.tsx"), "utf8");
    expect(page).toContain('subscription?.productKind === "PLAN"');
    expect(page).toContain("!subscription.cancelAtPeriodEnd");
    expect(page).toContain("canCancelSubscription(membership.role)");
  });
});

describe("the help article describes this flow", () => {
  const article = HELP_ARTICLES.find((a) => a.slug === "cancel-subscription")!;

  it.each(["en", "fr"] as const)("%s: Billing → Cancel subscription → confirm, Resume, no portal detour", (base) => {
    const copy = article.copy[base];
    const text = JSON.stringify(copy);
    expect(text).not.toMatch(/Manage subscription|Gérer l'abonnement|Gérer l’abonnement/);
    expect(text).not.toMatch(/in the portal|dans le portail/i);
    const cancel = base === "en" ? "Cancel subscription" : "Annuler l'abonnement";
    const resume = base === "en" ? "Resume subscription" : "Reprendre l'abonnement";
    expect(copy.faq.a).toContain(`**${cancel}**`);
    expect(copy.faq.a).toContain(`**${resume}**`);
    expect(text).toContain(resume);
  });

  it("re-cut illustrations show the in-app buttons, not the portal", () => {
    const svg = [2, 3, 4].map((n) => readFileSync(join(ROOT, `public/help/img/cancel-step${n}.svg`), "utf8")).join("\n");
    expect(svg).toContain("Cancel subscription");
    expect(svg).toContain("Resume subscription");
    expect(svg).not.toContain("Manage subscription");
    expect(svg).not.toMatch(/Update plan/);
  });
});

describe("the other surfaces that say how to cancel", () => {
  it("the AI Visibility landing FAQ, every locale", () => {
    const src = readFileSync(join(ROOT, "src/lib/ai-visibility-landing/copy.ts"), "utf8");
    expect(src).not.toMatch(/Manage subscription|Gérer l’abonnement|Abo verwalten/);
    expect(src).toContain("Billing → Cancel subscription, then confirm.");
    expect(src).toContain("Facturation → Annuler l’abonnement, puis confirmez.");
    expect(src).toContain("Abrechnung → Abonnement kündigen, dann bestätigen.");
  });

  it("the de pricing FAQ", () => {
    const src = readFileSync(join(ROOT, "src/lib/pricing-page/faq.ts"), "utf8");
    expect(src).not.toContain("**Abonnement verwalten**");
    expect(src).toContain("**Abonnement kündigen** → bestätigen");
  });

  it("the register trial note says where, in every locale, de-CH with ss", () => {
    const where: Record<string, string> = {
      en: "cancel anytime in Billing",
      "en-CA": "cancel anytime in Billing",
      fr: "annulez à tout moment dans Facturation",
      "fr-CA": "annulez à tout moment dans Facturation",
      "de-CH": "jederzeit kündbar unter Abrechnung",
    };
    for (const [locale, phrase] of Object.entries(where)) {
      const note = AUTH_CONTENT[locale as keyof typeof AUTH_CONTENT].register.trialNote;
      expect(note, locale).toContain(phrase);
      // Said once, not twice ("cancel anytime · … · cancel anytime in Billing").
      expect(note.split(phrase.split(" ")[0]).length - 1, locale).toBe(1);
    }
    expect(AUTH_CONTENT["de-CH"].register.trialNote).not.toContain("ß");
  });

  it("the pricing cards keep the Nov 12 line and do not say it twice", () => {
    // The card's "Cancel anytime" line under the checkout button is the
    // approved wording (tests/pricing-cancel-anytime.dom.test.tsx); the trial
    // line does not repeat it.
    for (const locale of ["en", "en-CA", "fr", "fr-CA", "de-CH"] as const) {
      const c = HOME_PRICING_CHROME[locale];
      expect(c.trialLine.toLowerCase()).not.toContain(c.cancelAnytime.toLowerCase());
    }
  });
});
