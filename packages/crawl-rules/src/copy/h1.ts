import type { RuleCopy } from "../types";

export const COPY: Record<string, RuleCopy> = {
  "h1.missing": {
    name: "Missing H1",
    description: "The page has no <h1>. The main heading tells readers and search engines what the page is about, and screen-reader users jump to it first.",
    howToFix: "Add one <h1> near the top of the main content that names the page's topic.",
  },
  "h1.duplicate": {
    name: "Duplicate H1",
    description: "Another crawled page uses exactly the same H1. Identical main headings make pages look interchangeable.",
    howToFix: "Make each H1 describe its own page; if the pages are duplicates, consolidate them.",
  },
  "h1.over_70_chars": {
    name: "H1 over 70 characters",
    description: "An H1 is longer than 70 characters. Long main headings are hard to scan and often carry a paragraph's worth of keywords.",
    howToFix: "Shorten the heading to the essential topic and move detail into the opening paragraph.",
  },
  "h1.multiple": {
    name: "Multiple H1s",
    description: "The page has more than one <h1>. It is valid HTML, but a single main heading gives the clearest outline.",
    howToFix: "Keep one H1 for the main topic and turn the others into H2s. Check for a logo or widget wrapped in an H1.",
  },
  "h1.matches_other_title": {
    name: "H1 matches another page's title",
    description: "This page's H1 is the exact title of a different page on the site. The two pages may be competing for the same query.",
    howToFix: "Differentiate the heading, or merge the pages if they cover the same thing.",
  },
  "h1.empty": {
    name: "Empty H1",
    description: "An <h1> has no text, often an image without alt text or a heading left behind by a template.",
    howToFix: "Give the heading text, or give the image inside it alt text that names the page.",
  },
};
