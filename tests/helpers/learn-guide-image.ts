// Shared by the learn-guide image tests (review-request-templates,
// csv-review-import): both guides render their figure through the same
// {k:"image"} block, so they are checked the same way.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { expect } from "vitest";
import GuidePage, { generateMetadata } from "@/app/[locale]/learn/guides/[slug]/page";

export const ROOT = join(__dirname, "../..");

export const renderGuide = async (slug: string, locale: string) =>
  renderToStaticMarkup(await GuidePage({ params: Promise.resolve({ locale, slug }) }));

export const guideMeta = (slug: string, locale: string) =>
  generateMetadata({ params: Promise.resolve({ locale, slug }) });

/** renderToStaticMarkup escapes text; undo the five entities it emits. */
export const decode = (s: string) =>
  s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** The page's Article JSON-LD node. */
export function articleNode(html: string): Record<string, unknown> {
  const json = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]);
  return (json["@graph"] as Record<string, unknown>[]).find((n) => n["@type"] === "Article")!;
}

export interface ExpectedFigure {
  /** File stem under /learn/guides/, e.g. "review-request-system". */
  stem: string;
  /** Widths of the srcset, last one native. */
  widths: [number, number, number];
  height: number;
  alt: string;
  caption: string;
  /** Text that ends the intro paragraph the figure follows. */
  introEnd: string;
  /** id of the H2 that comes after the figure (and its own trailing blocks). */
  nextH2: string;
}

/**
 * The page has exactly one <figure>, right after the intro paragraph and
 * before `nextH2`, with every attribute the briefs specify and every srcset
 * file on disk. Returns the HTML that follows the figure, up to the H2.
 */
export function expectGuideFigure(html: string, f: ExpectedFigure): string {
  const figures = [...html.matchAll(/<figure[\s\S]*?<\/figure>/g)].map((m) => m[0]);
  expect(figures).toHaveLength(1);
  const fig = figures[0];
  const intro = html.indexOf(f.introEnd);
  const h2 = html.indexOf(`<h2 id="${f.nextH2}"`);
  const at = html.indexOf(fig);
  expect(intro).toBeGreaterThan(-1);
  expect(h2).toBeGreaterThan(-1);
  expect(at).toBeGreaterThan(intro);
  expect(at).toBeLessThan(h2);
  // Nothing between the intro paragraph and the figure.
  expect(html.slice(html.indexOf("</p>", intro) + 4, at)).toBe("");

  const img = fig.match(/<img [^>]*>/)![0];
  const [w0, w1, native] = f.widths;
  expect(img).toContain(`src="/learn/guides/${f.stem}-${w1}.webp"`);
  expect(img).toContain(`width="${native}"`);
  expect(img).toContain(`height="${f.height}"`);
  expect(decode(img)).toContain(`alt="${f.alt}"`);
  expect(img).toContain('sizes="(max-width: 760px) 100vw, 720px"');
  expect(img).toContain('loading="eager"');
  expect(img).toContain('fetchPriority="high"');
  expect(img).toContain('decoding="async"');
  const srcset = img.match(/srcSet="([^"]+)"/)![1].split(", ");
  expect(srcset).toEqual([w0, w1, native].map((w) => `/learn/guides/${f.stem}-${w}.webp ${w}w`));
  for (const entry of srcset) {
    const file = entry.split(" ")[0];
    expect(existsSync(join(ROOT, "public", file)), file).toBe(true);
  }
  expect(fig).toContain("<figcaption");
  expect(fig).toContain(f.caption);
  return html.slice(at + fig.length, h2);
}

/** og:image + twitter:image are the guide's og crop (1200x630, on disk) with the figure's alt. */
export async function expectGuideShareCard(slug: string, stem: string, alt: string): Promise<void> {
  const m = await guideMeta(slug, "en");
  const og = (m.openGraph as { images: Array<{ url: string; width: number; height: number; alt: string }> }).images[0];
  expect(og.url).toBe(`https://echorank360.com/learn/guides/${stem}-og.jpg`);
  expect([og.width, og.height]).toEqual([1200, 630]);
  expect(og.alt).toBe(alt);
  expect((m.twitter as { images: string[] }).images).toEqual([og.url]);
  expect(existsSync(join(ROOT, `public/learn/guides/${stem}-og.jpg`))).toBe(true);
}
