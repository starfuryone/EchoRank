// src/lib/site-crawler/free-limits.ts
//
// The free public site crawler's numbers, dependency-free so the copy and the
// Client Components can read them (free-crawl.ts, server only, re-exports them
// and enforces them).

/** Pages one free crawl fetches. */
export const FREE_CRAWL_URL_CAP = 100;
/** New free crawls per visitor IP per UTC day. */
export const FREE_CRAWL_IP_DAILY = 3;
/** One crawl per registrable domain in this window; a repeat gets the first's result. */
export const FREE_CRAWL_DOMAIN_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Result links, and the crawl behind them, live this long. */
export const FREE_CRAWL_RETENTION_DAYS = 7;
/** Rules shown in the free result's "Fix first" block (the rest sit behind the email form). */
export const FREE_FIX_FIRST = 5;
/** Where an owner asks to be left out. */
export const FREE_CRAWL_ABUSE_EMAIL = "support@echorank360.com";
