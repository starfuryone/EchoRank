import type { RuleCopy } from "../types";

export const COPY: Record<string, RuleCopy> = {
  "page_titles.missing": {
    name: "Missing page title",
    description: "The page has no <title>, or only an empty one. The title is the headline of a search result and the text of a browser tab; without it, search engines write their own.",
    howToFix: "Add a unique, descriptive <title> inside <head> that names what the page offers.",
  },
  "page_titles.duplicate": {
    name: "Duplicate page title",
    description: "Another crawled page has exactly the same title. Identical titles make pages hard to tell apart in search results and suggest duplicate or templated content.",
    howToFix: "Give each page a title that describes its own content. If the pages really are duplicates, consolidate them or set a canonical.",
  },
  "page_titles.over_60_chars": {
    name: "Title over 60 characters",
    description: "The title is longer than 60 characters, about where search results start to cut titles off.",
    howToFix: "Put the most important words first and trim the rest so the meaning survives truncation.",
  },
  "page_titles.over_70_chars": {
    name: "Title over 70 characters",
    description: "The title is longer than 70 characters and will almost certainly be truncated in search results, losing whatever comes after the cut.",
    howToFix: "Shorten the title to under 60 characters. Drop filler, repeated keywords and long brand suffixes first.",
  },
  "page_titles.under_30_chars": {
    name: "Title under 30 characters",
    description: "The title is shorter than 30 characters. Short titles often miss the words people search for and leave space in the result unused.",
    howToFix: "Expand the title with the page's main topic and a distinguishing detail, staying under 60 characters.",
  },
  "page_titles.over_561_px": {
    name: "Title over 561 pixels",
    description: "The title's estimated width in a desktop search result is over 561 pixels, the point at which titles are usually truncated. Wide characters (W, M, capitals) hit the limit before the character count does.",
    howToFix: "Shorten the title or use fewer capitals and wide characters until it fits.",
  },
  "page_titles.under_200_px": {
    name: "Title under 200 pixels",
    description: "The title's estimated width in a desktop search result is under 200 pixels: a very short headline that uses little of the space available.",
    howToFix: "Add descriptive words that match what people search for.",
  },
  "page_titles.same_as_h1": {
    name: "Title same as H1",
    description: "The title is identical to the page's first H1. That is not wrong, but it misses a chance to use a second phrasing of the topic.",
    howToFix: "Consider writing the title for the search result and the H1 for the reader already on the page, with different wording.",
  },
  "page_titles.multiple": {
    name: "Multiple title elements",
    description: "The page has more than one <title>. Search engines use one of them, not necessarily the one you intended.",
    howToFix: "Keep a single <title> in <head>. Look for a template or plugin adding a second one.",
  },
  "page_titles.outside_head": {
    name: "Title outside <head>",
    description: "A <title> element sits in the <body>. Search engines expect it in <head> and may ignore it where it is.",
    howToFix: "Move the <title> into <head>. If a script or widget writes it into the body, fix that output.",
  },
};
