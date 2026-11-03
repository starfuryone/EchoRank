// Copy for the accessibility family, built from axe-core's metadata
// (generated/axe-rules.ts) rather than written by hand. axe's `help` is the
// name, its description leads the description, and the fix points at Deque's
// rule page for the version the sidecar runs.

import type { RuleCopy } from "../types";
import { AXE_RULES, AXE_VERSION } from "../generated/axe-rules";
import { a11yRuleId } from "../rules/accessibility";

/** "wcag1410" → "1.4.10". */
function criterion(tag: string): string {
  const d = tag.slice(4);
  return `${d[0]}.${d[1]}.${d.slice(2)}`;
}

function sentence(text: string): string {
  const t = text.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

export const COPY: Record<string, RuleCopy> = Object.fromEntries(
  AXE_RULES.map((m) => {
    const refs = m.wcag.length
      ? ` WCAG success criteria: ${m.wcag.map(criterion).join(", ")}.`
      : " An axe-core best practice, not a WCAG requirement.";
    return [
      a11yRuleId(m.axeId),
      {
        name: m.help.charAt(0).toUpperCase() + m.help.slice(1),
        description: `${sentence(m.description)}${refs} Checked by axe-core ${AXE_VERSION} (rule "${m.axeId}") in the rendered page.`,
        howToFix: `Open the page, find the elements axe reports for "${m.axeId}", and fix each one. Deque's guide to this rule, with examples: ${m.helpUrl}`,
      },
    ];
  }),
);
