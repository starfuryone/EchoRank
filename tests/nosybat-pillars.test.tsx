// @vitest-environment jsdom
//
// The Nosy Bat pitch, Phase 2 (ECHORANK-NOSYBAT-COPY-REFRESH.md): the seven
// pillars (src/lib/site-crawler/nosybat-pillars.ts) on the homepage card and
// /enterprise, and the crawler line on the /pricing cards
// (pricing-page/headlines.ts). Every number from config and the registry; a
// pillar or clause whose feature is off is left out; the API is named with the
// plans that have it, never "every plan".
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import EnterprisePage from "@/app/[locale]/enterprise/page";
import { FLAGS, type Flags } from "@/lib/flags";
import { PLAN_CONFIGS } from "@/lib/plan-config";
import { cardPlans, planHeadlines } from "@/lib/pricing-page/headlines";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import { NOSYBAT_ENFORCED, buildNosybatFacts, nbNum, nosybatFacts } from "@/lib/site-crawler/nosybat-facts";
import { nosybatPillars } from "@/lib/site-crawler/nosybat-pillars";

const ROOT = join(__dirname, "..");
const flags = (over: Partial<Flags>): Flags => ({ ...FLAGS, ...over });
const ids = (f = nosybatFacts(), b: "en" | "fr" = "en", fl: Flags = FLAGS) => nosybatPillars(f, b, fl).map((p) => p.id);
const text = (f = nosybatFacts(), b: "en" | "fr" = "en", fl: Flags = FLAGS) =>
  nosybatPillars(f, b, fl).map((p) => `${p.title}\n${p.body}\n${p.short}`).join("\n");

describe("the seven pillars", () => {
  it("are all live today, in the brief's order, in en and fr", () => {
    for (const b of ["en", "fr"] as const) expect(ids(nosybatFacts(), b)).toEqual(["checks", "ai-view", "rendering", "room", "recurring", "search-console", "free"]);
  });

  it("no digit in any literal of the source", () => {
    const src = readFileSync(join(ROOT, "src/lib/site-crawler/nosybat-pillars.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const m of src.matchAll(/"([^"\n]*)"|`([^`]*)`/g)) {
      const l = (m[1] ?? m[2])!.replace(/\$\{[^}]*\}/g, "");
      expect(l, l).not.toMatch(/\d/);
    }
  });

  it("read the facts: a changed cap reaches the room pillar", () => {
    const plans = { ...PLAN_CONFIGS, AGENCY: { ...PLAN_CONFIGS.AGENCY, crawlUrlCap: 31_000, crawlPagesPerMonth: 777_000, crawlConcurrency: 6 } };
    const room = nosybatPillars(buildNosybatFacts({ plans }), "en").find((p) => p.id === "room")!;
    expect(room.body).toBe("Up to 31,000 URLs per crawl, 777,000 pages a month, and 6 crawls at once per workspace on Agency. Scheduled crawls run in parallel, not one after another.");
    const fr = nosybatPillars(buildNosybatFacts({ plans }), "fr").find((p) => p.id === "room")!;
    expect(fr.body).toContain(`${nbNum(31_000, "fr")} URL`);
  });

  it("gate the room pillar's limits on enforcement", () => {
    const off = buildNosybatFacts({ enforced: { ...NOSYBAT_ENFORCED, pagesPerMonth: false, crawlsAtOnce: false } });
    const room = nosybatPillars(off, "en").find((p) => p.id === "room")!;
    expect(room.body).not.toMatch(/pages a month|at once|in parallel/);
    expect(room.body).toMatch(/URLs per crawl on Agency\.$/);
  });

  it("leave out a pillar whose feature is off", () => {
    const off = flags({ "crawl.render": false, "crawl.gsc": false, "crawl.free": false });
    expect(ids(nosybatFacts(), "en", off)).toEqual(["checks", "room", "recurring"]);
    const noReports = text(nosybatFacts(), "en", flags({ "crawl.reports": false, "crawl.api": false }));
    expect(noReports).not.toMatch(/PDF|by email|API|MCP/);
  });

  it("name the API with the plans that have api_access, never every plan", () => {
    const f = nosybatFacts();
    const named = [...f.crawlPlans, f.plans.ENTERPRISE].filter((p) => p.api).map((p) => p.name);
    expect(named).toEqual(["Agency", "Enterprise"]);
    const recurring = nosybatPillars(f, "en").find((p) => p.id === "recurring")!;
    expect(recurring.body).toContain("an API with MCP on Agency and Enterprise");
    expect(text()).not.toMatch(/API[^.]*every plan/);
  });

  it("say 'not assessable', never 'failed', for a check that can't be read", () => {
    expect(nosybatPillars(nosybatFacts(), "en")[0]!.body).toContain('marked "not assessable", never counted as a failure');
    expect(nosybatPillars(nosybatFacts(), "fr")[0]!.body).toContain("« non évaluable »");
  });
});

describe("/pricing cards: the crawler line", () => {
  const lines = (locale: string) => Object.fromEntries(cardPlans().map((p) => [p, planHeadlines(p, locale).lines]));

  it("reads plan-config: crawls, URLs, pages a month and crawls at once in one line", () => {
    const en = lines("en");
    for (const p of ["STARTER", "GROWTH", "AGENCY"] as const) {
      const c = PLAN_CONFIGS[p];
      const line = en[p]!.find((l) => l.includes(CRAWLER_BRAND.name))!;
      expect(line).toContain(`up to ${c.crawlUrlCap.toLocaleString("en-US")} URLs each`);
      expect(line).toContain(`${c.crawlPagesPerMonth!.toLocaleString("en-US")} pages/mo`);
      if (c.crawlConcurrency > 1) expect(line).toContain(`${c.crawlConcurrency} at once`);
      else expect(line).not.toContain("at once");
    }
  });

  it("names JavaScript rendering once, on the entry crawl card", () => {
    const en = lines("en");
    expect(en.STARTER).toContain("JavaScript rendering included");
    expect(en.GROWTH).not.toContain("JavaScript rendering included");
    expect(lines("fr").STARTER).toContain("Rendu JavaScript inclus");
    expect(lines("de-CH").STARTER).toContain("JavaScript-Rendering inbegriffen");
  });

  it("the AI Visibility card says nothing about the crawler", () => {
    for (const l of ["en", "fr", "de-CH"]) {
      const ai = planHeadlines("AI_VISIBILITY", l).lines.join(" ");
      expect(ai).not.toContain(CRAWLER_BRAND.name);
      expect(ai).not.toMatch(/JavaScript/);
    }
  });
});

describe("/enterprise: the crawler section", () => {
  const page = async () =>
    new DOMParser().parseFromString(renderToStaticMarkup(await EnterprisePage({ params: Promise.resolve({ locale: "en" }) })), "text/html");

  it("leads with the first pillar and lists the others (the free crawl has its own card below)", async () => {
    const d = await page();
    const pillars = nosybatPillars(nosybatFacts(), "en");
    expect(d.querySelector('#crawler [data-pillar="checks"]')!.textContent).toBe(pillars[0]!.body);
    expect([...d.querySelectorAll('[data-testid="enterprise-pillars"] [data-pillar]')].map((x) => x.getAttribute("data-pillar"))).toEqual(
      pillars.slice(1).filter((p) => p.id !== "free").map((p) => p.id),
    );
  });

  it("its stats and the free crawl card read the facts; no number typed in the page", async () => {
    const d = await page();
    const f = nosybatFacts();
    const stats = [...d.querySelectorAll('[data-testid="enterprise-crawler-stats"] b')].map((b) => b.textContent);
    expect(stats).toEqual([f.rules.label, nbNum(f.topPlan.urlsPerCrawl, "en"), nbNum(f.topPlan.pagesPerMonth!, "en"), nbNum(f.topPlan.crawlsAtOnce, "en")]);
    expect(d.body.textContent).toContain(`Crawl ${f.free.pages} pages →`);
    const src = readFileSync(join(ROOT, "src/app/[locale]/enterprise/page.tsx"), "utf8");
    expect(src).not.toMatch(/\b\d{2,3}\+/);
    expect(src).not.toMatch(/\b100 pages\b/);
  });
});
