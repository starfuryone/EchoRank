// @vitest-environment jsdom
//
// The plan cards go by price, cheapest first, on every surface that uses the
// shared pricing grid (owner, 2026-11-12): /pricing, /site-crawler, the
// homepage and /ai-visibility. The order is computed from PLAN_CONFIGS by
// cardOrder() (plan-launch.ts), the same on both toggles; Enterprise stays the
// band under the cards; "Most popular" stays on Growth; the /pricing
// comparison columns follow it, Free first; "Everything in X, plus:" only ever
// names a card to the left.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PLAN_CONFIGS, type SellablePlanType } from "@/lib/plan-config";
import { cardOrder, NONE_LAUNCHED } from "@/lib/plan-launch";
import { pricingTiers } from "@/lib/pricing-tiers";
import { comparisonTable } from "@/lib/pricing-page/compare";
import { PRICING_PAGE_COPY } from "@/lib/pricing-page/copy";
import { buildNosybatFacts } from "@/lib/site-crawler/nosybat-facts";
import { AV_LADDER } from "@/lib/ai-visibility-landing/facts";
import { PricingSection } from "@/app/[locale]/PricingSection";
import { CompareTable } from "@/app/[locale]/pricing/CompareTable";
import { HOME_PRICING_CHROME, toolCountLine } from "@/lib/i18n/content";
import { seoToolCounts } from "@/lib/seo-tools";

afterEach(cleanup);

const ON = new Set(["NOSY_BAT"] as const);
const cents = (p: string) => Math.round(PLAN_CONFIGS[p as SellablePlanType].monthlyPrice * 100);
const ascending = (ids: readonly string[]) => ids.every((p, i) => i === 0 || cents(ids[i - 1]!) <= cents(p));

/** Every surface's cards, with the Nosy Bat plan on sale and not. */
const SURFACES = (launched: ReadonlySet<"NOSY_BAT">) => ({
  pricing: pricingTiers("en", undefined, { launched }),
  "site-crawler": pricingTiers("en", buildNosybatFacts({ launched }).crawlPlans.map((p) => p.id), { launched }),
  // The homepage and /ai-visibility pass no launched set: no crawler-only card.
  home: pricingTiers("en"),
  "ai-visibility": pricingTiers("en", AV_LADDER),
});

describe("the order", () => {
  it("is by monthly price from the config, cheapest first; Enterprise last and not a card", () => {
    expect(cardOrder(ON)).toEqual(["NOSY_BAT", "AI_VISIBILITY", "STARTER", "GROWTH", "AGENCY", "ENTERPRISE"]);
    expect(cardOrder(NONE_LAUNCHED)).toEqual(["AI_VISIBILITY", "STARTER", "GROWTH", "AGENCY", "ENTERPRISE"]);
    expect(ascending(cardOrder(ON).filter((p) => !PLAN_CONFIGS[p].isCustomPricing))).toBe(true);
    expect(pricingTiers("en", undefined, { launched: ON }).map((t) => t.id)).not.toContain("ENTERPRISE");
  });

  it("is computed, not typed: a price change reorders the cards", () => {
    const c = PLAN_CONFIGS.AGENCY as { monthlyPrice: number };
    const was = c.monthlyPrice;
    try {
      c.monthlyPrice = 1;
      expect(cardOrder(ON)[0]).toBe("AGENCY");
    } finally {
      c.monthlyPrice = was;
    }
    expect(cardOrder(ON)[0]).toBe("NOSY_BAT");
  });

  it.each([
    ["launched", ON],
    ["not launched", NONE_LAUNCHED as ReadonlySet<"NOSY_BAT">],
  ])("every surface, its own subset in the same order (crawler-only plan %s)", (_, launched) => {
    for (const [name, tiers] of Object.entries(SURFACES(launched))) {
      const ids = tiers.map((t) => t.id);
      expect(ascending(ids), `${name}: ${ids.join(", ")}`).toBe(true);
    }
    const s = SURFACES(ON);
    expect(s.pricing.map((t) => t.id)).toEqual(["NOSY_BAT", "AI_VISIBILITY", "STARTER", "GROWTH", "AGENCY"]);
    expect(s["site-crawler"].map((t) => t.id)).toEqual(["NOSY_BAT", "STARTER", "GROWTH", "AGENCY"]);
    expect(s.home.map((t) => t.id)).toEqual(["AI_VISIBILITY", "STARTER", "GROWTH", "AGENCY"]);
    expect(s["ai-visibility"].map((t) => t.id)).toEqual(["AI_VISIBILITY", "STARTER", "GROWTH", "AGENCY"]);
  });

  it("does not change on the Monthly / Yearly toggle, and 'Most popular' stays on Growth", () => {
    render(
      <PricingSection salesSrc="pricing-enterprise" enterpriseBand locale="en" pricing={pricingTiers("en", undefined, { launched: ON })} priceChrome={HOME_PRICING_CHROME.en} toolCountLine={toolCountLine("en", seoToolCounts())} tax="t" currency="c" header={null} />,
    );
    const order = () => [...document.querySelectorAll("[data-plan]")].map((e) => e.getAttribute("data-plan"));
    const monthly = order();
    // The cards by price, then the Enterprise band under them.
    expect(monthly).toEqual(["NOSY_BAT", "AI_VISIBILITY", "STARTER", "GROWTH", "AGENCY", "ENTERPRISE"]);
    fireEvent.click(screen.getByRole("button", { name: HOME_PRICING_CHROME.en.annual }));
    expect(order()).toEqual(monthly);
    const badged = [...document.querySelectorAll("[data-plan]")].filter((e) => e.textContent!.includes(HOME_PRICING_CHROME.en.mostPopular));
    expect(badged.map((e) => e.getAttribute("data-plan"))).toEqual(["GROWTH"]);
  });
});

describe("'Everything in X, plus:' never names a card to the right", () => {
  const nameToId = new Map(Object.entries(PLAN_CONFIGS).map(([id, c]) => [c.name, id]));
  it.each(["en", "fr"])("%s, every surface", (locale) => {
    const all = {
      pricing: pricingTiers(locale, undefined, { launched: ON }),
      "site-crawler": pricingTiers(locale, buildNosybatFacts({ launched: ON }).crawlPlans.map((p) => p.id), { launched: ON }),
      home: pricingTiers(locale),
    };
    for (const [surface, tiers] of Object.entries(all)) {
      const ids = tiers.map((t) => t.id);
      tiers.forEach((t, i) => {
        if (!t.inherits) return;
        const named = [...nameToId.entries()].find(([name]) => t.inherits!.includes(name))?.[1];
        expect(named, `${surface} ${t.id}: ${t.inherits}`).toBeDefined();
        expect(ids.indexOf(named!), `${surface} ${t.id}: ${t.inherits}`).toBeGreaterThanOrEqual(0);
        expect(ids.indexOf(named!), `${surface} ${t.id}: ${t.inherits}`).toBeLessThan(i);
      });
    }
    // The chain as it reads today on /pricing.
    expect(all.pricing.map((t) => [t.id, t.inherits])).toEqual([
      ["NOSY_BAT", null],
      ["AI_VISIBILITY", null],
      ["STARTER", locale === "fr" ? "Tout ce qu'offre AI Visibility, plus :" : "Everything in AI Visibility, plus:"],
      ["GROWTH", locale === "fr" ? "Tout ce qu'offre Starter, plus :" : "Everything in Starter, plus:"],
      ["AGENCY", locale === "fr" ? "Tout ce qu'offre Growth, plus :" : "Everything in Growth, plus:"],
    ]);
  });
});

describe("the /pricing comparison table", () => {
  it("orders its plan columns like the cards, Free first", () => {
    for (const launched of [ON, NONE_LAUNCHED as ReadonlySet<"NOSY_BAT">]) {
      const t = comparisonTable("en", launched);
      expect(t.plans).toEqual(pricingTiers("en", undefined, { launched }).map((x) => x.id));
      expect(ascending(t.plans)).toBe(true);
    }
    const html = renderToStaticMarkup(createElement(CompareTable, { table: comparisonTable("en", ON), copy: PRICING_PAGE_COPY.en }));
    const head = html.slice(html.indexOf("<thead>"), html.indexOf("</thead>"));
    const cols = [...head.matchAll(/<th scope="col"([^>]*)>/g)].map((m) => /data-plan="([A-Z_]+)"/.exec(m[1]!)?.[1] ?? null);
    // The label column, Free, then the plans by price.
    expect(cols).toEqual([null, null, "NOSY_BAT", "AI_VISIBILITY", "STARTER", "GROWTH", "AGENCY"]);
    expect(head.indexOf(PRICING_PAGE_COPY.en.freeHead)).toBeLessThan(head.indexOf('data-plan="NOSY_BAT"'));
  });
});
