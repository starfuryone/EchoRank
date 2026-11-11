// @vitest-environment jsdom
//
// The crawler-only plan, sold (owner's spec, 2026-11-10): PlanType NOSY_BAT,
// $22.40 a month or $215.04 a year, Agency's crawl limits read from the same
// values, two crawls at once. Its card shows on /pricing (after AI Visibility)
// and /site-crawler (first) only once its stripe_prices rows exist, and the
// checkout refuses it until then.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ onSale: vi.fn(async () => false) }));
vi.mock("@/lib/stripe/catalog", async (orig) => ({ ...(await orig<typeof import("@/lib/stripe/catalog")>()), checkoutTierOnSale: m.onSale }));

import { PricingSection } from "@/app/[locale]/PricingSection";
import { HOME_PRICING_CHROME, toolCountLine } from "@/lib/i18n/content";
import { PLAN_CONFIGS, PLAN_ORDER, TRIAL_DAYS } from "@/lib/plan-config";
import { CATALOG_GATED_PLANS, NONE_LAUNCHED, cardOrder, planOnSale } from "@/lib/plan-launch";
import { launchedPlans } from "@/lib/stripe/catalog";
import { checkoutLookupKey, planTypeForLookupKey } from "@/lib/stripe/lookup-keys";
import { pricingTiers, savePctOf, yearlySavingPct } from "@/lib/pricing-tiers";
import { cardPlans, planHeadlines } from "@/lib/pricing-page/headlines";
import { comparisonTable } from "@/lib/pricing-page/compare";
import { pricingFaq } from "@/lib/pricing-page/faq";
import { PLAN_AUDIENCE } from "@/lib/pricing-page/audience";
import { moneyAmount, usd } from "@/lib/pricing-page/format";
import { seoToolCounts } from "@/lib/seo-tools";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import { buildNosybatFacts, nbUsd } from "@/lib/site-crawler/nosybat-facts";
import { nosybatCardLines } from "@/lib/site-crawler/nosybat-card";
import { pitchCopy } from "@/lib/site-crawler/pitch-copy";
import { trialChargeLabel } from "@/lib/billing/trial-ending-email";
import { PLANS } from "@/lib/seo/constants";

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const ON = new Set(["NOSY_BAT"] as const);

afterEach(() => cleanup());

describe("the plan in config", () => {
  const nb = PLAN_CONFIGS.NOSY_BAT;
  const ag = PLAN_CONFIGS.AGENCY;

  it("is named from brand.ts, priced $22.40 / $17.92, with a 7-day trial like the others", () => {
    expect(nb.name).toBe(CRAWLER_BRAND.name);
    expect(nb.slug).toBe("nosy_bat");
    expect([nb.monthlyPrice, nb.annualPrice, nb.isCustomPricing]).toEqual([22.4, 17.92, false]);
    expect(TRIAL_DAYS).toBe(7);
  });

  it("takes Agency's crawl limits from the same values, not a copy; two crawls at once", () => {
    const shared = ["crawlUrlCap", "crawlsPerMonth", "crawlPagesPerMonth", "crawlRenderedPages", "crawlsKept", "crawlSchedules", "crawlScheduleCadences", "crawlExtractors", "crawlSearches", "crawlSegments"] as const;
    for (const k of shared) expect(nb[k], k).toBe(ag[k]);
    expect(nb.crawlsPerMonth).toBeNull();
    expect(nb.crawlScheduleCadences).toEqual(["daily", "weekly", "monthly"]);
    expect(nb.crawlConcurrency).toBe(2);
    // One object, spread into both (plan-config.ts AGENCY_CRAWLER).
    expect(read("src/lib/plan-config.ts").match(/\.\.\.AGENCY_CRAWLER,/g)?.length).toBe(2);
  });

  it("has every other quota at 0", () => {
    expect(Object.values(nb.quotaDefaults).every((v) => v === 0)).toBe(true);
    expect([nb.seoSearchesPerMonth, nb.trackedKeywords, nb.aiProjects, nb.aiMonthlyCapUsd, nb.keywordOpportunityAnalysesPerMonth, nb.linkAuthorityChecksPerMonth]).toEqual([0, 0, 0, 0, 0, 0]);
    expect(nb.aiCheckup).toEqual({ frequency: "none", providers: 0, prompts: 0, repetitions: 0 });
    expect(nb.backlinks.listRows).toBe(0);
  });

  it("is off the ladder, so the Subscription Agreement's plan lines and the site-wide offers do not change", () => {
    expect(PLAN_ORDER).not.toContain("NOSY_BAT");
    expect(read("src/app/[locale]/legal/_content/subscription-agreement.tsx")).toContain("return PLAN_ORDER.map((plan) => {");
    expect(PLANS.map((p) => p.name)).not.toContain(CRAWLER_BRAND.name);
  });

  it("has an enum value and a migration that only adds it", () => {
    expect(read("prisma/schema.prisma")).toMatch(/enum PlanType \{\s*AI_VISIBILITY\s*(\/\/\/[^\n]*\s*)*NOSY_BAT/);
    const sql = read("prisma/migrations/20261203090000_plan_type_nosy_bat/migration.sql").replace(/^--.*$/gm, "").trim();
    expect(sql).toBe(`ALTER TYPE "PlanType" ADD VALUE IF NOT EXISTS 'NOSY_BAT' AFTER 'AI_VISIBILITY';`);
  });
});

describe("Stripe: lookup keys, the seed, the operator's script", () => {
  it("maps the plan both ways", () => {
    expect(checkoutLookupKey("nosy_bat", "month")).toBe("echorank_nosy_bat_usd_month");
    expect(checkoutLookupKey("nosy_bat", "year")).toBe("echorank_nosy_bat_usd_year");
    expect(planTypeForLookupKey("echorank_nosy_bat_usd_month")).toBe("NOSY_BAT");
    expect(planTypeForLookupKey("echorank_nosy_bat_usd_year")).toBe("NOSY_BAT");
    expect(read("src/lib/stripe/prices.ts")).toContain('nosy_bat: "NOSY_BAT",');
    expect(read("src/app/[locale]/PricingSection.tsx")).toMatch(/case "NOSY_BAT":\s*return "nosy_bat";/);
  });

  it("the seed expects ten rows, Nosy Bat's at 2240 and 21504 cents", () => {
    const seed = read("scripts/seed-plan-prices-usd.ts");
    expect(seed).toContain('{ planTier: "nosy_bat", label: "Nosy Bat", monthlyCents: 2_240, annualCents: 21_504 }');
    expect(seed).toContain("// 5 tiers x 2 intervals = 10");
  });

  it("2240 cents a month, 21504 a year: 20% off, $17.92 a month", () => {
    expect(Math.round(PLAN_CONFIGS.NOSY_BAT.monthlyPrice * 100)).toBe(2240);
    expect(Math.round(PLAN_CONFIGS.NOSY_BAT.annualPrice * 100) * 12).toBe(21504);
    expect(savePctOf(22.4, 17.92)).toBe(20);
  });
});

describe("on sale only once its stripe_prices rows exist", () => {
  const rows = (...r: [string, string][]) => async () => r.map(([planTier, interval]) => ({ planTier, interval }));

  it("launched needs an active monthly AND yearly USD row; a failed read is not launched", async () => {
    expect([...CATALOG_GATED_PLANS]).toEqual(["NOSY_BAT"]);
    expect((await launchedPlans(rows())).has("NOSY_BAT")).toBe(false);
    expect((await launchedPlans(rows(["nosy_bat", "month"]))).has("NOSY_BAT")).toBe(false);
    expect((await launchedPlans(rows(["nosy_bat", "month"], ["nosy_bat", "year"]))).has("NOSY_BAT")).toBe(true);
    expect((await launchedPlans(async () => { throw new Error("db down"); })).size).toBe(0);
  });

  it("the card order holds it after AI Visibility only when launched", () => {
    expect(cardOrder()).toEqual(PLAN_ORDER);
    expect(cardOrder(ON)).toEqual(["AI_VISIBILITY", "NOSY_BAT", "STARTER", "GROWTH", "AGENCY", "ENTERPRISE"]);
    expect(planOnSale("NOSY_BAT")).toBe(false);
    expect(planOnSale("NOSY_BAT", ON)).toBe(true);
    expect(planOnSale("STARTER")).toBe(true);
  });

  it("the checkout refuses the plan while it is not on sale, before anything else", async () => {
    m.onSale.mockResolvedValue(false);
    const { POST } = await import("@/app/api/billing/checkout/route");
    const res = await POST({ json: async () => ({ tier: "nosy_bat", interval: "month" }) } as never);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "That plan is not available.", reason: "plan_not_on_sale" });
    expect(m.onSale).toHaveBeenCalledWith("nosy_bat");
  });

  it("/pricing and /site-crawler read the rows and regenerate every five minutes", () => {
    for (const p of ["src/app/[locale]/pricing/page.tsx", "src/app/[locale]/site-crawler/page.tsx"]) {
      expect(read(p)).toContain("export const revalidate = 300;");
      expect(read(p)).toContain("await launchedPlans()");
    }
  });
});

describe("the cards", () => {
  const tiers = (l: string, launched = NONE_LAUNCHED as ReadonlySet<"NOSY_BAT">, plans?: string[]) => pricingTiers(l, plans as never, { launched });

  it("no card while not on sale; after AI Visibility on /pricing and first on /site-crawler once it is", () => {
    expect(tiers("en").map((t) => t.id)).not.toContain("NOSY_BAT");
    expect(tiers("en", ON).map((t) => t.id)).toEqual(["AI_VISIBILITY", "NOSY_BAT", "STARTER", "GROWTH", "AGENCY"]);
    const crawlPlans = buildNosybatFacts({ launched: ON }).crawlPlans.map((p) => p.id);
    expect(crawlPlans).toEqual(["NOSY_BAT", "STARTER", "GROWTH", "AGENCY"]);
    expect(tiers("en", ON, crawlPlans).map((t) => t.id)).toEqual(crawlPlans);
  });

  it("is not a step on the ladder: no 'Everything in', and Starter still inherits from AI Visibility", () => {
    const t = tiers("en", ON);
    expect(t.find((x) => x.id === "NOSY_BAT")!.inherits).toBeNull();
    expect(t.find((x) => x.id === "STARTER")!.inherits).toBe("Everything in AI Visibility, plus:");
  });

  it.each(["en", "fr", "de-CH"] as const)("%s: the audience line and the lines from nosybatFacts, nine at most", (l) => {
    const nb = tiers(l, ON).find((x) => x.id === "NOSY_BAT")!;
    const b = l === "de-CH" ? "de" : l;
    expect(nb.audience).toBe(PLAN_AUDIENCE.NOSY_BAT[b]);
    expect(nb.lines).toEqual(nosybatCardLines(buildNosybatFacts({ launched: ON }), b).map((s) => s.replace(/ /g, " ")));
    expect(nb.lines.length).toBeLessThanOrEqual(9);
    if (l === "de-CH") expect(nb.lines.join(" ")).not.toContain("ß");
  });

  it("en lines: the checks, Agency's caps, two at once, rendering, schedules, the exports, the Google data, one user", () => {
    const lines = tiers("en", ON).find((x) => x.id === "NOSY_BAT")!.lines;
    expect(lines[1]).toBe("Up to 25,000 URLs per crawl, unlimited crawls");
    expect(lines[2]).toBe("300,000 pages a month · 2 crawls at once");
    expect(lines).toContain("JavaScript rendering, up to 5,000 pages per crawl");
    expect(lines).toContain("Scheduled crawls: daily, weekly, or monthly");
    expect(lines).toContain("One user");
    expect(lines.join(" ")).not.toMatch(/API|MCP|backlink|AI prompt|location/i);
  });

  it("prices in cents: $22.40, $17.92, billed $215.04 yearly, save $53.76 (20%)", () => {
    const nb = tiers("en", ON).find((x) => x.id === "NOSY_BAT")!;
    expect([nb.monthly, nb.annual, nb.annualTotal, nb.saveAmount, nb.savePct]).toEqual([22.4, 17.92, 215.04, 53.76, 20]);
    // Every other card states the saving as a percentage, as before.
    expect(tiers("en", ON).filter((x) => x.id !== "NOSY_BAT").every((x) => x.saveAmount === null)).toBe(true);
    expect(yearlySavingPct()).toBe(Math.min(...PLAN_ORDER.filter((p) => !PLAN_CONFIGS[p].isCustomPricing).map((p) => savePctOf(PLAN_CONFIGS[p].monthlyPrice, PLAN_CONFIGS[p].annualPrice)!)));
  });

  it("renders $22.40 a month, then $17.92 with 'save $53.76' and 'billed $215.04 yearly' on the annual toggle", () => {
    render(
      <PricingSection salesSrc="pricing-enterprise" enterpriseBand locale="en" pricing={tiers("en", ON)} priceChrome={HOME_PRICING_CHROME.en} toolCountLine={toolCountLine("en", seoToolCounts())} tax="t" currency="c" header={null} />,
    );
    const card = () => document.querySelector('[data-plan="NOSY_BAT"]')!;
    expect(card().querySelector("[class*=pamount]")!.textContent).toContain("$22.40");
    fireEvent.click(screen.getByRole("button", { name: HOME_PRICING_CHROME.en.annual }));
    const text = card().textContent!;
    expect(text).toContain("$17.92");
    expect(text).toContain("save $53.76");
    expect(text).toContain("billed $215.04 yearly");
    expect(text).not.toMatch(/save \d+%/);
    // Starter keeps its percentage.
    expect(document.querySelector('[data-plan="STARTER"]')!.textContent).toMatch(/save \d+%/);
    // No tools line: the plan has no SEO tools.
    expect(card().querySelector("[class*=ptools]")).toBeNull();
  });

  it("formats money with cents in every locale, whole dollars as before", () => {
    expect([usd(22.4, "en"), usd(22.4, "fr"), usd(22.4, "de"), usd(79, "en"), usd(4788, "de")]).toEqual(["$22.40", "$22,40", "$22.40", "$79", "$4’788"]);
    expect(moneyAmount(215.04, "fr")).toBe("215,04");
    expect(nbUsd(22.4, "en")).toBe("$22.40");
    expect(nbUsd(79, "en")).toBe("$79");
  });

  it("the trial-ending email names the amount to the cent", () => {
    expect(trialChargeLabel("NOSY_BAT", "year", "en")).toBe("$215.04 USD/year");
    expect(trialChargeLabel("NOSY_BAT", "month", "en")).toBe("$22.40 USD/month");
    expect(trialChargeLabel("STARTER", "month", "en")).toBe("$79 USD/month");
  });
});

describe("the comparison table, the FAQ and the copy, once on sale", () => {
  it("adds its column: the free crawl's rows from the facts, 'not included' everywhere outside the crawler, one user", () => {
    expect(comparisonTable("en").plans).not.toContain("NOSY_BAT");
    const t = comparisonTable("en", ON);
    expect(t.plans).toEqual(["AI_VISIBILITY", "NOSY_BAT", "STARTER", "GROWTH", "AGENCY"]);
    for (const g of t.groups.filter((x) => x.id === "ai" || x.id === "reputation" || x.id === "seo")) {
      for (const r of g.rows) expect(r.plans.NOSY_BAT, `${g.id} ${r.id}`).toEqual({ kind: "no" });
    }
    const crawler = t.groups.find((g) => g.id === "crawler")!;
    expect(crawler.rows.find((r) => r.id === "urls")!.plans.NOSY_BAT).toEqual({ kind: "text", text: "25,000" });
    expect(crawler.rows.find((r) => r.id === "at-once")!.plans.NOSY_BAT).toEqual({ kind: "text", text: "2" });
    const team = t.groups.find((g) => g.id === "support")!.rows.find((r) => r.id === "team")!;
    expect(team.plans.NOSY_BAT).toEqual({ kind: "text", text: "One user" });
  });

  it("the FAQ names it once on sale, and the 'crawler starts at Starter' range stays the ladder's", () => {
    const off = pricingFaq("en", { savePct: 20, freeCrawler: true });
    const on = pricingFaq("en", { savePct: 20, freeCrawler: true, launched: ON });
    const crawlerOff = off.find((i) => i.id === "crawler")!.a;
    const crawlerOn = on.find((i) => i.id === "crawler")!.a;
    expect(crawlerOff).not.toContain(CRAWLER_BRAND.name + "** plan");
    expect(crawlerOn).toContain(`The crawler alone is the **${CRAWLER_BRAND.name}** plan ($22.40/month): up to 25,000 URLs per crawl, for one user, with nothing else.`);
    expect(on.find((i) => i.id === "ai-only")!.a).toContain("The crawler alone is");
    expect(cardPlans()).toEqual(cardPlans(NONE_LAUNCHED));
  });

  it("the pitch: 'from $22.40/month' once on sale, and the team claim names Starter (the plan is one user)", () => {
    const off = pitchCopy(buildNosybatFacts(), "en");
    expect(off.sub).toContain("from $79/month");
    expect(off.blocks.find((x) => x.id === "team")!.body.startsWith("No per-seat charge.")).toBe(true);
    const on = pitchCopy(buildNosybatFacts({ launched: ON }), "en");
    expect(on.sub).toContain("from $22.40/month");
    expect(on.blocks.find((x) => x.id === "team")!.body.startsWith("No per-seat charge from Starter.")).toBe(true);
  });

  it("the card headlines without the facts (the billing page's client bundle) still describe it", () => {
    const h = planHeadlines("NOSY_BAT", "en", cardPlans(ON));
    expect(h.inherits).toBeNull();
    expect(h.lines[0]).toBe(`Unlimited ${CRAWLER_BRAND.name} crawls, up to 25,000 URLs each · 300,000 pages/mo · 2 at once`);
  });
});
