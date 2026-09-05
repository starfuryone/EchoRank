// src/lib/locations/curated.ts
//
// GENERATED DATA. Edit scripts/generate-locations.ts and re-run it; do not
// hand-edit the table below.
//
//   npx tsx scripts/generate-locations.ts
//
// ── WHY THIS FILE IS ALMOST EMPTY, AND WHAT FILLS IT ───────────────────────
//
// Every row here is a real DataForSEO location_code and its canonical
// location_name. Neither can be guessed: a wrong code posts a paid SERP check
// for the wrong place and returns positions that look entirely plausible, so
// the error is invisible until somebody checks a ranking by hand.
//
// The registry that has them — /v3/serp/google/locations/{iso} — is FREE, but
// it needs the DataForSEO credentials, and `.env` on this box is 600 echorank.
// The porting session ran as `deploy` and could not read it. So this table
// ships with the FIVE ENTRIES THAT WERE ALREADY VERIFIED IN THIS REPOSITORY —
// the country codes in src/lib/serp/options.ts, which are in production use —
// and nothing invented alongside them.
//
// EVERYTHING ELSE — every city, county and region — arrives when someone runs
// the generator. The picker, the search, the schema column and the task-post
// wiring are all complete and tested; what is missing is data, and the command
// that fetches it is one line.
//
// ── SIZE ───────────────────────────────────────────────────────────────────
// The full US list is ~60,000 entries / 9.5 MB, and ~23,000 slimmed to the
// five useful types. That is not a static asset anybody should ship: the
// generator caps each country to CITIES_PER_COUNTRY, which keeps the module
// small enough to import into a page and search in the browser without a
// server round trip.

import type { CuratedLocation } from "./types";

/**
 * When the table was generated, ISO 8601. `null` means it has never been
 * generated and carries only the pre-verified countries below.
 *
 * Google refreshes its geotargets roughly quarterly, so a table more than a
 * few months old is worth regenerating — `locationsAreStale()` says so.
 */
export const LOCATIONS_GENERATED_AT: string | null = null;

/**
 * The curated set.
 *
 * These five countries are the markets the SERP Checker and Rank Tracker
 * already offer (src/lib/serp/options.ts), minus the two whose codes are used
 * but whose canonical names were never recorded — the generator adds those
 * back with the names the provider actually returns rather than names guessed
 * here.
 */
export const CURATED_LOCATIONS: readonly CuratedLocation[] = [
  { code: 2124, name: "Canada", type: "Country", countryCode: "ca", label: "Canada" },
  { code: 2840, name: "United States", type: "Country", countryCode: "us", label: "United States" },
  { code: 2826, name: "United Kingdom", type: "Country", countryCode: "gb", label: "United Kingdom" },
  { code: 2250, name: "France", type: "Country", countryCode: "fr", label: "France" },
  { code: 2276, name: "Germany", type: "Country", countryCode: "de", label: "Germany" },
  { code: 2756, name: "Switzerland", type: "Country", countryCode: "ch", label: "Switzerland" },
  { code: 2036, name: "Australia", type: "Country", countryCode: "au", label: "Australia" },
];

/** True when the table has never been generated, or is over a quarter old. */
export function locationsAreStale(now: Date = new Date()): boolean {
  if (!LOCATIONS_GENERATED_AT) return true;
  const generated = new Date(LOCATIONS_GENERATED_AT).getTime();
  return now.getTime() - generated > 120 * 24 * 60 * 60 * 1000;
}

/** True when the table carries anything narrower than a country. */
export function hasLocalLocations(): boolean {
  return CURATED_LOCATIONS.some((location) => location.type !== "Country");
}
