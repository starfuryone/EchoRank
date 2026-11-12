// @vitest-environment jsdom
//
// The homepage pricing row matches /pricing (2026-11-12): the same plans on
// sale, cheapest first, the crawler-only plan first once its stripe_prices rows
// exist, through the same shared grid and config. Nothing typed: the order and
// every price are read from PLAN_CONFIGS and cardOrder().

import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

vi.stubGlobal(
  "IntersectionObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
// jsdom has no matchMedia; HomeClient's animations ask for reduced motion.
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: true,
  media: query,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
}));

const m = vi.hoisted(() => ({ launched: new Set<string>() }));
vi.mock("@/lib/stripe/catalog", async (orig) => ({
  ...(await orig<typeof import("@/lib/stripe/catalog")>()),
  launchedPlans: async () => m.launched,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  notFound: () => {
    throw new Error("notFound");
  },
  redirect: vi.fn(),
}));

import HomePage from "@/app/[locale]/page";
import PricingPage from "@/app/[locale]/pricing/page";
import { PLAN_CONFIGS, type SellablePlanType } from "@/lib/plan-config";
import { CATALOG_GATED_PLANS, cardOrder } from "@/lib/plan-launch";
import { HOME_PRICING_CHROME } from "@/lib/i18n/content";
import { pricingBase, usd, usdCents } from "@/lib/pricing-page/format";
import type { Locale } from "@/lib/i18n/config";

const LOCALES: Locale[] = ["en", "en-CA", "fr", "fr-CA", "de-CH"];
const P = (locale: string) => ({ params: Promise.resolve({ locale }) });

afterEach(() => {
  cleanup();
  m.launched = new Set();
});

/** The plan cards in a page's #pricing section, in DOM order (the Enterprise band excluded). */
function cardIds(root: ParentNode): string[] {
  return [...root.querySelectorAll("#pricing [data-plan]")]
    .filter((el) => el.getAttribute("data-plan") !== "ENTERPRISE")
    .map((el) => el.getAttribute("data-plan")!);
}
const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");

describe("the homepage pricing row", () => {
  it("the crawler-only plan is the one catalog-gated plan this covers", () => {
    expect([...CATALOG_GATED_PLANS]).toEqual(["NOSY_BAT"]);
  });

  for (const locale of LOCALES) {
    it(`${locale}: launched, five cards, cheapest first, the same row as /pricing`, async () => {
      m.launched = new Set(["NOSY_BAT"]);
      const home = parse(renderToStaticMarkup(await HomePage(P(locale))));
      const pricing = parse(renderToStaticMarkup(await PricingPage(P(locale))));
      const ids = cardIds(home);
      expect(ids).toEqual(cardIds(pricing));
      expect(ids).toEqual(cardOrder(m.launched as never).filter((p) => !PLAN_CONFIGS[p].isCustomPricing));
      expect(ids).toHaveLength(5);
      expect(ids[0]).toBe("NOSY_BAT");
      const monthly = ids.map((id) => PLAN_CONFIGS[id as SellablePlanType].monthlyPrice);
      expect(monthly).toEqual([...monthly].sort((a, b) => a - b));
      // Five across: the same grid class /pricing picks.
      const grid = home.querySelector("#pricing [data-plan]")!.parentElement!;
      expect(grid.className).toMatch(/priceGrid5/);
      // Each card prints its config price, monthly by default.
      const base = pricingBase(locale);
      for (const id of ids) {
        const amount = home.querySelector(`#pricing [data-plan="${id}"] [class*=pamount]`)!.textContent!;
        expect(amount, `${locale} ${id}`).toContain(usd(PLAN_CONFIGS[id as SellablePlanType].monthlyPrice, base));
      }
    });
  }

  it("not launched: the ladder without the crawler-only plan, as /pricing shows it", async () => {
    for (const locale of ["en", "fr", "de-CH"] as Locale[]) {
      const home = parse(renderToStaticMarkup(await HomePage(P(locale))));
      const pricing = parse(renderToStaticMarkup(await PricingPage(P(locale))));
      expect(cardIds(home)).toEqual(cardIds(pricing));
      expect(cardIds(home)).not.toContain("NOSY_BAT");
      expect(cardIds(home)).toEqual(cardOrder().filter((p) => !PLAN_CONFIGS[p].isCustomPricing));
    }
  });

  for (const locale of ["en", "fr", "de-CH"] as Locale[]) {
    it(`${locale}: the yearly toggle prints each card's config yearly rate, order unchanged`, async () => {
      m.launched = new Set(["NOSY_BAT"]);
      render(await HomePage(P(locale)));
      const section = document.getElementById("pricing")!;
      const before = cardIds(document);
      fireEvent.click(within(section).getByRole("button", { name: HOME_PRICING_CHROME[locale].annual }));
      expect(cardIds(document)).toEqual(before);
      const base = pricingBase(locale);
      for (const id of before) {
        const amount = section.querySelector(`[data-plan="${id}"] [class*=pamount]`)!.textContent!;
        expect(amount, `${locale} ${id}`).toContain(usdCents(PLAN_CONFIGS[id as SellablePlanType].annualPrice, base));
      }
      // The checkout button on every card, the crawler-only plan's included.
      expect(within(section).getAllByRole("button", { name: HOME_PRICING_CHROME[locale].checkoutCta })).toHaveLength(5);
      expect(screen.getAllByTestId("cancel-anytime")).toHaveLength(5);
    });
  }
});
