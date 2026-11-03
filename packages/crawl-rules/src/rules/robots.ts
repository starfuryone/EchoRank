// robots — what a draft robots.txt would change (Phase 4a, test mode).
//
// On a site the tenant has not verified, a custom robots.txt does not replace
// the live one: the crawl obeys the live file and judges every URL against
// the draft too. These two rules report the difference, so the draft can be
// checked before it is published. Informational: nothing is wrong yet.

import { ev, pageRule } from "../engine";
import type { Rule } from "../types";

const F = "robots" as const;

export const RULES: Rule[] = [
  pageRule({
    id: "robots.would_block",
    family: F,
    kind: "opportunity",
    priority: "low",
    applies: "any",
    detect: (p) => {
      const t = p.robotsTest;
      return t && t.liveAllowed && !t.customAllowed ? ev({ customLine: t.customLine }) : null;
    },
  }),
  pageRule({
    id: "robots.would_allow",
    family: F,
    kind: "opportunity",
    priority: "low",
    applies: "any",
    detect: (p) => {
      const t = p.robotsTest;
      return t && !t.liveAllowed && t.customAllowed ? ev({ liveLine: t.liveLine, customLine: t.customLine }) : null;
    },
  }),
];
