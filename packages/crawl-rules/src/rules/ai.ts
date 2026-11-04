// ai — what the crawl's AI prompts said about a page (Phase 4e, opt-in, on
// the top N pages). Capability "ai" is per PAGE: only pages the prompts ran
// on are judged, and each rule only when its preset ran.

import { ev, siteRule } from "../engine";
import type { Rule } from "../types";

const F = "ai" as const;
const AI = ["ai"] as const;
const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[\s\u00a0]+/g, " ").replace(/^["'«»“”]+|["'«»“”.]+$/g, "").trim();

export const RULES: Rule[] = [
  siteRule({
    id: "ai.suggested_title_differs",
    family: F,
    kind: "opportunity",
    priority: "low",
    requires: [...AI],
    detect: (p, ctx) => {
      const s = ctx.metrics?.ai?.suggestedTitle;
      if (!s) return null;
      return norm(s) === norm(p.title) ? null : ev({ value: s, found: p.title ?? "" });
    },
  }),
  siteRule({
    id: "ai.grammar_issues",
    family: F,
    kind: "warning",
    priority: "medium",
    requires: [...AI],
    detect: (p, ctx) => {
      const g = ctx.metrics?.ai?.grammarIssues;
      return g && g.length > 0 ? ev({ count: g.length, value: g[0] }) : null;
    },
  }),
];
