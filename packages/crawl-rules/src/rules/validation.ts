// validation — document structure as written, from the raw-source facts (a
// parser repairs all of these silently, which is exactly why they matter:
// each engine repairs them differently).

import { ev, pageRule } from "../engine";
import type { Rule } from "../types";

const F = "validation" as const;

export const RULES: Rule[] = [
  pageRule({
    id: "validation.missing_doctype",
    family: F,
    kind: "warning",
    priority: "medium",
    applies: "html",
    detect: (p) => (p.html!.raw.hasDoctype ? null : ev()),
  }),
  pageRule({
    id: "validation.invalid_head_element",
    family: F,
    kind: "issue",
    priority: "high",
    applies: "html",
    detect: (p) => {
      const els = p.html!.raw.invalidHeadElements;
      return els.length ? ev({ elements: els.join(", ") }) : null;
    },
  }),
  pageRule({
    id: "validation.body_before_head",
    family: F,
    kind: "issue",
    priority: "medium",
    applies: "html",
    detect: (p) => (p.html!.raw.bodyBeforeHead ? ev() : null),
  }),
  pageRule({
    id: "validation.multiple_html_or_body",
    family: F,
    kind: "issue",
    priority: "medium",
    applies: "html",
    detect: (p) => {
      const r = p.html!.raw;
      return r.htmlTagCount > 1 || r.bodyTagCount > 1 || r.headTagCount > 1
        ? ev({ html: r.htmlTagCount, head: r.headTagCount, body: r.bodyTagCount })
        : null;
    },
  }),
  pageRule({
    id: "validation.head_not_first",
    family: F,
    kind: "warning",
    priority: "low",
    applies: "html",
    detect: (p) => (p.html!.raw.headTagCount > 0 && !p.html!.raw.headIsFirstChild ? ev() : null),
  }),
  pageRule({
    id: "validation.missing_viewport",
    family: F,
    kind: "warning",
    priority: "medium",
    detect: (p) => (p.html!.hasViewport ? null : ev()),
  }),
];
