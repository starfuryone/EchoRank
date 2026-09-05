// src/lib/backlinks/snapshot-shape.ts
//
// The snapshot POINT and the minimum series length — the two things the client
// component needs from the history feature.
//
// SPLIT OUT OF ./snapshots.ts BECAUSE THAT FILE IS server-only. It imports
// prisma, and a Client Component taking a type from it would be fine (types are
// erased) but taking MIN_HISTORY_POINTS — a value — would drag the database
// driver into the browser bundle. That is the mistake CLAUDE.md's client/server
// rule exists for, and the one the compile check catches. Pure module, no
// imports.

/** One point on the sparkline. */
export interface BacklinkSnapshotPoint {
  /** YYYY-MM-DD, UTC. The x-axis. */
  date: string;
  backlinks: number;
  referringDomains: number;
  /** DataForSEO domain rank, or null when the scope has none to report. */
  rank: number | null;
}

/**
 * A sparkline needs two points to be a line.
 *
 * One point is a dot, and a dot drawn as a trend is worse than no chart — the
 * UI says "history starts building from here" instead.
 */
export const MIN_HISTORY_POINTS = 2;
