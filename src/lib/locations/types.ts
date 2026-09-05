// src/lib/locations/types.ts
//
// The location vocabulary for city-scoped rank tracking.
//
// ── THE CONTRACT DETAIL THAT SHAPES EVERYTHING HERE ────────────────────────
// DataForSEO targets a COUNTRY by `location_code` and a sub-country place by
// `location_name` — a canonical comma-separated string like
// "Enid,Oklahoma,United States". They are not interchangeable, and a city's
// code is not accepted where a country's is.
//
// So an entry carries BOTH, and `serpTarget()` below is the only place that
// decides which one goes upstream. Persisting only a code, as a first pass at
// this feature would, produces a picker whose selections cannot be sent.
//
// PURE — no fs, no prisma, no provider. The picker is a Client Component and
// imports this directly.

/**
 * The granularities a customer actually targets.
 *
 * Deliberately excludes Postal Code (~32,000 extra rows for the US alone),
 * State (national-ish for ranking purposes), and the long tail — Airport,
 * University, Neighborhood. Every one of those is a row a searcher scrolls
 * past on the way to the city they meant.
 */
export const LOCATION_TYPES = ["Country", "Region", "DMA Region", "County", "City"] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

export interface CuratedLocation {
  /** DataForSEO location_code. Sent for COUNTRY targets only — see the header. */
  code: number;
  /**
   * Canonical DataForSEO location_name, exactly as the provider spells it.
   * Sent as `location_name` for sub-country targets. NEVER reformatted before
   * it goes upstream: the provider matches this string literally and rejects
   * anything it did not produce.
   */
  name: string;
  type: LocationType;
  /** ISO 3166-1 alpha-2, lowercase. The country this belongs to. */
  countryCode: string;
  /** What the picker shows: "Enid, Oklahoma". */
  label: string;
}

/**
 * How one location is sent to the SERP endpoints.
 *
 * THE ONE PLACE THE CODE/NAME CHOICE IS MADE. A country goes by code — that is
 * what every existing call in this repo already sends, and changing it would
 * re-key every cached SERP check. Anything narrower goes by name, because a
 * city's code is not a value the SERP endpoints accept.
 */
export function serpTarget(
  location: CuratedLocation,
): { location_code: number } | { location_name: string } {
  return location.type === "Country"
    ? { location_code: location.code }
    : { location_name: location.name };
}

/**
 * Human label from a canonical name.
 *
 * The provider's segments are comma-separated with inconsistent spacing
 * ("Portland-Auburn, ME,United States"), so each segment is trimmed.
 * `maxSegments` truncates for the picker, which shows "Enid, Oklahoma" rather
 * than repeating the country on every row.
 */
export function formatLocationLabel(name: string, maxSegments?: number): string {
  const parts = name.split(",").map((part) => part.trim()).filter(Boolean);
  return (maxSegments ? parts.slice(0, maxSegments) : parts).join(", ");
}
