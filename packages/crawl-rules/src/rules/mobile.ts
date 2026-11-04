// mobile — measured in the rendered page at a phone's device width (Phase 3b).
//
// "Viewport missing" is NOT here: validation.missing_viewport already reports
// it from the raw HTML, rendered or not, and one finding per fact is the rule.

import { ev, pageRule, siteRule } from "../engine";
import type { Rule } from "../types";

const F = "mobile" as const;
const RENDER = ["render" as const];

/** Overflow under this many px is a rounding artefact, not a layout bug. */
export const OVERFLOW_TOLERANCE_PX = 2;
/** The legibility floor for body text on a phone. */
export const MIN_BODY_FONT_PX = 12;

/**
 * Phase 4d: the Lighthouse audits mobile.lighthouse_usability_low reads from
 * the MOBILE run. Lighthouse 12 removed font-size and tap-targets, so current
 * PSI reports only viewport; the other two still count on runs that carry them.
 */
export const MOBILE_USABILITY_AUDITS = ["viewport", "font-size", "tap-targets"] as const;
const LIGHTHOUSE_PASS = 0.9;

export const RULES: Rule[] = [
  pageRule({
    id: "mobile.content_wider_than_viewport",
    family: F,
    kind: "issue",
    priority: "medium",
    requires: RENDER,
    detect: (p) => {
      const v = p.render?.viewport;
      if (!v || v.scrollWidth <= v.width + OVERFLOW_TOLERANCE_PX) return null;
      return ev({ viewport: v.width, contentWidth: v.scrollWidth });
    },
  }),
  pageRule({
    id: "mobile.font_too_small",
    family: F,
    kind: "warning",
    priority: "medium",
    requires: RENDER,
    detect: (p) => {
      const px = p.render?.bodyFontPx;
      return px != null && px < MIN_BODY_FONT_PX ? ev({ bodyFontPx: px }) : null;
    },
  }),
  pageRule({
    id: "mobile.tap_targets_too_close",
    family: F,
    kind: "warning",
    priority: "low",
    requires: RENDER,
    detect: (p) => {
      const t = p.render?.tapTargets;
      return t && t.tooClose > 0 ? ev({ tooClose: t.tooClose, checked: t.checked, sample: t.sample }) : null;
    },
  }),
  siteRule({
    id: "mobile.lighthouse_usability_low",
    family: F,
    kind: "warning",
    priority: "medium",
    requires: ["psi"],
    detect: (_p, ctx) => {
      const psi = ctx.psi;
      if (!psi || psi.strategy !== "mobile") return null;
      const failing = MOBILE_USABILITY_AUDITS.filter((id) => {
        const a = psi.audits[id];
        return a && a.score !== null && a.score < LIGHTHOUSE_PASS;
      });
      return failing.length ? ev({ audits: failing.join(", "), strategy: "mobile", lighthouse: psi.lighthouseVersion }) : null;
    },
  }),
];
