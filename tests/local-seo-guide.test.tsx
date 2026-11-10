// /learn/guides/local-seo-checklist (2026-11-10).
//
// Step 4: Google stopped showing FAQ rich results for every site on May 7,
// 2026. The guide keeps LocalBusiness schema and a real FAQ written for
// people; FAQPage markup is optional and is never recommended for a rich
// result. The "Last updated" line and Article dateModified share one date.
//
// The overview image ("Local SEO with Echorank", the seven layers): one
// <figure> between the intro and step 1 on en, fr and de-CH, alt and caption
// in the page's language (the picture's own text is English), srcset 960w /
// 1672w, sized, eager, and a link to the full-size file; og:image and
// twitter:image are its 1200×630 crop on every locale; the Article names it.
// No horizontal scroll at 375 px is pinned here by the CSS that guarantees it
// and was measured in a browser on a scratch build.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LOCAL_SEO_FIGURE, LOCAL_SEO_IMG_VERSION, LOCAL_SEO_UPDATED, guideBySlug, headingId } from "@/lib/learn-content";
import { ROOT, articleNode, decode, guideMeta, renderGuide } from "./helpers/learn-guide-image";

const SLUG = "local-seo-checklist";
const render = (locale: string) => renderGuide(SLUG, locale);
const IMG = "/learn/guides/seven-layer-local-seo-discovery-blueprint";
/** Every URL of the picture carries its version (a re-cut under the same names must be refetched). */
const V = `?v=${LOCAL_SEO_IMG_VERSION}`;
const OG = `https://echorank360.com${IMG}-og.jpg${V}`;
const LOCALES = [
  ["en", "en"],
  ["en-CA", "en"],
  ["fr", "fr"],
  ["fr-CA", "fr"],
  ["de-CH", "de-CH"],
] as const;

/** WebP (VP8 lossy) or JPEG (SOF0/SOF2) pixel size. */
function sizeOf(file: string): [number, number] {
  const b = readFileSync(join(ROOT, "public", file));
  if (b.toString("ascii", 8, 12) === "WEBP") return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  for (let i = 2; i < b.length; ) {
    const marker = b.readUInt16BE(i);
    if (marker === 0xffc0 || marker === 0xffc2) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + b.readUInt16BE(i + 2);
  }
  throw new Error(`no size in ${file}`);
}

describe("the overview figure", () => {
  it.each(LOCALES)("%s: one figure after the intro, before step 1, with its alt and caption", async (locale, lang) => {
    const html = await render(locale);
    const figures = [...html.matchAll(/<figure[\s\S]*?<\/figure>/g)].map((m) => m[0]);
    expect(figures).toHaveLength(1);
    const fig = figures[0];
    const at = html.indexOf(fig);
    const intro = html.indexOf("This is the full checklist, ordered by leverage.");
    const step1 = html.indexOf(`<h2 id="${headingId("1. Google Business Profile, complete")}"`);
    expect(intro).toBeGreaterThan(-1);
    expect(at).toBeGreaterThan(intro);
    expect(at).toBeLessThan(step1);
    expect(html.slice(html.indexOf("</p>", intro) + 4, at)).toBe("");
    expect(html.slice(at + fig.length, step1)).toBe("");

    const d = decode(fig);
    expect(d).toContain(`alt="${LOCAL_SEO_FIGURE[lang].alt}"`);
    expect(d).toContain(`<figcaption`);
    expect(d).toContain(LOCAL_SEO_FIGURE[lang].caption);
  });

  it("the image: srcset 960w and 1672w, content-column sizes, width/height, eager, high priority", async () => {
    const fig = (await render("en")).match(/<figure[\s\S]*?<\/figure>/)![0];
    const img = fig.match(/<img [^>]*>/)![0];
    expect(decode(img)).toContain(`src="${IMG}-960.webp${V}"`);
    expect(decode(img.match(/srcSet="([^"]+)"/)![1])).toBe(`${IMG}-960.webp${V} 960w, ${IMG}-1672.webp${V} 1672w`);
    expect(img).toContain('sizes="(max-width: 760px) 100vw, 720px"');
    expect(img).toContain('width="1672"');
    expect(img).toContain('height="941"');
    expect(img).toContain('loading="eager"');
    expect(img).not.toContain('loading="lazy"');
    expect(img).toContain('fetchPriority="high"');
  });

  it("tapping it opens the full-size image", async () => {
    for (const locale of ["en", "fr", "de-CH"]) {
      const fig = (await render(locale)).match(/<figure[\s\S]*?<\/figure>/)![0];
      expect(decode(fig), locale).toMatch(new RegExp(`<a [^>]*href="${IMG}-1672\\.webp\\?v=${LOCAL_SEO_IMG_VERSION}"[^>]*>\\s*<img `));
    }
  });

  it("the files are on disk at the sizes the markup declares", () => {
    expect(sizeOf(`${IMG}-960.webp`)).toEqual([960, 540]);
    expect(sizeOf(`${IMG}-1672.webp`)).toEqual([1672, 941]);
    expect(sizeOf(`${IMG}-og.jpg`)).toEqual([1200, 630]);
  });

  it("the translations are real: none is the English text, de-CH has no ß", () => {
    for (const k of ["alt", "caption"] as const) {
      expect(LOCAL_SEO_FIGURE.fr[k]).not.toBe(LOCAL_SEO_FIGURE.en[k]);
      expect(LOCAL_SEO_FIGURE["de-CH"][k]).not.toBe(LOCAL_SEO_FIGURE.en[k]);
    }
    expect(JSON.stringify(LOCAL_SEO_FIGURE["de-CH"])).not.toContain("ß");
    expect(LOCAL_SEO_FIGURE.en.caption).toBe(
      "The seven layers at a glance, and the loop they feed: more reviews, more visibility, more customers.",
    );
  });

  it("no horizontal scroll at 375 px: the image, its link and the figure never exceed the column", () => {
    const css = readFileSync(join(ROOT, "src/app/[locale]/learn/_shared/learn.module.css"), "utf8");
    const rule = (sel: string) => css.match(new RegExp(`\\.${sel} \\{([^}]*)\\}`))![1];
    expect(rule("figure")).toMatch(/width: 100%/);
    expect(rule("figureImg")).toMatch(/display: block;[\s\S]*width: 100%;[\s\S]*height: auto/);
    expect(rule("figureLink")).toMatch(/display: block;[\s\S]*max-width: 100%/);
  });
});

describe("share card and Article image, every locale", () => {
  it.each(LOCALES)("%s: og:image and twitter:image are the 1200×630 crop, alt in the page's language", async (locale, lang) => {
    const m = await guideMeta(SLUG, locale);
    const og = (m.openGraph as { images: Array<{ url: string; width: number; height: number; alt: string }> }).images[0];
    expect(og).toEqual({ url: OG, width: 1200, height: 630, alt: LOCAL_SEO_FIGURE[lang].alt });
    const tw = (m.twitter as { images: Array<{ url: string; width: number; height: number; alt: string }> }).images;
    expect(tw).toEqual([{ url: OG, width: 1200, height: 630, alt: LOCAL_SEO_FIGURE[lang].alt }]);
    expect(existsSync(join(ROOT, `public${IMG}-og.jpg`))).toBe(true);
  });

  it.each(LOCALES)("%s: the Article JSON-LD names the full-size image", async (locale) => {
    expect(articleNode(await render(locale)).image).toBe(`https://echorank360.com${IMG}-1672.webp${V}`);
  });

  it("the re-cut picture's layer 4 is structured data, and no alt text names FAQPage", () => {
    for (const lang of ["en", "fr", "de-CH"] as const) {
      expect(LOCAL_SEO_FIGURE[lang].alt).not.toMatch(/faq/i);
      expect(LOCAL_SEO_FIGURE[lang].alt).toContain("LocalBusiness");
    }
  });

  it("the other guides' cards stay EN-only", async () => {
    const m = await guideMeta("review-request-templates", "fr");
    expect(JSON.stringify(m.openGraph)).not.toContain("review-request-system");
  });
});

/** The HTML of step 4: from its H2 to the next one. */
function step4(html: string): string {
  const from = html.indexOf(`<h2 id="${headingId("4. Structured data")}"`);
  const to = html.indexOf("<h2", from + 4);
  expect(from).toBeGreaterThan(-1);
  return decode(html.slice(from, to)).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

describe("step 4: structured data after FAQ rich results ended", () => {
  it("keeps LocalBusiness schema and a real FAQ written for people", async () => {
    const s = step4(await render("en"));
    expect(s).toContain("LocalBusiness markup on your homepage/contact page");
    expect(s).toContain("A real FAQ written for people");
  });

  it("says FAQPage markup is optional and earns no Google rich result, with the date", async () => {
    const s = step4(await render("en"));
    expect(s).toContain("FAQPage markup is optional");
    expect(s).toContain("Since May 7, 2026, Google shows no FAQ rich results for any site");
  });

  it("never recommends FAQ markup for a rich result", () => {
    const text = JSON.stringify(guideBySlug(SLUG)!.body);
    expect(text).not.toMatch(/FAQPage\*\* markup on a real FAQ/);
    expect(text).not.toMatch(/(earn|win|get|qualif\w*|eligib\w*)[^."]{0,40}(FAQ )?rich (result|snippet)/i);
  });

  it("the Last updated line and the Article dateModified carry the same date", async () => {
    expect(LOCAL_SEO_UPDATED).toBe("2026-11-10");
    const html = await render("en");
    expect(decode(html)).toContain("Last updated: November 10, 2026.");
    expect(articleNode(html).dateModified).toBe(LOCAL_SEO_UPDATED);
    expect(guideBySlug(SLUG)!.dateModified).toBe(LOCAL_SEO_UPDATED);
  });
});
