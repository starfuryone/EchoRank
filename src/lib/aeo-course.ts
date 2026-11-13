// The Echorank AEO course — /[locale]/learn/aeo, twelve lessons in five
// modules, a worksheet and a single-page print view.
//
// A PARALLEL CONFIG, NOT A SECOND COURSE INSIDE learn-content.ts. That module
// holds one flagship course (LEARN_CHAPTERS) with its own types and routes, and
// is imported by the edge proxy; refactoring it to hold two courses would put
// this one's ~80 KB of copy in the proxy bundle and risk the flagship. So the
// course lives here and in src/lib/aeo-course/, and its URL list lives in the
// dependency-free src/lib/aeo-course-routes.ts that the registry imports.
//
// SINGLE SOURCE OF TRUTH: the hub, the lessons, the worksheet, the print view,
// the JSON-LD, the sitemap and tests/aeo-course.test.ts all read this module.
//
// ORIGINAL COPY. Every lesson was written for Echorank from the course
// blueprint: no third-party course, article or framework, no competitor
// products, no statistics. MRCA (Mentioned → Recommended → Cited → Accurate) is
// Echorank's own scoring model. Body copy is English under all five locales,
// the /learn first-pass rule; chrome translates.

import { AEO_ALL, AEO_BASE, AEO_LESSON_SLUGS, AEO_WORKSHEET, type AeoLessonSlug } from "./aeo-course-routes";
import { MODULE_1 } from "./aeo-course/module-1";
import { MODULE_2 } from "./aeo-course/module-2";
import { MODULE_3 } from "./aeo-course/module-3";
import { MODULE_4 } from "./aeo-course/module-4";
import { MODULE_5 } from "./aeo-course/module-5";
import type { AeoBlock, AeoLesson, AeoModule, AeoPlanSection } from "./aeo-course/types";

export * from "./aeo-course/types";
export { AEO_ALL, AEO_BASE, AEO_LESSON_SLUGS, AEO_WORKSHEET, type AeoLessonSlug };

export const AEO_COURSE = {
  name: "The Echorank AEO Course",
  shortName: "AEO course",
  description:
    "A free, self-paced course in answer engine optimization: how AI assistants decide what to say, how to measure where you stand, and how to become the answer.",
  metaDescription:
    "A free 12-lesson course in answer engine optimization (AEO): how AI answers are built, how to measure your brand with the MRCA scorecard, and a 90-day plan.",
  /** The date the course copy was written. Article/Course dateModified. */
  updatedAt: "2026-11-13",
} as const;

export const AEO_MODULES: readonly AeoModule[] = [
  { n: 1, title: "How answer engines decide", blurb: "What AEO is, how an AI answer is assembled, and how the engines differ." },
  { n: 2, title: "Measure where you stand", blurb: "A fixed prompt panel and the MRCA scorecard: your measuring stick." },
  { n: 3, title: "Make your site answerable", blurb: "What crawlers read, who may read it, and pages written to be quoted." },
  { n: 4, title: "Earn trust beyond your site", blurb: "Reviews, consistent facts and independent mentions as evidence." },
  { n: 5, title: "Run it as a program", blurb: "Honest reporting and a 90-day rhythm you can keep up." },
];

export const AEO_LESSONS: readonly AeoLesson[] = [...MODULE_1, ...MODULE_2, ...MODULE_3, ...MODULE_4, ...MODULE_5];

/** The four MRCA stages, in order. The hub loop, lesson 5's funnel and the scorecard read this. */
export const MRCA_STAGES = [
  { key: "M", name: "Mentioned", line: "The assistant names you." },
  { key: "R", name: "Recommended", line: "It suggests you for the need." },
  { key: "C", name: "Cited", line: "It shows a page you own as a source." },
  { key: "A", name: "Accurate", line: "What it says about you is true." },
] as const;

// ── Words and minutes ──

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

function blockWords(b: AeoBlock): number {
  switch (b.k) {
    case "p":
    case "h2":
    case "h3":
      return words(b.t);
    case "list":
      return b.items.reduce((n, i) => n + words(i), 0);
    case "table":
      return words(b.caption) + [b.head, ...b.rows].flat().reduce((n, c) => n + words(c), 0);
    case "callout":
      return words(b.title) + words(b.t);
    case "graphic":
      return 0;
  }
}

/** The lesson's body, in words: prose, lists, tables and callouts. The 700–1,100 rule reads this. */
export function lessonWordCount(lesson: AeoLesson): number {
  return lesson.body.reduce((n, b) => n + blockWords(b), 0);
}

/** Every word a learner reads on the lesson page, including takeaways, practice and quiz. */
function pageWordCount(lesson: AeoLesson): number {
  return (
    lessonWordCount(lesson) +
    lesson.takeaways.reduce((n, t) => n + words(t), 0) +
    lesson.practice.steps.reduce((n, t) => n + words(t), 0) +
    lesson.quiz.reduce((n, q) => n + words(q.q) + q.options.reduce((m, o) => m + words(o), 0) + words(q.explain), 0)
  );
}

/** Reading minutes, computed from the page's words at 200 words a minute, rounded up. */
export function lessonMinutes(lesson: AeoLesson): number {
  return Math.ceil(pageWordCount(lesson) / 200);
}

export function courseMinutes(): number {
  return AEO_LESSONS.reduce((n, l) => n + lessonMinutes(l), 0);
}

// ── Lookups ──

export function aeoLessonBySlug(slug: string): AeoLesson | undefined {
  return AEO_LESSONS.find((l) => l.slug === slug);
}

export function aeoLessonPath(slug: string): string {
  return `${AEO_BASE}/${slug}`;
}

export function aeoLessonNumber(lesson: AeoLesson): number {
  return AEO_LESSONS.indexOf(lesson) + 1;
}

export function aeoModule(n: number): AeoModule | undefined {
  return AEO_MODULES.find((m) => m.n === n);
}

export function lessonsInModule(n: number): AeoLesson[] {
  return AEO_LESSONS.filter((l) => l.module === n);
}

/** Previous and next lesson in course order; undefined at the ends. */
export function aeoNeighbours(slug: string): { prev?: AeoLesson; next?: AeoLesson } {
  const i = AEO_LESSONS.findIndex((l) => l.slug === slug);
  if (i < 0) return {};
  return { prev: AEO_LESSONS[i - 1], next: AEO_LESSONS[i + 1] };
}

/** Anchor id for a lesson h2. */
export function aeoHeadingId(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The lesson's "On this page" entries: every h2, then the fixed closing sections. */
export function aeoToc(lesson: AeoLesson): { id: string; text: string }[] {
  return [
    ...lesson.body.filter((b): b is { k: "h2"; t: string } => b.k === "h2").map((b) => ({ id: aeoHeadingId(b.t), text: b.t })),
    { id: "takeaways", text: AEO_COPY.takeaways },
    { id: "practice", text: AEO_COPY.practice },
    { id: "check", text: AEO_COPY.check },
  ];
}

// ── The worksheet: the learner's AEO plan ──

export interface AeoPlanField {
  id: string;
  label: string;
  hint: string;
}

export const AEO_PLAN: readonly { section: AeoPlanSection; title: string; module?: number; fields: AeoPlanField[] }[] = [
  {
    section: "summary",
    title: "Summary",
    fields: [
      { id: "goal", label: "Our one-line AEO goal", hint: "Who asks, about what, and the outcome we want (lesson 1)." },
      { id: "priorities", label: "Top three priorities this quarter", hint: "One per line, in order." },
      { id: "owners", label: "Owners and first report date", hint: "Who owns each priority, and when the first monthly report is due." },
    ],
  },
  {
    section: "engines",
    module: 1,
    title: "How answer engines decide for us",
    fields: [
      { id: "engines", label: "Engines we track, and why", hint: "Two or three, from what buyers actually use (lesson 3)." },
      { id: "subquestions", label: "Sub-questions behind our top buyer question", hint: "And the page that answers each one, or “none” (lesson 2)." },
    ],
  },
  {
    section: "baseline",
    module: 2,
    title: "Prompt panel and baseline",
    fields: [
      { id: "panel", label: "Prompt panel", hint: "Id, type, stage and frozen wording for each prompt (lesson 4)." },
      { id: "scorecard", label: "Baseline MRCA scorecard", hint: "Where we drop out most often, per engine, and competitors seen (lesson 5)." },
    ],
  },
  {
    section: "site",
    module: 3,
    title: "Site fixes",
    fields: [
      { id: "rendering", label: "Content crawlers cannot see", hint: "Page types and the fix for each (lesson 6)." },
      { id: "access", label: "Crawler access decisions", hint: "Allow or block per user agent, with the reason and date (lesson 7)." },
      { id: "rewrites", label: "Pages to rewrite answer-first", hint: "The three pages, the opening answer for each, and the owner (lesson 8)." },
    ],
  },
  {
    section: "evidence",
    module: 4,
    title: "Evidence beyond our site",
    fields: [
      { id: "reputation", label: "Reputation and profile fixes", hint: "Source-of-truth record, profiles that differ, review routine (lesson 9)." },
      { id: "mentions", label: "Earned mentions and corrections", hint: "Third-party pages to contact and communities to join (lesson 10)." },
    ],
  },
  {
    section: "program",
    module: 5,
    title: "Running the program",
    fields: [
      { id: "report", label: "Monthly report template", hint: "Metrics with their blind spots (lesson 11)." },
      { id: "plan90", label: "90-day plan", hint: "Week 1, days 1–30, 31–60 and 61–90, with owners (lesson 12)." },
    ],
  },
];

/** localStorage keys. Each read and write is wrapped; the course works without storage. */
export const AEO_PROGRESS_KEY = "echorank.aeo.progress.v1";
export const AEO_WORKSHEET_KEY = "echorank.aeo.worksheet.v1";

// ── Chrome copy (the body is English everywhere; these strings are the course's own UI) ──

export const AEO_COPY = {
  hubCrumb: "AEO course",
  heroEyebrow: "Free course · 12 lessons · self-paced",
  heroH1: "Become the answer.",
  heroLead:
    "Answer engine optimization, from first principles to a 90-day plan. Learn how AI assistants decide what to say, measure where your brand stands with the MRCA scorecard, and fix what keeps you out of the answer.",
  start: "Start lesson 1",
  resume: (title: string) => `Resume: ${title}`,
  worksheetCta: "Open the AEO plan worksheet",
  modulesH2: "Five modules, twelve lessons",
  filterLabel: "Find a lesson",
  filterPlaceholder: "Try robots.txt, reviews, scorecard…",
  filterEmpty: "No lesson matches. Try a broader word.",
  glanceH2: "Course at a glance",
  glanceCaption: "Every lesson: what you will learn, what you will produce and how long it takes",
  glanceHead: ["Lesson", "You will learn", "You will produce", "Minutes"],
  mrcaH2: "One scoring model, all the way through",
  mrcaBody:
    "Echorank scores every AI answer in four stages. A brand can pass one and fail the next, and each failure has a different fix. You will meet the model in lesson 1, build it in lesson 5 and report on it in lesson 11.",
  /** A template ({done}, {total}): the ring that fills it in is a client component. */
  progress: "{done} of {total} lessons complete",
  lessonOne: "lesson",
  lessonMany: "lessons",
  minutes: (n: number) => `${n} min`,
  lessonN: (n: number) => `Lesson ${n}`,
  moduleN: (n: number) => `Module ${n}`,
  objectives: "In this lesson",
  takeaways: "Key takeaways",
  practice: "Practice task",
  practiceSection: (title: string) => `Adds to your plan: ${title}`,
  check: "Knowledge check",
  checkIntro: "Three questions. Pick an answer to see whether it is right and why.",
  correct: "Correct.",
  incorrect: "Not quite.",
  tryAgain: "Try again",
  markComplete: "Mark lesson complete",
  completed: "Completed",
  markIncomplete: "Mark as not complete",
  toolEyebrow: "Put it into practice",
  contents: "Course contents",
  onThisPage: "On this page",
  prev: "Previous lesson",
  next: "Next lesson",
  printAll: "Print the whole course",
  calloutLabel: {
    fact: "Fact",
    recommendation: "Echorank recommends",
    unproven: "Not yet proven",
    example: "Worked example",
  },
  worksheet: {
    title: "Your AEO plan",
    lead:
      "Every practice task in the course fills one section of this plan. It is saved in this browser only, never sent anywhere. Copy it as text or print it to share.",
    copy: "Copy as text",
    print: "Print",
    copied: "Plan copied to clipboard",
    copyFailed: "Copy failed. Select the text instead.",
    saved: "Saved in this browser",
    unsaved: "This browser is not saving; copy your plan before you leave",
    clear: "Clear the plan",
    clearConfirm: "Clear every field of the plan?",
  },
  all: {
    title: "The Echorank AEO Course, all lessons",
    lead: "Every lesson on one page, for printing or offline reading. Knowledge checks are left out.",
  },
  cta: {
    h2: "Track your MRCA score without the spreadsheet",
    body: "Echorank runs your prompts on the engines you choose, scores the answers and shows what to fix first.",
  },
} as const;

// ── Hub "Course at a glance" rows ──

export function glanceRows(): { n: number; slug: AeoLessonSlug; title: string; learn: string; produce: string; minutes: number }[] {
  return AEO_LESSONS.map((l, i) => ({
    n: i + 1,
    slug: l.slug,
    title: l.title,
    learn: l.objectives[0],
    produce: l.produces,
    minutes: lessonMinutes(l),
  }));
}

/** Every route the course itself links to, for the route-resolution test. */
export function aeoInternalHrefs(): string[] {
  const out = new Set<string>([AEO_BASE, AEO_WORKSHEET, AEO_ALL, "/pricing", "/free-audit"]);
  for (const l of AEO_LESSONS) {
    out.add(aeoLessonPath(l.slug));
    if (l.tool.kind !== "external") out.add(l.tool.href);
    for (const b of l.body) if (b.k === "callout" && b.link) out.add(b.link.href);
  }
  return [...out];
}
