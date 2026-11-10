// @vitest-environment jsdom
//
// Homepage /01 — "Two crawlers" (SITE-CRAWLER-HOMEPAGE.md): placement right
// after the hero with contiguous numbering, a derived rule count, gated words
// and a gated link, and the featureList in the homepage JSON-LD.
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.stubGlobal(
  "IntersectionObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const stub = vi.hoisted(() => ({ rules: null as null | { family: string }[], publicPage: true }));
vi.mock("@/lib/crawl-rules", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/crawl-rules")>();
  return {
    ...real,
    get RULES() {
      return stub.rules ?? real.RULES;
    },
  };
});
vi.mock("@/lib/flags", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/flags")>();
  return { ...real, flag: (name: Parameters<typeof real.flag>[0]) => (name === "crawl.publicPage" ? stub.publicPage : real.flag(name)) };
});

import HomePage from "@/app/[locale]/page";
import { TwoCrawlers } from "@/app/[locale]/TwoCrawlers";
import { RULES } from "@/lib/crawl-rules";
import { HOME_TWO_CRAWLERS } from "@/lib/i18n/content";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import { ruleCountLabel } from "@/lib/site-crawler/rule-count";
import { nosybatFacts } from "@/lib/site-crawler/nosybat-facts";
import { nosybatPillars } from "@/lib/site-crawler/nosybat-pillars";

const section = (locale: string) => renderToStaticMarkup(TwoCrawlers({ locale, sectionNumber: "01" }));
const home = async (locale: string) => renderToStaticMarkup(await HomePage({ params: Promise.resolve({ locale }) }));
const COUNT = /\b(\d{2,3}\+?) (checks|rules|vérifications|règles)\b/g;

afterEach(() => {
  stub.rules = null;
  stub.publicPage = true;
});

describe("homepage two-crawlers section", () => {
  it("has the same copy keys in en and fr", () => {
    const shape = (o: unknown): unknown =>
      typeof o === "object" && o !== null
        ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? v.length : shape(v)]))
        : typeof o;
    expect(shape(HOME_TWO_CRAWLERS.fr)).toEqual(shape(HOME_TWO_CRAWLERS.en));
  });

  it("sits directly after the hero, and the eyebrows stay contiguous", async () => {
    const html = await home("en");
    const hero = html.indexOf("</header>");
    const crawlers = html.indexOf('<section id="crawlers"');
    expect(crawlers).toBeGreaterThan(hero);
    expect(html.slice(hero, crawlers)).not.toMatch(/<section/);
    const nums = [...html.matchAll(/<b>\/ (\d\d)<\/b>/g)].map((m) => Number(m[1]));
    expect(nums).toEqual(nums.map((_, i) => i + 1));
    expect(nums[0]).toBe(1);
  });

  it("prints only the derived rule count, in both locales", () => {
    for (const locale of ["en", "fr"]) {
      const found = [...section(locale).matchAll(COUNT)].map((m) => m[1]);
      expect(found.length).toBeGreaterThan(0);
      for (const n of found) expect(n).toBe(ruleCountLabel());
    }
    expect(ruleCountLabel(RULES.length)).toBe(ruleCountLabel());
  });

  it("links to the crawler page only while crawl.publicPage is on", () => {
    expect(section("en")).toContain('href="/en/site-crawler"');
    expect(section("en")).toContain(`Meet ${CRAWLER_BRAND.name}`);
    stub.publicPage = false;
    expect(section("en")).not.toContain("/site-crawler");
    expect(section("en")).not.toContain(`Meet ${CRAWLER_BRAND.name}`);
  });

  it("names a check area only when one of its families is in the registry", () => {
    expect(section("en")).toMatch(/on-page, technical, hreflang, HTTPS, accessibility, spelling, and performance/);
    stub.rules = [{ family: "response_codes" }, { family: "page_titles" }];
    const html = section("en");
    expect(html).toContain("checks across on-page and technical.");
    expect(html).not.toMatch(/hreflang|HTTPS|accessibility|spelling/);
  });

  it("card B is the Nosy Bat pitch: the first pillar, then the others as bullets, from nosybatFacts", () => {
    for (const base of ["en", "fr"] as const) {
      const d = new DOMParser().parseFromString(section(base), "text/html");
      const card = d.querySelectorAll("article")[1]!;
      const pillars = nosybatPillars(nosybatFacts(), base);
      expect(card.querySelector('[data-pillar="checks"]')!.textContent).toBe(pillars[0]!.body);
      expect([...card.querySelectorAll("li")].map((li) => li.textContent)).toEqual(pillars.slice(1).map((p) => p.short));
      expect(card.textContent).toContain(base === "fr" ? "non évaluable" : "not assessable");
    }
  });

  it("sends Card A to the free audit and every other CTA to /pricing", () => {
    const html = section("en");
    expect(html).toContain('href="/en/free-audit"');
    const buttons = [...html.matchAll(/<a class="[^"]*btn[^"]*" href="([^"]+)"/g)].map((m) => m[1]);
    expect(buttons).toEqual(["/en/free-audit", "/en/pricing"]);
  });

  it("adds both crawlers to the homepage featureList", async () => {
    const html = await home("en");
    expect(html).toContain(`"featureList":["AI visibility audit","Site crawler (${CRAWLER_BRAND.name})"]`);
  });
});
