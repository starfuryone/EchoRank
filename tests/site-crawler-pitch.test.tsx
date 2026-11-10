// @vitest-environment jsdom
//
// The crawler's sales pitch on /[locale]/site-crawler (src/lib/site-crawler/pitch-copy.ts):
// the hero, six blocks under it and the closing band. Every number comes from
// nosybatFacts; a block whose feature is off is dropped; the API is never
// claimed for every plan; both buttons go somewhere that exists.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Page from "@/app/[locale]/site-crawler/page";
import { FLAGS, type Flags } from "@/lib/flags";
import { PLAN_CONFIGS } from "@/lib/plan-config";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import { buildNosybatFacts, nbNum, nosybatFacts } from "@/lib/site-crawler/nosybat-facts";
import { pitchCopy } from "@/lib/site-crawler/pitch-copy";

const ROOT = join(__dirname, "..");
const render = async (locale: string) =>
  new DOMParser().parseFromString(renderToStaticMarkup(await Page({ params: Promise.resolve({ locale }) })), "text/html");
const flags = (over: Partial<Flags>): Flags => ({ ...FLAGS, ...over });
const all = (p: ReturnType<typeof pitchCopy>) => [p.h1, p.sub, p.freeButton ?? "", p.plansButton, ...p.blocks.flatMap((b) => [b.heading, b.body]), p.closing].join("\n");

describe("the pitch copy", () => {
  it.each(["en", "fr"] as const)("%s: six blocks today, in order, none dropped", (b) => {
    const p = pitchCopy(nosybatFacts(), b);
    expect(p.blocks.map((x) => x.id)).toEqual(["proof", "checks", "ai-view", "rendering", "room", "team"]);
    expect(p.dropped).toEqual([]);
  });

  it("says what the brief says, with every figure from config and the registry", () => {
    const f = nosybatFacts();
    const p = pitchCopy(f, "en");
    expect(p.h1).toBe("The SEO crawler that checks every page and shows its evidence.");
    expect(p.sub).toBe(
      `${f.rules.label} checks, JavaScript rendering on every plan from ${f.firstPlan.name}, from $${PLAN_CONFIGS.STARTER.monthlyPrice}/month. Crawl ${f.free.pages} pages free, no account.`,
    );
    expect(p.blocks.find((x) => x.id === "room")!.body).toBe(
      `Up to ${nbNum(PLAN_CONFIGS.AGENCY.crawlUrlCap, "en")} URLs per crawl and ${nbNum(PLAN_CONFIGS.AGENCY.crawlPagesPerMonth!, "en")} pages a month on Agency. Schedule crawls, compare one crawl with the last, and check a staging site before launch.`,
    );
    expect(p.closing).toBe(`Crawl ${f.free.pages} pages free. Plans from $${PLAN_CONFIGS.STARTER.monthlyPrice}/month with a ${f.trialDays}-day trial.`);
    expect(p.freeButton).toBe(`Crawl ${f.free.pages} pages free`);
  });

  it("no typed count, cap or price in the copy source", () => {
    const src = readFileSync(join(ROOT, "src/lib/site-crawler/pitch-copy.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    // Every string literal and template chunk: no digit at all, no "$" before a digit.
    const literals = [...src.matchAll(/"([^"\n]*)"|`([^`]*)`/g)].map((m) => (m[1] ?? m[2])!.replace(/\$\{[^}]*\}/g, ""));
    for (const l of literals) expect(l, l).not.toMatch(/\d/);
  });

  it("follows the config: a changed cap, price or trial changes the copy", () => {
    const plans = {
      ...PLAN_CONFIGS,
      STARTER: { ...PLAN_CONFIGS.STARTER, monthlyPrice: 81 },
      AGENCY: { ...PLAN_CONFIGS.AGENCY, crawlUrlCap: 12_345, crawlPagesPerMonth: 456_789 },
    };
    const p = all(pitchCopy(buildNosybatFacts({ plans }), "en"));
    expect(p).toContain("$81/month");
    expect(p).toContain("12,345 URLs per crawl");
    expect(p).toContain("456,789 pages a month");
    const fr = all(pitchCopy(buildNosybatFacts({ plans }), "fr"));
    expect(fr).toContain(`${nbNum(12_345, "fr")} URL`);
  });

  it("drops what is not live: rendering off, the page allowance not enforced, the free crawler off", () => {
    const f = nosybatFacts();
    const off = pitchCopy(f, "en", flags({ "crawl.render": false, "crawl.free": false }));
    expect(off.blocks.map((x) => x.id)).toEqual(["proof", "checks", "room", "team"]);
    expect(off.dropped.map((d) => d.id)).toEqual(["ai-view", "rendering"]);
    expect(off.sub).not.toContain("JavaScript");
    expect(off.freeButton).toBeNull();
    expect(off.closing).not.toContain("free");
    const unenforced = buildNosybatFacts({ enforced: { ...f.enforced, pagesPerMonth: false } });
    expect(pitchCopy(unenforced, "en").blocks.find((x) => x.id === "room")!.body).not.toContain("pages a month");
    // A crawl plan that renders nothing: no "rendering on every plan" anywhere.
    const noRender = buildNosybatFacts({ plans: { ...PLAN_CONFIGS, STARTER: { ...PLAN_CONFIGS.STARTER, crawlRenderedPages: 0 } } });
    expect(all(pitchCopy(noRender, "en"))).not.toContain("JavaScript rendering on every plan");
  });

  it("never claims the API: it is Agency-only today, not every plan", () => {
    expect(nosybatFacts().everyPlan.api).toBe(false);
    for (const b of ["en", "fr"] as const) expect(all(pitchCopy(nosybatFacts(), b))).not.toMatch(/\bAPI\b|MCP/);
  });

  it("real French, not the English", () => {
    const en = pitchCopy(nosybatFacts(), "en");
    const fr = pitchCopy(nosybatFacts(), "fr");
    expect(fr.blocks.map((x) => x.heading)).not.toEqual(en.blocks.map((x) => x.heading));
    expect(fr.h1).toBe("Le robot d'exploration SEO qui vérifie chaque page et montre ses preuves.");
    expect(fr.closing).toContain("jours d'essai");
  });
});

describe("/site-crawler: hero, pitch, closing band", () => {
  it.each([
    ["en", "en"],
    ["fr", "fr"],
  ] as const)("%s: H1, sub-line, both buttons, the six blocks under the hero", async (locale, b) => {
    const d = await render(locale);
    const p = pitchCopy(nosybatFacts(), b);
    expect(d.querySelector("h1")!.textContent).toBe(p.h1);
    const sections = [...d.querySelectorAll("section")];
    expect(sections[0]!.querySelector('[data-testid="hero-lockup"]')).not.toBeNull();
    expect(sections[1]!.getAttribute("data-testid")).toBe("nb-pitch");
    expect([...sections[1]!.querySelectorAll("[data-block]")].map((x) => x.getAttribute("data-block"))).toEqual(p.blocks.map((x) => x.id));
    expect(sections[0]!.textContent).toContain(p.sub);
    // The old capability intro is gone from the page.
    expect(d.body.textContent).not.toContain(`${CRAWLER_BRAND.name} is the site crawler inside Echorank`);
    const last = sections[sections.length - 1]!;
    expect(last.getAttribute("data-testid")).toBe("nb-closing");
    expect(last.textContent).toContain(p.closing);
  });

  it.each(["site-crawler-hero", "site-crawler-closing"])("%s: both buttons resolve (the free crawl, /pricing with its src)", async (src) => {
    for (const locale of ["en", "fr"]) {
      const d = await render(locale);
      const free = d.querySelector(`[data-testid="${src}-free"]`)!.getAttribute("href");
      const plans = d.querySelector(`[data-testid="${src}-plans"]`)!.getAttribute("href");
      expect(free).toBe(`/${locale}/free-tools/site-crawler`);
      expect(plans).toBe(`/${locale}/pricing?src=${src}`);
      // The routes behind them exist.
      expect(existsSync(join(ROOT, "src/app/[locale]/free-tools/site-crawler/page.tsx"))).toBe(true);
      expect(existsSync(join(ROOT, "src/app/[locale]/pricing/page.tsx"))).toBe(true);
    }
  });

  it("no horizontal scroll at 375 px: the pitch grid is one column on phones and never wider than its track", () => {
    const css = readFileSync(join(ROOT, "src/app/[locale]/site-crawler/site-crawler.module.css"), "utf8");
    expect(css).toMatch(/\.pitchGrid\{display:grid;grid-template-columns:1fr;/);
    expect(css).toMatch(/@media\(min-width:760px\)\{\.pitchGrid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}\}/);
  });
});
