// src/lib/crawler-guides-link.ts
//
// Where the crawler guides are listed together: the guides index, at an
// anchor. The mega menu, the public /site-crawler page, the crawler's header
// and its help modal all link here.
//
// Its own module, and dependency-free, because two of those are CLIENT
// components (PublicNav, the crawler header): importing learn-content.ts for
// one string would ship the whole Knowledge Hub's prose to the browser.

/** The guides index section id. */
export const CRAWLER_GUIDES_ANCHOR = "nosy-bat";

/** Path after the locale segment. */
export const CRAWLER_GUIDES_HREF = `/learn/guides#${CRAWLER_GUIDES_ANCHOR}`;
