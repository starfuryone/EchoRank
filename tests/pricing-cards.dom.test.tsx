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
import { PLAN_CONFIGS, TRIAL_DAYS } from "@/lib/plan-config";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import type { Locale } from "@/lib/i18n/config";

vi.stubGlobal("fetch", vi.fn());
afterEach(cleanup);

const counts = seoToolCounts();
const CARDS = ["STARTER", "GROWTH", "AGENCY"] as const;
const en = (n: number) => n.toLocaleString("en-US");

function renderGrid(locale: Locale, extra: { compareHref?: string } = {}) {
  return render(
    <PricingSection
      locale={locale}
      pricing={pricingTiers(locale)}
      priceChrome={HOME_PRICING_CHROME[locale]}
      toolCountLine={toolCountLine(locale, counts)}
      tax="tax line"
      currency="currency line"
      header={null}
      {...extra}
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
function enLines(plan: (typeof CARDS)[number]): string[] {
  const c = PLAN_CONFIGS[plan];
  const locs = c.quotaDefaults.maxLocations;
  const engines = c.aiCheckup.providers === null ? "all AI engines" : `${c.aiCheckup.providers} AI engines`;
  const cadence = { weekly: "weekly", twice_weekly: "2×/week", daily: "daily" }[c.aiCheckup.frequency as "weekly"];
  const crawls =
    c.crawlsPerMonth === null
      ? `Unlimited ${CRAWLER_BRAND.name} crawls, up to ${en(c.crawlUrlCap)} URLs each`
      : `${en(c.crawlsPerMonth)} ${CRAWLER_BRAND.name} crawls/mo, up to ${en(c.crawlUrlCap)} URLs each`;
  return [
    `${en(locs)} location${locs === 1 ? "" : "s"}`,
    `AI answer tracking across ${engines} (${cadence})`,
    `${en(c.quotaDefaults.maxRequestsPerMonth)} feedback requests/month`,
    `${en(c.seoSearchesPerMonth!)} SEO searches + ${en(c.trackedKeywords!)} tracked keywords`,
    `${en(c.keywordOpportunityAnalysesPerMonth!)} domain analyses/mo`,
    crawls,
    plan === "STARTER" ? "Email support — 48h weekday response" : "Priority support — email, 24h weekday response",
  ];
}

// ─── The line-ups, on screen ────────────────────────────────────────────────

describe("the rendered card line-ups", () => {
  it("renders three cards and no fourth — Enterprise stays cardless", () => {
    renderGrid("en");
    expect(screen.getByText("/ STARTER")).toBeTruthy();
    expect(screen.getByText("/ GROWTH")).toBeTruthy();
    expect(screen.getByText("/ AGENCY")).toBeTruthy();
    expect(screen.queryByText("/ ENTERPRISE")).toBeNull();
  });

  it("STARTER lists its seven headline lines, in the spec's order", () => {
    renderGrid("en");
    expect(bullets("STARTER")).toEqual(enLines("STARTER"));
    expect(card("STARTER").textContent).not.toContain("Everything in");
  });

  it("GROWTH opens with 'Everything in Starter, plus:' and lists only what differs", () => {
    renderGrid("en");
    expect(within(card("GROWTH")).getByText("Everything in Starter, plus:")).toBeTruthy();
    const starter = new Set(enLines("STARTER"));
    expect(bullets("GROWTH")).toEqual(enLines("GROWTH").filter((l) => !starter.has(l)));
  });

  it("AGENCY opens with 'Everything in Growth, plus:' and drops the shared support line", () => {
    renderGrid("en");
    expect(within(card("AGENCY")).getByText("Everything in Growth, plus:")).toBeTruthy();
    const growth = new Set(enLines("GROWTH"));
    const lines = bullets("AGENCY");
    expect(lines).toEqual(enLines("AGENCY").filter((l) => !growth.has(l)));
    expect(lines.join(" ")).not.toContain("Priority support");
  });

  it("every card carries six to eight headline entries (lines + the 'plus' heading)", () => {
    renderGrid("en");
    for (const plan of CARDS) {
      const n = bullets(plan).length + (card(plan).textContent!.includes("Everything in") ? 1 : 0);
      expect(n, plan).toBeGreaterThanOrEqual(6);
      expect(n, plan).toBeLessThanOrEqual(8);
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
    expect(links).toHaveLength(3);
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
    for (const english of ["location", "feedback requests", "SEO searches", "crawls/mo", "support —", "domain analyses"]) {
      expect(all, `English "${english}" leaked onto a French card`).not.toContain(english);
    }
    expect(bullets("STARTER")[0]).toBe(`${PLAN_CONFIGS.STARTER.quotaDefaults.maxLocations} emplacement`);
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

  it("renders the one tool-count line on every paid card, from the registry counts", () => {
    renderGrid("en");
    expect(screen.getAllByText(new RegExp(`${counts.available} tools available · ${counts.coming} coming`))).toHaveLength(3);
  });

  it("prints the French count line on the French grid", () => {
    renderGrid("fr");
    expect(screen.getAllByText(new RegExp(`${counts.available} outils disponibles · ${counts.coming} à venir`))).toHaveLength(3);
  });

  it("still renders one checkout button per paid card", () => {
    renderGrid("en");
    expect(screen.getAllByText("Start free trial")).toHaveLength(3);
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
    expect(ent.getAttribute("href")).toMatch(/^mailto:/);
    expect(screen.queryByText("/ ENTERPRISE")).toBeNull();
  });
});
