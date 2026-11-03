import type { RuleCopy } from "../types";

export const COPY: Record<string, RuleCopy> = {
  "extraction.empty": {
    name: "Custom extractor found nothing",
    description: "One or more of your custom extractors returned no value on this page, while another extractor did. The page looks like the ones you wrote the extractors for, but this field is missing: a product without a price, an article without an author or date, a page without its social tags.",
    howToFix: "Open the page and check whether the value is really absent or only marked up differently. If it is absent, add it to the page. If it is there, widen the extractor's selector, XPath or pattern so it matches this template too.",
  },
  "search.match": {
    name: "Custom search matched",
    description: "One of your custom searches found its text or pattern in this page's source. The evidence lists each search that matched and how many times. Searches are yours to define, so a match means whatever you set them up to catch: a staging host, an old tracking tag, a placeholder left in a template.",
    howToFix: "Review the matches on this page. If the search is looking for something that should not ship, remove it from the page or its template and crawl again. If a match is expected here, narrow the search or exclude the page.",
  },
};
