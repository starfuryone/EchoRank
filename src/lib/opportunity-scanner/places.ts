// src/lib/opportunity-scanner/places.ts
//
// The scanner's one optional, metered upstream call: a Google Places text
// search per prospect, to find out whether the business has a Maps listing and
// how it is doing there.
//
// ── OFF BY DEFAULT, and that default is the design ──────────────────────────
// This is the only thing in the whole tool that spends money, and it spends it
// per row — a 1,000-domain batch with the box ticked is $32. So:
//
//   - ScanBatch.placesEnabled defaults false in the schema.
//   - The submit form shows the dollar estimate BEFORE the agency can submit
//     (estimateBatchUsd below is what it renders).
//   - The cap is checked BEFORE the call is built, per row, not once per batch.
//
// That last one matters more than it looks. Checking once at submit would let a
// batch that started under the cap run a thousand calls past it, because the
// spend it is checking against is the spend the batch itself is creating. The
// check has to happen inside the loop, against a figure that includes what this
// batch has already bought.
//
// ── Everything fails to "no listing", never to an error ─────────────────────
// Places not configured, cap reached, HTTP 500, no match, a match with no
// rating — all of them produce `null`, and a null renders as an omitted section
// in the PDF and an empty cell in the CSV. An agency scanning SaaS companies
// gets a thousand nulls and that is the CORRECT answer, not a degraded one:
// none of those businesses are on Google Maps. Turning any of these into a row
// failure would fail most of a normal batch.

import { logger } from "@/infrastructure/observability/logger";
import {
  spentThisMonth as defaultSpent,
  monthlyCapUsd as defaultCap,
  recordCall,
} from "@/lib/dataforseo/metering";
import { searchPlaces, placesConfigured } from "@/lib/signals/competitors";
import { PLACES_TEXTSEARCH_USD } from "@/lib/explain/cost";
import { brandQuery, estimateBatchUsd } from "./estimate";

// Re-exported so callers import the estimate from the module that owns the
// Places call, while the arithmetic itself stays Prisma-free and testable.
// Same arrangement as ai-lens/url.ts and registrable-domain.ts.
export { brandQuery, estimateBatchUsd };

/** What a scan row stores about a prospect's Google listing. */
export interface PlaceStanding {
  name: string;
  rating: number | null;
  reviewCount: number | null;
}

export interface PlaceLookupResult {
  place: PlaceStanding | null;
  /** Real dollars spent by THIS call. Zero when nothing left the building. */
  costUsd: number;
  /** Why there is no place, for the log. Never shown to a customer. */
  reason?: "disabled" | "not_configured" | "cap_reached" | "no_match" | "upstream_failed";
}

const NOTHING: PlaceLookupResult = { place: null, costUsd: 0 };


/**
 * One prospect's Google standing, metered.
 *
 * The cap check reads spend that includes every SeoApiCall row this batch has
 * already written, because recordCall commits before the next row runs. That is
 * what makes a per-row check meaningful rather than a thousand reads of the
 * same stale number.
 */
export async function lookupPlace(input: {
  tenantId: string;
  domain: string;
  enabled: boolean;
  spent?: (tenantId: string) => Promise<number>;
  cap?: (tenantId: string) => Promise<number>;
  search?: typeof searchPlaces;
}): Promise<PlaceLookupResult> {
  const {
    tenantId,
    domain,
    enabled,
    spent = defaultSpent,
    cap = defaultCap,
    search = searchPlaces,
  } = input;

  if (!enabled) return { ...NOTHING, reason: "disabled" };
  if (!placesConfigured()) return { ...NOTHING, reason: "not_configured" };

  const query = brandQuery(domain);
  if (!query) return { ...NOTHING, reason: "no_match" };

  // ── The cap, checked BEFORE the request is built ────────────────────────
  const [spentUsd, capUsd] = await Promise.all([spent(tenantId), cap(tenantId)]);
  if (spentUsd >= capUsd) {
    logger.warn(
      { tenantId, domain, spentUsd, capUsd },
      "opportunity-scanner: monthly budget reached, Places lookup skipped",
    );
    return { ...NOTHING, reason: "cap_reached" };
  }

  let candidates: Awaited<ReturnType<typeof searchPlaces>>;
  let ok = true;
  try {
    candidates = await search(query);
  } catch (err) {
    logger.warn({ tenantId, domain, err }, "opportunity-scanner: Places search threw");
    candidates = [];
    ok = false;
  }

  // BILLED EITHER WAY. A request left the building, so a SeoApiCall row that
  // omitted it would make the cap under-count real spend — the same rule
  // gatherReviews follows. `ok` records whether it was useful, not whether it
  // was billed.
  await recordCall({
    tenantId,
    feature: "local_seo",
    path: "places.googleapis.com/v1/places:searchText",
    costUsd: PLACES_TEXTSEARCH_USD,
    ok,
  });

  if (!ok) {
    return { place: null, costUsd: PLACES_TEXTSEARCH_USD, reason: "upstream_failed" };
  }

  // FIRST RESULT ONLY. searchPlaces returns up to five and there is no way to
  // tell from a domain stem which of five same-named businesses is the right
  // one, so taking the top match is the honest ceiling on what this can know.
  // Attaching the wrong company's 2-star rating to a prospect would be worse
  // than attaching nothing.
  const top = candidates[0];
  if (!top) {
    return { place: null, costUsd: PLACES_TEXTSEARCH_USD, reason: "no_match" };
  }

  return {
    place: {
      name: top.name,
      rating: typeof top.rating === "number" ? top.rating : null,
      reviewCount: typeof top.reviewCount === "number" ? top.reviewCount : null,
    },
    costUsd: PLACES_TEXTSEARCH_USD,
  };
}
