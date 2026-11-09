// /learn/guides/csv-review-import: "The CSV Review Import System" image
// (ECHORANK-CSV-GUIDE-IMAGE, 2026-11-09).
//
// The picture is the route the intro names, so it sits right after the intro
// and before "The schema"; a five-step list under it carries the same steps as
// readable text, linking into the sections below, with no heading of its own,
// so the table of contents does not change. English is baked into the picture:
// the fr page (same English body, see LearnGuide.fr) shows the list but no
// image, and keeps the default share card. Same block, styles and helpers as
// review-guide-image.test.tsx.
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

const SLUG = "csv-review-import";
const ALT =
  "The CSV review import system, a universal five-part workflow: export your reviews, map the columns to the seven-field schema, validate ratings and dates, save as a CSV of up to 5 MB, then import and retry rejected rows.";
const INTRO_END = "one normalized CSV is the route.";
const STEPS = ["Export reviews", "Map the columns", "Validate the data", "Save as CSV", "Import and retry"];
const render = (locale: string) => renderGuide(SLUG, locale);

/** The <ol> right after the intro (en: after the figure). */
function stepList(html: string): string {
  const from = html.indexOf("</p>", html.indexOf(INTRO_END));
  const ol = html.indexOf("<ol", from);
  // It must come before "The schema" H2.
  expect(ol).toBeLessThan(html.indexOf('<h2 id="the-schema"'));
  return html.slice(ol, html.indexOf("</ol>", ol) + 5);
}

describe("the figure", () => {
  it("en: one <figure> between the intro paragraph and The schema H2, sized, alt'd, srcset x3", async () => {
    const after = expectGuideFigure(await render("en"), {
      stem: "csv-review-import-system",
      widths: [800, 1200, 1670],
      height: 941,
      alt: ALT,
      caption: "The whole workflow on one page.",
      introEnd: INTRO_END,
      nextH2: "the-schema",
    });
    // Between the figure and the H2: the step list, nothing else.
    expect(after.startsWith("<ol")).toBe(true);
    expect(after.endsWith("</ol>")).toBe(true);
  });

  it("fr (and fr-CA): no csv-review-import-system image", async () => {
    for (const locale of ["fr", "fr-CA"]) {
      const html = await render(locale);
      expect(html, locale).not.toContain("csv-review-import-system");
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
    expect(hrefs).toEqual(["mapping-an-export-from-another-tool", "the-schema", "when-rows-reject"]);
    for (const id of hrefs) expect(html, id).toContain(`id="${id}"`);
  });

  it("states the page's own facts: seven fields, 1–5, YYYY-MM-DD, 5 MB, duplicates skipped", () => {
    const body = guideBySlug(SLUG)!.body;
    const columns = (body.find((b) => b.k === "table") as { rows: string[][] }).rows.map((r) => r[0]);
    expect(columns).toHaveLength(7);
    const page = JSON.stringify(body);
    for (const fact of ["Integer 1–5", "YYYY-MM-DD", "Files up to 5 MB", "imports skip duplicates"]) expect(page).toContain(fact);
  });

  it("adds no heading: the table of contents is unchanged", () => {
    expect(tableOfContents(guideBySlug(SLUG)!.body).map((h) => h.text)).toEqual([
      "The schema",
      "Mapping an export from another tool",
      "Facebook's odd shape",
      "When rows reject",
      "Google Takeout: last resort",
    ]);
  });
});

describe("share card and Article image", () => {
  it("en: og:image and twitter:image are the og crop, with the figure's alt", async () => {
    await expectGuideShareCard(SLUG, "csv-review-import-system", ALT);
  });

  it("en: the Article node carries the 1670 image", async () => {
    expect(articleNode(await render("en")).image).toBe("https://echorank360.com/learn/guides/csv-review-import-system-1670.webp");
  });

  it("fr: keeps the site's default share card and no Article image", async () => {
    const m = await guideMeta(SLUG, "fr");
    const og = (m.openGraph as { images: Array<{ url: string }> }).images[0];
    expect(og.url).not.toContain("csv-review-import-system");
    expect(articleNode(await render("fr"))).not.toHaveProperty("image");
  });
});
