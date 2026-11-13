// Industry prompt setup guides — route table, JSON-LD and the rendered pages.
//
// Follows tests/learn-content.test.ts + tests/learn-jsonld.test.ts: the routes
// the config implies exist on disk and in the sitemap registry, the structured
// data is derived from the config (never a hand-kept copy), and the HTML a
// visitor gets keeps the copy rules: no package domain, no competitor, no
// camel-case brand, no target="_blank", sales CTAs to /pricing and
// /free-audit (never /register) with "Cancel anytime" in every locale.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import HubPage, { generateMetadata as hubMetadata } from "@/app/[locale]/prompt-guides/page";
import GuidePage, { generateMetadata as guideMetadata, generateStaticParams } from "@/app/[locale]/prompt-guides/[slug]/page";
import { HUB_URL, guideGraph, guideUrl, hubGraph } from "@/app/[locale]/prompt-guides/_shared/graph";
import { GUIDE_FAQ, PROMPT_GUIDES, PROMPT_USES, guidePath, totalPrompts, totalsByUse } from "@/lib/prompt-guides";
import { PROMPT_GUIDES_BASE, promptGuideRoutes } from "@/lib/prompt-guide-routes";
import { KNOWN_MARKETING_PATHS, LOCALIZED_ROUTES } from "@/lib/seo/registry";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";
import { HOME_PRICING_CHROME } from "@/lib/i18n/content";

const APP = join(process.cwd(), "src", "app", "[locale]", "prompt-guides");
const hub = async (locale: string) => renderToStaticMarkup(await HubPage({ params: Promise.resolve({ locale }) }));
const guide = async (locale: string, slug: string) => renderToStaticMarkup(await GuidePage({ params: Promise.resolve({ locale, slug }) }));
const FORBIDDEN = /EchoRank|echorank\.com|tryprofound|GEO Checker/;

/** A JSON-LD node as the tests read it: loose, but not `any`. */
interface LdNode {
  "@type": string;
  "@id"?: string;
  [k: string]: unknown;
}
interface LdItem {
  name: string;
  url: string;
  item: string;
  position: number;
  acceptedAnswer: { text: string };
}
const nodes = (graph: unknown): LdNode[] => JSON.parse(JSON.stringify(graph)) as LdNode[];
const find = (graph: LdNode[], type: string) => graph.find((n) => n["@type"] === type)!;
const items = (n: LdNode, key: string) => n[key] as LdItem[];
const ref = (n: LdNode, key: string) => (n[key] as { "@id": string })["@id"];
const ldOf = (html: string) => {
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  expect(m, "one JSON-LD block").toBeTruthy();
  return JSON.parse(m![1]) as { "@context": string; "@graph": Record<string, unknown>[] };
};

describe("route table", () => {
  it("has the hub and the guide route on disk", () => {
    expect(existsSync(join(APP, "page.tsx")), "hub").toBe(true);
    expect(existsSync(join(APP, "[slug]", "page.tsx")), "guide route").toBe(true);
  });

  it("registers the hub at 0.7 and every guide at 0.6, once each", () => {
    const routes = promptGuideRoutes();
    expect(routes).toEqual([PROMPT_GUIDES_BASE, ...PROMPT_GUIDES.map((g) => guidePath(g.slug))]);
    for (const path of routes) {
      const hits = LOCALIZED_ROUTES.filter((r) => r.path === path);
      expect(hits, path).toHaveLength(1);
      expect(hits[0].priority, path).toBe(path === PROMPT_GUIDES_BASE ? 0.7 : 0.6);
      // Which is what lets the proxy 308 a locale-less /prompt-guides/<slug> onto /en.
      expect(KNOWN_MARKETING_PATHS).toContain(path);
    }
  });

  it("generates every locale × guide, and nothing else", () => {
    const params = generateStaticParams();
    expect(params).toHaveLength(SUPPORTED_LOCALES.length * PROMPT_GUIDES.length);
    expect(new Set(params.map((p) => p.slug))).toEqual(new Set(PROMPT_GUIDES.map((g) => g.slug)));
  });

  it("404s an unknown slug and an unknown locale", async () => {
    await expect(GuidePage({ params: Promise.resolve({ locale: "en", slug: "not-a-guide" }) })).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
    await expect(GuidePage({ params: Promise.resolve({ locale: "xx", slug: "retail" }) })).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
    await expect(HubPage({ params: Promise.resolve({ locale: "xx" }) })).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
  });
});

describe("metadata", () => {
  it("canonicals every locale to the en URL and lists the hreflang set", async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const m = await hubMetadata({ params: Promise.resolve({ locale }) });
      expect(m.alternates?.canonical).toBe(HUB_URL);
      expect(Object.keys(m.alternates?.languages ?? {})).toEqual(expect.arrayContaining([...SUPPORTED_LOCALES, "x-default"]));
      for (const g of PROMPT_GUIDES) {
        const gm = await guideMetadata({ params: Promise.resolve({ locale, slug: g.slug }) });
        expect(gm.alternates?.canonical).toBe(guideUrl(g.slug));
        expect(gm.description).toBe(g.metaDescription);
      }
    }
  });
});

describe("JSON-LD", () => {
  it("gives the hub a CollectionPage whose ItemList is the ten guides, in order, plus a BreadcrumbList", () => {
    const graph = nodes(hubGraph("en"));
    const types = graph.map((n) => n["@type"]);
    expect(types).toEqual(expect.arrayContaining(["Organization", "WebSite", "CollectionPage", "ItemList", "BreadcrumbList"]));
    const list = find(graph, "ItemList");
    expect(list.numberOfItems).toBe(PROMPT_GUIDES.length);
    expect(items(list, "itemListElement").map((i) => i.url)).toEqual(PROMPT_GUIDES.map((g) => guideUrl(g.slug)));
    expect(items(list, "itemListElement").map((i) => i.name)).toEqual(PROMPT_GUIDES.map((g) => g.title));
    expect(items(list, "itemListElement").map((i) => i.position)).toEqual(PROMPT_GUIDES.map((_, i) => i + 1));
    const page = find(graph, "CollectionPage");
    expect(ref(page, "mainEntity")).toBe(list["@id"]);
    expect(page.url).toBe(HUB_URL);
  });

  it("gives each guide an Article, a three-level BreadcrumbList and the FAQPage the page renders", () => {
    for (const g of PROMPT_GUIDES) {
      const graph = nodes(guideGraph(g, "en"));
      const art = find(graph, "Article");
      expect(art.headline).toBe(g.title);
      expect(art.description).toBe(g.metaDescription);
      expect(art.url).toBe(guideUrl(g.slug));
      expect(ref(art, "publisher")).toBe(find(graph, "Organization")["@id"]);
      expect(ref(art, "author")).toBe(ref(art, "publisher"));
      const crumbs = find(graph, "BreadcrumbList");
      expect(items(crumbs, "itemListElement").map((c) => c.item)).toEqual([expect.stringMatching(/\/en$/), HUB_URL, guideUrl(g.slug)]);
      const faq = find(graph, "FAQPage");
      expect(items(faq, "mainEntity").map((q) => q.name)).toEqual(GUIDE_FAQ.map((f) => f.q));
      expect(items(faq, "mainEntity").map((q) => q.acceptedAnswer.text)).toEqual(GUIDE_FAQ.map((f) => f.a));
    }
  });

  it("is derived, not copied: a drifted guide changes the Article", () => {
    const drifted = { ...PROMPT_GUIDES[0], title: "Drifted" };
    const art = guideGraph(drifted, "en").find((n) => n["@type"] === "Article")!;
    expect(art.headline).toBe("Drifted");
  });

  it("parses as JSON out of the rendered page", async () => {
    const h = ldOf(await hub("en"));
    expect(h["@context"]).toBe("https://schema.org");
    expect(h["@graph"].some((n) => n["@type"] === "CollectionPage")).toBe(true);
    const g = ldOf(await guide("fr", "healthcare"));
    expect(g["@graph"].some((n) => n["@type"] === "FAQPage")).toBe(true);
  });
});

describe("rendered hub", () => {
  it("prints the stats, the glance table and the totals row from the config", async () => {
    const html = await hub("en");
    const stats = html.slice(html.indexOf('data-testid="hub-stats"'));
    expect(stats).toMatch(new RegExp(`<b>${PROMPT_GUIDES.length}</b>[\\s\\S]*<b>${totalPrompts()}</b>[\\s\\S]*<b>1</b>`));
    const glance = html.slice(html.indexOf('data-testid="glance-table"'), html.indexOf("</table>", html.indexOf('data-testid="glance-table"')));
    for (const g of PROMPT_GUIDES) {
      expect(glance).toContain(`href="/en${guidePath(g.slug)}"`);
      expect(glance).toContain(g.safeguardShort);
      expect(glance).toContain(g.cadenceShort);
    }
    const totals = html.slice(html.indexOf('data-testid="mix-totals"'), html.indexOf("</tr>", html.indexOf('data-testid="mix-totals"')));
    const nums = [...totals.matchAll(/<td[^>]*>(\d+)<\/td>/g)].map((m) => Number(m[1]));
    const t = totalsByUse();
    expect(nums).toEqual([...PROMPT_USES.map((u) => t[u]), 120]);
    expect(nums).toEqual([41, 32, 11, 5, 10, 14, 7, 120]);
  });

  it("renders all ten cards with the filter, its live count and the hub figures", async () => {
    const html = await hub("en");
    expect([...html.matchAll(/data-guide="/g)]).toHaveLength(PROMPT_GUIDES.length);
    expect(html).toContain('id="prompt-guide-filter"');
    expect(html).toContain(`data-testid="guide-count">${PROMPT_GUIDES.length} guides<`);
    for (const id of ["pg-hero-w", "pg-hero-n", "pg-mix-w", "pg-mix-n", "pg-method-w", "pg-method-n"]) {
      expect(html, id).toContain(`id="${id}-title"`);
    }
  });
});

describe("rendered guides", () => {
  it("renders the ten sections, the TOC, the tables with scoped headers and every figure", async () => {
    for (const g of PROMPT_GUIDES) {
      const html = await guide("en", g.slug);
      for (const id of ["strategy", "topics", "refinement", "categories", "tags", "measurement", "actions", "research", "plan", "faq"]) {
        expect(html, `${g.slug} #${id}`).toContain(`id="${id}"`);
        expect(html, `${g.slug} toc ${id}`).toContain(`href="#${id}"`);
      }
      for (const p of g.prompts) expect(html).toContain(`aria-label="Copy ${p.topic.replace(/&/g, "&amp;")} prompt"`);
      expect(html).toContain("Copy all 12 prompts");
      expect(html).toContain("Print / Save PDF");
      expect(html).toContain('data-testid="updated-chip">Updated November 2026<');
      expect([...html.matchAll(/<table/g)].length, g.slug).toBe(8);
      // Every header cell carries a scope (the lookahead skips <thead>).
      expect(html).not.toMatch(/<th(?=[\s>])(?![^>]*scope=)[^>]*>/);
      expect([...html.matchAll(/<th scope="(col|row)"/g)].length, g.slug).toBeGreaterThan(40);
      for (const id of ["pg-icon", "pg-mix", "pg-refine-w", "pg-refine-n", "pg-funnel", "pg-plan-w", "pg-plan-n"]) {
        expect(html, `${g.slug} ${id}`).toContain(`id="${id}-title"`);
        expect(html, `${g.slug} ${id}`).toContain(`id="${id}-desc"`);
      }
      // Three related guides and the prev/next pair, all real routes.
      const tail = html.slice(html.indexOf("Explore related guides"));
      for (const href of tail.matchAll(/href="\/en\/prompt-guides\/([^"]+)"/g)) expect(PROMPT_GUIDES.some((x) => x.slug === href[1])).toBe(true);
    }
  });

  it("puts every count on the G2 chart as text, not colour alone", async () => {
    const g = PROMPT_GUIDES[0];
    const html = await guide("en", g.slug);
    const fig = html.slice(html.indexOf('id="pg-mix-title"'), html.indexOf("</svg>", html.indexOf('id="pg-mix-title"')));
    for (const u of PROMPT_USES) expect(fig).toContain(`>${u}</text>`);
  });

  it("draws the funnel with stage names and no numbers", async () => {
    const html = await guide("en", "retail");
    const start = html.indexOf('id="pg-funnel-title"');
    const fig = html.slice(start, html.indexOf("</svg>", start));
    const texts = [...fig.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
    expect(texts).toEqual(["Mentioned", "Recommended", "Cited (owned site)", "Accurate"]);
  });
});

describe("every page, every locale", () => {
  it("keeps the copy rules and the CTA rules", async () => {
    const pages: [string, string][] = [];
    for (const locale of SUPPORTED_LOCALES) {
      pages.push([`${locale} hub`, await hub(locale)]);
      for (const g of PROMPT_GUIDES) pages.push([`${locale} ${g.slug}`, await guide(locale, g.slug)]);
    }
    for (const [name, html] of pages) {
      const locale = name.split(" ")[0] as (typeof SUPPORTED_LOCALES)[number];
      expect(html, name).not.toMatch(FORBIDDEN);
      expect(html, name).not.toMatch(/tryprofound|\bprofound\b|echorank\.com/i);
      expect(html, name).not.toContain('target="_blank"');
      expect(html, name).not.toMatch(/href="\/[a-zA-Z-]*\/?register/);
      const cta = html.slice(html.indexOf('data-testid="prompt-guides-cta"'), html.indexOf("</aside>", html.indexOf('data-testid="prompt-guides-cta"')));
      expect(cta, name).toContain(`href="/${locale}/pricing"`);
      expect(cta, name).toContain(`href="/${locale}/free-audit"`);
      expect(cta, name).toContain(HOME_PRICING_CHROME[locale].cancelAnytime.replace(/'/g, "&#x27;"));
      // Every SVG figure: role="img" with a title and a desc.
      for (const svg of html.matchAll(/<svg[^>]*role="img"[^>]*>([\s\S]*?)<\/svg>/g)) {
        expect(svg[1], name).toMatch(/^<title id="[^"]+">[^<]+<\/title><desc id="[^"]+">[^<]+<\/desc>/);
      }
    }
    expect(pages).toHaveLength(SUPPORTED_LOCALES.length * (PROMPT_GUIDES.length + 1));
  }, 60_000);
});
