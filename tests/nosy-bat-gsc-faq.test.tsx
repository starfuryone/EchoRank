// /site-crawler FAQ, first question (2026-11-09): "Google Search Console is
// free. Why would I pay for Nosy Bat?" The page and its FAQPage JSON-LD say
// the same thing in en and fr; every number is config; each bullet shows only
// while the feature it describes is on.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Page from "@/app/[locale]/site-crawler/page";
import { FLAGS, type Flags } from "@/lib/flags";
import { PLAN_CONFIGS } from "@/lib/plan-config";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import { FREE_CRAWL_URL_CAP } from "@/lib/site-crawler/free-limits";
import { CRAWL_PLANS, faqPlainText, visibleFaq } from "@/lib/site-crawler/marketing-copy";
import { ruleCountLabel } from "@/lib/site-crawler/rule-count";

const NB = CRAWLER_BRAND.name;
const ROOT = join(__dirname, "..");
const decode = (s: string) =>
  s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const ctx = (flags: Flags = FLAGS) => ({ families: new Set<string>(), flags, plans: PLAN_CONFIGS, ruleCount: ruleCountLabel() });
const render = async (locale: string) => decode(renderToStaticMarkup(await Page({ params: Promise.resolve({ locale }) })));
const nf = (n: number, b: "en" | "fr") => new Intl.NumberFormat(b === "fr" ? "fr-CA" : "en-US").format(n);

describe("the Search Console question", () => {
  it.each(["en", "fr"] as const)("%s: it is the first question on the page and in the FAQPage JSON-LD, with the same answer", async (b) => {
    const faq = visibleFaq(ctx(), b);
    expect(faq[0].q).toMatch(/Search Console/);
    const html = await render(b);
    const firstQ = html.match(/<h3 class="[^"]*faqQ[^"]*">([^<]+)<\/h3>/)![1];
    expect(firstQ).toBe(faq[0].q);
    const graph = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1])["@graph"] as Record<string, unknown>[];
    const page = graph.find((n) => n["@type"] === "FAQPage") as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
    expect(page.mainEntity[0].name).toBe(faq[0].q);
    expect(page.mainEntity[0].acceptedAnswer.text).toBe(faqPlainText(faq[0]));
    // Every bullet the page shows is in the JSON-LD answer, and on the page.
    for (const item of faq[0].list!) {
      expect(page.mainEntity[0].acceptedAnswer.text).toContain(item.lead);
      expect(html).toContain(item.lead);
      expect(html).toContain(item.text);
      for (const s of item.sub ?? []) expect(html).toContain(s);
    }
    expect(html).toContain(faq[0].after!.text);
    // The other questions are unchanged and still follow it.
    expect(faq.length).toBeGreaterThan(1);
    expect(page.mainEntity).toHaveLength(faq.length);
  });

  it.each(["en", "fr"] as const)("%s: the numbers are config: Agency URLs per crawl, rule count, free crawl, first plan and price", (b) => {
    const text = faqPlainText(visibleFaq(ctx(), b)[0]);
    const first = PLAN_CONFIGS[CRAWL_PLANS[0]];
    expect(first.name).toBe("Starter");
    expect(text).toContain(nf(PLAN_CONFIGS.AGENCY.crawlUrlCap, b));
    expect(text).toContain(ruleCountLabel());
    expect(text).toContain(nf(FREE_CRAWL_URL_CAP, b));
    expect(text).toContain(first.name);
    expect(text).toContain(`$${nf(first.monthlyPrice, b)}`);
  });

  it("the source types no Nosy Bat count or price (the 1,000 is Search Console's own example limit)", () => {
    const src = readFileSync(join(ROOT, "src/lib/site-crawler/marketing-copy.ts"), "utf8");
    const block = src.slice(src.indexOf("function gscFaqList"), src.indexOf("export const CRAWL_FAQ"));
    const numbers = [...block.matchAll(/\b\d[\d, ]*\d\b|\$\d+/g)].map((m) => m[0].trim()).filter((n) => !/^1[, ]000$/.test(n));
    expect(numbers).toEqual([]);
  });

  it("each bullet follows its feature flag", () => {
    const leads = (flags: Flags) => visibleFaq(ctx(flags), "en")[0].list!.map((i) => i.lead);
    expect(leads(FLAGS)).toContain("It shows your site the way AI crawlers see it.");
    expect(leads({ ...FLAGS, "crawl.render": false })).not.toContain("It shows your site the way AI crawlers see it.");
    expect(leads({ ...FLAGS, "crawl.login": false })).not.toContain("It works before Google does.");
    const free = (flags: Flags) => visibleFaq(ctx(flags), "en")[0].list!.find((i) => i.lead === "Try it first.")!.text;
    expect(free(FLAGS)).toMatch(/pages free, with no account/);
    expect(free({ ...FLAGS, "crawl.free": false })).not.toMatch(/pages free/);
    const intro = (flags: Flags) => visibleFaq(ctx(flags), "en")[0].a;
    expect(intro(FLAGS)).toMatch(/pulls in your Search Console data/);
    expect(intro({ ...FLAGS, "crawl.gsc": false })).not.toMatch(/pulls in/);
    const recurring = (flags: Flags) => visibleFaq(ctx(flags), "en")[0].list!.find((i) => i.lead === "It fits recurring work.")!.text;
    expect(recurring(FLAGS)).toBe(
      "Scheduled crawls, crawl-to-crawl comparison, results by email, CSV on every table, a PDF report per crawl, and an API with MCP. One plan covers your whole team, with no per-seat pricing.",
    );
    expect(recurring({ ...FLAGS, "crawl.api": false })).not.toMatch(/API/);
  });

  it("names the crawler by its brand and keeps the text as written", () => {
    const f = visibleFaq(ctx(), "en")[0];
    expect(f.q).toBe(`Google Search Console is free. Why would I pay for ${NB}?`);
    expect(f.after).toEqual({ lead: "In short:", text: `Search Console is Google's report card on your site. ${NB} is the full inspection you run whenever you need it. Most sites need both.` });
  });
});
