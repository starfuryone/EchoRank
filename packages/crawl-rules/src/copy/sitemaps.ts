import type { RuleCopy } from "../types";

export const COPY: Record<string, RuleCopy> = {
  "sitemaps.url_not_crawled": {
    name: "Sitemap URLs not crawled",
    description: "The sitemap lists URLs this crawl never reached, because the URL limit or time limit stopped it, or because robots.txt or scope rules kept them out.",
    howToFix: "Raise the crawl limit or check those URLs. A sitemap should list only live, indexable pages on the site.",
  },
  "sitemaps.page_not_in_sitemap": {
    name: "Indexable page missing from the sitemap",
    description: "This page answers 200, is indexable and self-canonical, but the sitemap does not list it. Search engines may find it later, or not at all.",
    howToFix: "Add the page to the sitemap, or check your sitemap generator includes this section of the site.",
  },
  "sitemaps.non_indexable_listed": {
    name: "Non-indexable URL in the sitemap",
    description: "The sitemap lists a URL that is noindex or canonicalised to another page. A sitemap should list only the URLs you want indexed.",
    howToFix: "Remove the URL from the sitemap, or make the page indexable and self-canonical.",
  },
  "sitemaps.redirect_listed": {
    name: "Redirect in the sitemap",
    description: "The sitemap lists a URL that redirects. Search engines are asked to crawl an address that is not the real page.",
    howToFix: "List the final destination URL instead of the redirecting one.",
  },
  "sitemaps.error_listed": {
    name: "Error page in the sitemap",
    description: "The sitemap lists a URL that answers 4xx or 5xx. Too many errors make search engines trust the sitemap less.",
    howToFix: "Remove dead URLs from the sitemap, or restore the pages.",
  },
  "sitemaps.missing": {
    name: "No XML sitemap found",
    description: "The crawl found no XML sitemap, neither declared in robots.txt nor at /sitemap.xml. Search engines then rely on links alone to discover pages.",
    howToFix: "Publish an XML sitemap of your indexable pages and declare it in robots.txt with a Sitemap: line.",
  },
  "sitemaps.too_large": {
    name: "Sitemap over 50,000 URLs",
    description: "A sitemap file lists more than 50,000 URLs, the protocol's limit per file. Search engines may reject it.",
    howToFix: "Split it into several files of at most 50,000 URLs (and 50 MB uncompressed) and list them in a sitemap index.",
  },
  "sitemaps.not_in_robots": {
    name: "Sitemap not declared in robots.txt",
    description: "A sitemap exists, but robots.txt has no Sitemap: line pointing to it. Declaring it helps every search engine find it, not only those you submit it to.",
    howToFix: "Add Sitemap: https://your-site/sitemap.xml to robots.txt.",
  },
};
