// src/lib/site-crawler/constants.ts
//
// The knobs that make this crawler a polite one. Every number here is a limit
// on us, not on the site being crawled — they are the reason a tenant can point
// this at a server without us becoming their traffic problem.

import { CRAWLER_BRAND } from "./brand";

/**
 * Identifies the crawler and points at a page explaining it. Never spoofed.
 * The token before the `/` is what robots.txt groups match; only the comment
 * carries the brand name.
 */
export const CRAWLER_USER_AGENT = CRAWLER_BRAND.ua;

/** Requests per second, per crawl. Enforced by a token bucket. */
export const MAX_REQUESTS_PER_SECOND = 2;

/** Simultaneous in-flight fetches inside one crawl. */
export const FETCH_CONCURRENCY = 4;

/**
 * Simultaneous crawls box-wide (BullMQ worker concurrency): env
 * CRAWL_MAX_CONCURRENT, read by crawlMaxConcurrent() in tenant-caps.ts (server
 * only), bounded to CRAWL_MAX_CONCURRENT_BOUNDS. Each workspace still holds at
 * most one of them unless staff override it (fair share, tenant-caps.ts).
 */
export const CRAWL_MAX_CONCURRENT_DEFAULT = 6;
export const CRAWL_MAX_CONCURRENT_BOUNDS = [1, 16] as const;

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

// ─── Phase 4a: link graph ───────────────────────────────────────────────────
/** Internal link edges stored per source page (deduped per target first). */
export const MAX_LINKS_PER_PAGE = 100;
export const MAX_ANCHOR_CHARS = 200;
/** <img> srcs kept per page for the image sitemap. */
export const MAX_IMG_SRCS_PER_PAGE = 50;

// ─── Phase 4a: retention ────────────────────────────────────────────────────
/** Crawls a tenant may pin (kept with full data beyond the plan's crawlsKept). */
export const CRAWL_PIN_MAX = 5;
/** Rows deleted per statement by the retention job. */
export const RETENTION_BATCH_ROWS = 5_000;
/** A failed or cancelled crawl's partial data is kept this long, then purged. */
export const RETENTION_UNFINISHED_DAYS = 7;
/** crawl_site_defaults rows never verified and untouched this long are deleted. */
export const SITE_DEFAULTS_STALE_DAYS = 365;

/** Redis key names for one crawl's transient state. */
export const crawlKeys = (jobId: string) => ({
  queue: `crawl:${jobId}:queue`,
  seen: `crawl:${jobId}:seen`,
  cancel: `crawl:${jobId}:cancel`,
  /** HASH normalizedUrl -> inlink count. Flushed into CrawlPage at the end. */
  inlinks: `crawl:${jobId}:inlinks`,
  /** SET of normalized in-scope sitemap URLs. */
  sitemap: `crawl:${jobId}:sitemap`,
  /** HASH normalizedUrl -> internal rel=nofollow links pointing at it. */
  nofollowInlinks: `crawl:${jobId}:nofollow`,
  /** HASH target -> the first page seen linking to it (outlinks-to-redirect credit). */
  firstSource: `crawl:${jobId}:firstsource`,
  /** HASH url -> "status|bytes" of a HEAD check, so a shared image or link is checked once per crawl. */
  headCache: `crawl:${jobId}:head`,
  /** Phase 4e: the forms-login cookie jar, encrypted (login.ts). Never in Postgres. */
  login: `crawl:${jobId}:login`,
});

// ─── Phase 3a: bounded HEAD checks (external links, same-host images) ──────
/** External links HEAD-checked per page; results cached per crawl. */
export const EXTERNAL_CHECKS_PER_PAGE = 10;
/** Phase 4g: outbound links stored per page (crawl_links isExternal), deduped by URL. */
export const MAX_EXTERNAL_LINKS_PER_PAGE = 50;
/** Phase 4g: distinct external URLs whose status aggregation resolves per crawl, most-linked first. */
export const EXTERNAL_RESOLVE_CAP = 1_000;
export const EXTERNAL_RESOLVE_CONCURRENCY = 10;
/** Same-host images HEAD-checked per page, through the politeness limiter. */
export const IMAGE_CHECKS_PER_PAGE = 10;
export const HEAD_TIMEOUT_MS = 5_000;
/** images.over_100kb threshold. */
export const IMAGE_MAX_BYTES = 100 * 1024;
