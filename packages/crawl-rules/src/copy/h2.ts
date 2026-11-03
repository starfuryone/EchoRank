import type { RuleCopy } from "../types";

export const COPY: Record<string, RuleCopy> = {
  "h2.missing": {
    name: "Missing H2",
    description: "The page has no <h2>. Section headings break content into scannable parts and give search engines and screen readers an outline.",
    howToFix: "Add H2s for the main sections of the content. Short pages with one idea may not need any.",
  },
  "h2.duplicate": {
    name: "Duplicate H2",
    description: "This page's first H2 is the same as on other crawled pages, usually a template heading (\"Related products\", \"Contact us\") in the first slot.",
    howToFix: "Make the first section heading specific to the page, or move shared template headings below the page's own sections.",
  },
  "h2.over_70_chars": {
    name: "H2 over 70 characters",
    description: "An H2 is longer than 70 characters, which reads like a sentence rather than a heading.",
    howToFix: "Shorten the heading and move the detail into the section's first paragraph.",
  },
  "h2.repeated_on_page": {
    name: "Identical H2s on one page",
    description: "The same H2 text appears more than once on the page, so the outline has two sections with the same name.",
    howToFix: "Rename the sections so each heading says what is different about it.",
  },
  "h2.non_sequential": {
    name: "Heading levels out of order",
    description: "An <h3> appears before the first <h2>. Skipping a level breaks the document outline that screen-reader users navigate by.",
    howToFix: "Use headings in order (H1, then H2, then H3), and style them with CSS rather than picking a level for its size.",
  },
  "h2.empty": {
    name: "Empty H2",
    description: "An <h2> has no text, usually a leftover from a template or an icon-only heading.",
    howToFix: "Give the heading text or remove the empty element.",
  },
};
