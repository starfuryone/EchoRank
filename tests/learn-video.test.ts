// Chapter video: does it render, where does it render, and does it reach
// structured data — asserted against the config, never against a fixture.
//
// The placement requirement is the interesting one. The video belongs after the
// intro and before the first section heading, and the test proves that by
// comparing positions in the rendered markup rather than by trusting a class
// name — so it would still catch a regression that moved the block to the
// bottom of the article.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ArticleShell } from "@/app/[locale]/learn/_shared/ArticleShell";
import { chapterGraph } from "@/app/[locale]/learn/_shared/graph";
import { isoDuration } from "@/lib/seo/jsonld";
import { SITE_URL } from "@/lib/seo/constants";
import {
  LEARN_CHAPTERS,
  chapterBySlug,
  chapterVideoOf,
  inlineVideoOf,
  type LearnChapter,
} from "@/lib/learn-content";

const WITH_VIDEO = chapterBySlug("what-is-reputation-management")!;
const WITHOUT_VIDEO = chapterBySlug("audit-your-starting-point")!;
const WITH_INLINE_VIDEO = chapterBySlug("import-your-review-history")!;

const CRUMBS = { home: "Home", hub: "Knowledge Hub" };

function render(chapter: LearnChapter, locale = "en"): string {
  return renderToStaticMarkup(
    createElement(ArticleShell, {
      locale,
      eyebrow: "CHAPTER 01",
      title: chapter.title,
      description: chapter.description,
      readingTime: chapter.readingTime,
      body: chapter.body,
      video: chapter.video,
      cta: chapter.cta,
      related: chapter.related,
    }),
  );
}

describe("config", () => {
  it("gives chapter 1 a chapter video and nothing else one", () => {
    const withChapterVideo = LEARN_CHAPTERS.filter((c) => chapterVideoOf(c)).map((c) => c.slug);
    expect(withChapterVideo).toEqual(["what-is-reputation-management"]);
  });

  it("keeps the extension walkthrough a prose-placed video, not a chapter video", () => {
    // The two are different features on the same field. If this flips, chapter
    // 3's walkthrough would render twice — once at its marker, once after the
    // intro — or lose its HomeVideo chrome.
    expect(inlineVideoOf(WITH_INLINE_VIDEO)).toBeDefined();
    expect(chapterVideoOf(WITH_INLINE_VIDEO)).toBeUndefined();
  });

  it("carries only measured values", () => {
    const v = chapterVideoOf(WITH_VIDEO)!;
    expect(v.src).toBe("/videos/echorank-what-is-reputation-management.mp4");
    expect(v.poster).toBe("/videos/echorank-what-is-reputation-management-poster.jpg");
    expect(v.uploadDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(v.durationSeconds).toBe(248);
    // Title and description are the chapter's own, so the VideoObject can never
    // describe a different page than the one it sits on.
    expect(v.title).toBe(WITH_VIDEO.title);
    expect(v.description).toBe(WITH_VIDEO.description);
  });
});

describe("rendering", () => {
  it("renders a video block for the chapter that has one", () => {
    const html = render(WITH_VIDEO);
    expect(html).toContain("<video");
    expect(html).toContain('src="/videos/echorank-what-is-reputation-management.mp4"');
    expect(html).toContain('poster="/videos/echorank-what-is-reputation-management-poster.jpg"');
  });

  it("renders none for a chapter without the field", () => {
    expect(render(WITHOUT_VIDEO)).not.toContain("<video");
  });

  it("places it after the intro and before the first section heading", () => {
    const html = render(WITH_VIDEO);
    const introEnd = html.indexOf("That framing is obsolete for three reasons.");
    const video = html.indexOf("<video");
    const firstHeading = html.indexOf("Reviews are a ranking factor");

    expect(introEnd).toBeGreaterThan(-1);
    expect(firstHeading).toBeGreaterThan(-1);
    expect(video).toBeGreaterThan(introEnd);
    expect(video).toBeLessThan(firstHeading);
  });

  it("uses native controls, a poster, and no eager preload", () => {
    const html = render(WITH_VIDEO);
    expect(html).toContain("controls");
    expect(html).toContain('preload="none"');
    expect(html).toMatch(/playsinline/i);
  });

  it("leaves the prose-placed walkthrough on its own player", () => {
    // HomeVideo is muted with controls={false} and its own overlay. A native
    // controls bar here would mean the two placements had been collapsed into
    // one. (Both use preload="none", so that attribute distinguishes nothing.)
    const html = render(WITH_INLINE_VIDEO);
    expect(html).toContain("echorank-extension-install.mp4");
    expect(html).not.toContain("controls=");
    expect(html).toContain("muted=");
  });

  it("does not mute the chapter video — it is user-initiated, not decorative", () => {
    const html = render(WITH_VIDEO);
    expect(html).toContain("controls=");
    expect(html).not.toContain("muted=");
  });

  it("renders the same video under every locale, because the prose is English", () => {
    // fr/de-CH serve the English body, so the one config entry applies to all
    // five locale variants of the page.
    for (const locale of ["en", "en-CA", "fr", "fr-CA", "de-CH"]) {
      const html = render(WITH_VIDEO, locale);
      expect(html, locale).toContain("/videos/echorank-what-is-reputation-management.mp4");
    }
  });
});

describe("VideoObject", () => {
  const typesIn = (chapter: LearnChapter) =>
    chapterGraph(chapter, "en", CRUMBS).map((n) => n["@type"]);

  it("appears for a chapter with a video", () => {
    expect(typesIn(WITH_VIDEO)).toContain("VideoObject");
  });

  it("does not appear for a chapter without one", () => {
    expect(typesIn(WITHOUT_VIDEO)).not.toContain("VideoObject");
  });

  it("derives every field from the config, with absolute URLs", () => {
    const node = chapterGraph(WITH_VIDEO, "en", CRUMBS).find(
      (n) => n["@type"] === "VideoObject",
    ) as Record<string, unknown>;
    const v = chapterVideoOf(WITH_VIDEO)!;

    expect(node.name).toBe(v.title);
    expect(node.description).toBe(v.description);
    expect(node.uploadDate).toBe(v.uploadDate);
    expect(node.contentUrl).toBe(`${SITE_URL}${v.src}`);
    expect(node.thumbnailUrl).toBe(`${SITE_URL}${v.poster}`);
    expect(node.duration).toBe("PT4M8S");
  });

  it("names the canonical /en URL, matching what the page canonicals to", () => {
    const node = chapterGraph(WITH_VIDEO, "fr", CRUMBS).find(
      (n) => n["@type"] === "VideoObject",
    ) as Record<string, unknown>;
    expect(node["@id"]).toBe(`${SITE_URL}/en/learn/${WITH_VIDEO.slug}#video`);
  });

  it("omits duration for the prose-placed video, which has none measured", () => {
    const node = chapterGraph(WITH_INLINE_VIDEO, "en", CRUMBS).find(
      (n) => n["@type"] === "VideoObject",
    ) as Record<string, unknown>;
    expect(node).toBeDefined();
    expect(node.duration).toBeUndefined();
  });
});

describe("isoDuration", () => {
  it("serializes the chapter's runtime", () => {
    expect(isoDuration(248)).toBe("PT4M8S");
  });

  it("omits zero components rather than padding them", () => {
    expect(isoDuration(60)).toBe("PT1M");
    expect(isoDuration(45)).toBe("PT45S");
    expect(isoDuration(3600)).toBe("PT1H");
    expect(isoDuration(3661)).toBe("PT1H1M1S");
  });

  it("never emits a bare PT, which is invalid", () => {
    expect(isoDuration(0)).toBe("PT0S");
    expect(isoDuration(-5)).toBe("PT0S");
  });

  it("floors fractional seconds instead of publishing a decimal", () => {
    // The file is 248.49s; schema.org durations are whole units here.
    expect(isoDuration(248.49)).toBe("PT4M8S");
  });
});
