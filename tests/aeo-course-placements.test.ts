// Where the Echorank AEO course is linked from. The menu entry is asserted in
// tests/mega-nav.test.ts; this suite holds the rest of the placements so that
// none of them can disappear unnoticed: the /learn hub's featured card,
// /resources, the homepage RESOURCES row, the audit strips, the footer, the
// in-app Help hub, and the cross-links in the glossary, keyword-research,
// technical-geo and prompt-guides pages.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LearnHub from "@/app/[locale]/learn/page";
import ResourcesPage from "@/app/[locale]/resources/page";
import PromptGuidesHub from "@/app/[locale]/prompt-guides/page";
import { PublicFooter } from "@/components/PublicFooter";
import { AeoCourseStrip } from "@/components/aeo-course/CourseStrip";
import { HELP_GROUPS } from "@/lib/help-content";
import { HELP_COPY } from "@/lib/i18n/dashboard";
import { GLOSSARY_HTML } from "@/app/[locale]/glossary/landing-html";
import { AEO_BASE, AEO_LESSON_SLUGS } from "@/lib/aeo-course-routes";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("AEO course placements", () => {
  it("features the course at the top of the /learn hub, before the flagship course", async () => {
    for (const locale of ["en", "fr"]) {
      const html = renderToStaticMarkup(await LearnHub({ params: Promise.resolve({ locale }) }));
      const feature = html.indexOf('data-testid="learn-aeo-feature"');
      expect(feature, locale).toBeGreaterThan(0);
      expect(feature).toBeLessThan(html.indexOf('id="course"'));
      expect(html).toContain(`href="/${locale}${AEO_BASE}"`);
      expect(html).toMatch(new RegExp(`${AEO_LESSON_SLUGS.length} (lessons|leçons)`));
    }
  });

  it("lists the course in the Learn group of /resources, both locales", async () => {
    for (const locale of ["en", "fr"]) {
      const html = renderToStaticMarkup(await ResourcesPage({ params: Promise.resolve({ locale }) }));
      expect(html, locale).toContain(`/${locale}${AEO_BASE}`);
    }
  });

  it("links it from the homepage RESOURCES row with the existing s.btn pattern, en and fr labels", () => {
    const src = read("src/app/[locale]/HomeClient.tsx");
    expect(src).toMatch(/<Link className=\{s\.btn\} href=\{L\("\/learn\/aeo"\)\}/);
    expect(src).toContain('aeoCourse: "Free AEO course"');
    expect(src).toContain('aeoCourse: "Cours AEO gratuit"');
  });

  it("puts the slim strip below the audit on /free-audit and below the audit block on /ai-visibility", () => {
    for (const [file, anchor] of [
      ["src/app/[locale]/free-audit/page.tsx", "<AuditRunner"],
      ["src/app/[locale]/ai-visibility/page.tsx", "c.tools.audit.cta"],
    ] as const) {
      const src = read(file);
      expect(src.indexOf("<AeoCourseStrip"), file).toBeGreaterThan(src.indexOf(anchor));
    }
    const en = renderToStaticMarkup(createElement(AeoCourseStrip, { locale: "en" }));
    expect(en).toContain(`href="/en${AEO_BASE}"`);
    expect(en).toContain("Learn how to fix what the audit finds");
    expect(renderToStaticMarkup(createElement(AeoCourseStrip, { locale: "fr-CA" }))).toContain(`href="/fr-CA${AEO_BASE}"`);
  });

  it("links it from the footer, beside Learn, both locales", () => {
    for (const locale of ["en", "fr", "de-CH"]) {
      const html = renderToStaticMarkup(createElement(PublicFooter, { locale }));
      const learn = html.indexOf(`href="/${locale}/learn"`);
      const aeo = html.indexOf(`href="/${locale}${AEO_BASE}"`);
      expect(aeo, locale).toBeGreaterThan(learn);
    }
  });

  it("opens it from the in-app Help hub in a new tab, with copy in all three dashboard catalogs", () => {
    const card = HELP_GROUPS.flatMap((g) => g.cards).find((c) => c.id === "aeo_course");
    expect(card).toEqual({ id: "aeo_course", kind: "external", href: `/en${AEO_BASE}`, icon: "book" });
    for (const loc of ["en", "fr", "de-CH"] as const) {
      const cards = HELP_COPY[loc].cards as Record<string, { name: string } | undefined>;
      expect(cards.aeo_course?.name, loc).toBeTruthy();
    }
  });

  it("cross-links from the glossary (AEO, GEO, AI visibility), keyword research, technical GEO and the prompt guides", async () => {
    const entry = (h3: string) => GLOSSARY_HTML.slice(GLOSSARY_HTML.indexOf(`<h3>${h3}`), GLOSSARY_HTML.indexOf("</li>", GLOSSARY_HTML.indexOf(`<h3>${h3}`)));
    for (const h3 of ["AEO (answer engine optimization)", "Generative Engine Optimization (GEO)", "AI visibility</h3>"]) {
      expect(entry(h3.replace("</h3>", "")), h3).toContain(`href="/en${AEO_BASE}"`);
    }
    expect(read("src/app/[locale]/keyword-research/landing-html.ts")).toContain(`<a href="/en${AEO_BASE}">Free AEO course</a>`);
    expect(read("src/app/[locale]/technical-geo/landing-html.ts")).toContain(`<a class="btn btn-secondary" href="/en${AEO_BASE}">Free AEO course</a>`);
    const pg = renderToStaticMarkup(await PromptGuidesHub({ params: Promise.resolve({ locale: "en" }) }));
    expect(pg).toContain(`href="/en${AEO_BASE}/build-your-prompt-panel"`);
  });
});
