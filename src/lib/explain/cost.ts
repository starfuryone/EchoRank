// src/lib/explain/cost.ts
//
// What one "why are they winning?" run costs, and where each number came from.
//
// The confirm dialog shows this BEFORE the first run, so it has to be a real
// estimate rather than a round number someone liked. Every constant below is
// either a price recorded in this repo's own fixtures, a price observed in
// production SeoApiCall rows, or a published rate card with the SKU named.
//
// ── Estimate, not a promise ────────────────────────────────────────────────
// DataForSEO bills from the response, never from a price table — see
// metering.ts, which records `billing.costUsd` off the envelope. These
// constants exist ONLY to tell the customer what they are about to spend. The
// SeoApiCall rows written afterwards carry the real figure, and ExplainReport
// .costUsd sums those, so a run that cost more than estimated reports what it
// actually cost.

/**
 * backlinks/summary/live, one domain.
 *
 * fixtures/dataforseo/v3-backlinks-summary-live.json records $0.024036. The
 * production SeoApiCall rows for feature="backlinks" average $0.024585 all
 * time. The higher of the two is used: an estimate that undershoots the bill is
 * worse than one that overshoots it.
 */
export const BACKLINKS_SUMMARY_USD = 0.024585;

/**
 * Google Places, Place Details, Pro SKU — $20 per 1,000 requests.
 *
 * The SKU is fixed by the field mask in src/lib/signals/competitors.ts:
 * `rating` and `userRatingCount` are Pro fields, and the comment there says so.
 * Unlike the DataForSEO figure this is a published rate rather than an observed
 * one, because Places returns no cost in its response — which is also why the
 * SeoApiCall row this feature writes for a Places call has to carry a constant.
 * If Google moves the rate card, this is the one line to change.
 */
export const PLACES_DETAILS_USD = 0.02;

/**
 * The av-visibility sidecar and the entity HEAD checks cost nothing upstream.
 * Named rather than left implicit so the estimate below reads as a complete
 * accounting of all six gatherers rather than as four of them.
 */
export const SIDECAR_AUDIT_USD = 0;
export const ENTITY_CHECK_USD = 0;

/** One line of the estimate the confirm dialog itemises. */
export interface CostLine {
  /** Matches a FactorKey where one call maps to one factor. */
  key: "authority" | "reviews" | "site" | "entities";
  /** How many upstream calls this line buys. */
  calls: number;
  unitUsd: number;
  totalUsd: number;
  /** True when the call writes a SeoApiCall row and counts against the cap. */
  metered: boolean;
}

export interface CostEstimate {
  lines: CostLine[];
  /** Everything, including the free lines. */
  totalUsd: number;
  /** The part that counts against the tenant's monthly DataForSEO USD cap.
   *  Places is metered into SeoApiCall too, but under its own feature — see
   *  the note in gather.ts on why it still counts here. */
  meteredUsd: number;
}

/**
 * What a run will cost, given what it is actually able to do.
 *
 * Both flags matter: a rival with no Places id buys no Places calls, and a
 * tenant with no configured Places key buys none either. Quoting $0.089 to
 * someone who is about to spend $0.049 is the same failure as quoting too low.
 */
export function estimateRunCost(opts: {
  /** Both the rival's and the tenant's own domain are looked up. */
  domainsToPrice: number;
  /** Places is only bought when there is an id to look up AND a key to use. */
  placesLookups: number;
}): CostEstimate {
  const { domainsToPrice, placesLookups } = opts;

  const lines: CostLine[] = [
    {
      key: "authority",
      calls: domainsToPrice,
      unitUsd: BACKLINKS_SUMMARY_USD,
      totalUsd: round6(domainsToPrice * BACKLINKS_SUMMARY_USD),
      metered: true,
    },
    {
      key: "reviews",
      calls: placesLookups,
      unitUsd: PLACES_DETAILS_USD,
      totalUsd: round6(placesLookups * PLACES_DETAILS_USD),
      metered: true,
    },
    { key: "site", calls: 2, unitUsd: SIDECAR_AUDIT_USD, totalUsd: 0, metered: false },
    { key: "entities", calls: 3, unitUsd: ENTITY_CHECK_USD, totalUsd: 0, metered: false },
  ];

  return {
    lines,
    totalUsd: round6(lines.reduce((sum, line) => sum + line.totalUsd, 0)),
    meteredUsd: round6(
      lines.filter((line) => line.metered).reduce((sum, line) => sum + line.totalUsd, 0),
    ),
  };
}

/** Six decimals, matching SeoApiCall.costUsd's Decimal(10,6). Rounding here
 *  rather than at the call site keeps the estimate and the stored cost in the
 *  same precision, so they can be compared without a tolerance. */
export function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
