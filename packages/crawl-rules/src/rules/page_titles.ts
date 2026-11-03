// page_titles — the <title> element. Length is checked in characters AND in
// estimated SERP pixels: Google truncates by width, so "WWWW" and "iiii" are
// the same length and very different titles.

import { ev, pageRule, siteRule } from "../engine";
import type { PageFacts, Rule } from "../types";
import { TITLE_FONT_PX, pixelWidth } from "../util/pixels";

const F = "page_titles" as const;

/** The title search engines use: the first non-empty <title>. */
export const titleOf = (p: PageFacts): string | null => p.html!.titles.find((t) => t !== "") ?? null;

const withTitle = (test: (t: string, p: PageFacts) => ReturnType<typeof ev> | null) => (p: PageFacts) => {
  const t = titleOf(p);
  return t === null ? null : test(t, p);
};

export const RULES: Rule[] = [
  pageRule({
    id: "page_titles.missing",
    family: F,
    kind: "issue",
    priority: "high",
    detect: (p) => (titleOf(p) === null ? ev({ titleTags: p.html!.titles.length }) : null),
  }),
  siteRule({
    id: "page_titles.duplicate",
    family: F,
    kind: "issue",
    priority: "medium",
    detect: (p, ctx) =>
      p.title && ctx.site.duplicateTitleCount > 1 ? ev({ pages: ctx.site.duplicateTitleCount, title: p.title }) : null,
  }),
  pageRule({
    id: "page_titles.over_60_chars",
    family: F,
    kind: "warning",
    priority: "low",
    detect: withTitle((t) => (t.length > 60 ? ev({ length: t.length, title: t }) : null)),
  }),
  pageRule({
    id: "page_titles.over_70_chars",
    family: F,
    kind: "warning",
    priority: "medium",
    detect: withTitle((t) => (t.length > 70 ? ev({ length: t.length, title: t }) : null)),
  }),
  pageRule({
    id: "page_titles.under_30_chars",
    family: F,
    kind: "opportunity",
    priority: "low",
    detect: withTitle((t) => (t.length < 30 ? ev({ length: t.length, title: t }) : null)),
  }),
  pageRule({
    id: "page_titles.over_561_px",
    family: F,
    kind: "warning",
    priority: "low",
    detect: withTitle((t) => {
      const px = pixelWidth(t, TITLE_FONT_PX);
      return px > 561 ? ev({ pixels: px, title: t }) : null;
    }),
  }),
  pageRule({
    id: "page_titles.under_200_px",
    family: F,
    kind: "opportunity",
    priority: "low",
    detect: withTitle((t) => {
      const px = pixelWidth(t, TITLE_FONT_PX);
      return px < 200 ? ev({ pixels: px, title: t }) : null;
    }),
  }),
  pageRule({
    id: "page_titles.same_as_h1",
    family: F,
    kind: "opportunity",
    priority: "low",
    detect: withTitle((t, p) => {
      const h1 = p.html!.h1[0];
      return h1 && h1.toLowerCase() === t.toLowerCase() ? ev({ title: t }) : null;
    }),
  }),
  pageRule({
    id: "page_titles.multiple",
    family: F,
    kind: "issue",
    priority: "medium",
    detect: (p) => (p.html!.titles.length > 1 ? ev({ count: p.html!.titles.length }) : null),
  }),
  pageRule({
    id: "page_titles.outside_head",
    family: F,
    kind: "issue",
    priority: "medium",
    detect: (p) => (p.html!.titlesOutsideHead > 0 ? ev({ count: p.html!.titlesOutsideHead }) : null),
  }),
];
