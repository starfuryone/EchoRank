// The Echorank AEO course's URL space: /[locale]/learn/aeo, one page per
// lesson, the worksheet and the single-page print view. Everything else about
// the course lives in src/lib/aeo-course.ts.
//
// SEPARATE ON PURPOSE, like prompt-guide-routes.ts: src/lib/seo/registry.ts
// imports this, the registry is in the edge proxy's bundle, and the course
// config is ~80 KB of lesson copy. tests/aeo-course.test.ts fails if the slugs
// here and the lessons there ever disagree.

export const AEO_BASE = "/learn/aeo";

/** Course order. Module membership lives in the config. */
export const AEO_LESSON_SLUGS = [
  "what-is-aeo",
  "how-ai-answers-are-built",
  "engines-compared",
  "build-your-prompt-panel",
  "the-mrca-scorecard",
  "what-machines-actually-read",
  "crawler-access",
  "writing-answer-ready-pages",
  "reviews-and-reputation-as-evidence",
  "mentions-communities-and-video",
  "attribution-and-reporting",
  "your-90-day-aeo-plan",
] as const;

export type AeoLessonSlug = (typeof AEO_LESSON_SLUGS)[number];

/** Utility pages: real routes, both noindex, so neither is in the sitemap. */
export const AEO_WORKSHEET = `${AEO_BASE}/worksheet`;
export const AEO_ALL = `${AEO_BASE}/all`;

/** The indexable pages, for the sitemap registry: the hub, then every lesson. */
export function aeoRoutes(): string[] {
  return [AEO_BASE, ...AEO_LESSON_SLUGS.map((s) => `${AEO_BASE}/${s}`)];
}
