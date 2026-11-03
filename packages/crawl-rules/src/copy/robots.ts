import type { RuleCopy } from "../types";

export const COPY: Record<string, RuleCopy> = {
  "robots.would_block": {
    name: "Draft robots.txt would block this URL",
    description: "The live robots.txt lets crawlers fetch this URL; the custom robots.txt you are testing would disallow it. Search engines would stop crawling it once the draft is published, and a page they cannot crawl can drop out of results.",
    howToFix: "If the page should stay crawlable, change or remove the Disallow line shown in the evidence before publishing the draft. If blocking it is the intent, nothing to do.",
  },
  "robots.would_allow": {
    name: "Draft robots.txt would allow this URL",
    description: "The live robots.txt keeps crawlers out of this URL; the custom robots.txt you are testing would let them in. The crawl obeyed the live file, so the page itself was not fetched.",
    howToFix: "If the URL should stay out of search, keep a matching Disallow line in the draft. If opening it up is the intent, publish the draft and crawl again to audit the page.",
  },
};
