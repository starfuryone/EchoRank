// extraction — the tenant's own extractors and searches (Phase 4b).
//
// extraction.empty: an extractor came back empty on a page where at least
// one other extractor found something — the template the extractors were
// written for is there, but this field is not (a product without a price,
// an article without an author). A page where every extractor is empty is
// most likely a different kind of page, and is not reported.
//
// search.match: a custom search matched. What a match means is the tenant's
// call (a staging host left in a link, an old tracking tag), so it is a
// warning to review, not an issue.

import { ev, pageRule } from "../engine";
import type { Rule } from "../types";

const F = "extraction" as const;

export const RULES: Rule[] = [
  pageRule({
    id: "extraction.empty",
    family: F,
    kind: "opportunity",
    priority: "low",
    applies: "html",
    detect: (p) => {
      const c = p.custom;
      return c && c.extractorsFound > 0 && c.extractorsEmpty.length > 0
        ? ev({ empty: c.extractorsEmpty.join(", "), count: c.extractorsEmpty.length })
        : null;
    },
  }),
  pageRule({
    id: "search.match",
    family: F,
    kind: "warning",
    priority: "medium",
    applies: "html",
    detect: (p) => {
      const m = p.custom?.searchMatches ?? [];
      return m.length
        ? ev({ searches: m.map((s) => `${s.name} (${s.count})`).join(", "), matches: m.reduce((n, s) => n + s.count, 0) })
        : null;
    },
  }),
];
