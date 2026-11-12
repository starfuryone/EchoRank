// @vitest-environment jsdom
//
// tests/pricing-compare-cta.test.tsx
//
// /[locale]/pricing #compare: the CTA row under the subtitle and above the
// compare table, as the server renders it (signed out: the session probe only
// runs in the browser; tests/pricing-compare-cta.dom.test.tsx covers signed in).
// Labels per locale from PRICING_PAGE_COPY, the trial length from TRIAL_DAYS.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  notFound: () => {
    throw new Error("notFound");
  },
  redirect: vi.fn(),
}));

import PricingPage from "@/app/[locale]/pricing/page";
import { TRIAL_DAYS } from "@/lib/plan-config";
import type { Locale } from "@/lib/i18n/config";

const P = (locale: string) => ({ params: Promise.resolve({ locale }) });

/** The owner's wording, per locale (the pricing catalog folds en-CA/fr-CA onto en/fr). */
const EXPECTED: Record<Locale, { trial: string; free: string }> = {
  en: { trial: `Start your ${TRIAL_DAYS}-day free trial`, free: "Try the free tools" },
  "en-CA": { trial: `Start your ${TRIAL_DAYS}-day free trial`, free: "Try the free tools" },
  fr: { trial: `Commencer l'essai gratuit de ${TRIAL_DAYS} jours`, free: "Essayer les outils gratuits" },
  "fr-CA": { trial: `Commencer l'essai gratuit de ${TRIAL_DAYS} jours`, free: "Essayer les outils gratuits" },
  "de-CH": { trial: `${TRIAL_DAYS} Tage kostenlos testen`, free: "Kostenlose Tools testen" },
};

async function compareSection(locale: string): Promise<{ doc: Document; section: Element }> {
  const html = renderToStaticMarkup(await PricingPage(P(locale)));
  const doc = new DOMParser().parseFromString(html, "text/html");
  return { doc, section: doc.getElementById("compare")! };
}

describe("the #compare CTA row on /pricing", () => {
  it.each(Object.keys(EXPECTED) as Locale[])("renders both buttons in %s, with hrefs that resolve", async (locale) => {
    const { doc, section } = await compareSection(locale);
    const row = section.querySelector('[data-testid="compare-cta"]')!;
    expect(row).not.toBeNull();
    const primary = row.querySelector('[data-cta="primary"]')!;
    const secondary = row.querySelector('[data-cta="secondary"]')!;
    expect(primary.textContent).toBe(EXPECTED[locale].trial);
    expect(secondary.textContent).toBe(EXPECTED[locale].free);

    // Primary: the plan cards on this page (checkout needs a plan picked).
    expect(primary.getAttribute("href")).toBe("#pricing");
    expect(doc.getElementById("pricing")).not.toBeNull();
    // Secondary: the locale's free-tools hub, a real route.
    expect(secondary.getAttribute("href")).toBe(`/${locale}/free-tools`);
    expect(existsSync(join(process.cwd(), "src/app/[locale]/free-tools/page.tsx"))).toBe(true);
    // Never the registration form (site rule).
    expect(row.innerHTML).not.toContain("/register");
  });

  it("sits directly under the subtitle and above the compare table", async () => {
    const { section } = await compareSection("en");
    const container = section.firstElementChild!;
    const kids = [...container.children];
    const row = kids.findIndex((k) => k.getAttribute("data-testid") === "compare-cta");
    expect(kids[row - 1].textContent).toBe("What the public free tools give you without an account, and what each plan adds.");
    expect(kids[row + 1].querySelector("table")).not.toBeNull();
  });

  it("reuses the page's buttons: the cards' checkout look for the primary, a plain .btn for the secondary", async () => {
    const { section } = await compareSection("en");
    const row = section.querySelector('[data-testid="compare-cta"]')!;
    expect(row.querySelector('[data-cta="primary"]')!.className).toMatch(/pbuyLink/);
    expect(row.querySelector('[data-cta="secondary"]')!.className).toMatch(/(^|\s|_)btn(\s|_|$)/);
    expect(row.querySelector('[data-cta="secondary"]')!.className).not.toMatch(/btnPrimary|pbuy/);
  });

  it("spells the brand Echorank, never camel-case", async () => {
    for (const locale of Object.keys(EXPECTED)) {
      const { section } = await compareSection(locale);
      expect(section.querySelector('[data-testid="compare-cta"]')!.textContent).not.toMatch(/Echo\s?R/);
    }
  });
});
