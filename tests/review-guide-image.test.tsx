// /learn/guides/review-request-templates: "The Review Request System" image
// (ECHORANK-REVIEW-GUIDE-IMAGE, 2026-11-09).
//
// The picture sums up the guide before the templates, so it sits between the
// intro and the rules; the rules follow it, five of them in its order and
// wording. English is baked into the picture, so the fr page (which renders the
// same English body) shows no image, and only the en base gets the guide's
// share card and Article image. Helpers shared with csv-guide-image.test.tsx.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { guideBySlug, headingId, tableOfContents } from "@/lib/learn-content";
import {
  ROOT,
  articleNode,
  decode,
  expectGuideFigure,
  expectGuideShareCard,
  guideMeta,
  renderGuide,
} from "./helpers/learn-guide-image";

const SLUG = "review-request-templates";
const ALT =
  "The review request system, an ethical five-part workflow: ask everyone, time it right, make it personal, use a one-tap link, send one reminder.";
const RULES = ["Ask everyone.", "Time it right.", "Make it personal.", "One-tap link.", "One reminder."];
const render = (locale: string) => renderGuide(SLUG, locale);

describe("the figure", () => {
  it("en: one <figure> between the intro paragraph and the rules H2, sized, alt'd, srcset x3", async () => {
    const after = expectGuideFigure(await render("en"), {
      stem: "review-request-system",
      widths: [800, 1200, 1671],
      height: 941,
      alt: ALT,
      caption: "The whole system on one page. Each part is explained below.",
      introEnd: "This guide is the system: channel by channel, with the exact copy.",
      nextH2: "the-five-rules",
    });
    // The rules heading follows the figure directly.
    expect(after).toBe("");
  });

  it("fr (and fr-CA): no review-request-system image anywhere on the page", async () => {
    for (const locale of ["fr", "fr-CA"]) {
      const html = await render(locale);
      expect(html, locale).not.toContain("review-request-system");
      expect(html, locale).not.toContain("<figure");
    }
  });

  it("the native size is what the markup declares", () => {
    // WebP VP8: width/height are 14-bit fields at bytes 26..29.
    const webp = readFileSync(join(ROOT, "public/learn/guides/review-request-system-1671.webp"));
    expect([webp.readUInt16LE(26) & 0x3fff, webp.readUInt16LE(28) & 0x3fff]).toEqual([1671, 941]);
  });
});

describe("the rules", () => {
  it.each(["en", "fr"])("%s: five rules, in the image's order and wording", async (locale) => {
    const html = decode(await render(locale));
    const h2 = html.indexOf('<h2 id="the-five-rules"');
    const ol = html.slice(html.indexOf("<ol", h2), html.indexOf("</ol>", h2));
    const items = [...ol.matchAll(/<li>\s*<strong>([^<]+)<\/strong>/g)].map((m) => m[1]);
    expect(items).toEqual(RULES);
    expect(html).toContain("After 5–7 days, then stop. A second reminder costs goodwill.");
    expect(html).not.toMatch(/four rules|quatre règles/i);
  });

  it("keeps the email section's reminder line", () => {
    const body = guideBySlug(SLUG)!.body;
    expect(body).toContainEqual({ k: "p", t: "One reminder after 5–7 days. Then stop — a second reminder costs goodwill." });
  });

  it("the table of contents shows the new heading, and its anchor is the-five-rules", () => {
    const toc = tableOfContents(guideBySlug(SLUG)!.body);
    expect(toc).toContainEqual({ id: "the-five-rules", text: "The five rules" });
    expect(headingId("The five rules")).toBe("the-five-rules");
  });

  it("leaves no link to #the-four-rules in src, public or docs", () => {
    let out = "";
    try {
      out = execFileSync("git", ["grep", "-l", "the-four-rules", "--", "src", "public", "docs"], { cwd: ROOT, encoding: "utf8" });
    } catch {
      out = ""; // git grep exits 1 when nothing matches
    }
    expect(out.trim()).toBe("");
  });
});

describe("share card and Article image", () => {
  it("en: og:image and twitter:image are the og crop, with the figure's alt", async () => {
    await expectGuideShareCard(SLUG, "review-request-system", ALT);
  });

  it("en: the Article node carries the 1671 image", async () => {
    expect(articleNode(await render("en")).image).toBe("https://echorank360.com/learn/guides/review-request-system-1671.webp");
  });

  it("fr: keeps the site's default share card and no Article image", async () => {
    const m = await guideMeta(SLUG, "fr");
    const og = (m.openGraph as { images: Array<{ url: string }> }).images[0];
    expect(og.url).not.toContain("review-request-system");
    expect(articleNode(await render("fr"))).not.toHaveProperty("image");
  });
});
