// accessibility — one rule per axe-core rule (Phase 3b), run by the sidecar in
// the rendered page. The list, names and descriptions are generated from axe's
// own metadata (generated/axe-rules.ts); only the mapping lives here.
//
// Kind from axe's impact: critical/serious → issue, moderate → warning,
// minor → opportunity. Priority follows the same scale.

import { ev, pageRule } from "../engine";
import type { Rule, RuleKind, RulePriority } from "../types";
import { AXE_RULES, type AxeRuleMeta } from "../generated/axe-rules";

const F = "accessibility" as const;

export const KIND_OF_IMPACT: Record<AxeRuleMeta["impact"], RuleKind> = {
  critical: "issue",
  serious: "issue",
  moderate: "warning",
  minor: "opportunity",
};

const PRIORITY_OF_IMPACT: Record<AxeRuleMeta["impact"], RulePriority> = {
  critical: "high",
  serious: "high",
  moderate: "medium",
  minor: "low",
};

/** "color-contrast" → "accessibility.color_contrast". Ids are lower snake case. */
export function a11yRuleId(axeId: string): string {
  return `${F}.${axeId.replace(/-/g, "_")}`;
}

export const RULES: Rule[] = AXE_RULES.map((m) =>
  pageRule({
    id: a11yRuleId(m.axeId),
    family: F,
    kind: KIND_OF_IMPACT[m.impact],
    priority: PRIORITY_OF_IMPACT[m.impact],
    requires: ["render"],
    detect: (p) => {
      const v = p.render?.axe?.[m.axeId];
      return v && v.nodes > 0 ? ev({ elements: v.nodes, impact: v.impact }) : null;
    },
  }),
);
