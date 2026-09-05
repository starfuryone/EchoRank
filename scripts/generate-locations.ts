/**
 * scripts/generate-locations.ts
 *
 * Regenerates src/lib/locations/curated.ts from DataForSEO's SERP location
 * registry.
 *
 *   npx tsx scripts/generate-locations.ts
 *
 * MUST BE RUN AS `echorank` OR root. `.env` is 600 echorank and this needs
 * DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD from it:
 *
 *   sudo -u echorank bash -c 'set -a && . .env && set +a && npx tsx scripts/generate-locations.ts'
 *
 * ── THIS SCRIPT IS A THIRD RUNTIME, AND IT DECLARES ITS STRATEGY BY HAVING
 * ── NOTHING TO DECLARE ──────────────────────────────────────────────────────
 * CLAUDE.md: every runtime outside Next that touches a `server-only` module
 * needs a resolution strategy, because outside the react-server condition that
 * package's main export THROWS on import. Two exist (vitest's alias, the tsx
 * workers' --conditions flag) and adding a third means adding its strategy in
 * the same commit.
 *
 * This script's strategy is to touch NOTHING guarded. It imports only
 * `node:fs`, `node:path` and its own pure sibling `src/lib/locations/types` —
 * no prisma, no @/lib/dataforseo/client (which is guarded), no @/lib anything
 * that reaches a database. The provider call below is a hand-rolled fetch for
 * exactly that reason: going through the repo's DataForSEO client would import
 * `server-only` and this script would die at import, in production, the way
 * the workers crash-looped 66 times before that rule was written down.
 *
 * Keep it that way. If this ever needs the metered client, it needs
 * NODE_OPTIONS=--conditions=react-server as well, and that belongs in the same
 * commit as the import.
 *
 * ── WHAT IT DOES ───────────────────────────────────────────────────────────
 * For each country in COUNTRIES: fetch /v3/serp/google/locations/{iso} (FREE —
 * cost 0, so nothing is metered), keep the five granularities customers
 * actually target, cap to CITIES_PER_COUNTRY by shortest canonical name (a
 * proxy for prominence: "Boston,Massachusetts,United States" beats
 * "North Reading,Massachusetts,United States"), and write the table.
 *
 * The full US list is ~60,000 entries / 9.5 MB. The cap is what keeps the
 * generated module small enough to import into a page and search in the
 * browser.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { LOCATION_TYPES, formatLocationLabel, type CuratedLocation } from "../src/lib/locations/types";

/**
 * Countries to generate, as (ISO alpha-2, DataForSEO country location_code).
 *
 * THE CODES ARE NOT GUESSED — they are the seven markets already in production
 * use in src/lib/serp/options.ts. Adding a country here means finding its code
 * in the registry response, not inventing one.
 */
const COUNTRIES: { iso: string; code: number }[] = [
  { iso: "ca", code: 2124 },
  { iso: "us", code: 2840 },
  { iso: "gb", code: 2826 },
  { iso: "fr", code: 2250 },
  { iso: "de", code: 2276 },
  { iso: "ch", code: 2756 },
  { iso: "au", code: 2036 },
];

/**
 * Sub-country entries kept per country.
 *
 * 400 x 7 is ~2,800 rows — well under the MAX_INLINE_LOCATIONS tripwire in
 * search.ts, and a module of roughly 300 KB. Raise it and check that assertion
 * still holds; past a few thousand the picker wants a server search route
 * rather than a bigger array.
 */
const CITIES_PER_COUNTRY = 400;

const OUT = join(process.cwd(), "src", "lib", "locations", "curated.ts");

const KEEP = new Set<string>(LOCATION_TYPES.filter((type) => type !== "Country"));

interface RegistryItem {
  location_code?: number;
  location_name?: string;
  location_type?: string | null;
}

function auth(): string {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) {
    throw new Error(
      "DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD are not set. Run as echorank with .env sourced — see this file's header.",
    );
  }
  return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
}

async function fetchCountry(iso: string): Promise<RegistryItem[]> {
  // GET, not POST — the registry takes the ISO code in the path. It is free
  // (cost 0), which is why nothing here meters.
  const res = await fetch(`https://api.dataforseo.com/v3/serp/google/locations/${iso}`, {
    headers: { Authorization: auth() },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${iso}`);
  const json = (await res.json()) as {
    tasks?: { status_code?: number; status_message?: string; result?: RegistryItem[] }[];
  };
  const task = json.tasks?.[0];
  if (!task || task.status_code !== 20000) {
    throw new Error(`${iso}: ${task?.status_code} ${task?.status_message ?? "no task"}`);
  }
  return task.result ?? [];
}

function toCurated(item: RegistryItem, iso: string): CuratedLocation | null {
  if (typeof item.location_code !== "number") return null;
  if (typeof item.location_name !== "string" || !item.location_name) return null;
  const type = item.location_type;
  if (!type || !KEEP.has(type)) return null;
  return {
    code: item.location_code,
    // VERBATIM. The provider matches this string literally and rejects
    // anything it did not produce, so it is never reformatted on the way in.
    name: item.location_name,
    type: type as CuratedLocation["type"],
    countryCode: iso,
    // Two segments: "Enid, Oklahoma". Repeating the country on every row of a
    // country-filtered picker is noise.
    label: formatLocationLabel(item.location_name, 2),
  };
}

function serialize(locations: CuratedLocation[]): string {
  return locations
    .map(
      (location) =>
        `  { code: ${location.code}, name: ${JSON.stringify(location.name)}, type: ${JSON.stringify(
          location.type,
        )}, countryCode: ${JSON.stringify(location.countryCode)}, label: ${JSON.stringify(
          location.label,
        )} },`,
    )
    .join("\n");
}

async function main(): Promise<void> {
  const countries: CuratedLocation[] = [];
  const locals: CuratedLocation[] = [];

  for (const { iso, code } of COUNTRIES) {
    process.stdout.write(`fetching ${iso}… `);
    const items = await fetchCountry(iso);

    // The country's own row, so its canonical NAME comes from the provider
    // rather than from a guess in this file.
    const own = items.find(
      (item) => item.location_code === code && item.location_type === "Country",
    );
    countries.push({
      code,
      name: own?.location_name ?? iso.toUpperCase(),
      type: "Country",
      countryCode: iso,
      label: formatLocationLabel(own?.location_name ?? iso.toUpperCase()),
    });

    const kept = items
      .map((item) => toCurated(item, iso))
      .filter((entry): entry is CuratedLocation => entry !== null)
      // Shortest canonical name first — a rough prominence proxy, and the one
      // the spec this is adapted from names as its picker's known weakness.
      // A population table would be better and is not worth a dependency.
      .sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name))
      .slice(0, CITIES_PER_COUNTRY);

    locals.push(...kept);
    process.stdout.write(`${items.length} rows, kept ${kept.length}\n`);
  }

  const all = [...countries, ...locals];
  const header = `// src/lib/locations/curated.ts
//
// GENERATED DATA. Edit scripts/generate-locations.ts and re-run it; do not
// hand-edit the table below.
//
//   npx tsx scripts/generate-locations.ts
//
// Every row is a real DataForSEO location_code and its canonical
// location_name, fetched from /v3/serp/google/locations/{iso} (free, cost 0).
// Neither can be guessed: a wrong code posts a paid SERP check for the wrong
// place and returns positions that look entirely plausible.
//
// Google refreshes its geotargets roughly quarterly; locationsAreStale() below
// reports when this table is worth regenerating.

import type { CuratedLocation } from "./types";

export const LOCATIONS_GENERATED_AT: string | null = ${JSON.stringify(
    new Date().toISOString(),
  )};

export const CURATED_LOCATIONS: readonly CuratedLocation[] = [
${serialize(all)}
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
`;

  writeFileSync(OUT, header, "utf8");
  console.log(`\\nwrote ${all.length} locations to ${OUT}`);
  console.log("Now run: npx tsc --noEmit && npm run test:vitest -- tests/locations.test.ts");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
