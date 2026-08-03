// src/lib/historical/options.ts
//
// The caps. Every number here bounds something a tenant can grow without limit.

/** Largest markdown body accepted for one snapshot. */
export const MAX_SNAPSHOT_BYTES = 300 * 1024;

/**
 * Snapshots retained per tenant. Oldest pruned first on insert.
 *
 * THIS IS THE ABUSE GUARD. Captures accept any public URL, so with no cap a
 * tenant could point Echorank at the open web and use it as a generic archiver.
 * The cap plus the per-minute rate limit is what makes that uninteresting, and
 * it is deliberately the ONLY thing doing that job — an ownership check would
 * remove the reason the tool exists.
 *
 * IF SCHEDULED AUTO-CAPTURES ARRIVE: revisit this as a single number. A
 * recurring job pointed at third-party URLs consumes the allowance on a
 * schedule rather than on a click, which is a different risk from a person
 * pasting a competitor's page. Third-party URLs should get a lower RECURRING
 * cap than own-site ones at that point. Not split today because nothing
 * recurs today, and a split cap with no scheduler is unused complexity.
 */
export const MAX_SNAPSHOTS_PER_TENANT = 500;

/** Snapshots fetched in one Wayback import. */
export const MAX_WAYBACK_IMPORT = 10;

/** CDX responses cached this long, keyed by URL. */
export const CDX_CACHE_TTL_SECONDS = 24 * 60 * 60;

/** DataForSEO Labs keyword-history cache, per (keyword, location). */
export const KEYWORD_HISTORY_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Manual captures per tenant per minute. */
export const CAPTURE_RATE_LIMIT = 5;
export const CAPTURE_RATE_WINDOW_MS = 60_000;

/**
 * Ceiling on one capture, so a slow third-party site cannot hold a request open.
 *
 * Measured against the live sidecar: example.com 0.9s, a 16 KB Echorank page
 * 1.7s. 10s is roughly six times the observed cost of a real capture, which
 * leaves room for a slow origin without letting one hang. The sidecar keeps its
 * own budgets underneath (15s raw fetch, 45s render); this bounds OUR side, and
 * a capture that trips it is reported as a timeout rather than a broken page.
 */
export const CAPTURE_TIMEOUT_MS = 10_000;

/** Wayback imports per tenant per minute. */
export const IMPORT_RATE_LIMIT = 2;
export const IMPORT_RATE_WINDOW_MS = 60_000;

export const SNAPSHOT_SOURCES = ["ai_lens", "manual", "wayback"] as const;
export type SnapshotSource = (typeof SNAPSHOT_SOURCES)[number];
