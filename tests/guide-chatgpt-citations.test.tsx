// /learn/guides/how-to-get-cited-by-chatgpt (ECHORANK-GUIDE-CHATGPT-CITATIONS,
// 2026-11-09): en / fr / de-CH bodies, stable anchors, the diagram, the copy
// button, the stacked table, sources in new tabs, CTAs from config, the hub
// card, the menu link and the free check's cross-link.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PublicNav } from "@/app/[locale]/PublicNav";
import GuidesIndex from "@/app/[locale]/learn/guides/page";
import sitemap from "@/app/sitemap";
import { SnapshotUpsell } from "@/components/snapshot/SnapshotReportView";
import { CHATGPT_GUIDE_HREF, CHATGPT_GUIDE_LABEL } from "@/lib/chatgpt-guide-link";
import { LEARN_BASE, guideBySlug, guideCopy, learnRoutes, tableOfContents } from "@/lib/learn-content";
import {
  CHATGPT_CITATIONS_SLUG as SLUG,
  CHATGPT_GUIDE_ANCHORS,
  CHATGPT_GUIDE_CHECKED,
  CHATGPT_GUIDE_CTAS,
} from "@/lib/learn-chatgpt-citations";
import { PLAN_CONFIGS } from "@/lib/plan-config";
import { KNOWN_MARKETING_PATHS, LOCALIZED_ROUTES } from "@/lib/seo/registry";
import { SNAPSHOT_COPY } from "@/lib/snapshot/copy";
import { blogArticleRoutes } from "@/lib/blog/loader";
import { PROMPT_COUNT } from "@/lib/snapshot/prompts";
import { FREE_CRAWL_URL_CAP } from "@/lib/site-crawler/free-limits";
import { decode, guideMeta, renderGuide, ROOT } from "./helpers/learn-guide-image";

const LOCALES = ["en", "fr", "de-CH"] as const;
const guide = guideBySlug(SLUG)!;
const article = (html: string) => html.slice(html.indexOf("<article"), html.indexOf("</article>"));
const graph = (html: string) =>
  JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1])["@graph"] as Record<string, unknown>[];

describe("the page", () => {
  it.each(LOCALES)("%s: renders its own language, with no English-only notice", async (locale) => {
    const html = decode(await renderGuide(SLUG, locale));
    const copy = guideCopy(guide, locale === "fr" ? "fr" : "en", locale);
    expect(copy.localized).toBe(true);
    expect(html).toContain(`>${copy.title}</h1>`);
    expect(html).not.toContain("disponible qu'en anglais");
    for (const h of tableOfContents(copy.body)) expect(html).toContain(`id="${h.id}"`);
  });

  it("the three bodies have the same structure and the same anchors", () => {
    const shape = (body: typeof guide.body) => body.map((b) => b.k + ("id" in b && b.id ? `#${b.id}` : ""));
    expect(shape(guide.fr!.body!)).toEqual(shape(guide.body));
    expect(shape(guide.de!.body)).toEqual(shape(guide.body));
  });

  it("the English text is the brief's: title, meta line and every heading", () => {
    expect(guide.title).toBe("How to Get Your Website Cited by ChatGPT (Plain-English Guide)");
    expect(guide.description).toBe(
      "How ChatGPT picks the websites it links to, and the plain-English steps that make yours one of them: crawler access, Bing, readable pages, the right content, and how to check.",
    );
    expect(tableOfContents(guide.body).map((h) => h.text)).toEqual([
      "Key takeaways",
      "How does ChatGPT decide which websites to cite?",
      "Can ChatGPT get into your website?",
      "Do you need to rank in Bing to get cited by ChatGPT?",
      "Can ChatGPT read the content on your pages?",
      "What kind of content does ChatGPT cite?",
      "How do you get ChatGPT to mention your brand when it isn't searching?",
      "How do you check whether ChatGPT cites your website?",
      "What doesn't help you get cited by ChatGPT?",
      "A 30-minute checklist",
      "Sources",
    ]);
  });

  it.each(LOCALES)("%s: every in-page anchor resolves, and the two linked-to anchors exist", async (locale) => {
    const html = await renderGuide(SLUG, locale);
    const hashes = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
    expect(hashes.length).toBeGreaterThan(10);
    for (const id of hashes) expect(html, id).toContain(`id="${id}"`);
    expect(html).toContain(`id="${CHATGPT_GUIDE_ANCHORS.access}"`);
    expect(html).toContain(`id="${CHATGPT_GUIDE_ANCHORS.check}"`);
  });

  it.each(LOCALES)("%s: every internal link in the article resolves to a known page", async (locale) => {
    const body = article(decode(await renderGuide(SLUG, locale)));
    // Pages from the route registry and the Knowledge Hub, plus published blog articles.
    const known = new Set([...KNOWN_MARKETING_PATHS, ...learnRoutes(), ...blogArticleRoutes(), ""]);
    const hrefs = [...body.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThan(5);
    for (const href of hrefs) {
      expect(href.startsWith(`/${locale}/`), href).toBe(true);
      const path = href.slice(locale.length + 1).split(/[?#]/)[0];
      expect(known.has(path), href).toBe(true);
    }
  });

  it.each(LOCALES)("%s: sources open in a new tab with noopener noreferrer", async (locale) => {
    const html = await renderGuide(SLUG, locale);
    const external = [...article(html).matchAll(/<a [^>]*href="https?:[^"]*"[^>]*>/g)].map((m) => m[0]);
    expect(external).toHaveLength(17);
    for (const a of external) {
      expect(a).toContain('target="_blank"');
      expect(a).toContain('rel="noopener noreferrer"');
    }
  });

  it("the user-agent table stacks on mobile: every cell labelled by its column", async () => {
    const html = decode(await renderGuide(SLUG, "en"));
    for (const label of ["User agent", "What OpenAI says it does", "Does robots.txt apply?", "Effect on ChatGPT citations"]) {
      expect(html).toContain(`data-label="${label}"`);
    }
    const css = readFileSync(join(ROOT, "src/app/[locale]/learn/_shared/learn.module.css"), "utf8");
    expect(css).toMatch(/@media \(max-width: 640px\) \{\s*\.tableStack \{[^}]*overflow: visible/);
    expect(css).toMatch(/\.tableStack td::before \{ content: attr\(data-label\)/);
  });

  it("the robots.txt block keeps its code untranslated and has a copy button, in every locale", async () => {
    for (const locale of LOCALES) {
      const html = decode(await renderGuide(SLUG, locale));
      expect(html).toContain("User-agent: OAI-SearchBot\nAllow: /");
      expect(html).toContain("# Choose one for training:");
      expect(html).toContain("data-copy-code");
    }
  });

  it.each(LOCALES)("%s: the diagram is an inline SVG with title, desc and a text equivalent, no images", async (locale) => {
    const html = decode(await renderGuide(SLUG, locale));
    const fig = html.slice(html.indexOf('data-testid="citation-flow"'), html.indexOf("</figure>", html.indexOf('data-testid="citation-flow"')));
    expect(fig).toMatch(/<svg[^>]*role="img"[^>]*aria-labelledby="cf-title cf-desc"/);
    expect(fig).toContain('<title id="cf-title">');
    expect(fig).toContain('<desc id="cf-desc">');
    expect([...fig.matchAll(/<li>/g)]).toHaveLength(7);
    expect(fig).not.toContain("<img");
    expect(fig).toContain("var(--surface)");
  });

  it("the Last checked date comes from one constant, on the page and in Article dateModified", async () => {
    expect(guide.dateModified).toBe(CHATGPT_GUIDE_CHECKED);
    const en = await renderGuide(SLUG, "en");
    expect(en).toContain("Last checked: November 9, 2026.");
    expect(decode(await renderGuide(SLUG, "fr"))).toContain("Dernière vérification : 9 novembre 2026.");
    expect(await renderGuide(SLUG, "de-CH")).toContain("Zuletzt geprüft: 9. November 2026.");
    const art = graph(en).find((n) => n["@type"] === "Article")!;
    expect(art.dateModified).toBe(CHATGPT_GUIDE_CHECKED);
  });
});

describe("CTAs: from config, with the guide's src", () => {
  it("every CTA carries src=guide-chatgpt-citations", () => {
    for (const href of Object.values(CHATGPT_GUIDE_CTAS)) expect(href).toContain("src=guide-chatgpt-citations");
    expect(CHATGPT_GUIDE_CTAS.plan).toBe("/pricing?plan=ai_visibility&src=guide-chatgpt-citations");
  });

  it.each(LOCALES)("%s: the counts and the price are config values, and the links are locale-prefixed", async (locale) => {
    const html = decode(await renderGuide(SLUG, locale));
    expect(html).toContain(`${PROMPT_COUNT} `);
    expect(html).toContain(`$${PLAN_CONFIGS.AI_VISIBILITY.monthlyPrice}`);
    expect(html).toContain(`${FREE_CRAWL_URL_CAP} `);
    for (const href of Object.values(CHATGPT_GUIDE_CTAS)) expect(html).toContain(`href="/${locale}${href}"`);
  });

  it("no CTA in the source types a price or a count", () => {
    const src = readFileSync(join(ROOT, "src/lib/learn-chatgpt-citations.ts"), "utf8");
    const ctaLines = src.split("\n").filter((l) => /CHATGPT_GUIDE_CTAS\./.test(l));
    expect(ctaLines.length).toBe(12);
    for (const line of ctaLines) {
      expect(line, line).not.toMatch(/\$\d/);
      expect(line, line).not.toMatch(/\b\d+ (pages|customer|questions|Seiten|Kundenfragen)/);
    }
  });
});

describe("metadata and structured data", () => {
  it("canonical per body language; en-CA and fr-CA fold; OG is the AI Visibility card", async () => {
    const canon = async (l: string) => ((await guideMeta(SLUG, l)).alternates as { canonical: string }).canonical;
    const path = `${LEARN_BASE}/guides/${SLUG}`;
    expect(await canon("en")).toBe(`https://echorank360.com/en${path}`);
    expect(await canon("en-CA")).toBe(`https://echorank360.com/en${path}`);
    expect(await canon("fr")).toBe(`https://echorank360.com/fr${path}`);
    expect(await canon("fr-CA")).toBe(`https://echorank360.com/fr${path}`);
    expect(await canon("de-CH")).toBe(`https://echorank360.com/de-CH${path}`);
    const m = await guideMeta(SLUG, "de-CH");
    expect(m.title).toBeDefined();
    expect((m.openGraph as { images: { url: string }[] }).images[0].url).toBe("https://echorank360.com/ai-visibility/og-ai-visibility.png");
    expect(Object.keys((m.alternates as { languages: Record<string, string> }).languages)).toEqual(expect.arrayContaining(["en", "fr", "de-CH"]));
  });

  it.each(LOCALES)("%s: Article (in the body's language) and BreadcrumbList, valid JSON", async (locale) => {
    const nodes = graph(await renderGuide(SLUG, locale));
    const art = nodes.find((n) => n["@type"] === "Article")!;
    expect(art.inLanguage).toBe(locale);
    expect(nodes.some((n) => n["@type"] === "BreadcrumbList")).toBe(true);
  });

  it("the sitemap lists the page in every locale", () => {
    expect(LOCALIZED_ROUTES.map((r) => r.path)).toContain(CHATGPT_GUIDE_HREF);
    const urls = sitemap().map((e) => e.url);
    for (const l of ["en", "en-CA", "fr", "fr-CA", "de-CH"]) expect(urls).toContain(`https://echorank360.com/${l}${CHATGPT_GUIDE_HREF}`);
  });
});

describe("hub, menu and cross-links", () => {
  it.each(["en", "fr", "de-CH"])("%s: a card in the guides hub's #ai-visibility section", async (locale) => {
    const html = renderToStaticMarkup(await GuidesIndex({ params: Promise.resolve({ locale }) }));
    const at = html.indexOf('id="ai-visibility"');
    expect(at).toBeGreaterThan(-1);
    const section = html.slice(at, html.indexOf("</section>", at));
    expect(section).toContain(`href="/${locale}${CHATGPT_GUIDE_HREF}"`);
  });

  it.each([
    ["en", CHATGPT_GUIDE_LABEL.en],
    ["en-CA", CHATGPT_GUIDE_LABEL.en],
    ["fr", CHATGPT_GUIDE_LABEL.fr],
    ["fr-CA", CHATGPT_GUIDE_LABEL.fr],
    ["de-CH", CHATGPT_GUIDE_LABEL.de],
  ])("%s: the Resources menu's Guides list links to it, labelled %s", (locale, label) => {
    const html = decode(renderToStaticMarkup(<PublicNav locale={locale} />));
    const at = html.indexOf(`href="/${locale}${CHATGPT_GUIDE_HREF}"`);
    expect(at).toBeGreaterThan(-1);
    expect(html.slice(at, at + 300)).toContain(label);
  });

  it("the static route-handler pages carry no Guides list to update (their navs are page-local)", () => {
    const dir = join(ROOT, "src/app/[locale]");
    for (const d of readdirSync(dir)) {
      let src: string;
      try {
        src = readFileSync(join(dir, d, "landing-html.ts"), "utf8");
      } catch {
        continue;
      }
      expect(src, d).not.toContain("/guides/getting-started");
    }
  });

  it("the free AI Visibility Check's result links to the checking section", () => {
    for (const locale of ["en", "fr"]) {
      const c = SNAPSHOT_COPY[locale === "fr" ? "fr" : "en"];
      const html = decode(renderToStaticMarkup(<SnapshotUpsell c={c} locale={locale} />));
      expect(html).toContain(`href="/${locale}${CHATGPT_GUIDE_HREF}#${CHATGPT_GUIDE_ANCHORS.check}"`);
      expect(html).toContain(c.upsell.guideLink);
    }
  });
});
