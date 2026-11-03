import type { RuleCopy } from "../types";

export const COPY: Record<string, RuleCopy> = {
  "javascript.content_only_rendered": {
    name: "Content only in the rendered page",
    description: "A substantial share of the page's text appears only after JavaScript runs. Google renders pages in a second pass that can lag the first by days; AI crawlers such as GPTBot and ClaudeBot do not run JavaScript at all and never see it.",
    howToFix: "Render the main content on the server (SSR or static generation) so it is in the HTML response. Keep JavaScript for interaction, not for the copy itself.",
  },
  "javascript.links_only_rendered": {
    name: "Links only in the rendered page",
    description: "Internal links that exist only after JavaScript runs. Crawlers that do not render cannot discover the pages behind them, and Google finds them only after rendering.",
    howToFix: "Output navigation and in-content links as plain <a href> elements in the server HTML. Links injected by script, or built from onclick handlers, are the usual cause.",
  },
  "javascript.title_changed": {
    name: "Title changed by JavaScript",
    description: "The <title> in the rendered page is different from the one in the HTML response, or exists only after rendering. Bots that do not render, and Google before it renders, index the original.",
    howToFix: "Send the final title in the HTML response. In single-page apps, set it during server rendering rather than on the client.",
  },
  "javascript.meta_description_changed": {
    name: "Meta description changed by JavaScript",
    description: "The meta description in the rendered page is different from the one in the HTML response, or exists only after rendering.",
    howToFix: "Send the final meta description in the HTML response rather than setting it from a script.",
  },
  "javascript.h1_changed": {
    name: "H1 changed by JavaScript",
    description: "The first <h1> in the rendered page is different from the one in the HTML response, or exists only after rendering.",
    howToFix: "Render the page's main heading on the server so every crawler reads the same one.",
  },
  "javascript.canonical_changed": {
    name: "Canonical changed by JavaScript",
    description: "The rel=canonical in the rendered page points somewhere other than the one in the HTML response, or is added by script. Google says to keep the canonical in the HTML and not to change it with JavaScript; conflicting signals may see both ignored.",
    howToFix: "Put the correct canonical in the server HTML and remove the script that rewrites or injects it.",
  },
  "javascript.noindex_only_original": {
    name: "noindex in the original HTML only",
    description: "The HTML response carries noindex and JavaScript removes it. Google does not render pages it is told not to index, so the page stays out of the index whatever the script does.",
    howToFix: "If the page should be indexed, remove noindex from the server HTML. Never rely on JavaScript to lift a noindex.",
  },
  "javascript.noindex_only_rendered": {
    name: "noindex added by JavaScript",
    description: "The HTML response is indexable but the rendered page carries noindex. Crawlers that do not render will index it; Google drops it after rendering. Either way the signal is mixed.",
    howToFix: "Decide whether the page should be indexed and say so in the server HTML. Remove the script that adds the robots meta tag.",
  },
  "javascript.js_redirect": {
    name: "JavaScript redirect",
    description: "The page navigates to another URL from a script after it loads. Crawlers that do not render never follow it, and Google treats it as a weaker signal than an HTTP redirect.",
    howToFix: "Replace the script redirect with a server-side 301 (permanent) or 302 (temporary).",
  },
  "javascript.ajax_crawling_scheme": {
    name: "Old AJAX crawling scheme (#!)",
    description: "The page's URL or its links use hashbang (#!) URLs from Google's AJAX crawling scheme, which Google deprecated in 2015 and no longer supports. Everything after the # is ignored by crawlers.",
    howToFix: "Move to real URLs with the History API (pushState) and render their content on the server; redirect the old #! URLs.",
  },
  "javascript.rendered_word_count_zero": {
    name: "Rendered page has no text",
    description: "After JavaScript ran, the page had no visible text at all: the app failed to render, rendered only after a user action, or needs a browser feature the renderer does not have.",
    howToFix: "Open the page with JavaScript errors visible (DevTools console) and fix what stops the content rendering. Check the console errors finding for the same URL.",
  },
  "javascript.console_errors": {
    name: "JavaScript console errors",
    description: "The page logged errors to the console, or threw uncaught exceptions, while it rendered. Errors can stop content or links from rendering for search engines as well as visitors.",
    howToFix: "Open the page in a browser with DevTools, read the console, and fix the errors from the first one down. Failed resource loads appear here too.",
  },
  "javascript.enable_rendering": {
    name: "Page looks client-rendered: crawl with rendering",
    description: "The HTML response has no internal links and almost no text, which is what a page built by JavaScript looks like before it runs. This crawl did not render pages, so what the page shows after JavaScript was not checked.",
    howToFix: "Run the crawl again with rendering on (Thin pages is enough) to see the rendered content, links and the JavaScript findings.",
  },
};
