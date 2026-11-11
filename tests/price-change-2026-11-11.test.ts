// tests/price-change-2026-11-11.test.ts
//
// The price change of 2026-11-11: monthly $22 / $28 / $78 / $177 / $488, yearly
// 20% off. Every surface reads PLAN_CONFIGS; monthly prices print whole, yearly
// figures with both decimals. Old prices stay recognised: nobody is migrated.

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

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

/** The owner's table: monthly dollars, yearly total in cents. */
const TABLE: [SellablePlanType, number, number][] = [
  ["NOSY_BAT", 22, 21_120],
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
  const OLD = /\$ ?(29|79|199|499)\b|\$(23|63|159|399)\/mo|\$22\.40|\$17\.92|\$215\.04|\$53\.76/;
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
