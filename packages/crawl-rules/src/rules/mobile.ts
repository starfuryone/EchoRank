// mobile — measured in the rendered page at a phone's device width (Phase 3b).
//
// "Viewport missing" is NOT here: validation.missing_viewport already reports
// it from the raw HTML, rendered or not, and one finding per fact is the rule.

import { ev, pageRule } from "../engine";
import type { Rule } from "../types";

const F = "mobile" as const;
const RENDER = ["render" as const];

/** Overflow under this many px is a rounding artefact, not a layout bug. */
export const OVERFLOW_TOLERANCE_PX = 2;
/** The legibility floor for body text on a phone. */
export const MIN_BODY_FONT_PX = 12;

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
];
