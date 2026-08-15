// src/lib/opportunity-scanner/estimate.ts
//
// The two pure functions the Places lookup needs, in a module with NO Prisma.
//
// EXTRACTED FROM places.ts, not copied, for the reason
// src/lib/registrable-domain.ts gives in its own header: places.ts imports
// dataforseo/metering, which constructs a Prisma client at module scope, so
// anything importing the price estimate was dragging a database client and a
// DATABASE_URL requirement along with it. That made a pure arithmetic function
// untestable without a database — and the estimate is the number a customer is
// quoted before they spend money, which is exactly the thing that should be
// cheap to test.
//
// places.ts re-exports both, so there is still one copy and no caller had to
// change.

import { PLACES_TEXTSEARCH_USD } from "@/lib/explain/cost";

/**
 * What a batch will cost at submit time.
 *
 * Rounded UP to the cent, because a quote that undershoots the bill is worse
 * than one that overshoots it — the same rule explain/cost.ts applies to its
 * DataForSEO figures.
 */
export function estimateBatchUsd(rowCount: number, placesEnabled: boolean): number {
  if (!placesEnabled || rowCount <= 0) return 0;
  return Math.ceil(rowCount * PLACES_TEXTSEARCH_USD * 100) / 100;
}

/**
 * The Places search query for one prospect.
 *
 * THE REGISTRABLE DOMAIN, MINUS ITS SUFFIX, is the brand guess —
 * "acme-dental" out of "acme-dental.com", hyphens to spaces. Crude, and
 * deliberately not cleverer: the alternative is fetching the site's <title> to
 * extract a brand name, which is a second HTTP request per row to improve a
 * lookup that is off by default. Places' text search is fuzzy enough to find a
 * local business from the domain stem when one exists, and when one does not
 * exist no query would have found it.
 */
export function brandQuery(domain: string): string {
  const stem = (domain ?? "").split(".")[0] ?? "";
  return stem.replace(/[-_]+/g, " ").trim();
}
