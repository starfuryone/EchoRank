// src/lib/free-tools/public-constants.ts
//
// Constants the BROWSER may import.
//
// This module has no imports at all, deliberately. The tool libraries next to
// it reach Redis, Prisma and DataForSEO at module scope, so a client component
// importing a single number from one of them drags a database client into the
// browser bundle — which is not a type error and not a test failure, but a hard
// build failure. It surfaced exactly that way: tsc and the full suite were
// green and `next build` refused.
//
// Rule of thumb: if a "use client" file needs it, it belongs here.

/** SERP Location Changer: positions shown before the signup wall. */
export const FREE_VISIBLE_POSITIONS = 3;

/** Share of Search: how many brands may be compared at once. */
export const MIN_BRANDS = 2;
export const MAX_BRANDS = 5;

/**
 * Display names for the seven markets serp/options.ts verifies.
 *
 * Labels only — the codes themselves stay in serp/options.ts, which is the
 * module that decides which markets are supported.
 */
export const FREE_LOCATION_LABELS: Record<number, string> = {
  2124: "Canada",
  2840: "United States",
  2826: "United Kingdom",
  2250: "France",
  2276: "Germany",
  2756: "Switzerland",
  2036: "Australia",
};
