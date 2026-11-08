// @vitest-environment jsdom
//
// /pricing rebuilt on the EchoPilot page model (ECHORANK-PRICING.md): the
// hero saving, the headline lines, the Free-vs-paid table, the FAQ and its
// FAQPage JSON-LD, the Offer JSON-LD — and the three pages that render the
// shared cards (/pricing, the homepage, /site-crawler) agreeing on every price
// and on the one tool-count line.
//
// EXPECTED VALUES ARE READ FROM CONFIG, NEVER TYPED.

import { readFileSync } from "node:fs";
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
import { PLAN_CONFIGS, TRIAL_DAYS, type SellablePlanType } from "@/lib/plan-config";
import { planFeatures } from "@/lib/plan-features";
import { pricingTiers, savePctOf, yearlySavingPct } from "@/lib/pricing-tiers";
import { cardPlans, planHeadlines, supportLine } from "@/lib/pricing-page/headlines";
import { comparisonTable } from "@/lib/pricing-page/compare";
import { pricingFaq } from "@/lib/pricing-page/faq";
import { planAllowsArea } from "@/lib/plan-access";
import { SUPPORT_EMAIL } from "@/lib/assistant/config";
import { PRICING_PAGE_COPY } from "@/lib/pricing-page/copy";
import { toolCountLine } from "@/lib/i18n/content";
import { seoToolCounts } from "@/lib/seo-tools";
import { FREE_CRAWL_URL_CAP } from "@/lib/site-crawler/free-limits";
import { AV_FREE_AUDITS_PER_DAY } from "@/lib/av-free-limit";
import { RUNS_PER_IP_PER_DAY } from "@/lib/snapshot/limits";
import type { Locale } from "@/lib/i18n/config";

const P = (locale: string) => ({ params: Promise.resolve({ locale }) });
const LOCALES: Locale[] = ["en", "en-CA", "fr", "fr-CA", "de-CH"];
const CARDS = cardPlans();

async function pricingHtml(locale: string): Promise<string> {
  return renderToStaticMarkup(await PricingPage(P(locale)));
}
function doc(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}
function graph(html: string): Array<Record<string, unknown>> {
  const raw = doc(html).querySelector('script[type="application/ld+json"]')!.textContent!;
  return (JSON.parse(raw) as { "@graph": Array<Record<string, unknown>> })["@graph"];
}

// ─── Config-derived numbers ─────────────────────────────────────────────────

describe("the yearly saving", () => {
  it("is the smallest per-tier saving, rounded down", () => {
    const each = CARDS.map((p) => Math.floor(((PLAN_CONFIGS[p].monthlyPrice - PLAN_CONFIGS[p].annualPrice) / PLAN_CONFIGS[p].monthlyPrice) * 100));
    expect(yearlySavingPct()).toBe(Math.min(...each));
  });

  it("every tier's card saving and yearly total come from its own config", () => {
    for (const t of pricingTiers("en")) {
      const c = PLAN_CONFIGS[t.id as SellablePlanType];
      expect(t.savePct).toBe(savePctOf(c.monthlyPrice, c.annualPrice));
      expect(t.annualTotal).toBe(c.annualPrice * 12);
      expect(t.trialDays).toBe(TRIAL_DAYS);
    }
  });
});

describe("headline lines", () => {
  it("support wording is the same binding promise plan-features.ts makes (en, fr)", () => {
    for (const plan of CARDS) {
      for (const [loc, base] of [["en", "en"], ["fr", "fr"]] as const) {
        expect(planFeatures(plan, loc)).toContain(supportLine(plan, base));
      }
    }
  });

  it("each line carries its tier's configured numbers", () => {
    for (const plan of CARDS) {
      const c = PLAN_CONFIGS[plan];
      const all = planHeadlines(plan, "en").lines.join(" | ");
      if (plan === CARDS[0]) {
        expect(all).toContain(`${c.quotaDefaults.maxLocations} location`);
      }
      expect(all).toContain(c.crawlUrlCap.toLocaleString("en-US"));
      expect(all).toContain(c.quotaDefaults.maxRequestsPerMonth.toLocaleString("en-US"));
      expect(all).toContain(c.seoSearchesPerMonth!.toLocaleString("en-US"));
    }
  });

  it("de-CH lines use the Swiss apostrophe and never ß", () => {
    for (const plan of CARDS) {
      const lines = planHeadlines(plan, "de-CH").lines.join(" ");
      expect(lines).not.toContain("ß");
      expect(lines).not.toMatch(/\d,\d{3}/);
    }
  });
});

// ─── /pricing in every locale ───────────────────────────────────────────────

describe("/pricing page structure", () => {
  it.each(LOCALES)("%s: hero, cards, compare table, FAQ, closing band, in order", async (l) => {
    const html = await pricingHtml(l);
    const d = doc(html);
    const ids = [...d.querySelectorAll("section[id]")].map((s) => s.id);
    expect(ids).toEqual(["pricing", "compare", "faq"]);
    expect(d.querySelectorAll("h1")).toHaveLength(1);
    // Hero subhead: the saving from config.
    expect(d.querySelector('[data-testid="pricing-sub"]')!.textContent).toContain(String(yearlySavingPct()));
    // Closing band leads to the cards.
    const closing = [...d.querySelectorAll("a")].filter((a) => a.getAttribute("href") === "#pricing");
    expect(closing.length).toBeGreaterThan(0);
    // Every card links to this page's own table.
    expect([...d.querySelectorAll("a")].filter((a) => a.getAttribute("href") === "#compare")).toHaveLength(CARDS.length);
  });

  it("carries no English page copy on fr or de-CH", async () => {
    for (const l of ["fr", "de-CH"]) {
      const d = doc(await pricingHtml(l));
      const text = d.body.textContent!;
      for (const english of [PRICING_PAGE_COPY.en.compareH2, PRICING_PAGE_COPY.en.faqH2, PRICING_PAGE_COPY.en.closingCta, "feedback requests", "Is there a free trial"]) {
        expect(text, `${l}: "${english}"`).not.toContain(english);
      }
      if (l === "de-CH") expect(text).not.toContain("ß");
    }
  });

  it("keeps the legal agreement line, the USD note and the credits link", async () => {
    const d = doc(await pricingHtml("en"));
    expect(d.querySelector('input[type="checkbox"]')).toBeTruthy();
    expect(d.body.textContent).toContain("US dollars (USD)");
    expect([...d.querySelectorAll("a")].some((a) => a.getAttribute("href") === "/en/credits")).toBe(true);
    expect(d.body.textContent).toContain(`free for ${TRIAL_DAYS} days`);
  });

  it("renders no sample-output or estimator section (skipped: nothing real to show / no grounded defaults)", async () => {
    const d = doc(await pricingHtml("en"));
    expect(d.querySelector("#sample, #estimator")).toBeNull();
  });
});

// ─── The comparison table ───────────────────────────────────────────────────

describe("Free vs paid", () => {
  it("has the Free column and one column per card tier, grouped by area", async () => {
    const d = doc(await pricingHtml("en"));
    const head = [...d.querySelectorAll('[data-testid="compare-table"] thead th')].map((th) => th.textContent);
    expect(head.slice(2)).toEqual(CARDS.map((p) => PLAN_CONFIGS[p].name));
    expect(head[1]).toContain("Free");
    const groups = [...d.querySelectorAll("[data-testid=compare-table] tbody")].map((t) => t.getAttribute("data-group"));
    expect(groups).toEqual(["ai", "reputation", "seo", "crawler", "support"]);
  });

  it("every paid number cell equals config", () => {
    const t = comparisonTable("en");
    const cell = (row: string, plan: SellablePlanType) => {
      const r = t.groups.flatMap((g) => g.rows).find((x) => x.id === row)!;
      const c = r.plans[plan]!;
      return c.kind === "text" ? c.text : c.kind;
    };
    // A 0 allowance is a locked tool, so the cell is "not included", not "0".
    const num = (n: number | null) => (n === null ? "Unlimited" : n === 0 ? "no" : n.toLocaleString("en-US"));
    for (const p of CARDS) {
      const c = PLAN_CONFIGS[p];
      expect(cell("locations", p)).toBe(num(c.quotaDefaults.maxLocations));
      expect(cell("feedback", p)).toBe(num(c.quotaDefaults.maxRequestsPerMonth));
      expect(cell("searches", p)).toBe(num(c.seoSearchesPerMonth));
      expect(cell("keywords", p)).toBe(num(c.trackedKeywords));
      expect(cell("urls", p)).toBe(num(c.crawlUrlCap));
      expect(cell("crawls", p)).toBe(num(c.crawlsPerMonth));
      expect(cell("kept", p)).toBe(num(c.crawlsKept));
      expect(cell("rendered", p)).toBe(num(c.crawlRenderedPages));
      expect(cell("brands", p)).toBe(num(c.aiProjects));
      expect(cell("sms", p)).toBe(c.quotaDefaults.maxSmsPerMonth === 0 ? "no" : num(c.quotaDefaults.maxSmsPerMonth));
      expect(cell("tools", p)).toBe(planAllowsArea(p, "seo_tools") ? toolCountLine("en", seoToolCounts()) : "no");
    }
  });

  it("has an AI Visibility column: AI rows filled, every SEO, crawler and reputation volume not included", () => {
    const t = comparisonTable("en");
    const cell = (row: string) => {
      const r = t.groups.flatMap((g) => g.rows).find((x) => x.id === row)!;
      const c = r.plans.AI_VISIBILITY!;
      return c.kind === "text" ? c.text : c.kind;
    };
    expect(CARDS[0]).toBe("AI_VISIBILITY");
    expect(cell("locations")).toBe("1");
    for (const row of ["feedback", "searches", "keywords", "tools", "sms"]) expect(cell(row), row).toBe("no");
    // Cited sources and trend history are part of AI visibility (2026-11-07), on every column.
    for (const p of CARDS) {
      const r = (id: string) => t.groups.flatMap((g) => g.rows).find((x) => x.id === id)!.plans[p]!.kind;
      expect(r("citations"), p).toBe("yes");
      expect(r("history"), p).toBe("yes");
    }
  });

  it("the Free column reads the free tools' own limits and links to each tool", async () => {
    const d = doc(await pricingHtml("en"));
    const free = (row: string) => d.querySelector(`[data-row="${row}"] td`)!;
    expect(free("audit").textContent).toContain(String(AV_FREE_AUDITS_PER_DAY));
    expect(free("audit").querySelector("a")!.getAttribute("href")).toBe("/en/free-audit");
    expect(free("tracking").textContent).toContain(`${RUNS_PER_IP_PER_DAY} a day`);
    expect(free("tracking").querySelector("a")!.getAttribute("href")).toBe("/en/ai-visibility-check");
    expect(free("tools").querySelector("a")!.getAttribute("href")).toBe("/en/free-tools");
    const urls = free("urls");
    if (urls.querySelector("a")) {
      expect(urls.textContent).toContain(String(FREE_CRAWL_URL_CAP));
      expect(urls.querySelector("a")!.getAttribute("href")).toBe("/en/free-tools/site-crawler");
    }
  });

  it("yes/no marks carry a spoken label", async () => {
    const d = doc(await pricingHtml("en"));
    const marks = [...d.querySelectorAll("[data-testid=compare-table] td")].filter((td) => /^[✓—]/.test(td.textContent!));
    expect(marks.length).toBeGreaterThan(0);
    for (const td of marks) expect(td.textContent).toMatch(/Included|Not included/);
  });

  it("sits in its own scroll box with a sticky header and a pinned first column", () => {
    const css = readFileSync(join(process.cwd(), "src/app/[locale]/pricing/pricing.module.css"), "utf8");
    expect(css).toMatch(/\.scroll\{[^}]*overflow:auto/);
    expect(css).toMatch(/thead th\{position:sticky;top:0/);
    expect(css).toMatch(/\.first\{position:sticky;left:0/);
  });
});

// ─── FAQ + JSON-LD ──────────────────────────────────────────────────────────

describe("Straight answers and the structured data", () => {
  it.each(LOCALES)("%s: FAQPage JSON-LD lists every question on the page, as plain text", async (l) => {
    const html = await pricingHtml(l);
    const items = pricingFaq(l, { savePct: yearlySavingPct()!, freeCrawler: true });
    const faq = graph(html).find((n) => n["@type"] === "FAQPage") as { mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }> };
    expect(faq).toBeTruthy();
    expect(faq.mainEntity).toHaveLength(12);
    expect(faq.mainEntity.map((q) => q.name)).toEqual(items.map((i) => i.q));
    for (const q of faq.mainEntity) expect(q.acceptedAnswer.text).not.toMatch(/\*\*|\]\(/);
    const shown = [...doc(html).querySelectorAll("[data-faq] h3")].map((h) => h.textContent);
    expect(shown).toEqual(items.map((i) => i.q));
  });

  it.each(LOCALES)("%s: no [CONFIRM] anywhere in the rendered page, markup included", async (l) => {
    expect(await pricingHtml(l)).not.toContain("CONFIRM");
  });

  it("covers the spec's ten topics plus the AI-only question first and social posting, all answered", () => {
    for (const l of ["en", "fr", "de-CH"]) {
      const items = pricingFaq(l, { savePct: 20, freeCrawler: true });
      expect(items.map((i) => i.id)).toEqual(["ai-only", "trial", "cancel", "location", "limits", "billing", "crawler", "social", "seats", "payment", "refunds", "tax"]);
      for (const it of items) expect(it.a.length, `${l} ${it.id}`).toBeGreaterThan(40);
    }
  });

  it("answers 'Which plan if I only need AI visibility?' with the AI plan's own numbers", () => {
    const ai = PLAN_CONFIGS.AI_VISIBILITY;
    const q = { en: "Which plan if I only need AI visibility?" } as const;
    const en = pricingFaq("en", { savePct: 20, freeCrawler: true })[0]!;
    expect(en.q).toBe(q.en);
    expect(en.a).toContain(ai.name);
    expect(en.a).toContain(`$${ai.monthlyPrice}`);
    expect(en.a).toContain(String(ai.aiCheckup.prompts));
    for (const l of ["fr", "de-CH"]) {
      const a = pricingFaq(l, { savePct: 20, freeCrawler: true })[0]!.a;
      expect(a, l).toContain(String(ai.aiCheckup.prompts));
      expect(a, l).toContain(String(ai.monthlyPrice));
    }
  });

  it("the crawler answer names the first plan that includes the crawler, not 'every plan'", () => {
    const a = pricingFaq("en", { savePct: 20, freeCrawler: true }).find((i) => i.id === "crawler")!.a;
    expect(a).toContain("every plan from Starter");
  });

  it("trial and refund answers state TRIAL_DAYS from config", () => {
    for (const l of ["en", "fr", "de-CH"]) {
      const items = pricingFaq(l, { savePct: 20, freeCrawler: true });
      for (const id of ["trial", "refunds"]) {
        expect(items.find((i) => i.id === id)!.a, `${l} ${id}`).toContain(String(TRIAL_DAYS));
      }
    }
  });

  it("the location answer lists each tier's configured location count", () => {
    const joiner = { en: "on", fr: "avec", "de-CH": "bei" } as const;
    for (const l of ["en", "fr", "de-CH"] as const) {
      const a = pricingFaq(l, { savePct: 20, freeCrawler: true }).find((i) => i.id === "location")!.a;
      for (const p of CARDS) {
        // Location counts are below 1,000, so no grouping separator applies.
        expect(a, `${l} ${p}`).toContain(`${PLAN_CONFIGS[p].quotaDefaults.maxLocations} ${joiner[l]} ${PLAN_CONFIGS[p].name}`);
      }
    }
  });

  it("the billing answer sends interval switches to the support address", () => {
    for (const l of ["en", "fr", "de-CH"]) {
      expect(pricingFaq(l, { savePct: 20, freeCrawler: true }).find((i) => i.id === "billing")!.a).toContain(SUPPORT_EMAIL);
    }
  });

  it("Offer JSON-LD prices equal the configured monthly prices", async () => {
    const app = graph(await pricingHtml("en")).find((n) => n["@type"] === "SoftwareApplication") as { offers: Array<{ name: string; price: number | string }> };
    for (const plan of CARDS) {
      const offer = app.offers.find((o) => o.name === PLAN_CONFIGS[plan].name);
      expect(offer, plan).toBeTruthy();
      expect(String(offer!.price)).toBe(String(PLAN_CONFIGS[plan].monthlyPrice));
    }
  });
});

// ─── The three pages agree ──────────────────────────────────────────────────

describe("/pricing, the homepage and /site-crawler render the same cards", () => {
  async function pages(l: string) {
    const Home = (await import("@/app/[locale]/page")).default;
    const Crawler = (await import("@/app/[locale]/site-crawler/page")).default;
    return {
      pricing: doc(await pricingHtml(l)),
      home: doc(renderToStaticMarkup(await Home(P(l) as never))),
      crawler: doc(renderToStaticMarkup(await Crawler(P(l) as never))),
    };
  }

  it.each(["en", "fr", "de-CH"])("%s: same monthly prices, trial line and tool-count line on every card", async (l) => {
    const all = await pages(l);
    const line = toolCountLine(l as Locale, seoToolCounts());
    for (const [name, d] of Object.entries(all)) {
      // /site-crawler sells the crawler, so it shows only the plans that include it.
      const plans = name === "crawler" ? CARDS.filter((p) => planAllowsArea(p, "crawler")) : CARDS;
      for (const plan of plans) {
        const card = d.querySelector(`[data-plan="${plan}"]`);
        expect(card, `${name} ${plan}`).toBeTruthy();
        expect(card!.querySelector("[class*=pamount]")!.textContent, `${name} ${plan}`).toContain(`$${PLAN_CONFIGS[plan].monthlyPrice}`);
        expect(card!.textContent, `${name} ${plan}`).toContain(String(TRIAL_DAYS));
        const tools = card!.querySelector("[class*=ptools]");
        if (planAllowsArea(plan, "seo_tools")) expect(tools!.textContent, `${name} ${plan}`).toContain(line);
        else expect(tools, `${name} ${plan} has a tool-count line`).toBeNull();
      }
    }
  }, 30_000);

  it("en: /pricing shows five cards with Enterprise, the homepage four, /site-crawler three", async () => {
    const all = await pages("en");
    // Cards only: the comparison table carries data-plan on its cells too.
    const shown = (d: Document) =>
      [...d.querySelectorAll("[class*=priceGrid] > [data-plan]")].map((el) => el.getAttribute("data-plan"));
    expect(shown(all.pricing)).toEqual(["AI_VISIBILITY", "STARTER", "GROWTH", "AGENCY", "ENTERPRISE"]);
    expect(shown(all.home)).toEqual(["AI_VISIBILITY", "STARTER", "GROWTH", "AGENCY"]);
    expect(shown(all.crawler)).toEqual(["STARTER", "GROWTH", "AGENCY"]);
    const cta = all.pricing.querySelector("[data-testid=enterprise-card-cta]")!;
    expect(cta.getAttribute("href")).toBe("/en/enterprise/contact?src=pricing-enterprise-card");
    expect(all.home.querySelector("[data-testid=enterprise-card-cta]")).toBeNull();
  }, 30_000);
});

// ─── No typed prices ────────────────────────────────────────────────────────

describe("no hard-coded prices in the changed copy files", () => {
  const FILES = [
    "src/lib/pricing-page/copy.ts",
    "src/lib/pricing-page/headlines.ts",
    "src/lib/pricing-page/compare.ts",
    "src/lib/pricing-page/faq.ts",
    "src/app/[locale]/pricing/page.tsx",
    "src/app/[locale]/pricing/CompareTable.tsx",
    "src/app/[locale]/PricingSection.tsx",
  ];
  it.each(FILES)("%s has no literal $<digit>", (f) => {
    const src = readFileSync(join(process.cwd(), f), "utf8");
    expect(src.match(/\$[0-9]/g) ?? []).toEqual([]);
  });

  it("the pricing chrome and notes carry templates, not numbers", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/i18n/content.ts"), "utf8");
    const chrome = src.slice(src.indexOf("export const HOME_PRICING_CHROME"), src.indexOf("export const CONSENT_COPY"));
    const notes = src.slice(src.indexOf("export const PRICING_NOTES"), src.indexOf("export function pricingNotes"));
    for (const block of [chrome, notes]) {
      expect(block.match(/\$[0-9]/g) ?? []).toEqual([]);
      expect(block).not.toMatch(/\b7\b/);
    }
  });
});
