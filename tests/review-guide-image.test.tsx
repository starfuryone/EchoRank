// /learn/guides/review-request-templates: "The Review Request System" image
// (ECHORANK-REVIEW-GUIDE-IMAGE, 2026-11-09).
//
// The picture sums up the guide before the templates, so it sits between the
// intro and the rules; the rules follow it, five of them in its order and
// wording. English is baked into the picture, so the fr page (which renders the
// same English body) shows no image, and only the en base gets the guide's
// share card and Article image.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import GuidePage, { generateMetadata } from "@/app/[locale]/learn/guides/[slug]/page";
import { guideBySlug, headingId, tableOfContents } from "@/lib/learn-content";

const ROOT = join(__dirname, "..");
const SLUG = "review-request-templates";
const ALT =
  "The review request system, an ethical five-part workflow: ask everyone, time it right, make it personal, use a one-tap link, send one reminder.";
const RULES = ["Ask everyone.", "Time it right.", "Make it personal.", "One-tap link.", "One reminder."];

const render = async (locale: string) =>
  renderToStaticMarkup(await GuidePage({ params: Promise.resolve({ locale, slug: SLUG }) }));
const meta = (locale: string) => generateMetadata({ params: Promise.resolve({ locale, slug: SLUG }) });
const decode = (s: string) =>
  s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

function article(html: string): Record<string, unknown> {
  const json = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]);
  return (json["@graph"] as Record<string, unknown>[]).find((n) => n["@type"] === "Article")!;
}

describe("the figure", () => {
  it("en: one <figure> between the intro paragraph and the rules H2, sized, alt'd, srcset x3", async () => {
    const html = await render("en");
    const figures = [...html.matchAll(/<figure[\s\S]*?<\/figure>/g)].map((m) => m[0]);
    expect(figures).toHaveLength(1);
    const fig = figures[0];
    const intro = html.indexOf("This guide is the system: channel by channel, with the exact copy.");
    const rulesH2 = html.indexOf('<h2 id="the-five-rules"');
    expect(intro).toBeGreaterThan(-1);
    expect(rulesH2).toBeGreaterThan(-1);
    const at = html.indexOf(fig);
    expect(at).toBeGreaterThan(intro);
    expect(at).toBeLessThan(rulesH2);
    // Nothing else between the intro paragraph and the figure, or the figure and the H2.
    expect(html.slice(html.indexOf("</p>", intro) + 4, at)).toBe("");
    expect(html.slice(at + fig.length, rulesH2)).toBe("");

    const img = fig.match(/<img [^>]*>/)![0];
    expect(img).toContain('src="/learn/guides/review-request-system-1200.webp"');
    expect(img).toContain('width="1671"');
    expect(img).toContain('height="941"');
    expect(decode(img)).toContain(`alt="${ALT}"`);
    expect(img).toContain('sizes="(max-width: 760px) 100vw, 720px"');
    expect(img).toContain('loading="eager"');
    expect(img).toContain('fetchPriority="high"');
    expect(img).toContain('decoding="async"');
    const srcset = img.match(/srcSet="([^"]+)"/)![1].split(", ");
    expect(srcset).toEqual([
      "/learn/guides/review-request-system-800.webp 800w",
      "/learn/guides/review-request-system-1200.webp 1200w",
      "/learn/guides/review-request-system-1671.webp 1671w",
    ]);
    for (const entry of srcset) {
      const file = entry.split(" ")[0];
      expect(existsSync(join(ROOT, "public", file)), file).toBe(true);
    }
    expect(fig).toContain("<figcaption");
    expect(fig).toContain("The whole system on one page. Each part is explained below.");
  });

  it("fr (and fr-CA): no review-request-system image anywhere on the page", async () => {
    for (const locale of ["fr", "fr-CA"]) {
      const html = await render(locale);
      expect(html, locale).not.toContain("review-request-system");
      expect(html, locale).not.toContain("<figure");
    }
  });

  it("the native size and the og crop are what the markup declares", () => {
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

  it("leaves no link to #the-four-rules in src, public, docs or tests", () => {
    let out = "";
    try {
      out = execFileSync("git", ["grep", "-l", "the-four-rules", "--", "src", "public", "docs", ":!tests/review-guide-image.test.tsx"], {
        cwd: ROOT,
        encoding: "utf8",
      });
    } catch {
      out = ""; // git grep exits 1 when nothing matches
    }
    expect(out.trim()).toBe("");
  });
});

describe("share card and Article image", () => {
  it("en: og:image and twitter:image are the og crop, with the figure's alt", async () => {
    const m = await meta("en");
    const og = (m.openGraph as { images: Array<{ url: string; width: number; height: number; alt: string }> }).images[0];
    expect(og.url).toBe("https://echorank360.com/learn/guides/review-request-system-og.jpg");
    expect([og.width, og.height]).toEqual([1200, 630]);
    expect(og.alt).toBe(ALT);
    expect((m.twitter as { images: string[] }).images).toEqual([og.url]);
    expect(existsSync(join(ROOT, "public/learn/guides/review-request-system-og.jpg"))).toBe(true);
  });

  it("en: the Article node carries the 1671 image", async () => {
    expect(article(await render("en")).image).toBe("https://echorank360.com/learn/guides/review-request-system-1671.webp");
  });

  it("fr: keeps the site's default share card and no Article image", async () => {
    const m = await meta("fr");
    const og = (m.openGraph as { images: Array<{ url: string }> }).images[0];
    expect(og.url).not.toContain("review-request-system");
    expect(article(await render("fr"))).not.toHaveProperty("image");
  });
});
