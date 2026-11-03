// spelling — misspellings in the page's visible text (Phase 3c). Spelling
// only, no grammar. The consumer runs the dictionary (the crawler uses nspell
// with hunspell dictionaries for en, fr and de) and hands over SpellingFacts;
// the verdicts are here.

import { ev, pageRule } from "../engine";
import type { Rule } from "../types";

const F = "spelling" as const;
const SPELL = ["spell" as const];

/** Distinct misspellings above which the page gets the stronger finding. */
export const MANY_MISSPELLINGS = 5;

export const RULES: Rule[] = [
  pageRule({
    id: "spelling.misspellings",
    family: F,
    kind: "warning",
    priority: "low",
    requires: SPELL,
    detect: (p) => {
      const s = p.spelling;
      return s && s.supported && s.misspelled > 0
        ? ev({ misspelled: s.misspelled, lang: s.lang, sample: s.sample.join(", ") })
        : null;
    },
  }),
  pageRule({
    id: "spelling.over_5_misspellings",
    family: F,
    kind: "warning",
    priority: "medium",
    requires: SPELL,
    detect: (p) => {
      const s = p.spelling;
      return s && s.supported && s.misspelled > MANY_MISSPELLINGS
        ? ev({ misspelled: s.misspelled, lang: s.lang, sample: s.sample.join(", ") })
        : null;
    },
  }),
  pageRule({
    id: "spelling.unsupported_language",
    family: F,
    kind: "opportunity",
    priority: "low",
    requires: SPELL,
    detect: (p) => {
      const s = p.spelling;
      return s && !s.supported ? ev({ lang: s.lang }) : null;
    },
  }),
];
