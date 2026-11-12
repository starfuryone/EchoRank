// tests/price-change-2026-11-11.test.ts
//
// The price change of 2026-11-11: monthly $28 / $78 / $177 / $488, yearly 20%
// off, and the crawler-only plan at $15 / $144 a year (owner, 2026-11-12; it
// was $22 in the 2026-11-11 table). Every surface reads PLAN_CONFIGS; monthly
// prices print whole, yearly figures with both decimals. Old prices stay
// recognised: nobody is migrated.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const { stripePrice } = vi.hoisted(() => ({ stripePrice: { findFirst: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma: { stripePrice } }));

import { PLAN_CONFIGS, type SellablePlanType } from "@/lib/plan-config";
import { EXPECTED_ACTIVE_ROWS, PLAN_PRICE_SPECS, lookupKeyFor } from "@/lib/stripe/plan-price-spec";
import { resolvePlanFromPriceId } from "@/lib/stripe/prices";
import { pricingTiers } from "@/lib/pricing-tiers";
import { usd, usdCents } from "@/lib/pricing-page/format";
import { pricingFaq } from "@/lib/pricing-page/faq";
import { planFacts } from "@/lib/assistant/prompt";
import { PLANS } from "@/lib/seo/constants";
import { GET as technicalGeo } from "@/app/[locale]/technical-geo/route";
import { priceTokens } from "@/app/[locale]/technical-geo/prices";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PublicNav } from "@/app/[locale]/PublicNav";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import { NB_INTRO_MINUTES, NB_INTRO_VIDEO } from "@/lib/site-crawler/intro-video";
import { pitchCopy } from "@/lib/site-crawler/pitch-copy";
import { buildNosybatFacts } from "@/lib/site-crawler/nosybat-facts";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const nav = (locale: string) => renderToStaticMarkup(createElement(PublicNav, { locale }));

/** The owner's table: monthly dollars, yearly total in cents. */
const TABLE: [SellablePlanType, number, number][] = [
  ["NOSY_BAT", 15, 14_400],
  ["AI_VISIBILITY", 28, 26_880],
  ["STARTER", 78, 74_880],
  ["GROWTH", 177, 169_920],
  ["AGENCY", 488, 468_480],
];

describe("the plan config", () => {
  it.each(TABLE)("%s: $%d a month, %d cents a year (20% off)", (plan, monthly, yearCents) => {
    const c = PLAN_CONFIGS[plan];
    expect(c.monthlyPrice).toBe(monthly);
    expect(Number.isInteger(c.monthlyPrice)).toBe(true);
    expect(Math.round(c.annualPrice * 100) * 12).toBe(yearCents);
    expect(yearCents).toBe(monthly * 100 * 12 * 0.8);
  });

  it("the Stripe amounts are derived from it: 10 rows, the lookup keys as before", () => {
    expect(EXPECTED_ACTIVE_ROWS).toBe(10);
    for (const [plan, monthly, yearCents] of TABLE) {
      const s = PLAN_PRICE_SPECS.find((x) => x.plan === plan)!;
      expect([s.monthlyCents, s.annualCents], plan).toEqual([monthly * 100, yearCents]);
    }
    expect(lookupKeyFor(PLAN_PRICE_SPECS.find((x) => x.plan === "STARTER")!, "year")).toBe("echorank_starter_usd_year");
    const seed = read("scripts/seed-plan-prices-usd.ts");
    expect(seed).not.toMatch(/monthlyCents: \d/);
    expect(seed).toContain("PLAN_PRICE_SPECS");
  });
});

describe("display: monthly whole, yearly with two decimals, plus the billed-yearly total", () => {
  it("the cards' figures", () => {
    const t = pricingTiers("en").find((x) => x.id === "STARTER")!;
    expect(usd(t.monthly!, "en")).toBe("$78");
    expect(usdCents(t.annual!, "en")).toBe("$62.40");
    expect(usdCents(t.annualTotal!, "en")).toBe("$748.80");
    const g = pricingTiers("en").find((x) => x.id === "GROWTH")!;
    expect([usd(g.monthly!, "en"), usdCents(g.annual!, "en"), usdCents(g.annualTotal!, "en")]).toEqual(["$177", "$141.60", "$1,699.20"]);
    expect(usdCents(62.4, "fr")).toBe("$62,40");
  });

  it("the pricing FAQ's AI-only answer", () => {
    const a = pricingFaq("en", { savePct: 20, freeCrawler: true }).find((i) => i.id === "ai-only")!.a;
    expect(a).toContain("at $28/month ($22.40/month billed yearly)");
    expect(a).toContain("start at **Starter** ($78/month).");
    const fr = pricingFaq("fr", { savePct: 20, freeCrawler: true }).find((i) => i.id === "ai-only")!.a;
    expect(fr).toContain("à 28 $ par mois (22,40 $ par mois en annuel)");
  });

  it("the assistant's plan facts", () => {
    expect(planFacts()).toContain("- Starter: $78/month, or $62.40/month billed annually ($748.80 a year).");
    expect(planFacts()).toContain("- Agency: $488/month, or $390.40/month billed annually ($4,684.80 a year).");
  });

  it("the site-wide Offer JSON-LD", () => {
    expect(PLANS).toEqual([
      { name: "AI Visibility", price: "28" },
      { name: "Starter", price: "78" },
      { name: "Growth", price: "177" },
      { name: "Agency", price: "488" },
    ]);
  });
});

describe("the crawler-only plan at $15 / $144 (2026-11-12), on every surface that prices it", () => {
  const ON = new Set(["NOSY_BAT"] as const);

  it("the Stripe amounts: 1500 and 14400 cents", () => {
    const s = PLAN_PRICE_SPECS.find((x) => x.plan === "NOSY_BAT")!;
    expect([s.monthlyCents, s.annualCents]).toEqual([1_500, 14_400]);
    expect(lookupKeyFor(s, "month")).toBe("echorank_nosy_bat_usd_month");
  });

  it("the card: $15 a month, $12.00 billed $144.00 yearly, save $36.00", () => {
    const t = pricingTiers("en", undefined, { launched: ON }).find((x) => x.id === "NOSY_BAT")!;
    expect([usd(t.monthly!, "en"), usdCents(t.annual!, "en"), usdCents(t.annualTotal!, "en"), usdCents(t.saveAmount!, "en")]).toEqual(["$15", "$12.00", "$144.00", "$36.00"]);
  });

  it("the Product menu's plan item, en and fr", () => {
    expect(nav("en")).toContain(`${CRAWLER_BRAND.name} plan — $15/mo`);
    expect(nav("fr")).toMatch(new RegExp(`Forfait ${CRAWLER_BRAND.name} — 15\\s\\$/mois`));
  });

  it("/site-crawler: the Offer reads the config, the pitch says 'from $15/month'", () => {
    const page = read("src/app/[locale]/site-crawler/page.tsx");
    expect(page).toContain("price: String(PLAN_CONFIGS.NOSY_BAT.monthlyPrice)");
    expect(page).not.toMatch(/\$\d/);
    expect(pitchCopy(buildNosybatFacts({ launched: ON }), "en").sub).toContain("from $15/month");
    expect(pricingFaq("en", { savePct: 20, freeCrawler: true, launched: ON }).find((i) => i.id === "crawler")!.a).toContain("plan ($15/month)");
  });

  it("the technical-geo payload's tokens", () => {
    expect(priceTokens()["__PRICE_NOSY_BAT_MONTH__"]).toBe("$15");
    expect(priceTokens()["__PRICE_NOSY_BAT_YEAR_MO__"]).toBe("$12.00");
  });
});

describe("the intro video's length: one value for the menu and the /site-crawler H2", () => {
  it("is the file's length in minutes", () => {
    expect(NB_INTRO_MINUTES).toBe(Math.round(NB_INTRO_VIDEO.durationSeconds / 60));
  });

  it("the H2 reads it, en and fr, and types no length", () => {
    const page = read("src/app/[locale]/site-crawler/page.tsx");
    expect(page).toContain("videoH2: `${NB_INTRO_MINUTES} minutes, every feature.`");
    expect(page).toContain("videoH2: `${NB_INTRO_MINUTES} minutes, toutes les fonctionnalités.`");
    expect(page).not.toMatch(/Two minutes|Deux minutes/);
  });

  it("the menu reads it, en and fr", () => {
    expect(read("src/app/[locale]/PublicNav.tsx")).toContain("const introMinutes = NB_INTRO_MINUTES;");
    expect(nav("en")).toContain(`Watch the ${NB_INTRO_MINUTES}-minute intro`);
    expect(nav("fr")).toContain(`Voir l&#x27;intro de ${NB_INTRO_MINUTES} minutes`);
  });
});

describe("the technical-geo landing page", () => {
  it("reads its prices from the config, and carries no typed price or leftover token", async () => {
    const html = await technicalGeo().text();
    expect(html).not.toContain("__PRICE_");
    expect(html).not.toMatch(/\$(79|199|499|63|159|399)\b/);
    expect(html).toContain("Starter from $78/mo.");
    expect(html).toContain("<b>$177<small>/mo</small></b>");
    expect(html).toContain("$390.40/mo billed annually");
    expect(priceTokens()["__PRICE_GROWTH_YEAR_MO__"]).toBe("$141.60");
    expect(read("src/app/[locale]/technical-geo/landing-html.ts")).not.toMatch(/\$\d/);
  });
});

describe("old prices stay recognised", () => {
  it("the webhook's reverse lookup has no `active` filter: a retired row still maps", async () => {
    stripePrice.findFirst.mockResolvedValue({ planTier: "starter", currency: "USD" });
    expect(await resolvePlanFromPriceId("price_old_starter")).toEqual({ planType: "STARTER", currency: "USD" });
    const where = stripePrice.findFirst.mock.calls[0][0].where;
    expect(where).toEqual({ stripePriceId: "price_old_starter" });
  });

  it("the seed retires old rows instead of deleting them, and counts active rows", () => {
    const seed = read("scripts/seed-plan-prices-usd.ts");
    expect(seed).toContain("data: { active: false }");
    expect(seed).not.toMatch(/stripePrice\.delete/);
    expect(seed).toContain("count({ where: { currency: CURRENCY, active: true } })");
  });
});

describe("no typed old price in what visitors read", () => {
  // The places a price was typed by hand before: landing payloads, the
  // help illustrations, llms.txt, the blog. (The pinned agreement lines are
  // tested in tests/subscription-agreement-pinned.test.ts.)
  // Nosy Bat's earlier figures too: $22.40 / $17.92 / $215.04, then $22 /
  // $17.60 / $211.20 (save $52.80).
  const OLD = /\$ ?(29|79|199|499)\b|\$(23|63|159|399)\/mo|\$22\.40|\$17\.92|\$215\.04|\$53\.76|\$22\/mo|\$17\.60|\$211\.20|\$52\.80/;
  function files(dir: string, ext: RegExp): string[] {
    return readdirSync(join(ROOT, dir)).flatMap((f) => {
      const p = join(dir, f);
      return statSync(join(ROOT, p)).isDirectory() ? files(p, ext) : ext.test(f) ? [p] : [];
    });
  }
  const targets = [
    ...files("src/app/[locale]", /^landing-html\.ts$/),
    ...files("content/blog/en", /\.md$/),
    ...files("public/help/img", /\.svg$/),
    "public/llms.txt",
  ];
  it.each(targets)("%s", (f) => {
    expect(read(f)).not.toMatch(OLD);
  });
});
