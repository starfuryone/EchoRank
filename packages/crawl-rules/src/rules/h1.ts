// h1 — the page's main heading.

import { ev, pageRule, siteRule } from "../engine";
import type { Rule } from "../types";

const F = "h1" as const;

export const RULES: Rule[] = [
  pageRule({
    id: "h1.missing",
    family: F,
    kind: "issue",
    priority: "medium",
    detect: (p) => (p.html!.h1.length === 0 ? ev() : null),
  }),
  siteRule({
    id: "h1.duplicate",
    family: F,
    kind: "warning",
    priority: "low",
    detect: (p, ctx) => (p.h1First && ctx.site.duplicateH1Count > 1 ? ev({ pages: ctx.site.duplicateH1Count, h1: p.h1First }) : null),
  }),
  pageRule({
    id: "h1.over_70_chars",
    family: F,
    kind: "warning",
    priority: "low",
    detect: (p) => {
      const long = p.html!.h1.find((h) => h.length > 70);
      return long ? ev({ length: long.length, h1: long }) : null;
    },
  }),
  pageRule({
    id: "h1.multiple",
    family: F,
    kind: "warning",
    priority: "low",
    detect: (p) => (p.html!.h1.length > 1 ? ev({ count: p.html!.h1.length }) : null),
  }),
  siteRule({
    id: "h1.matches_other_title",
    family: F,
    kind: "warning",
    priority: "low",
    detect: (p, ctx) =>
      p.h1First && ctx.site.h1MatchesOtherTitleCount > 0 ? ev({ pages: ctx.site.h1MatchesOtherTitleCount, h1: p.h1First }) : null,
  }),
  pageRule({
    id: "h1.empty",
    family: F,
    kind: "issue",
    priority: "medium",
    detect: (p) => {
      const empty = p.html!.h1.filter((h) => h === "").length;
      return empty > 0 ? ev({ count: empty }) : null;
    },
  }),
];
