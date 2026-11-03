import type { RuleCopy } from "../types";

export const COPY: Record<string, RuleCopy> = {
  "meta_description.missing": {
    name: "Missing meta description",
    description: "The page has no meta description, or an empty one. Search engines then build the snippet from page text, which is often a menu or cookie notice.",
    howToFix: "Add a <meta name=\"description\"> in <head>: one or two sentences, 70–155 characters, saying what the page offers and why to click.",
  },
  "meta_description.duplicate": {
    name: "Duplicate meta description",
    description: "Another crawled page has exactly the same meta description. Repeated snippets make results from your site look interchangeable.",
    howToFix: "Write a description for each page from its own content. For large templated sections, generate it from page-specific fields.",
  },
  "meta_description.over_155_chars": {
    name: "Meta description over 155 characters",
    description: "The description is longer than 155 characters, so search results will usually cut it off mid-sentence.",
    howToFix: "Lead with the key message and trim to under 155 characters.",
  },
  "meta_description.under_70_chars": {
    name: "Meta description under 70 characters",
    description: "The description is shorter than 70 characters. A very short snippet wastes space that could sell the click.",
    howToFix: "Expand it with what the page offers and a reason to choose it, staying under 155 characters.",
  },
  "meta_description.over_985_px": {
    name: "Meta description over 985 pixels",
    description: "The description's estimated width in a desktop search result is over 985 pixels, about where snippets are truncated.",
    howToFix: "Shorten the description until it fits; wide characters and capitals use space fastest.",
  },
  "meta_description.multiple": {
    name: "Multiple meta descriptions",
    description: "The page has more than one meta description tag. Search engines pick one, not necessarily the right one.",
    howToFix: "Keep one description tag. Check for a theme and an SEO plugin both writing one.",
  },
  "meta_description.outside_head": {
    name: "Meta description outside <head>",
    description: "A meta description tag sits in the <body>, where search engines may ignore it.",
    howToFix: "Move the tag into <head>, or fix the template or script that writes it into the body.",
  },
};
