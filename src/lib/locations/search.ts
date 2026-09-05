// src/lib/locations/search.ts
//
// Searching the curated location table.
//
// ── IN THE BROWSER, ON PURPOSE ─────────────────────────────────────────────
// The table is a static module small enough to import into a page, so the
// picker filters it directly — no debounce, no server function, no spinner.
// The reference implementation goes to a KV store per keystroke because its
// table is 23,000 entries; ours is capped by the generator precisely so this
// can be a synchronous array filter.
//
// If the curated set ever outgrows that — say someone raises the per-country
// cap into the thousands — the fix is a server search route, not a slower
// filter here. `MAX_INLINE_LOCATIONS` is asserted by the suite so the day that
// happens is a failing test rather than a janky picker.
//
// PURE.

import { CURATED_LOCATIONS } from "./curated";
import type { CuratedLocation, LocationType } from "./types";

/**
 * Above this the table stops being something to ship to a browser.
 *
 * Not a hard cap on the generator — it is a tripwire. The generator caps per
 * country; this catches the case where enough countries are added that the
 * total stops being reasonable.
 */
export const MAX_INLINE_LOCATIONS = 5000;

/** Results one search returns. Longer lists are scrolled, not read. */
export const SEARCH_LIMIT = 20;

/** Fold case and accents so "Zurich" finds "Zürich". */
function fold(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/**
 * Rank order within a match: type first, then position of the match.
 *
 * TYPE FIRST because a search for "Portland" should offer the city before the
 * DMA region that shares its name — the reference's own spec calls that out as
 * its picker's weakest point, and ordering by type is most of the fix without
 * a population table.
 *
 * Then PREFIX BEFORE SUBSTRING: someone typing "san" means San Francisco, not
 * Sanford-under-something.
 */
const TYPE_RANK: Record<LocationType, number> = {
  City: 0,
  "DMA Region": 1,
  County: 2,
  Region: 3,
  Country: 4,
};

export interface LocationSearchOptions {
  /** Restrict to one country, lowercase ISO 3166-1 alpha-2. */
  countryCode?: string;
  /** Restrict to some granularities. */
  types?: readonly LocationType[];
  limit?: number;
}

/**
 * Substring search over the curated table.
 *
 * An EMPTY query returns the first `limit` entries for the country rather than
 * nothing: a picker that is blank until you type gives no hint that it has
 * anything in it, which on a table this small is the wrong first impression.
 */
export function searchLocations(
  query: string,
  options: LocationSearchOptions = {},
): CuratedLocation[] {
  const limit = options.limit ?? SEARCH_LIMIT;
  const types = options.types ? new Set(options.types) : null;

  const pool = CURATED_LOCATIONS.filter((location) => {
    if (options.countryCode && location.countryCode !== options.countryCode) return false;
    if (types && !types.has(location.type)) return false;
    return true;
  });

  const needle = fold(query.trim());
  if (!needle) {
    return [...pool].sort((a, b) => TYPE_RANK[a.type] - TYPE_RANK[b.type]).slice(0, limit);
  }

  const scored: { location: CuratedLocation; typeRank: number; matchAt: number }[] = [];
  for (const location of pool) {
    const matchAt = fold(location.label).indexOf(needle);
    if (matchAt === -1) continue;
    scored.push({ location, typeRank: TYPE_RANK[location.type], matchAt });
  }

  return scored
    .sort(
      (a, b) =>
        a.typeRank - b.typeRank ||
        a.matchAt - b.matchAt ||
        a.location.label.localeCompare(b.location.label),
    )
    .slice(0, limit)
    .map((entry) => entry.location);
}

/** One location by its canonical name — how a stored selection is resolved. */
export function findLocationByName(name: string): CuratedLocation | null {
  return CURATED_LOCATIONS.find((location) => location.name === name) ?? null;
}

/** One COUNTRY by its code. Countries are the only entries a code identifies. */
export function findCountryByCode(code: number): CuratedLocation | null {
  return (
    CURATED_LOCATIONS.find(
      (location) => location.type === "Country" && location.code === code,
    ) ?? null
  );
}

/** Countries the table covers, alphabetical. The picker's first dropdown. */
export function availableCountries(): CuratedLocation[] {
  return CURATED_LOCATIONS.filter((location) => location.type === "Country").sort((a, b) =>
    a.label.localeCompare(b.label),
  );
}
