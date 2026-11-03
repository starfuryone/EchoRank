import type { RuleCopy } from "../types";

export const COPY: Record<string, RuleCopy> = {
  "response_codes.internal_4xx": {
    name: "Internal client error (4xx)",
    description: "A URL on the site answers with a 4xx status, usually 404 Not Found or 410 Gone. Visitors and crawlers who follow a link to it hit a dead end.",
    howToFix: "Restore the page, or 301-redirect the URL to its closest live equivalent, then update the internal links that point at it.",
  },
  "response_codes.internal_5xx": {
    name: "Internal server error (5xx)",
    description: "A URL on the site answers with a 5xx status. The server failed to produce the page; search engines retry, then drop URLs that keep failing.",
    howToFix: "Check the server and application logs for this URL at the crawl time, fix the failing code path or capacity issue, and re-crawl.",
  },
  "response_codes.external_4xx": {
    name: "Broken external link (4xx)",
    description: "The page links to another site's URL that answers with a 4xx status. A broken outbound link is a dead end for readers and a quality signal for search engines.",
    howToFix: "Update the link to the resource's new address, link to an archived or alternative source, or remove it.",
  },
  "response_codes.external_5xx": {
    name: "External link server error (5xx)",
    description: "The page links to another site's URL that answered with a 5xx status during the crawl. It may be a temporary outage on their side.",
    howToFix: "Re-check the link later. If it keeps failing, replace it with a working source or remove it.",
  },
  "response_codes.no_response": {
    name: "No response",
    description: "The request produced no HTTP response at all: a timeout, a DNS failure, a refused connection or too many redirects.",
    howToFix: "Load the URL yourself to confirm. Check DNS, firewall or bot-protection rules that may block crawlers, and how long the server takes to answer.",
  },
  "response_codes.internal_3xx": {
    name: "Internal redirect (3xx)",
    description: "The crawled URL redirects to another URL. Redirects are fine for moved content, but each one costs a request and dilutes crawl budget when internal links keep pointing at them.",
    howToFix: "Keep the redirect for external visitors, but point internal links straight at the final URL.",
  },
  "response_codes.redirect_chain": {
    name: "Redirect chain",
    description: "Reaching the final URL takes more than one redirect hop. Every hop adds latency, and search engines stop following long chains.",
    howToFix: "Redirect the original URL straight to the final destination in a single hop, and update links to point at the final URL.",
  },
  "response_codes.redirect_loop": {
    name: "Redirect loop",
    description: "The URL's redirects lead back to a URL already in the chain, so the page can never load.",
    howToFix: "Find the rule that sends the last URL in the loop back to the first (often HTTP/HTTPS or trailing-slash rules fighting) and break the cycle.",
  },
  "response_codes.meta_refresh": {
    name: "Meta refresh redirect",
    description: "The page uses <meta http-equiv=\"refresh\"> to send visitors elsewhere. Search engines treat it as a weak redirect, and it disorients screen-reader users.",
    howToFix: "Replace the meta refresh with a server-side 301 (permanent) or 302 (temporary) redirect.",
  },
  "response_codes.redirect_to_error": {
    name: "Redirect to an error page",
    description: "The URL redirects, and the destination answers with a 4xx or 5xx status. The redirect sends visitors to a dead end.",
    howToFix: "Point the redirect at a live page, or fix the destination.",
  },
  "response_codes.blocked_by_robots": {
    name: "Blocked by robots.txt",
    description: "robots.txt disallows this URL, so it was recorded but not fetched. Search engines will not crawl it either, though they can still index the bare URL if other pages link to it.",
    howToFix: "If the page should rank, remove the Disallow rule that matches it. If it should stay out of search, use noindex instead and let it be crawled.",
  },
  "response_codes.inlinks_to_3xx": {
    name: "Internal links point at a redirect",
    description: "Other pages on the site link to this URL, which redirects. Each click costs an extra request and passes link signals through a hop.",
    howToFix: "Update those internal links to point straight at the redirect's destination.",
  },
};
