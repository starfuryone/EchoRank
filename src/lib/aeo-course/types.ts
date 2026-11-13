// Types for the Echorank AEO course (src/lib/aeo-course.ts). Kept apart so the
// five lesson modules and the config can import them without a cycle.
//
// Body blocks are typed data, never HTML strings: every table and graphic on a
// lesson page renders from these values.

import type { SeoToolId } from "@/lib/seo-tools";
import type { AeoLessonSlug } from "@/lib/aeo-course-routes";

/** The graphic components, by id (src/components/aeo-course/graphics). */
export type AeoGraphicId =
  | "serp-vs-answer"
  | "fan-out"
  | "engine-matrix"
  | "prompt-panel"
  | "mrca-funnel"
  | "crawler-view"
  | "crawler-gate"
  | "page-anatomy"
  | "evidence-map"
  | "earned-rings"
  | "dashboard-mock"
  | "roadmap-90";

/**
 * What a callout is, said out loud. The course separates three kinds of claim:
 * what is established ("fact"), what Echorank advises ("recommendation") and
 * what nobody has shown yet ("unproven"). "example" carries the worked example.
 */
export type AeoCalloutTone = "fact" | "recommendation" | "unproven" | "example";

export type AeoBlock =
  | { k: "p"; t: string }
  | { k: "h2"; t: string }
  | { k: "h3"; t: string }
  | { k: "list"; ordered?: boolean; items: string[] }
  | { k: "table"; caption: string; head: string[]; rows: string[][] }
  /** `link`: a locale-less public route (registered), rendered locale-prefixed. */
  | { k: "callout"; tone: AeoCalloutTone; title: string; t: string; link?: { href: string; label: string } }
  | { k: "graphic"; id: AeoGraphicId };

export interface AeoQuestion {
  q: string;
  options: string[];
  /** Index into options. Exactly one answer is right. */
  correct: number;
  /** One line, shown after any answer. */
  explain: string;
}

/** The six sections of the learner's AEO plan (the worksheet). */
export type AeoPlanSection = "engines" | "baseline" | "site" | "evidence" | "program" | "summary";

export interface AeoPractice {
  /** What to do, as numbered steps. */
  steps: string[];
  /** The worksheet section this task fills. */
  section: AeoPlanSection;
}

/**
 * The lesson's one tool card. Every tie-in is something a visitor can reach:
 *   seo      — a tool from src/lib/seo-tools.ts that is LIVE (isSeoToolLive),
 *              linked to a public page about it, never to the app itself;
 *   page     — a public Echorank route (registered in the sitemap registry);
 *   external — another Echorank service on its own domain.
 */
export type AeoToolCard =
  | { kind: "seo"; tool: SeoToolId; name: string; body: string; href: string; cta: string }
  | { kind: "page"; name: string; body: string; href: string; cta: string }
  | { kind: "external"; name: string; body: string; href: string; cta: string };

export interface AeoLesson {
  slug: AeoLessonSlug;
  /** 1–5. */
  module: number;
  title: string;
  /** One or two sentences: the hub card and the lesson's lede. */
  summary: string;
  /** ≤ 165 characters, unique. */
  metaDescription: string;
  /** "You will learn" — three items. */
  objectives: string[];
  /** "You will produce" — the hub's glance table. */
  produces: string;
  body: AeoBlock[];
  /** Exactly three. */
  takeaways: string[];
  practice: AeoPractice;
  /** Exactly three. */
  quiz: AeoQuestion[];
  tool: AeoToolCard;
}

export interface AeoModule {
  n: number;
  title: string;
  blurb: string;
}
