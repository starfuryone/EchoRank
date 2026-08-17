/**
 * @vitest-environment jsdom
 */
// The pricing grid AS RENDERED, in both locales and both billing intervals.
//
// The invariant suite (pricing-card-invariants.test.ts) proves the bullets are
// derived from the right config fields. This one proves they survive the trip
// to the DOM — that the real tier data, the real chrome and the real component
// put the expected line-up on screen, that the monthly/annual toggle changes
// only the price, and that the things this change was told not to disturb
// (ConsentGate, the struck anchor price, the tools footer) are still there.
//
// Rendered rather than asserted on source text because a card that renders
// nothing still passes a grep.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { PricingSection } from "@/app/[locale]/PricingSection";
import { pricingTiers } from "@/lib/pricing-tiers";
import { HOME_PRICING_CHROME } from "@/lib/i18n/content";
import { SEO_TOOL_GROUPS } from "@/lib/seo-tools";
import { PLAN_CONFIGS } from "@/lib/plan-config";
import type { Locale } from "@/lib/i18n/config";

vi.stubGlobal("fetch", vi.fn());
afterEach(cleanup);

const liveToolCount = SEO_TOOL_GROUPS.flatMap((g) => g.tools).length;

function renderGrid(locale: Locale) {
  return render(
    <PricingSection
      locale={locale}
      pricing={pricingTiers(locale)}
      priceChrome={HOME_PRICING_CHROME[locale]}
      liveToolCount={liveToolCount}
      tax="tax line"
      currency="currency line"
      header={null}
    />,
  );
}

/** The <div> for one tier, found by its uppercased name. */
function card(name: string): HTMLElement {
  const label = screen.getByText(`/ ${name}`);
  return label.parentElement as HTMLElement;
}

/** Every <li> in a card, as text. */
function bullets(name: string): string[] {
  return within(card(name))
    .getAllByRole("listitem")
    .map((li) => li.textContent ?? "");
}

// ─── The line-ups, on screen ────────────────────────────────────────────────

describe("the rendered card line-ups", () => {
  it("renders three cards and no fourth — Enterprise stays cardless", () => {
    renderGrid("en");
    expect(screen.getByText("/ STARTER")).toBeTruthy();
    expect(screen.getByText("/ GROWTH")).toBeTruthy();
    expect(screen.getByText("/ AGENCY")).toBeTruthy();
    expect(screen.queryByText("/ ENTERPRISE")).toBeNull();
  });

  it("puts STARTER's whole line-up on screen, in order", () => {
    renderGrid("en");
    expect(bullets("STARTER")).toEqual([
      "1 location",
      "AI answer tracking across 2 AI engines (weekly)",
      "AI Trust Score",
      "Lost-recommendation alerts",
      "500 feedback requests/month",
      "Email review requests",
      "250 SEO searches + 25 tracked keywords/mo",
      "5 domain analyses/mo — 75+ AI-tested opportunities (AI Keyword Opportunity Finder)",
      "Site crawls up to 500 URLs",
      "Review authenticity verification",
      "Email support — 48h weekday response",
    ]);
  });

  it("puts GROWTH's whole line-up on screen, in order", () => {
    renderGrid("en");
    expect(bullets("GROWTH")).toEqual([
      "5 locations",
      "AI answer tracking across 4 AI engines (2×/week)",
      "5,000 feedback requests/month",
      "Email + SMS channels",
      "AI risk scoring & sentiment analysis",
      "Recovery tickets & workflows",
      "Escalation prediction",
      "1,000 SEO searches + 100 tracked keywords/mo",
      "25 domain analyses/mo",
      "Site crawls up to 5,000 URLs",
      "Advanced analytics",
      "Priority support — email, 24h weekday response",
    ]);
  });

  it("puts AGENCY's whole line-up on screen, in order", () => {
    renderGrid("en");
    expect(bullets("AGENCY")).toEqual([
      "25 locations",
      "AI answer tracking across all AI engines (daily)",
      "15,000 feedback requests/month",
      "White-label dashboard",
      "Client management",
      "Custom domain support",
      "Full API access",
      "5,000 SEO searches + 500 tracked keywords/mo",
      "55 domain analyses/mo",
      "Site crawls up to 25,000 URLs",
      "All AI features",
      "Priority support — email, 24h weekday response",
    ]);
  });
});

// ─── French ─────────────────────────────────────────────────────────────────

describe("the French grid", () => {
  it("renders French bullets, not English ones", () => {
    renderGrid("fr");
    expect(bullets("STARTER")).toEqual([
      "1 emplacement",
      "Suivi des réponses IA sur 2 moteurs IA (hebdomadaire)",
      "Score de confiance IA",
      "Alertes de perte de recommandation",
      "500 demandes de rétroaction/mois",
      "Demandes d'avis par courriel",
      "250 recherches SEO + 25 mots-clés suivis/mois",
      "5 analyses de domaine/mois — plus de 75 occasions testées par IA (Détecteur d'occasions IA)",
      "Analyses de site jusqu'à 500 URL",
      "Vérification de l'authenticité des avis",
      "Soutien par courriel — réponse en 48 h les jours ouvrables",
    ]);
  });

  it("carries no English bullet on any French card", () => {
    renderGrid("fr");
    const all = ["STARTER", "GROWTH", "AGENCY"].flatMap(bullets).join(" ");
    for (const english of [
      "location",
      "feedback requests",
      "SEO searches",
      "Site crawls",
      "support —",
      "domain analyses",
    ]) {
      expect(all, `English "${english}" leaked onto a French card`).not.toContain(english);
    }
  });

  it("uses French chrome around the French cards", () => {
    renderGrid("fr");
    expect(screen.getByText("Mensuel")).toBeTruthy();
    expect(screen.getByText("Annuel")).toBeTruthy();
  });
});

// ─── The toggle ─────────────────────────────────────────────────────────────

describe("the monthly / annual toggle", () => {
  it("shows monthly prices first, with no struck anchor", () => {
    renderGrid("en");
    expect(within(card("STARTER")).getByText(/\$79/)).toBeTruthy();
    expect(card("STARTER").querySelector("s")).toBeNull();
  });

  it("switches to annual prices and strikes the monthly one through", () => {
    renderGrid("en");
    fireEvent.click(screen.getByText("Annual"));

    const starter = card("STARTER");
    expect(within(starter).getByText(/\$63/)).toBeTruthy();
    // The anchor is the REAL monthly price, struck beside the annual rate.
    const struck = starter.querySelector("s");
    expect(struck?.textContent).toBe("$79");
    expect(within(starter).getByText("billed annually")).toBeTruthy();
    expect(within(starter).getByText("save 20%")).toBeTruthy();
  });

  it("leaves the bullets untouched when the interval changes", () => {
    // The line-up describes the plan, not the billing period. A toggle that
    // edited it would be selling two different products at two prices.
    renderGrid("en");
    const monthly = bullets("GROWTH");
    fireEvent.click(screen.getByText("Annual"));
    expect(bullets("GROWTH")).toEqual(monthly);
  });

  it("prices every card from PLAN_CONFIGS, at both intervals", () => {
    renderGrid("en");
    for (const plan of ["STARTER", "GROWTH", "AGENCY"] as const) {
      const re = new RegExp(`\\$${PLAN_CONFIGS[plan].monthlyPrice}`);
      expect(within(card(plan)).getByText(re), `${plan} monthly`).toBeTruthy();
    }
    fireEvent.click(screen.getByText("Annual"));
    for (const plan of ["STARTER", "GROWTH", "AGENCY"] as const) {
      const re = new RegExp(`\\$${PLAN_CONFIGS[plan].annualPrice}`);
      expect(within(card(plan)).getByText(re), `${plan} annual`).toBeTruthy();
    }
  });
});

// ─── What must not have moved ───────────────────────────────────────────────

describe("the surrounding furniture is undisturbed", () => {
  it("still renders the ConsentGate below the cards", () => {
    // Explicitly in scope as "must be untouched": the checkout consent checkbox
    // is what makes the card's CTA lawful, and it is easy to lose to a layout
    // edit because nothing else fails when it goes.
    renderGrid("en");
    expect(screen.getByRole("checkbox")).toBeTruthy();
  });

  it("still renders the tools footer on every paid card, from the live count", () => {
    renderGrid("en");
    const links = screen.getAllByText(new RegExp(`${liveToolCount}\\+ SEO & AI tools included`));
    expect(links).toHaveLength(3);
  });

  it("still renders one checkout button per paid card", () => {
    renderGrid("en");
    expect(screen.getAllByText("Start free trial")).toHaveLength(3);
  });

  it("renders the /credits line once, pointing at this locale's page", () => {
    renderGrid("fr");
    const link = screen.getByText(/Packs de crédits prépayés/);
    expect(link.getAttribute("href")).toBe("/fr/credits");
  });

  it("keeps the tax and currency lines", () => {
    renderGrid("en");
    expect(screen.getByText("tax line")).toBeTruthy();
    expect(screen.getByText("currency line")).toBeTruthy();
  });
});
