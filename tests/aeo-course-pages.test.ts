// The Echorank AEO course — route table, metadata, JSON-LD and rendered pages.
// Follows tests/learn-content.test.ts + tests/learn-jsonld.test.ts: routes the
// config implies exist on disk and in the registry, structured data is derived
// from the config, and the HTML keeps the copy, CTA and accessibility rules in
// all five locales.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import HubPage, { generateMetadata as hubMetadata } from "@/app/[locale]/learn/aeo/page";
import LessonPage, { generateMetadata as lessonMetadata, generateStaticParams } from "@/app/[locale]/learn/aeo/[lesson]/page";
import WorksheetPage, { generateMetadata as worksheetMetadata } from "@/app/[locale]/learn/aeo/worksheet/page";
import AllPage, { generateMetadata as allMetadata } from "@/app/[locale]/learn/aeo/all/page";
import ChapterPage from "@/app/[locale]/learn/[chapter]/page";
import { AEO_COURSE_ID, AEO_HUB_URL, aeoHubGraph, aeoLessonGraph, aeoLessonUrl } from "@/app/[locale]/learn/aeo/_shared/graph";
import { AEO_LESSONS, aeoLessonPath, glanceRows } from "@/lib/aeo-course";
import { AEO_ALL, AEO_BASE, AEO_WORKSHEET, aeoRoutes } from "@/lib/aeo-course-routes";
import { ECHOPEDIA_SLUG, LEARN_CHAPTERS } from "@/lib/learn-content";
import { KNOWN_MARKETING_PATHS, LOCALIZED_ROUTES } from "@/lib/seo/registry";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";
import { HOME_PRICING_CHROME } from "@/lib/i18n/content";

const APP = join(process.cwd(), "src", "app", "[locale]", "learn", "aeo");
const NOT_FOUND = /NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/;
const hub = async (locale: string) => renderToStaticMarkup(await HubPage({ params: Promise.resolve({ locale }) }));
const lesson = async (locale: string, slug: string) => renderToStaticMarkup(await LessonPage({ params: Promise.resolve({ locale, lesson: slug }) }));
const FORBIDDEN = /EchoRank|Ahrefs|Semrush|Profound|Moz\b|transcript|source course|\d+(\.\d+)?\s?%/;

interface LdNode {
  "@type": string;
  "@id"?: string;
  [k: string]: unknown;
}
const nodes = (g: unknown) => JSON.parse(JSON.stringify(g)) as LdNode[];
const find = (g: LdNode[], type: string) => g.find((n) => n["@type"] === type)!;

describe("route table", () => {
  it("has the hub, the lesson route, the worksheet and the print view on disk", () => {
    for (const p of ["page.tsx", "[lesson]/page.tsx", "worksheet/page.tsx", "all/page.tsx"]) expect(existsSync(join(APP, p)), p).toBe(true);
  });

  it("cannot collide with /learn/[chapter]: no chapter, guide index or Echopedia is called aeo", () => {
    expect(LEARN_CHAPTERS.map((c) => c.slug)).not.toContain("aeo");
    expect(["guides", ECHOPEDIA_SLUG]).not.toContain("aeo");
    // And no lesson is named after a static sibling of the lesson route.
    expect(AEO_LESSONS.map((l) => l.slug)).not.toContain("worksheet");
    expect(AEO_LESSONS.map((l) => l.slug)).not.toContain("all");
  });

  it("registers the hub at 0.8 and each lesson at 0.6, once each; the noindex pages stay out", () => {
    expect(aeoRoutes()).toEqual([AEO_BASE, ...AEO_LESSONS.map((l) => aeoLessonPath(l.slug))]);
    for (const path of aeoRoutes()) {
      const hits = LOCALIZED_ROUTES.filter((r) => r.path === path);
      expect(hits, path).toHaveLength(1);
      expect(hits[0].priority, path).toBe(path === AEO_BASE ? 0.8 : 0.6);
      expect(KNOWN_MARKETING_PATHS).toContain(path);
    }
    for (const p of [AEO_WORKSHEET, AEO_ALL]) expect(LOCALIZED_ROUTES.some((r) => r.path === p), p).toBe(false);
  });

  it("generates every locale × lesson", () => {
    expect(generateStaticParams()).toHaveLength(SUPPORTED_LOCALES.length * AEO_LESSONS.length);
  });

  it("404s an unknown lesson and an unknown locale", async () => {
    await expect(LessonPage({ params: Promise.resolve({ locale: "en", lesson: "not-a-lesson" }) })).rejects.toThrow(NOT_FOUND);
    await expect(LessonPage({ params: Promise.resolve({ locale: "xx", lesson: "what-is-aeo" }) })).rejects.toThrow(NOT_FOUND);
    await expect(HubPage({ params: Promise.resolve({ locale: "xx" }) })).rejects.toThrow(NOT_FOUND);
  });

  it("leaves the existing chapters rendering", async () => {
    const html = renderToStaticMarkup(await ChapterPage({ params: Promise.resolve({ locale: "en", chapter: LEARN_CHAPTERS[0].slug }) }));
    expect(html).toContain(LEARN_CHAPTERS[0].title.replace(/&/g, "&amp;").replace(/'/g, "&#x27;"));
  });
});

describe("metadata", () => {
  it("canonicals every locale to the en URL with the hreflang set", async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const m = await hubMetadata({ params: Promise.resolve({ locale }) });
      expect(m.alternates?.canonical).toBe(AEO_HUB_URL);
      expect(Object.keys(m.alternates?.languages ?? {})).toEqual(expect.arrayContaining([...SUPPORTED_LOCALES, "x-default"]));
      for (const l of AEO_LESSONS) {
        const lm = await lessonMetadata({ params: Promise.resolve({ locale, lesson: l.slug }) });
        expect(lm.alternates?.canonical).toBe(aeoLessonUrl(l.slug));
        expect(lm.description).toBe(l.metaDescription);
      }
    }
  });

  it("noindexes the worksheet and the print view, canonical to the hub", async () => {
    for (const fn of [worksheetMetadata, allMetadata]) {
      const m = await fn({ params: Promise.resolve({ locale: "en" }) });
      expect(m.robots).toEqual({ index: false, follow: false });
      expect(m.alternates?.canonical).toBe(AEO_HUB_URL);
    }
  });
});

describe("JSON-LD", () => {
  it("describes the hub as a free, self-paced online Course with an ItemList and a BreadcrumbList", () => {
    const g = nodes(aeoHubGraph("en"));
    const course = find(g, "Course");
    expect(course["@id"]).toBe(AEO_COURSE_ID);
    expect(course.isAccessibleForFree).toBe(true);
    expect((course.offers as { price: number }).price).toBe(0);
    expect((course.hasCourseInstance as { courseMode: string }).courseMode).toBe("online");
    expect((course.provider as { "@id": string })["@id"]).toBe(find(g, "Organization")["@id"]);
    const list = find(g, "ItemList");
    expect((list.itemListElement as { url: string }[]).map((i) => i.url)).toEqual(AEO_LESSONS.map((l) => aeoLessonUrl(l.slug)));
    expect(find(g, "BreadcrumbList")).toBeTruthy();
    expect(g.some((n) => n["@type"] === "FAQPage")).toBe(false);
  });

  it("makes each lesson an Article that is part of the course, with no FAQPage", () => {
    for (const l of AEO_LESSONS) {
      const g = nodes(aeoLessonGraph(l, "en"));
      const art = find(g, "Article");
      expect(art.headline).toBe(l.title);
      expect(art.url).toBe(aeoLessonUrl(l.slug));
      expect((art.isPartOf as { "@id": string }[]).map((x) => x["@id"])).toContain(AEO_COURSE_ID);
      expect(g.some((n) => n["@type"] === "FAQPage")).toBe(false);
      const crumbs = find(g, "BreadcrumbList").itemListElement as { item: string }[];
      expect(crumbs.map((c) => c.item).slice(-2)).toEqual([AEO_HUB_URL, aeoLessonUrl(l.slug)]);
    }
  });

  it("parses as JSON out of the rendered page", async () => {
    const m = (await hub("fr")).match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(JSON.parse(m![1])["@graph"].some((n: LdNode) => n["@type"] === "Course")).toBe(true);
  });
});

describe("rendered pages", () => {
  it("renders the hub: lesson cards, glance table with minutes, the hero loop and the CTA", async () => {
    const html = await hub("en");
    expect([...html.matchAll(/data-lesson="/g)]).toHaveLength(12);
    const glance = html.slice(html.indexOf('data-testid="aeo-glance"'), html.indexOf("</table>", html.indexOf('data-testid="aeo-glance"')));
    for (const r of glanceRows()) expect(glance).toContain(`>${r.minutes}</td>`);
    expect(html).toContain('id="g-mrca-loop-t"');
    expect(html).toContain('data-testid="aeo-start"');
    expect(html).toContain(`href="/en${AEO_WORKSHEET}"`);
    expect(html).toContain(`href="/en${AEO_ALL}"`);
  });

  it("renders each lesson's closing sequence and its graphic", async () => {
    for (const l of AEO_LESSONS) {
      const html = await lesson("en", l.slug);
      const order = ['id="takeaways"', 'id="practice"', 'id="check"', 'data-testid="aeo-tool-card"', 'aria-label="Course contents"'].map((s) => html.lastIndexOf(s));
      expect(order.every((v) => v > 0), l.slug).toBe(true);
      expect(order.slice(0, 4), l.slug).toEqual([...order.slice(0, 4)].sort((a, b) => a - b));
      expect([...html.matchAll(/type="radio"/g)].length, l.slug).toBeGreaterThanOrEqual(9);
      for (const b of l.body) if (b.k === "graphic") expect(html, `${l.slug} ${b.id}`).toContain(`data-graphic="g-${b.id}"`);
    }
  });

  it("puts the worksheet and the sales CTA at the end of the last lesson only", async () => {
    const last = await lesson("en", AEO_LESSONS[11].slug);
    expect(last).toContain('data-testid="aeo-cta"');
    expect(await lesson("en", AEO_LESSONS[0].slug)).not.toContain('data-testid="aeo-cta"');
  });

  it("keeps the copy, CTA and accessibility rules on every page in every locale", async () => {
    const pages: [(typeof SUPPORTED_LOCALES)[number], string, string][] = [];
    for (const locale of SUPPORTED_LOCALES) {
      pages.push([locale, "hub", await hub(locale)]);
      for (const l of AEO_LESSONS) pages.push([locale, l.slug, await lesson(locale, l.slug)]);
      pages.push([locale, "worksheet", renderToStaticMarkup(await WorksheetPage({ params: Promise.resolve({ locale }) }))]);
      pages.push([locale, "all", renderToStaticMarkup(await AllPage({ params: Promise.resolve({ locale }) }))]);
    }
    for (const [locale, name, html] of pages) {
      const tag = `${locale} ${name}`;
      // The copy rule applies to what a reader sees (and to every attribute's
      // words, checked below), not to CSS values like the shared nav's 100%.
      const text = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ");
      expect(text, tag).not.toMatch(FORBIDDEN);
      expect(html, tag).not.toMatch(/EchoRank|Ahrefs|Semrush|Profound|Moz\b|transcript|source course/);
      expect(html, tag).not.toContain('target="_blank"');
      expect(html, tag).not.toMatch(/href="\/[a-zA-Z-]*\/?register/);
      for (const svg of html.matchAll(/<svg[^>]*role="img"[^>]*>([\s\S]*?)<\/svg>/g)) expect(svg[1], tag).toMatch(/^<title id="[^"]+">[^<]+<\/title><desc id="[^"]+">[^<]+<\/desc>/);
      for (const table of html.matchAll(/<table[\s\S]*?<\/table>/g)) {
        expect(table[0], tag).toMatch(/<caption>/);
        expect(table[0], tag).not.toMatch(/<th(?=[\s>])(?![^>]*scope=)[^>]*>/);
      }
      if (html.includes('data-testid="aeo-cta"')) {
        const cta = html.slice(html.indexOf('data-testid="aeo-cta"'), html.indexOf("</aside>", html.indexOf('data-testid="aeo-cta"')));
        expect(cta, tag).toContain(`href="/${locale}/pricing"`);
        expect(cta, tag).toContain(`href="/${locale}/free-audit"`);
        expect(cta, tag).toContain(HOME_PRICING_CHROME[locale].cancelAnytime.replace(/'/g, "&#x27;"));
      }
    }
    expect(pages.filter(([, , h]) => h.includes('data-testid="aeo-cta"')).length).toBe(SUPPORTED_LOCALES.length * 2);
  }, 120_000);
});
