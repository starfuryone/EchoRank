// src/lib/site-crawler/constants.ts
//
// The knobs that make this crawler a polite one. Every number here is a limit
// on us, not on the site being crawled — they are the reason a tenant can point
// this at a server without us becoming their traffic problem.

/** Identifies the crawler and points at a page explaining it. Never spoofed. */
export const CRAWLER_USER_AGENT = "Echorank360Bot/1.0 (+https://echorank360.com/bot)";

/** Requests per second, per crawl. Enforced by a token bucket. */
export const MAX_REQUESTS_PER_SECOND = 2;

/** Simultaneous in-flight fetches inside one crawl. */
export const FETCH_CONCURRENCY = 4;

/** Simultaneous crawls box-wide (BullMQ worker concurrency). */
export const CRAWL_JOB_CONCURRENCY = 2;

/** Per-request timeout. */
export const FETCH_TIMEOUT_MS = 15_000;

/** Redirect hops followed before giving up on a URL. */
export const MAX_REDIRECT_HOPS = 5;

/** Response bytes read before aborting. A page larger than this is not one. */
export const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

/** Wall-clock ceiling for one crawl. Hitting it completes, it does not fail. */
export const MAX_CRAWL_DURATION_MS = 60 * 60 * 1000;

/**
 * Rows written per transaction, and therefore the most pages held in memory at
 * once. The box is shared and small; the crawled set never lives in RAM.
 */
export const WRITE_BATCH_SIZE = 25;

/** TTL on the frontier and seen-set, so an abandoned crawl cannot leak keys. */
export const REDIS_KEY_TTL_SECONDS = 24 * 60 * 60;

/** Word count below which a 200 HTML page is flagged THIN_CONTENT. */
export const THIN_CONTENT_WORDS = 150;

export const TITLE_MAX_LENGTH = 60;
export const TITLE_MIN_LENGTH = 15;
export const META_DESC_MAX_LENGTH = 160;

/** Sitemap files followed, including nested index files. */
export const MAX_SITEMAP_FILES = 10;

/** URLs taken from the sitemap across all files, before we stop reading. */
export const MAX_SITEMAP_URLS = 50_000;

/** Per sitemap file. Same shape as a page fetch, tighter body cap. */
export const SITEMAP_TIMEOUT_MS = 15_000;
export const MAX_SITEMAP_BYTES = 5 * 1024 * 1024;

/** Hops walked before a redirect chain is called a loop. */
export const MAX_CHAIN_WALK = 10;

/** Rows read per batch by the aggregation queries. Never the whole table. */
export const AGGREGATION_BATCH_SIZE = 1_000;

/** Sample sizes in the summary JSON. Counts are exact; lists are capped. */
export const SUMMARY_SAMPLE_LIMIT = 500;
export const SUMMARY_DEEPEST_LIMIT = 10;

/** Redis key names for one crawl's transient state. */
export const crawlKeys = (jobId: string) => ({
  queue: `crawl:${jobId}:queue`,
  seen: `crawl:${jobId}:seen`,
  cancel: `crawl:${jobId}:cancel`,
  /** HASH normalizedUrl -> inlink count. Flushed into CrawlPage at the end. */
  inlinks: `crawl:${jobId}:inlinks`,
  /** SET of normalized in-scope sitemap URLs. */
  sitemap: `crawl:${jobId}:sitemap`,
});
