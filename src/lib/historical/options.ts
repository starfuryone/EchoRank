// src/lib/historical/options.ts
//
// The caps. Every number here bounds something a tenant can grow without limit.

/** Largest markdown body accepted for one snapshot. */
export const MAX_SNAPSHOT_BYTES = 300 * 1024;

/** Snapshots retained per tenant. Oldest pruned first on insert. */
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

/** Wayback imports per tenant per minute. */
export const IMPORT_RATE_LIMIT = 2;
export const IMPORT_RATE_WINDOW_MS = 60_000;

export const SNAPSHOT_SOURCES = ["ai_lens", "manual", "wayback"] as const;
export type SnapshotSource = (typeof SNAPSHOT_SOURCES)[number];
