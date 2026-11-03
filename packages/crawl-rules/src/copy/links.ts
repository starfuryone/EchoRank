import type { RuleCopy } from "../types";

export const COPY: Record<string, RuleCopy> = {
  "links.high_external_outlinks": {
    name: "Over 100 external links",
    description: "The page links to more than 100 distinct external URLs. Link-heavy pages look like directories and spread readers' attention thin.",
    howToFix: "Keep the links that help the reader and remove or paginate the rest.",
  },
  "links.high_internal_outlinks": {
    name: "Over 500 internal links",
    description: "The page links to more than 500 distinct internal URLs, usually a mega-menu or a footer repeated on every page. Each link then carries very little weight.",
    howToFix: "Trim navigation to the pages that matter and move long lists into hub pages.",
  },
  "links.no_internal_outlinks": {
    name: "No internal links",
    description: "The page links to no other page on the site. It is a dead end for visitors and for crawlers following links.",
    howToFix: "Add navigation and contextual links to related pages. Check the links are real <a href> elements, not script-only.",
  },
  "links.inlinks_only_nofollow": {
    name: "Only linked with nofollow",
    description: "Every internal link to this page is rel=\"nofollow\", so it receives no internal link signals.",
    howToFix: "Remove nofollow from internal links to pages you want to rank.",
  },
  "links.non_descriptive_anchor": {
    name: "Non-descriptive anchor text",
    description: "Links use generic text such as \"click here\" or \"read more\". It tells search engines nothing about the target, and screen-reader users listing links hear a column of identical phrases.",
    howToFix: "Make the link text describe the destination, e.g. \"read our pricing guide\" instead of \"read more\".",
  },
  "links.localhost_links": {
    name: "Links to localhost",
    description: "The page links to localhost or a loopback address, a leftover from development that is broken for every visitor.",
    howToFix: "Replace the links with production URLs, or root-relative paths.",
  },
  "links.internal_nofollow": {
    name: "Internal links with nofollow",
    description: "The page marks links to other pages on the same site rel=\"nofollow\", withholding link signals from your own pages.",
    howToFix: "Remove nofollow from internal links. To keep a page out of search, use noindex on that page instead.",
  },
  "links.outlinks_to_redirect": {
    name: "Links to redirecting URLs",
    description: "Pages link to URLs on this site that redirect. Each click costs an extra hop.",
    howToFix: "Update the links to point straight at the redirect destination.",
  },
  "links.internal_with_parameters": {
    name: "Internal links with parameters",
    description: "The page links internally to URLs with query parameters. Parameter variants can multiply crawlable URLs and split signals.",
    howToFix: "Link to the clean URL wherever the parameter is not needed, and canonicalise parameter variants.",
  },
  "links.only_one_inlink": {
    name: "Only one internal link to the page",
    description: "Just one page on the site links here. Pages with few internal links are crawled less and rank less.",
    howToFix: "Link to the page from related content, hub pages or navigation.",
  },
  "links.deep_page": {
    name: "Crawl depth over 3",
    description: "The page is more than three clicks from the start URL. Deep pages are crawled less often and are hard for visitors to find.",
    howToFix: "Add links from higher-level pages, hubs or navigation to bring it closer to the homepage.",
  },
  "links.orphan": {
    name: "Orphan page",
    description: "The page is listed in the sitemap but no crawled page links to it. Search engines may find it through the sitemap, but it receives no internal link signals.",
    howToFix: "Link to it from relevant pages, or remove it from the sitemap if it should not be live.",
  },
  "links.external_to_redirect": {
    name: "External links that redirect",
    description: "Some outbound links point at URLs that redirect. They work, but the destination may have moved for good.",
    howToFix: "Update the links to the final destination URLs.",
  },
  "links.anchor_over_100_chars": {
    name: "Anchor text over 100 characters",
    description: "A link's text is longer than 100 characters, usually a whole sentence or a block wrapped in a link.",
    howToFix: "Link a short, descriptive phrase rather than the whole sentence or card.",
  },
  "links.to_http": {
    name: "Links to non-HTTPS URLs",
    description: "The page links to http:// URLs. Visitors may be shown an insecure-site warning, or a redirect hop at best.",
    howToFix: "Change the links to https://. For your own site, update templates and content to use HTTPS URLs.",
  },
};
