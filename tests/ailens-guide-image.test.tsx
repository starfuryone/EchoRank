// /learn/guides/ai-lens-content-gap: "The AI Lens Content Gap" image
// (ECHORANK-AILENS-GUIDE-IMAGE, 2026-11-09).
//
// Unlike the review and CSV guides, the picture does not follow the intro: the
// intro and "Why the gap exists" set up the problem, and the image starts the
// how-to half, directly before "Measuring it". Not near the top, so it loads
// lazily with no fetch priority. A five-step list under it carries the same
// steps as text, with no heading (the TOC is unchanged). fr is handled as the
// CSV guide is: the list in English under the "English only" notice, no image,
// the default share card. Same block, styles and helpers as the other two.
import { describe, expect, it } from "vitest";
import { guideBySlug, tableOfContents } from "@/lib/learn-content";
import {
  articleNode,
  decode,
  expectGuideFigure,
  expectGuideShareCard,
  guideMeta,
  renderGuide,
} from "./helpers/learn-guide-image";

const SLUG = "ai-lens-content-gap";
const ALT =
  "The AI Lens content gap, a five-part visibility workflow: compare the raw HTML with the rendered page, measure the gap, prioritize key pages, render content early, then recheck and monitor.";
const WHY_END = "recommends competitors whose product detail exists in plain HTML.";
const STEPS = ["Compare the views", "Measure the gap", "Prioritize key pages", "Render content early", "Recheck and monitor"];
const render = (locale: string) => renderGuide(SLUG, locale);

/** The <ol> right after "Why the gap exists" (en: after the figure), before "Measuring it". */
function stepList(html: string): string {
  const from = html.indexOf("</p>", html.indexOf(WHY_END));
  const ol = html.indexOf("<ol", from);
  expect(ol).toBeGreaterThan(html.indexOf('<h2 id="why-the-gap-exists"'));
  expect(ol).toBeLessThan(html.indexOf('<h2 id="measuring-it"'));
  return html.slice(ol, html.indexOf("</ol>", ol) + 5);
}

describe("the figure", () => {
  it("en: one lazy <figure> after the Why section and directly before Measuring it", async () => {
    const html = await render("en");
    const after = expectGuideFigure(html, {
      stem: "ai-lens-content-gap",
      widths: [800, 1200, 1670],
      height: 942,
      alt: ALT,
      caption: "From finding the gap to closing it.",
      introEnd: WHY_END,
      nextH2: "measuring-it",
      priority: false,
    });
    // After the "Why the gap exists" heading, not after the intro.
    expect(html.indexOf("<figure")).toBeGreaterThan(html.indexOf('<h2 id="why-the-gap-exists"'));
    // Between the figure and the H2: the step list, nothing else.
    expect(after.startsWith("<ol")).toBe(true);
    expect(after.endsWith("</ol>")).toBe(true);
  });

  it("fr (and fr-CA): no ai-lens-content-gap image", async () => {
    for (const locale of ["fr", "fr-CA"]) {
      const html = await render(locale);
      expect(html, locale).not.toContain("ai-lens-content-gap-");
      expect(html, locale).not.toContain("<figure");
    }
  });
});

describe("the five-step list", () => {
  it.each(["en", "fr"])("%s: five items in order, every in-page link resolving to an id on the page", async (locale) => {
    const html = decode(await render(locale));
    const ol = stepList(html);
    expect([...ol.matchAll(/<li><strong>([^<]+)<\/strong>/g)].map((m) => m[1])).toEqual(STEPS);
    const hrefs = [...ol.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual(["measuring-it", "measuring-it", "closing-it"]);
    for (const id of hrefs) expect(html, id).toContain(`id="${id}"`);
  });

  it("adds no claim the page does not already make", () => {
    const page = JSON.stringify(guideBySlug(SLUG)!.body);
    for (const fact of [
      "Compare the raw HTML your server sends against the fully rendered page",
      "share of content that only exists after rendering",
      "product detail, service descriptions, or FAQs",
      "Server-side rendering (SSR)",
      "Static pre-rendering",
      "Selective pre-rendering",
      "re-run the measurement",
      "**Bot Analytics** shows whether AI and search crawlers actually visit",
      "give it weeks, not hours",
    ]) {
      expect(page, fact).toContain(fact);
    }
  });

  it("adds no heading: the table of contents is unchanged", () => {
    expect(tableOfContents(guideBySlug(SLUG)!.body).map((h) => h.text)).toEqual([
      "Why the gap exists",
      "Measuring it",
      "Closing it",
      "What it looks like in practice",
    ]);
  });
});

describe("share card and Article image", () => {
  it("en: og:image and twitter:image are the og crop, with the figure's alt", async () => {
    await expectGuideShareCard(SLUG, "ai-lens-content-gap", ALT);
  });

  it("en: the Article node carries the 1670 image", async () => {
    expect(articleNode(await render("en")).image).toBe("https://echorank360.com/learn/guides/ai-lens-content-gap-1670.webp");
  });

  it("fr: keeps the site's default share card and no Article image", async () => {
    const m = await guideMeta(SLUG, "fr");
    const og = (m.openGraph as { images: Array<{ url: string }> }).images[0];
    expect(og.url).not.toContain("ai-lens-content-gap");
    expect(articleNode(await render("fr"))).not.toHaveProperty("image");
  });
});
