import type { RuleCopy } from "../types";

export const COPY: Record<string, RuleCopy> = {
  "ga4.crawled_zero_sessions": {
    name: "Indexable page with no GA4 sessions",
    description: "The page can be indexed and the crawl reached it, but Google Analytics recorded no session landing on it in the last 28 days. Nobody arrives on it from search, links or campaigns — or the page is missing the GA4 tag.",
    howToFix: "First check the page carries your GA4 tag. If it does, decide whether the page should attract visits: link to it, improve it for the searches it should answer, or merge it into a page that already does.",
  },
  "ga4.converting_page_has_issues": {
    name: "Converting page with high-priority issues",
    description: "GA4 recorded key events (conversions) from sessions landing on this page in the last 28 days, and the crawl found at least one high-priority issue on it. Problems on a page that earns conversions cost more than the same problems elsewhere.",
    howToFix: "Open the page's issues, filter by high priority and fix those first. The evidence shows its key events, sessions and how many high-priority issues it carries.",
  },
};
