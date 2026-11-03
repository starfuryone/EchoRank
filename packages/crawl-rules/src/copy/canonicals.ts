import type { RuleCopy } from "../types";

export const COPY: Record<string, RuleCopy> = {
  "canonicals.missing": {
    name: "Missing canonical",
    description: "The page declares no canonical URL, in the HTML or a Link header. Without one, parameter and tracking variants of the page compete with it.",
    howToFix: "Add <link rel=\"canonical\" href=\"…\"> in <head>, usually pointing at the page's own clean URL.",
  },
  "canonicals.canonicalised": {
    name: "Canonicalised to another URL",
    description: "The page's canonical points at a different URL, so it asks search engines to index that URL instead of this one. That is right for duplicates and variants, and a mistake anywhere else.",
    howToFix: "Check the target is the intended main version. If this page should rank on its own, make the canonical self-referencing.",
  },
  "canonicals.multiple": {
    name: "Multiple canonicals",
    description: "The page declares more than one rel=canonical. Search engines may ignore all of them when they disagree.",
    howToFix: "Keep one canonical. Look for a theme and a plugin (or a CMS and a CDN) each adding one.",
  },
  "canonicals.to_redirect": {
    name: "Canonical points at a redirect",
    description: "The canonical target redirects elsewhere. It sends mixed signals, and search engines may disregard it.",
    howToFix: "Point the canonical straight at the final URL the redirect leads to.",
  },
  "canonicals.to_error": {
    name: "Canonical points at an error page",
    description: "The canonical target answers 4xx or 5xx. You are asking search engines to index a page that does not work.",
    howToFix: "Point the canonical at a live page, usually this page's own URL.",
  },
  "canonicals.to_noindex": {
    name: "Canonical points at a noindex page",
    description: "The canonical target carries noindex. One says \"index that page\", the other says \"do not index it\", so neither may end up indexed.",
    howToFix: "Canonicalise to an indexable page, or remove noindex from the target if it should be indexed.",
  },
  "canonicals.relative": {
    name: "Relative canonical URL",
    description: "The canonical is a relative URL (e.g. /page). It is allowed, but a base-tag or protocol mistake turns it into the wrong address.",
    howToFix: "Use the full absolute URL, including https:// and the host.",
  },
  "canonicals.header_html_mismatch": {
    name: "Canonical header and HTML disagree",
    description: "The Link response header and the HTML declare different canonical URLs. Search engines may ignore both.",
    howToFix: "Declare the canonical in one place, or make both point at the same URL.",
  },
  "canonicals.outside_head": {
    name: "Canonical outside <head>",
    description: "A rel=canonical link sits in the <body>. Google ignores canonicals outside <head>.",
    howToFix: "Move the canonical into <head>, or fix the script that injects it into the body.",
  },
  "canonicals.to_http_from_https": {
    name: "HTTPS page canonicalised to HTTP",
    description: "This HTTPS page's canonical points at an http:// URL, asking search engines to prefer the insecure version.",
    howToFix: "Change the canonical to the https:// URL.",
  },
};
