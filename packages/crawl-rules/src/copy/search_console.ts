import type { RuleCopy } from "../types";

export const COPY: Record<string, RuleCopy> = {
  "gsc.indexed_zero_impressions": {
    name: "Indexable page with no Search Console impressions",
    description: "The page can be indexed — it returns 200, is not noindex and is its own canonical — but Search Console recorded no impressions for it in the last 28 days. Google either has not indexed it or never shows it for any search.",
    howToFix: "Inspect the URL in Search Console to see whether it is indexed. If it is not, link to it from relevant pages and add it to the sitemap. If it is indexed but never shown, the page may duplicate another or answer no query: improve its content, merge it, or noindex it.",
  },
  "gsc.traffic_low_inlinks": {
    name: "Page with search traffic and at most one internal link",
    description: "Search Console shows impressions for this page in the last 28 days, yet the crawl found at most one internal link pointing to it. Pages that already earn visibility usually gain more when the rest of the site links to them.",
    howToFix: "Add links to this page from related pages, navigation or hub pages, with descriptive anchor text. The evidence shows its impressions, clicks and current internal links.",
  },
  "gsc.traffic_noindex": {
    name: "Noindex page still getting clicks",
    description: "The page carries noindex, but Search Console recorded clicks to it in the last 28 days. Either the noindex is recent and the page is about to drop out of search, or it was added by mistake to a page people find through Google.",
    howToFix: "Check whether the noindex is intended. If not, remove it from the meta robots tag or the X-Robots-Tag header. If it is, expect the traffic to stop and make sure an indexable page serves those searches.",
  },
  "gsc.not_indexed_with_inlinks": {
    name: "Linked from the site but not indexed by Google",
    description: "Search Console's URL Inspection says Google has not indexed this page, although it is indexable and the site links to it. The evidence shows Google's verdict and coverage state (for example \"Crawled - currently not indexed\" or \"Discovered - currently not indexed\").",
    howToFix: "Improve what makes the page worth indexing (unique, substantial content), link to it from stronger pages, then request indexing in Search Console.",
  },
  "gsc.blocked_for_google": {
    name: "Blocked for Google by robots.txt",
    description: "URL Inspection reports that Google's robots.txt check disallows this page, so Googlebot will not crawl it. This is what Google sees, which can differ from the robots.txt the crawler read.",
    howToFix: "If the page should be in search, remove or narrow the Disallow rule that matches it, then re-test the URL in Search Console.",
  },
  "gsc.google_canonical_differs": {
    name: "Google chose a different canonical",
    description: "The canonical Google selected for this page is not the one the page declares (or the page itself when it declares none). Google is consolidating it into another URL; the evidence shows both.",
    howToFix: "Make the signals agree: canonical tag, internal links, sitemap and redirects should all point at the URL you want indexed. If Google's choice is right, update your canonical.",
  },
};
