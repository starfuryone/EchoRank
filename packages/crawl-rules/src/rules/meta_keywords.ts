// meta_keywords — the tag no major search engine has read in years. Its only
// remaining effect is telling competitors which keywords you target.

import { ev, pageRule } from "../engine";
import type { Rule } from "../types";

export const RULES: Rule[] = [
  pageRule({
    id: "meta_keywords.present",
    family: "meta_keywords",
    kind: "opportunity",
    priority: "low",
    detect: (p) => (p.html!.metaKeywords !== null ? ev({ keywords: p.html!.metaKeywords }) : null),
  }),
];
