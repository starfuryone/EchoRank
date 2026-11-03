import type { RuleCopy } from "../types";

export const COPY: Record<string, RuleCopy> = {
  "validation.missing_doctype": {
    name: "Missing doctype",
    description: "The document does not start with <!DOCTYPE html>, so browsers render it in quirks mode, with legacy layout rules that differ between browsers.",
    howToFix: "Make <!DOCTYPE html> the very first line of every page.",
  },
  "validation.invalid_head_element": {
    name: "Body element inside <head>",
    description: "The <head> contains an element that belongs in the body (a <div>, <img>, <a>…). Parsers end the <head> at that point, so every meta, canonical and hreflang tag after it is treated as body content and may be ignored.",
    howToFix: "Move the element into <body>. Third-party snippets that inject markup into <head> are the usual cause.",
  },
  "validation.body_before_head": {
    name: "<body> before <head>",
    description: "A <body> tag appears in the source before the <head>. Everything in the head is then parsed as body content.",
    howToFix: "Fix the template so the document is <html>, then <head>, then <body>.",
  },
  "validation.multiple_html_or_body": {
    name: "Multiple <html>, <head> or <body> tags",
    description: "The source contains more than one <html>, <head> or <body> start tag, usually from templates or includes nested inside each other.",
    howToFix: "Make sure only the outer layout emits the document skeleton; partials should output fragments.",
  },
  "validation.head_not_first": {
    name: "<head> is not the first element",
    description: "Something comes between <html> and <head>. Parsers then create an implied head, and the real one is mis-parsed.",
    howToFix: "Put <head> immediately after the opening <html> tag.",
  },
  "validation.missing_viewport": {
    name: "Missing viewport meta tag",
    description: "The page has no <meta name=\"viewport\">, so phones render it at desktop width, zoomed out. Search engines index the mobile version first.",
    howToFix: "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> to <head>.",
  },
};
