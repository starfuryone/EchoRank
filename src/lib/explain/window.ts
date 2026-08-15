// src/lib/explain/window.ts
//
// The 7-day window, in one place.
//
// Its own module for two reasons. It is imported by the CLIENT component that
// renders the confirm dialog ("the report is kept for N days"), and store.ts —
// where it would otherwise live — imports Prisma, which must never reach the
// browser bundle. And keeping the report's re-run window and the per-call
// cache TTL derived from a single number makes them impossible to drift apart:
// a stale gap between them would let a day-eight re-run mix week-old bought
// data into a fresh report with no way to say which half is which.

/** Days a stored report is served before a re-run is permitted. */
export const EXPLAIN_RERUN_DAYS = 7;

/** The same window in milliseconds, for the freshness check. */
export const EXPLAIN_RERUN_MS = EXPLAIN_RERUN_DAYS * 24 * 60 * 60 * 1000;

/** The same window in seconds, for the Redis TTL on each bought call. */
export const EXPLAIN_CACHE_TTL_SECONDS = EXPLAIN_RERUN_DAYS * 24 * 60 * 60;
