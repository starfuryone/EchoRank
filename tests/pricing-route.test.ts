// Phase 0 + 1: the standalone /pricing page, and the homepage CTAs that now
// route through it.
//
// THE INVARIANT THIS PROTECTS: /pricing is the only marketing page that links
// into /register. Every other CTA leads here first, so a visitor cannot reach
// registration without passing the prices. Two exceptions are deliberate and
// must survive — a plan card's own Stripe checkout (which has already chosen a
// tier, so bouncing it back to pricing would dead-end the funnel) and the
// signed-in dashboard link.
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PricingPage, { generateMetadata } from "@/app/[locale]/pricing/page";
import { PricingSection } from "@/app/[locale]/PricingSection";
import { pricingTiers } from "@/lib/pricing-tiers";
import { PLAN_CONFIGS, PLAN_ORDER } from "@/lib/plan-config";
import { softwareApplication } from "@/lib/seo/jsonld";
import { LOCALIZED_ROUTES } from "@/lib/seo/registry";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";
import { HOME_PRICING_CHROME } from "@/lib/i18n/content";

async function page(locale: string): Promise<string> {
  const el = await PricingPage({ params: Promise.resolve({ locale }) });
  return renderToStaticMarkup(el);
}

/** Every href in the markup. */
function hrefs(html: string): string[] {
  return [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
}

describe("/pricing renders in every locale", () => {
  it("returns markup for all five supported locales", async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const html = await page(locale);
      expect(html.length).toBeGreaterThan(500);
      // The grid actually rendered, not just the shell.
      // STARTER is the entry tier now that the $29 AI Visibility card is gone.
      expect(html).toContain("$79");
    }
  });

  it("carries a unique per-locale canonical", async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const meta = await generateMetadata({ params: Promise.resolve({ locale }) });
      expect(String(meta.alternates?.canonical)).toContain(`/${locale}/pricing`);
      expect(meta.title).toBeTruthy();
    }
  });

  it("is registered for the sitemap", () => {
    expect(LOCALIZED_ROUTES.some((r) => r.path === "/pricing")).toBe(true);
  });
});

describe("numbers come from plan config, never from the page", () => {
  it("renders exactly the non-custom tiers, at their configured prices", () => {
    const tiers = pricingTiers("en");
    const expected = PLAN_ORDER.filter((p) => !PLAN_CONFIGS[p].isCustomPricing);
    expect(tiers.map((t) => t.id)).toEqual(expected);
    for (const tier of tiers) {
      expect(tier.monthly).toBe(PLAN_CONFIGS[tier.id as keyof typeof PLAN_CONFIGS].monthlyPrice);
      expect(tier.annual).toBe(PLAN_CONFIGS[tier.id as keyof typeof PLAN_CONFIGS].annualPrice);
    }
  });

  it("JSON-LD offers match the plan config", () => {
    const node = softwareApplication("en") as unknown as {
      offers: { name: string; price: number | string }[];
    };
    for (const offer of node.offers) {
      const plan = PLAN_ORDER.find((p) => PLAN_CONFIGS[p].name === offer.name);
      expect(plan, `offer ${offer.name} has no matching plan`).toBeTruthy();
      // schema.org Offer.price is emitted as a string; compare as one.
      expect(String(offer.price)).toBe(String(PLAN_CONFIGS[plan!].monthlyPrice));
    }
  });

  it("emits the offer graph on the page", async () => {
    const html = await page("en");
    expect(html).toContain('"@type":"Offer"');
    expect(html).toContain("BreadcrumbList");
  });
});

describe("the funnel terminates at pricing", () => {
  it("/pricing has a create-account link outside the plan cards", async () => {
    // Someone who wants an account before choosing a tier needs a way in, now
    // that every other CTA leads here.
    const html = await page("en");
    const register = hrefs(html).filter((h) => h.startsWith("/register"));
    expect(register.length).toBeGreaterThanOrEqual(1);
    // No ?plan= on it — that is what makes it the plan-less path.
    expect(register).toContain("/register");
  });

  it("the plan cards themselves carry no /register link", () => {
    // Their action is the Stripe checkout button, which only falls back to
    // /register from JS on a 401 — never as a rendered href.
    const html = renderToStaticMarkup(
      createElement(PricingSection, {
        locale: "en",
        pricing: pricingTiers("en"),
        priceChrome: HOME_PRICING_CHROME.en,
        liveToolCount: 24,
        tax: "t",
        currency: "c",
        header: null,
      }),
    );
    expect(hrefs(html).filter((h) => h.includes("/register"))).toEqual([]);
  });

  it("the tools line on /pricing points at the homepage, not a dead anchor", async () => {
    const html = await page("fr");
    expect(html).toContain('href="/fr#tools"');
    expect(html).not.toContain('href="#tools"');
  });
});
