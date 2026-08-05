// Structured data for one chapter page, as a pure function of the config.
//
// Extracted from the page component so it can be asserted directly: a server
// component's graph is otherwise only observable by rendering the whole route,
// and "does a VideoObject appear for this chapter and not that one" is exactly
// the question that should be cheap to ask.
//
// EVERY VALUE COMES FROM learn-content.ts. Nothing here composes a string a
// human could disagree with — see the no-invented-data rule at the top of
// src/lib/seo/jsonld.ts.

import {
  article,
  breadcrumbList,
  organization,
  videoObject,
  webSite,
  type JsonLdNode,
} from "@/lib/seo/jsonld";
import { SITE_URL } from "@/lib/seo/constants";
import { LEARN_BASE, chapterVideoOf, type LearnChapter } from "@/lib/learn-content";

export interface ChapterCrumbs {
  home: string;
  hub: string;
}

/**
 * Absolute URL of a chapter, always on /en.
 *
 * The articles are English under every locale, so all five canonical to the en
 * URL (see buildMetadata's canonicalLocale). Structured data must name the same
 * URL the canonical does, or it describes a page Google has been told to ignore.
 */
export function chapterUrl(slug: string): string {
  return `${SITE_URL}/en${LEARN_BASE}/${slug}`;
}

export function chapterGraph(
  chapter: LearnChapter,
  locale: string,
  crumbs: ChapterCrumbs,
): JsonLdNode[] {
  const pageUrl = chapterUrl(chapter.slug);
  const video = chapterVideoOf(chapter);

  return [
    organization(locale),
    webSite(locale),
    article({
      headline: chapter.title,
      description: chapter.description,
      pageUrl,
      readingTime: chapter.readingTime,
      inLanguage: "en",
    }),
    breadcrumbList([
      { name: crumbs.home, url: `${SITE_URL}/en` },
      { name: crumbs.hub, url: `${SITE_URL}/en${LEARN_BASE}` },
      { name: chapter.title, url: pageUrl },
    ]),
    // A chapter video gets a full VideoObject, duration included. A prose-placed
    // video is the same node minus the duration, which InlineVideo does not
    // carry because nobody has measured it.
    ...(video
      ? [
          videoObject({
            name: video.title,
            description: video.description,
            thumbnailUrl: video.poster,
            contentUrl: video.src,
            uploadDate: video.uploadDate,
            durationSeconds: video.durationSeconds,
            pageUrl,
            inLanguage: "en",
          }),
        ]
      : chapter.video
        ? [
            videoObject({
              name: chapter.video.title,
              description: chapter.description,
              thumbnailUrl: chapter.video.poster,
              contentUrl: chapter.video.src,
              uploadDate: chapter.video.uploadDate,
              pageUrl,
              inLanguage: "en",
            }),
          ]
        : []),
  ];
}
