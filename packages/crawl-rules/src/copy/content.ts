import type { RuleCopy } from "../types";

export const COPY: Record<string, RuleCopy> = {
  "content.low_word_count": {
    name: "Low word count",
    description: "The page has fewer than 200 words of visible text. Thin pages rarely answer a query well enough to rank, unless their job is something else (a contact form, a gallery).",
    howToFix: "Expand pages meant to rank with useful, specific content. Leave utility pages alone, or keep them out of the index.",
  },
  "content.exact_duplicate": {
    name: "Exact duplicate content",
    description: "Another crawled page has exactly the same visible text. Search engines pick one version to show and may pick the wrong one.",
    howToFix: "Consolidate the pages with a 301 redirect, or point the copies at the main version with rel=canonical.",
  },
  "content.near_duplicate": {
    name: "Near-duplicate content",
    description: "Another crawled page's text is almost identical to this one (a similarity fingerprint within 3 bits). Typical causes: location or product variants with only a word or two changed.",
    howToFix: "Give each page enough unique content to stand alone, or canonicalise the variants to one main page.",
  },
  "content.readability_difficult": {
    name: "Difficult to read",
    description: "The English text scores below 50 on the Flesch reading-ease scale: long sentences and long words. That is college level, harder than most visitors want to read.",
    howToFix: "Shorten sentences, prefer common words, and break long paragraphs up with headings and lists.",
  },
  "content.placeholder_text": {
    name: "Placeholder text",
    description: "The page contains placeholder text such as \"lorem ipsum\", \"coming soon\" or \"under construction\". It reads as unfinished to visitors and search engines.",
    howToFix: "Replace the placeholder with real content, or keep the page out of the index until it is ready.",
  },
  "content.soft_404": {
    name: "Possible soft 404",
    description: "The page answers 200 OK but looks like an error page: a \"not found\" title, or almost no content. Search engines treat it as a 404 and may also distrust the site's real 200s.",
    howToFix: "Return a real 404 or 410 status for missing pages, or add real content if the page should exist.",
  },
  "content.low_text_ratio": {
    name: "Low text-to-HTML ratio",
    description: "Visible text is under 10% of the HTML. The page is mostly markup, scripts and inline styles, which slows it down without adding anything to read.",
    howToFix: "Move inline scripts and styles into cached files, trim unused markup, and check the page has real content.",
  },
  "content.missing_lang": {
    name: "Missing lang attribute",
    description: "The <html> element has no lang attribute. Screen readers then guess the pronunciation, and browsers cannot offer the right translation.",
    howToFix: "Set the page language on the root element, e.g. <html lang=\"en\"> or <html lang=\"fr-CA\">.",
  },
  "content.charset_missing": {
    name: "Character encoding not declared",
    description: "Neither the Content-Type header nor the HTML declares a character encoding. Browsers then guess, and accented characters can come out garbled.",
    howToFix: "Send charset=utf-8 in the Content-Type header, and add <meta charset=\"utf-8\"> as the first element in <head>.",
  },
  "content.charset_not_utf8": {
    name: "Character encoding is not UTF-8",
    description: "The page declares an encoding other than UTF-8 (e.g. ISO-8859-1 or Windows-1252). UTF-8 is the web standard; other encodings break on characters they cannot represent.",
    howToFix: "Save templates and content as UTF-8 and declare charset=utf-8 in the header and <meta charset>.",
  },
};
