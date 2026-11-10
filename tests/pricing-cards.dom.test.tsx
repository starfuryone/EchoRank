/**
 * @vitest-environment jsdom
 */
// The pricing grid AS RENDERED, in three locales and both billing intervals.
//
// pricing-page.test.ts proves the headline lines are derived from the right
// config fields. This one proves they survive the trip to the DOM — that the
// real tier data, the real chrome and the real component put the expected
// line-up on screen, that the monthly/yearly toggle changes only the price,
// and that the furniture (ConsentGate, the struck anchor price, the tools
// footer, the credits line) is still there.
//
// EVERY EXPECTED NUMBER IS READ FROM CONFIG, never typed: a price change must
// move these assertions with it, not fail them.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { PricingSection } from "@/app/[locale]/PricingSection";
import { pricingTiers, savePctOf } from "@/lib/pricing-tiers";
import { HOME_PRICING_CHROME, toolCountLine } from "@/lib/i18n/content";
import { seoToolCounts } from "@/lib/seo-tools";
import { PLAN_CONFIGS, TRIAL_DAYS, type SellablePlanType } from "@/lib/plan-config";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import { engineNames } from "@/lib/pricing-page/headlines";
import { PLAN_AUDIENCE } from "@/lib/pricing-page/audience";
import { planAllowsArea } from "@/lib/plan-access";
import { hasFeature } from "@/lib/feature-flags";
import type { Locale } from "@/lib/i18n/config";

vi.stubGlobal("fetch", vi.fn());
afterEach(cleanup);

const counts = seoToolCounts();
const CARDS = ["AI_VISIBILITY", "STARTER", "GROWTH", "AGENCY"] as const;
type Card = (typeof CARDS)[number];
/** The cards that include the SEO tools hub and therefore its tool count. */
const SEO_CARDS = ["STARTER", "GROWTH", "AGENCY"] as const;
const en = (n: number) => n.toLocaleString("en-US");

function renderGrid(
  locale: Locale,
  extra: { compareHref?: string; enterpriseCard?: boolean; plans?: SellablePlanType[] } = {},
) {
  const { plans, ...rest } = extra;
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
      {...rest}
    />,
  );
}

/** The card for one tier. */
function card(plan: string): HTMLElement {
  return document.querySelector(`[data-plan="${plan}"]`) as HTMLElement;
}

/** Every <li> in a card, as text. */
function bullets(plan: string): string[] {
  return within(card(plan))
    .getAllByRole("listitem")
    .map((li) => li.textContent ?? "");
}

/** The English headline lines one tier would show on its own, from config. */
function enLines(plan: Card): string[] {
  const c = PLAN_CONFIGS[plan];
  const shape = c.aiCheckup;
  const locs = c.quotaDefaults.maxLocations;
  const engines = shape.providers === null ? "all AI engines" : `${shape.providers} AI engines`;
  const cadence = { weekly: "weekly", twice_weekly: "2×/week", daily: "daily" }[shape.frequency as "weekly"];
  const names = engineNames(shape);
  // The crawler lines: the crawls, their size and the month's pages; JavaScript
  // rendering; crawls at once where more than one may run.
  const crawls =
    (c.crawlsPerMonth === null
      ? `Unlimited ${CRAWLER_BRAND.name} crawls, up to ${en(c.crawlUrlCap)} URLs each`
      : `${en(c.crawlsPerMonth)} ${CRAWLER_BRAND.name} crawls/mo, up to ${en(c.crawlUrlCap)} URLs each`) +
    (c.crawlPagesPerMonth ? ` · ${en(c.crawlPagesPerMonth)} pages/mo` : "") +
    (c.crawlConcurrency > 1 ? ` · ${en(c.crawlConcurrency)} at once` : "");
  const crawler = planAllowsArea(plan, "crawler");
  const lines: (string | null)[] = [
    `${en(shape.prompts)} AI prompts · ${engines} · ${cadence}${names ? ` (${names.join(", ")})` : ""}`,
    hasFeature(plan, "citation_tracking") ? "Cited sources and citation opportunities" : null,
    "Trend history: score and every checkup",
    shape.repetitions > 1 ? `Each prompt asked ${shape.repetitions}× per engine` : null,
    `${en(locs)} location${locs === 1 ? "" : "s"}`,
    c.quotaDefaults.maxRequestsPerMonth > 0 ? `${en(c.quotaDefaults.maxRequestsPerMonth)} feedback requests/month` : null,
    c.seoSearchesPerMonth ? `${en(c.seoSearchesPerMonth)} SEO searches + ${en(c.trackedKeywords!)} tracked keywords` : null,
    c.keywordOpportunityAnalysesPerMonth ? `${en(c.keywordOpportunityAnalysesPerMonth)} domain analyses/mo` : null,
    crawler ? crawls : null,
    crawler && c.crawlRenderedPages > 0 ? "JavaScript rendering included" : null,
    plan === "AI_VISIBILITY" || plan === "STARTER"
      ? "Email support — 48h weekday response"
      : "Priority support — email, 24h weekday response",
  ];
  return lines.filter((l): l is string => l !== null);
}

/** What a card shows above `below`: its AI line, then only what differs. */
function diffed(plan: Card, below: Card): string[] {
  const shared = new Set(enLines(below));
  return enLines(plan).filter((l, i) => i === 0 || !shared.has(l));
}

// ─── The line-ups, on screen ────────────────────────────────────────────────

describe("the rendered card line-ups", () => {
  it("renders the four self-serve cards, AI Visibility first — Enterprise stays cardless by default", () => {
    renderGrid("en");
    const order = [...document.querySelectorAll("[data-plan]")].map((el) => el.getAttribute("data-plan"));
    expect(order).toEqual([...CARDS]);
    expect(screen.queryByText("/ ENTERPRISE")).toBeNull();
  });

  it("AI VISIBILITY lists all its lines: the AI line, cited sources, trend history, one location, support", () => {
    renderGrid("en");
    expect(bullets("AI_VISIBILITY")).toEqual(enLines("AI_VISIBILITY"));
    expect(bullets("AI_VISIBILITY")).toEqual([
      "10 AI prompts · 3 AI engines · daily (ChatGPT, Google AI Overviews, Gemini)",
      "Cited sources and citation opportunities",
      "Trend history: score and every checkup",
      "1 location",
      "Email support — 48h weekday response",
    ]);
    expect(card("AI_VISIBILITY").textContent).not.toContain("Everything in");
    expect(card("AI_VISIBILITY").textContent).toContain("$29");
  });

  it("STARTER opens with 'Everything in AI Visibility, plus:', its AI line, then what differs", () => {
    renderGrid("en");
    expect(within(card("STARTER")).getByText("Everything in AI Visibility, plus:")).toBeTruthy();
    expect(bullets("STARTER")).toEqual(diffed("STARTER", "AI_VISIBILITY"));
  });

  it("GROWTH keeps its AI line although Starter's reads the same, then the repetitions", () => {
    renderGrid("en");
    expect(within(card("GROWTH")).getByText("Everything in Starter, plus:")).toBeTruthy();
    const lines = bullets("GROWTH");
    expect(lines).toEqual(diffed("GROWTH", "STARTER"));
    expect(lines[0]).toMatch(/^15 AI prompts · 4 AI engines · daily/);
    expect(lines[1]).toBe("Each prompt asked 2× per engine");
  });

  it("AGENCY opens with 'Everything in Growth, plus:' and drops the shared support line", () => {
    renderGrid("en");
    expect(within(card("AGENCY")).getByText("Everything in Growth, plus:")).toBeTruthy();
    const lines = bullets("AGENCY");
    expect(lines).toEqual(diffed("AGENCY", "GROWTH"));
    expect(lines[0]).toMatch(/^20 AI prompts · 4 AI engines · daily/);
    expect(lines.join(" ")).not.toContain("Priority support");
  });

  it("leads every card with the AI line", () => {
    renderGrid("en");
    for (const plan of CARDS) expect(bullets(plan)[0], plan).toMatch(/ AI prompts · /);
  });

  it("every card carries three to nine headline entries (lines + the 'plus' heading)", () => {
    renderGrid("en");
    for (const plan of CARDS) {
      const n = bullets(plan).length + (card(plan).textContent!.includes("Everything in") ? 1 : 0);
      expect(n, plan).toBeGreaterThanOrEqual(3);
      expect(n, plan).toBeLessThanOrEqual(9);
    }
  });

  it("prints each plan's audience line under the price, in every locale", () => {
    for (const locale of ["en", "fr", "de-CH"] as const) {
      renderGrid(locale);
      const base = locale === "de-CH" ? "de" : locale;
      for (const plan of CARDS) {
        expect(within(card(plan)).getByTestId("plan-audience").textContent, `${locale}/${plan}`).toBe(
          PLAN_AUDIENCE[plan][base],
        );
      }
      cleanup();
    }
  });

  it("badges the plan config marks highlighted as Most popular, and only that one", () => {
    renderGrid("en");
    const badged = CARDS.filter((p) => within(card(p)).queryByText("Most popular"));
    expect(badged).toEqual(CARDS.filter((p) => PLAN_CONFIGS[p].highlighted));
    expect(badged).toEqual(["GROWTH"]);
  });

  it("prints the trial line from TRIAL_DAYS on every card", () => {
    renderGrid("en");
    for (const plan of CARDS) {
      expect(within(card(plan)).getByText(`${TRIAL_DAYS}-day free trial · card required`)).toBeTruthy();
    }
  });

  it("links every card to the comparison table", () => {
    renderGrid("en");
    const links = screen.getAllByText("See every feature →");
    expect(links).toHaveLength(CARDS.length);
    for (const a of links) expect(a.getAttribute("href")).toBe("/en/pricing#compare");
  });

  it("the standalone page can point the link at its own #compare", () => {
    renderGrid("en", { compareHref: "#compare" });
    for (const a of screen.getAllByText("See every feature →")) expect(a.getAttribute("href")).toBe("#compare");
  });
});

// ─── French and German ──────────────────────────────────────────────────────

describe("the French and Swiss-German grids", () => {
  it("renders French lines, not English ones", () => {
    renderGrid("fr");
    const all = CARDS.flatMap(bullets).join(" ");
    for (const english of ["location", "feedback requests", "SEO searches", "crawls/mo", "support —", "domain analyses", "AI prompts", "per engine"]) {
      expect(all, `English "${english}" leaked onto a French card`).not.toContain(english);
    }
    expect(bullets("AI_VISIBILITY")[0]).toMatch(/^10 requêtes IA · 3 moteurs IA · quotidien/);
    expect(bullets("AI_VISIBILITY").slice(1, 4)).toEqual([
      "Sources citées et occasions de citation",
      "Historique des tendances : score et chaque vérification",
      `${PLAN_CONFIGS.AI_VISIBILITY.quotaDefaults.maxLocations} emplacement`,
    ]);
    expect(within(card("STARTER")).getByText("Tout ce qu'offre AI Visibility, plus :")).toBeTruthy();
    expect(within(card("GROWTH")).getByText("Tout ce qu'offre Starter, plus :")).toBeTruthy();
  });

  it("renders German lines with Swiss grouping and no ß", () => {
    renderGrid("de-CH");
    const all = CARDS.flatMap(bullets).join(" ");
    expect(all).toContain("Standort");
    expect(all).toContain(PLAN_CONFIGS.AGENCY.crawlUrlCap.toLocaleString("en-US").replace(/,/g, "’"));
    expect(all).not.toContain("ß");
    expect(document.body.textContent).not.toContain("ß");
    expect(within(card("GROWTH")).getByText("Alles aus Starter, dazu:")).toBeTruthy();
  });

  it("uses each locale's chrome around the cards", () => {
    renderGrid("fr");
    expect(screen.getByText("Mensuel")).toBeTruthy();
    expect(screen.getByText("Annuel")).toBeTruthy();
    cleanup();
    renderGrid("de-CH");
    expect(screen.getByText("Monatlich")).toBeTruthy();
    expect(screen.getByText("Jährlich")).toBeTruthy();
  });
});

// ─── The toggle ─────────────────────────────────────────────────────────────

describe("the monthly / yearly toggle", () => {
  it("defaults to monthly prices, with no struck anchor and no yearly total", () => {
    renderGrid("en");
    for (const plan of CARDS) {
      expect(card(plan).querySelector("[class*=pamount]")!.textContent).toContain(`$${PLAN_CONFIGS[plan].monthlyPrice}`);
      expect(card(plan).querySelector("s")).toBeNull();
      expect(card(plan).textContent).not.toContain("yearly");
    }
  });

  it("yearly: per-month rate, struck monthly price, 'billed $X yearly' and the saving — all from config", () => {
    renderGrid("en");
    fireEvent.click(screen.getByText("Yearly"));
    for (const plan of CARDS) {
      const c = PLAN_CONFIGS[plan];
      const el = card(plan);
      expect(el.querySelector("[class*=pamount]")!.textContent).toContain(`$${c.annualPrice}`);
      expect(el.querySelector("s")?.textContent).toBe(`$${c.monthlyPrice}`);
      expect(within(el).getByText(`billed $${en(c.annualPrice * 12)} yearly`)).toBeTruthy();
      expect(within(el).getByText(`save ${savePctOf(c.monthlyPrice, c.annualPrice)}%`)).toBeTruthy();
    }
  });

  it("the saving is rounded down, never up", () => {
    for (const plan of CARDS) {
      const c = PLAN_CONFIGS[plan];
      const exact = ((c.monthlyPrice - c.annualPrice) / c.monthlyPrice) * 100;
      expect(savePctOf(c.monthlyPrice, c.annualPrice)).toBe(Math.floor(exact));
    }
  });

  it("leaves the lines untouched when the interval changes", () => {
    renderGrid("en");
    const monthly = bullets("GROWTH");
    fireEvent.click(screen.getByText("Yearly"));
    expect(bullets("GROWTH")).toEqual(monthly);
  });
});

// ─── What must not have moved ───────────────────────────────────────────────

describe("the surrounding furniture is undisturbed", () => {
  it("still renders the ConsentGate below the cards", () => {
    renderGrid("en");
    expect(screen.getByRole("checkbox")).toBeTruthy();
  });

  it("renders the tool-count line on every card that includes the SEO tools, from the registry counts", () => {
    renderGrid("en");
    const re = new RegExp(`${counts.available} tools available · ${counts.coming} coming`);
    expect(screen.getAllByText(re)).toHaveLength(SEO_CARDS.length);
    for (const plan of SEO_CARDS) expect(within(card(plan)).getByText(re), plan).toBeTruthy();
  });

  it("puts no tool-count or crawl line on the AI Visibility card", () => {
    for (const locale of ["en", "fr", "de-CH"] as const) {
      renderGrid(locale);
      const text = card("AI_VISIBILITY").textContent!;
      expect(text, locale).not.toMatch(/tools available|outils disponibles|Tools verfügbar/);
      expect(text, locale).not.toContain(CRAWLER_BRAND.name);
      cleanup();
    }
  });

  it("prints the French count line on the French grid", () => {
    renderGrid("fr");
    expect(screen.getAllByText(new RegExp(`${counts.available} outils disponibles · ${counts.coming} à venir`))).toHaveLength(SEO_CARDS.length);
  });

  it("still renders one checkout button per paid card", () => {
    renderGrid("en");
    expect(screen.getAllByText("Start free trial")).toHaveLength(CARDS.length);
  });

  it("renders the /credits line once, pointing at this locale's page", () => {
    renderGrid("fr");
    const link = screen.getByText(/Packs de crédits prépayés/);
    expect(link.getAttribute("href")).toBe("/fr/credits");
  });

  it("keeps the tax and currency lines, and adds Stripe + the Enterprise contact under the grid", () => {
    renderGrid("en");
    expect(screen.getByText("tax line")).toBeTruthy();
    expect(screen.getByText("currency line")).toBeTruthy();
    expect(screen.getByText("Secure checkout by Stripe")).toBeTruthy();
    const ent = screen.getByText(/^Enterprise: custom limits/);
    // The sales form, not a mailto (src/lib/sales/), with ?src= naming this grid.
    expect(ent.getAttribute("href")).toBe("/en/enterprise/contact?src=pricing-enterprise");
    expect(screen.queryByText("/ ENTERPRISE")).toBeNull();
  });
});

// ─── The card sets per page ─────────────────────────────────────────────────

describe("each page's card set", () => {
  const shown = () => [...document.querySelectorAll("[data-plan]")].map((el) => el.getAttribute("data-plan"));

  it("/pricing: AI Visibility, Starter, Growth (Most popular), Agency and an Enterprise card", () => {
    renderGrid("en", { enterpriseCard: true });
    expect(shown()).toEqual([...CARDS, "ENTERPRISE"]);
    expect(within(card("GROWTH")).getByText("Most popular")).toBeTruthy();
    const cta = screen.getByTestId("enterprise-card-cta");
    expect(cta.textContent).toBe("Talk to us");
    // The sales form, never a mailto, with ?src= naming the card.
    expect(cta.getAttribute("href")).toBe("/en/enterprise/contact?src=pricing-enterprise-card");
    expect(within(card("ENTERPRISE")).getByText("Custom")).toBeTruthy();
    expect(within(card("ENTERPRISE")).getByTestId("plan-audience").textContent).toBe(PLAN_AUDIENCE.ENTERPRISE.en);
    // The card replaces the under-grid Enterprise line rather than doubling it.
    expect(screen.queryByText(/^Enterprise: custom limits/)).toBeNull();
    expect(document.querySelector("[class*=priceGrid5]")).not.toBeNull();
  });

  it("/pricing in French and Swiss German: the Enterprise card's own words", () => {
    renderGrid("fr", { enterpriseCard: true });
    expect(screen.getByTestId("enterprise-card-cta").textContent).toBe("Parlons-en");
    expect(screen.getByTestId("enterprise-card-cta").getAttribute("href")).toBe("/fr/enterprise/contact?src=pricing-enterprise-card");
    cleanup();
    renderGrid("de-CH", { enterpriseCard: true });
    expect(screen.getByTestId("enterprise-card-cta").textContent).toBe("Kontakt aufnehmen");
  });

  it("homepage: the four paid plans, no Enterprise card", () => {
    renderGrid("en");
    expect(shown()).toEqual([...CARDS]);
    expect(document.querySelector("[class*=priceGrid4]")).not.toBeNull();
  });

  it("/site-crawler: Starter, Growth and Agency, with Starter as the entry card", () => {
    renderGrid("en", { plans: ["STARTER", "GROWTH", "AGENCY"] });
    expect(shown()).toEqual(["STARTER", "GROWTH", "AGENCY"]);
    expect(card("STARTER").textContent).not.toContain("Everything in");
    expect(within(card("GROWTH")).getByText("Everything in Starter, plus:")).toBeTruthy();
  });

  it("every card's price is the config's, on every set", () => {
    renderGrid("en", { enterpriseCard: true });
    for (const plan of CARDS) {
      expect(card(plan).querySelector("[class*=pamount]")!.textContent, plan).toContain(`$${PLAN_CONFIGS[plan].monthlyPrice}`);
    }
    expect(PLAN_CONFIGS.AI_VISIBILITY.monthlyPrice).toBe(29);
    expect(PLAN_CONFIGS.AI_VISIBILITY.annualPrice * 12).toBe(276);
  });
});
