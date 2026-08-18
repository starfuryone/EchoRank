// Phase 0 + 1: the standalone /pricing page, and the homepage CTAs that now
// route through it.
//
// THE INVARIANT THIS PROTECTS, INVERTED AS OF THE CHECKOUT-FIRST FUNNEL:
// /pricing no longer links into /register AT ALL, and neither does anything
// else. An account is what a completed Stripe checkout produces, so there is no
// account to create before choosing a plan — bare /register redirects here, and
// the plan-less "Create account" button that used to sit under the grid was
// deleted in the same commit as this assertion was flipped.
//
// The plan cards' own checkout still keeps its /register?plan=… fallback in the
// source, but only for the standalone Watcher: that SKU is an entitlement gated
// on an existing tenant, so /api/billing/checkout still 401s it for anonymous
// callers. It is never a rendered href either way.
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
  it("/pricing carries NO /register link, plan-less or otherwise", async () => {
    // The inversion. This assertion used to require exactly the opposite: a
    // bare "/register" href for someone who wanted an account before choosing a
    // tier. That state no longer exists — an account is the OUTPUT of a
    // checkout now, not its prerequisite — and bare /register redirects to this
    // very page, so the button would have linked here from here.
    //
    // Flipped in the same commit as the redirect and the button's deletion, on
    // purpose: inverted first it would have failed against shipped code; left
    // until after, it would have opened a window with nothing guarding the
    // invariant at all.
    for (const locale of SUPPORTED_LOCALES) {
      const html = await page(locale);
      expect(hrefs(html).filter((h) => h.startsWith("/register")), locale).toEqual([]);
    }
  });

  it("the plan cards themselves carry no /register link", () => {
    // Their action is the Stripe checkout button. It reaches /register only
    // from JS on a 401, which now happens for the standalone Watcher alone —
    // never as a rendered href, then or now.
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
