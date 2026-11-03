// h2 — section headings. Lower stakes than the H1, so mostly warnings and
// opportunities: they shape the outline readers and assistive tech navigate.

import { ev, pageRule, siteRule } from "../engine";
import type { Rule } from "../types";

const F = "h2" as const;

export const RULES: Rule[] = [
  pageRule({
    id: "h2.missing",
    family: F,
    kind: "opportunity",
    priority: "low",
    detect: (p) => (p.html!.h2.length === 0 ? ev() : null),
  }),
  siteRule({
    id: "h2.duplicate",
    family: F,
    kind: "opportunity",
    priority: "low",
    detect: (p, ctx) => (p.h2First && ctx.site.duplicateH2Count > 1 ? ev({ pages: ctx.site.duplicateH2Count, h2: p.h2First }) : null),
  }),
  pageRule({
    id: "h2.over_70_chars",
    family: F,
    kind: "warning",
    priority: "low",
    detect: (p) => {
      const long = p.html!.h2.find((h) => h.length > 70);
      return long ? ev({ length: long.length, h2: long }) : null;
    },
  }),
  pageRule({
    id: "h2.repeated_on_page",
    family: F,
    kind: "warning",
    priority: "low",
    detect: (p) => {
      const seen = new Set<string>();
      const dup = p.html!.h2.find((h) => {
        const k = h.toLowerCase();
        if (h === "" || !seen.has(k)) return (seen.add(k), false);
        return true;
      });
      return dup ? ev({ h2: dup }) : null;
    },
  }),
  pageRule({
    id: "h2.non_sequential",
    family: F,
    kind: "warning",
    priority: "low",
    detect: (p) => (p.html!.h3BeforeH2 ? ev() : null),
  }),
  pageRule({
    id: "h2.empty",
    family: F,
    kind: "warning",
    priority: "low",
    detect: (p) => {
      const empty = p.html!.h2.filter((h) => h === "").length;
      return empty > 0 ? ev({ count: empty }) : null;
    },
  }),
];
