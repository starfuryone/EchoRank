import type { RuleCopy } from "../types";

export const COPY: Record<string, RuleCopy> = {
  "url.non_ascii": {
    name: "Non-ASCII characters in URL",
    description: "The URL path contains characters outside ASCII (accented letters, symbols, other scripts). Browsers show them fine, but they are percent-encoded when copied, shared or logged, which makes the URL long and unreadable.",
    howToFix: "Use plain ASCII slugs (e.g. \"cafe\" rather than \"café\") for new URLs. Change existing ones only with a 301 redirect from the old address.",
  },
  "url.underscores": {
    name: "Underscores in URL",
    description: "The URL path uses underscores. Search engines treat hyphens as word separators but may read underscores as joining words, so \"red_shoes\" can be read as one word.",
    howToFix: "Use hyphens in new URLs. Renaming existing URLs is rarely worth it on its own; if you do, 301-redirect the old ones.",
  },
  "url.uppercase": {
    name: "Uppercase characters in URL",
    description: "The URL path contains uppercase letters. Paths are case-sensitive on most servers, so /Page and /page can be two URLs with the same content.",
    howToFix: "Use lowercase paths, and 301-redirect uppercase variants to the lowercase URL.",
  },
  "url.parameters": {
    name: "URL has query parameters",
    description: "The URL carries query parameters. Parameters for sorting, filtering or tracking can multiply one page into many crawlable URLs.",
    howToFix: "Keep parameters out of internal links where a clean path works, and set a canonical to the parameter-free version on filtered or sorted views.",
  },
  "url.over_115_chars": {
    name: "URL over 115 characters",
    description: "The URL is longer than 115 characters. Long URLs are truncated in search results, hard to share and often a sign of deep nesting or stacked parameters.",
    howToFix: "Shorten the slug and flatten unnecessary folder levels for new pages. Redirect existing long URLs only when you restructure.",
  },
  "url.multiple_slashes": {
    name: "Multiple slashes in URL",
    description: "The URL path contains a double slash (//). It usually comes from a template joining paths badly, and can create duplicate URLs for one page.",
    howToFix: "Fix the template or link that produces the double slash, and 301-redirect the variant to the single-slash URL.",
  },
  "url.repetitive_path": {
    name: "Repetitive path segment",
    description: "A segment repeats in the URL path (e.g. /shop/shoes/shop/shoes). This is typically a relative-link bug that lets crawlers generate endless URLs.",
    howToFix: "Make the offending links absolute or root-relative (starting with /), and return 404 or redirect for the generated paths.",
  },
  "url.contains_space": {
    name: "Space in URL",
    description: "The URL path contains an encoded space (%20 or +). Spaces break when URLs are pasted into emails or chat, and look untidy in search results.",
    howToFix: "Use hyphens instead of spaces in file and page names, and redirect the old URLs.",
  },
  "url.internal_search": {
    name: "Internal search results URL",
    description: "The URL looks like a site-search results page (a parameter such as q= or search=). Search engines advise against indexing internal search results: they are thin and endless.",
    howToFix: "Add noindex to search results pages and avoid linking to them from crawlable navigation. Blocking them in robots.txt also stops crawl waste.",
  },
  "url.trailing_slash_variant": {
    name: "Trailing-slash variant served",
    description: "This URL answers 200, but its canonical is the same path with the trailing slash added or removed. Both variants are live, so links and signals are split between two URLs.",
    howToFix: "Pick one form, 301-redirect the other to it, and link internally only to the chosen form.",
  },
};
