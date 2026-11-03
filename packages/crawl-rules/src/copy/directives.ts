import type { RuleCopy } from "../types";

export const COPY: Record<string, RuleCopy> = {
  "directives.noindex": {
    name: "Noindex",
    description: "The page tells search engines not to index it (meta robots or X-Robots-Tag). Right for thank-you pages, internal search and staging; costly when it is on a page you want found.",
    howToFix: "If the page should appear in search, remove noindex from the meta tag and the X-Robots-Tag header. Otherwise, nothing to do.",
  },
  "directives.nofollow": {
    name: "Nofollow",
    description: "The page tells search engines not to follow any of its links, so none of them pass signals or lead to discovery.",
    howToFix: "Remove page-level nofollow unless you have a specific reason. To discount individual links, put rel=\"nofollow\" on those links instead.",
  },
  "directives.none": {
    name: "Robots \"none\"",
    description: "The page uses the \"none\" directive, shorthand for noindex and nofollow together.",
    howToFix: "Check this is intended. For a page that should rank, remove the directive.",
  },
  "directives.noarchive": {
    name: "Noarchive",
    description: "The page asks search engines not to keep a cached copy. It does not affect ranking.",
    howToFix: "Usually fine as is. Remove it if you have no reason to hide cached copies.",
  },
  "directives.nosnippet": {
    name: "Nosnippet",
    description: "The page forbids text snippets and video previews in search results, which usually lowers click-through. It also keeps the page's text out of AI overviews.",
    howToFix: "Remove nosnippet unless the content must not be quoted. Use data-nosnippet on specific passages instead.",
  },
  "directives.max_snippet": {
    name: "Max-snippet limit",
    description: "The page limits how many characters search engines may show in a snippet. A low limit shortens or removes the description shown in results.",
    howToFix: "Check the limit is deliberate; max-snippet:-1 means no limit.",
  },
  "directives.noimageindex": {
    name: "Noimageindex",
    description: "The page asks search engines not to index its images, so they will not appear in image search from this page.",
    howToFix: "Remove it if image search traffic is useful to you.",
  },
  "directives.notranslate": {
    name: "Notranslate",
    description: "The page asks search engines not to offer a translation of it in results.",
    howToFix: "Remove it unless translation would genuinely mislead readers.",
  },
  "directives.unavailable_after": {
    name: "Unavailable_after",
    description: "The page carries an expiry date after which search engines should drop it from results.",
    howToFix: "Check the date is right and the page really should disappear then, e.g. an event or offer page.",
  },
  "directives.noindex_canonical_conflict": {
    name: "Noindex with a canonical to another page",
    description: "The page says noindex and also names another URL as its canonical. Google warns the two signals conflict, and the canonical may be ignored.",
    howToFix: "Use one: a canonical for a duplicate that should pass its signals, or noindex for a page that should simply stay out of search.",
  },
  "directives.noindex_in_sitemap": {
    name: "Noindex page in the sitemap",
    description: "The page is listed in the XML sitemap but carries noindex. The sitemap says \"index this\" and the page says \"do not\".",
    howToFix: "Remove noindex pages from the sitemap, or remove noindex if the page belongs in search.",
  },
  "directives.outside_head": {
    name: "Meta robots outside <head>",
    description: "A meta robots or googlebot tag sits in the <body>, where search engines may not honour it.",
    howToFix: "Move the tag into <head>, or fix the script that injects it into the body.",
  },
  "directives.header_meta_conflict": {
    name: "X-Robots-Tag and meta robots disagree",
    description: "The X-Robots-Tag header and the meta robots tag give different index or follow instructions. Search engines apply the most restrictive one, which may not be the one you meant.",
    howToFix: "Set the directive in one place, or make the header and the tag say the same thing.",
  },
};
