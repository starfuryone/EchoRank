/**
 * @vitest-environment jsdom
 */
// "Cancel anytime" under every plan card's checkout button (2026-11-12).
//
// PricingSection is the one card grid behind /pricing, the homepage,
// /site-crawler and /ai-visibility, so rendering it per locale, per card set
// and per toggle covers every surface. The words come from
// HOME_PRICING_CHROME; the expected strings are typed here on purpose, because
// they are the approved copy, and the test checks the catalog says them.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PricingSection, checkoutTierFor } from "@/app/[locale]/PricingSection";
import { pricingTiers } from "@/lib/pricing-tiers";
import { HOME_PRICING_CHROME, toolCountLine } from "@/lib/i18n/content";
import { seoToolCounts } from "@/lib/seo-tools";
import type { SellablePlanType } from "@/lib/plan-config";
import { SUPPORTED_LOCALES as LOCALES, type Locale } from "@/lib/i18n/config";

vi.stubGlobal("fetch", vi.fn());
afterEach(cleanup);

const counts = seoToolCounts();

const APPROVED: Record<Locale, string> = {
  en: "Cancel anytime",
  "en-CA": "Cancel anytime",
  fr: "Annulez à tout moment",
  "fr-CA": "Annulez à tout moment",
  "de-CH": "Jederzeit kündbar",
};

/** The card sets the pages render: homepage/default, /pricing, /site-crawler. */
const SETS: { name: string; plans?: SellablePlanType[]; enterpriseBand?: boolean; enterpriseCard?: boolean }[] = [
  { name: "homepage / ai-visibility (default set)" },
  { name: "/pricing (Enterprise band)", enterpriseBand: true },
  { name: "/pricing (Enterprise card)", enterpriseCard: true },
  { name: "/site-crawler", plans: ["STARTER", "GROWTH", "AGENCY"] },
];

function renderGrid(locale: Locale, set: (typeof SETS)[number]) {
  const { plans, enterpriseBand, enterpriseCard } = set;
  return render(
    <PricingSection
      salesSrc="pricing-enterprise"
      locale={locale}
      pricing={pricingTiers(locale, plans)}
      priceChrome={HOME_PRICING_CHROME[locale]}
      toolCountLine={toolCountLine(locale, counts)}
      tax="tax line"
      currency="currency line"
      header={null}
      enterpriseBand={enterpriseBand}
      enterpriseCard={enterpriseCard}
    />,
  );
}

const paidCards = () =>
  [...document.querySelectorAll<HTMLElement>("[data-plan]")].filter((el) =>
    checkoutTierFor(el.getAttribute("data-plan") ?? ""),
  );

/** Every paid card: one line, the catalog's words, directly after its checkout button. */
function expectLineOnEveryCard(locale: Locale) {
  const cards = paidCards();
  expect(cards.length).toBeGreaterThan(0);
  for (const card of cards) {
    const plan = card.getAttribute("data-plan");
    const lines = card.querySelectorAll("[data-testid=cancel-anytime]");
    expect(lines, `${locale} ${plan}`).toHaveLength(1);
    const line = lines[0] as HTMLElement;
    expect(line.textContent, `${locale} ${plan}`).toBe(APPROVED[locale]);
    const button = card.querySelector("button");
    expect(button?.textContent).toBe(HOME_PRICING_CHROME[locale].checkoutCta);
    expect(button?.nextElementSibling, `${locale} ${plan}: right under the button`).toBe(line);
    const icon = line.querySelector("svg");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
    expect(icon?.getAttribute("focusable")).toBe("false");
  }
  // Nothing outside a paid card says it this way.
  expect(document.querySelectorAll("[data-testid=cancel-anytime]")).toHaveLength(cards.length);
}

describe("the catalog", () => {
  it("carries the approved words in every marketing locale", () => {
    for (const locale of LOCALES) {
      expect(HOME_PRICING_CHROME[locale].cancelAnytime, locale).toBe(APPROVED[locale]);
    }
    expect(HOME_PRICING_CHROME["de-CH"].cancelAnytime).not.toContain("ß");
  });

  it("does not repeat what the trial line already says", () => {
    for (const locale of LOCALES) {
      const trial = HOME_PRICING_CHROME[locale].trialLine.toLowerCase();
      expect(trial, locale).not.toContain(HOME_PRICING_CHROME[locale].cancelAnytime.toLowerCase());
    }
  });
});

describe("Cancel anytime under every checkout button", () => {
  for (const set of SETS) {
    for (const locale of LOCALES) {
      it(`${set.name}, ${locale}: monthly and yearly`, () => {
        renderGrid(locale, set);
        expectLineOnEveryCard(locale);
        fireEvent.click(screen.getByRole("button", { name: HOME_PRICING_CHROME[locale].annual }));
        expectLineOnEveryCard(locale);
      });
    }
  }

  it("leaves Enterprise alone: no line on its card or its band", () => {
    renderGrid("en", { name: "card", enterpriseCard: true });
    expect(document.querySelector("[data-plan=ENTERPRISE] [data-testid=cancel-anytime]")).toBeNull();
    cleanup();
    renderGrid("en", { name: "band", enterpriseBand: true });
    expect(screen.getByTestId("enterprise-band").querySelector("[data-testid=cancel-anytime]")).toBeNull();
  });

  it("keeps the card order and the sentence under the grid", () => {
    renderGrid("en", { name: "default" });
    const order = [...document.querySelectorAll("[data-plan]")].map((el) => el.getAttribute("data-plan"));
    expect(order).toEqual(pricingTiers("en").map((t) => t.id));
    expect(screen.getByText("tax line")).toBeTruthy();
  });
});

describe("the line's style", () => {
  const css = readFileSync(join(process.cwd(), "src/app/[locale]/home2.module.css"), "utf8");

  it("is one muted, small, centred line that never wraps", () => {
    const rule = css.match(/\.pcancel\{([^}]*)\}/)?.[1] ?? "";
    expect(rule).toContain("white-space:nowrap");
    expect(rule).toContain("color:var(--muted)");
    expect(rule).toContain("justify-content:center");
    expect(rule).toMatch(/font-size:12(\.5)?px/);
  });

  it("draws the check in the success text token", () => {
    expect(css).toContain(".pcancelIcon{flex:none;color:var(--greenText)}");
  });
});
