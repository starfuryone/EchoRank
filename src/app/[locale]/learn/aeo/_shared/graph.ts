// Structured data for the AEO course, as pure functions of the config, so
// tests/aeo-course-pages.test.ts can assert the graph without rendering.
//
// URLs are /en: the body is English under every locale, so every locale
// canonicals to the en URL and the structured data names the same URL.
// Lessons are Article nodes (what /learn uses) that are part of the Course.
// No FAQPage: the knowledge checks are quizzes, not FAQs.

import { ORGANIZATION_ID, WEBSITE_ID, article, breadcrumbList, organization, videoObject, webSite, type JsonLdNode } from "@/lib/seo/jsonld";
import { SITE_URL } from "@/lib/seo/constants";
import { LEARN_BASE } from "@/lib/learn-content";
import { AEO_BASE, AEO_COURSE, AEO_LESSONS, aeoLessonPath, aeoLessonVideo, courseMinutes, lessonMinutes, type AeoLesson } from "@/lib/aeo-course";

export const AEO_HUB_URL = `${SITE_URL}/en${AEO_BASE}`;
export const AEO_COURSE_ID = `${AEO_HUB_URL}#course`;
export const aeoLessonUrl = (slug: string) => `${SITE_URL}/en${aeoLessonPath(slug)}`;

const crumbs = [
  { name: "Home", url: `${SITE_URL}/en` },
  { name: "Knowledge Hub", url: `${SITE_URL}/en${LEARN_BASE}` },
  { name: AEO_COURSE.shortName, url: AEO_HUB_URL },
];

export function aeoHubGraph(locale: string): JsonLdNode[] {
  return [
    organization(locale),
    webSite(locale),
    {
      "@type": "Course",
      "@id": AEO_COURSE_ID,
      name: AEO_COURSE.name,
      description: AEO_COURSE.description,
      url: AEO_HUB_URL,
      inLanguage: "en",
      dateModified: AEO_COURSE.updatedAt,
      provider: { "@id": ORGANIZATION_ID },
      publisher: { "@id": ORGANIZATION_ID },
      isPartOf: { "@id": WEBSITE_ID },
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: 0, priceCurrency: "USD", category: "Free" },
      hasCourseInstance: {
        "@type": "CourseInstance",
        courseMode: "online",
        courseWorkload: `PT${courseMinutes()}M`,
        description: "Self-paced, online, free.",
      },
      hasPart: AEO_LESSONS.map((l) => ({
        "@type": "Article",
        "@id": `${aeoLessonUrl(l.slug)}#article`,
        headline: l.title,
        url: aeoLessonUrl(l.slug),
      })),
    },
    {
      "@type": "ItemList",
      "@id": `${AEO_HUB_URL}#lessons`,
      name: `${AEO_COURSE.name}: lessons`,
      numberOfItems: AEO_LESSONS.length,
      itemListElement: AEO_LESSONS.map((l, i) => ({ "@type": "ListItem", position: i + 1, name: l.title, url: aeoLessonUrl(l.slug) })),
    },
    breadcrumbList(crumbs),
  ];
}

export function aeoLessonGraph(lesson: AeoLesson, locale: string): JsonLdNode[] {
  const pageUrl = aeoLessonUrl(lesson.slug);
  const a = article({
    headline: lesson.title,
    description: lesson.metaDescription,
    pageUrl,
    inLanguage: "en",
    readingTime: lessonMinutes(lesson),
    dateModified: AEO_COURSE.updatedAt,
  });
  const video = aeoLessonVideo(lesson);
  return [
    organization(locale),
    webSite(locale),
    { ...a, isPartOf: [{ "@id": WEBSITE_ID }, { "@id": AEO_COURSE_ID }], learningResourceType: "Lesson", isAccessibleForFree: true },
    breadcrumbList([...crumbs, { name: lesson.title, url: pageUrl }]),
    // The lesson's own video, in the same graph (the /learn chapter builder).
    // videoObject() makes contentUrl and thumbnailUrl absolute.
    ...(video
      ? [
          videoObject({
            name: video.title,
            description: video.description,
            thumbnailUrl: video.poster,
            contentUrl: video.src,
            uploadDate: video.uploadDate,
            durationSeconds: video.durationSeconds,
            width: video.width,
            height: video.height,
            pageUrl,
            inLanguage: "en",
          }),
        ]
      : []),
  ];
}
