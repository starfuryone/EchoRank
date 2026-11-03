import type { RuleCopy } from "../types";

export const COPY: Record<string, RuleCopy> = {
  "mobile.content_wider_than_viewport": {
    name: "Content wider than the screen",
    description: "On a phone-width screen the page is wider than the viewport, so visitors scroll sideways. Google indexes the mobile version of pages, and this is one of the problems its mobile-friendliness guidance names.",
    howToFix: "Find the element that overflows (fixed widths, wide images or tables, long unbroken strings) and make it fit: max-width: 100%, flexible layouts, overflow-x: auto on tables.",
  },
  "mobile.font_too_small": {
    name: "Font size too small for mobile",
    description: "The body text's computed size is under 12 px on a phone-width screen, which most visitors cannot read without zooming.",
    howToFix: "Set the base font size to at least 16 px and size other text relative to it (rem). Check that the viewport meta tag is present, or the page is shown zoomed out.",
  },
  "mobile.tap_targets_too_close": {
    name: "Tap targets too close together",
    description: "Links or buttons smaller than 24 × 24 px sit within 24 px of another target, so a finger easily hits the wrong one (WCAG 2.2 success criterion 2.5.8, target size).",
    howToFix: "Make small targets at least 24 × 24 px (48 px is the comfortable size), or add spacing between them.",
  },
};
