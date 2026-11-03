// pagination — <link rel="next"> / <link rel="prev">. Google stopped using
// them as an indexing signal in 2019, but other engines and browsers still
// read them, and a broken sequence is still broken. Hence warnings, not issues.

import { ev, pageRule, siteRule } from "../engine";
import type { Rule } from "../types";
import { comparable } from "./canonicals";

const F = "pagination" as const;

export const RULES: Rule[] = [
  siteRule({
    id: "pagination.target_not_200",
    family: F,
    kind: "warning",
    priority: "medium",
    detect: (_p, ctx) =>
      ctx.site.pagination.non200 > 0 ? ev({ count: ctx.site.pagination.non200, sample: ctx.site.pagination.sample }) : null,
  }),
  siteRule({
    id: "pagination.sequence_error",
    family: F,
    kind: "warning",
    priority: "low",
    detect: (_p, ctx) =>
      ctx.site.pagination.sequenceErrors > 0
        ? ev({ count: ctx.site.pagination.sequenceErrors, sample: ctx.site.pagination.sample })
        : null,
  }),
  pageRule({
    id: "pagination.url_not_linked",
    family: F,
    kind: "warning",
    priority: "low",
    detect: (p) => {
      const linked = new Set(p.html!.anchors.map((a) => comparable(a.href, p.finalUrl)));
      const missing = [...p.html!.relNext, ...p.html!.relPrev].find((u) => !linked.has(comparable(u, p.finalUrl)));
      return missing ? ev({ url: missing }) : null;
    },
  }),
  pageRule({
    id: "pagination.multiple",
    family: F,
    kind: "warning",
    priority: "low",
    detect: (p) =>
      p.html!.relNext.length > 1 || p.html!.relPrev.length > 1
        ? ev({ next: p.html!.relNext.length, prev: p.html!.relPrev.length })
        : null,
  }),
  pageRule({
    id: "pagination.outside_head",
    family: F,
    kind: "warning",
    priority: "low",
    applies: "html",
    detect: (p) => (p.html!.paginationOutsideHead > 0 ? ev({ count: p.html!.paginationOutsideHead }) : null),
  }),
  pageRule({
    id: "pagination.canonicalised_to_first",
    family: F,
    kind: "warning",
    priority: "medium",
    detect: (p) => {
      // A page with a rel=prev is not the first in its series; its canonical
      // should be itself, not the series start.
      if (p.html!.relPrev.length === 0) return null;
      const raw = p.html!.canonicals[0];
      const canonical = raw ? comparable(raw, p.finalUrl) : null;
      return canonical && canonical !== comparable(p.finalUrl, p.finalUrl) ? ev({ canonical }) : null;
    },
  }),
];
