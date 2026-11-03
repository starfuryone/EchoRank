import type { RuleCopy } from "../types";

export const COPY: Record<string, RuleCopy> = {
  "pagination.target_not_200": {
    name: "Pagination link to a non-200 page",
    description: "A rel=\"next\" or rel=\"prev\" link points at a page that redirects or errors, so the series is broken at that step.",
    howToFix: "Point pagination links at live pages, and update them when a series gets shorter.",
  },
  "pagination.sequence_error": {
    name: "Pagination sequence error",
    description: "The pages' rel=\"next\" and rel=\"prev\" links do not agree: page 2 says next is page 3, but page 3 does not say prev is page 2.",
    howToFix: "Make every next/prev pair reciprocal, usually by generating both from the same page number in the template.",
  },
  "pagination.url_not_linked": {
    name: "Pagination URL not linked in the page",
    description: "The page declares a rel=\"next\" or rel=\"prev\" URL that no visible link on the page points to. Crawlers that ignore the tags cannot reach the next page.",
    howToFix: "Add ordinary <a href> links to the previous and next pages, e.g. in a pager.",
  },
  "pagination.multiple": {
    name: "Multiple next or prev links",
    description: "The page declares more than one rel=\"next\" or rel=\"prev\" link, so the series has no single order.",
    howToFix: "Keep one next and one prev per page.",
  },
  "pagination.outside_head": {
    name: "Pagination links outside <head>",
    description: "rel=\"next\"/\"prev\" <link> elements sit in the <body>, where they are not read.",
    howToFix: "Move the <link> elements into <head>.",
  },
  "pagination.canonicalised_to_first": {
    name: "Paginated page canonicalised to the first page",
    description: "A later page in a series (it has a rel=\"prev\") names another URL, typically page 1, as its canonical. Search engines may then never index the items listed on pages 2 and beyond.",
    howToFix: "Give each page in the series a self-referencing canonical, or offer a view-all page and canonicalise to that.",
  },
};
