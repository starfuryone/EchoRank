// src/lib/site-crawler/nosybat-enforced.ts
//
// Which of the crawler's newer limits code enforces today. Copy about one of
// them renders only while its marker is true. Dependency-free on purpose: the
// in-app Help modal (a Client Component) reads it, and nosybat-facts.ts (which
// pulls in the rule registry) re-exports it for the server side.
//
// Flip a marker only in the commit that adds (or removes) its enforcement;
// tests/nosybat-facts.test.ts reads the enforcing code for every true marker.
//   pagesPerMonth  page-allowance.ts: startCrawl refuses and lowers the cap,
//                  the runner stops per batch, a scheduled crawl is skipped
//                  with an email (debdaf87).
//   crawlsAtOnce   tenant-caps.ts claimCrawlSlot: one transaction under a
//                  per-workspace advisory lock; extra crawls wait in order
//                  (fc7f5103).
//   crawlsKept     retention.ts: the nightly job drops the full data of every
//                  completed crawl past the newest crawlsKept, pinned ones
//                  aside (2f40f449).

/** The limits added after the per-crawl URL cap, each shown only once code enforces it. */
export type NosybatGated = "pagesPerMonth" | "crawlsAtOnce" | "crawlsKept";

export const NOSYBAT_ENFORCED: Readonly<Record<NosybatGated, boolean>> = {
  pagesPerMonth: true,
  crawlsAtOnce: true,
  crawlsKept: true,
};
