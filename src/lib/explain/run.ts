// src/lib/explain/run.ts
//
// One run of the Competitor Reverse Engineer: gather, rank, persist.
//
// Kept out of the route handler so the whole pipeline is testable without a
// request, and so the route is left doing only what a route should — auth,
// plan gating, tenant scoping, input validation.
//
// ── The six gatherers run concurrently, on purpose ─────────────────────────
// They share no state and two of them are network-bound with multi-second
// tails (the sidecar audit and three entity HEAD checks). Run in sequence a
// report would take the sum of six timeouts; run together it takes the slowest.
// Each gatherer swallows its own failures into an outcome, so Promise.all here
// cannot reject on one bad provider — which is the property that makes the
// concurrency safe rather than merely fast.

import { logger } from "@/infrastructure/observability/logger";
import {
  gatherAuthority,
  gatherEntities,
  gatherReviews,
  gatherSite,
  gatherSovGaps,
  gatherRivalSources,
} from "./gather";
import { buildFactors } from "./factors";
import { saveReport } from "./store";
import { round6 } from "./cost";
import type { ExplainGather, ExplainReportView } from "./types";

export interface RunExplainInput {
  tenantId: string;
  brandProfileId: string;
  /** The tenant's own brand, as SOV and the citation rollup spell it. */
  brandName: string;
  /** The tenant's own registrable domain, or null when the brand profile has
   *  no website — in which case the paired "you" half of every domain factor
   *  is absent and the factors say so. */
  yourDomain: string | null;
  rivalName: string;
  rivalDomain: string;
  /** Places ids, when either side has a Google Business listing. Null is the
   *  ordinary case for a SaaS rival. */
  rivalPlaceId?: string | null;
  yourPlaceId?: string | null;
}

/**
 * Gather everything, rank it, store it, hand back the view.
 *
 * The caller has already decided a run is permitted — freshness and plan are
 * the route's business, not this function's. Calling it always spends money.
 */
export async function runExplain(input: RunExplainInput): Promise<ExplainReportView> {
  const {
    tenantId,
    brandProfileId,
    brandName,
    yourDomain,
    rivalName,
    rivalDomain,
    rivalPlaceId = null,
    yourPlaceId = null,
  } = input;

  const [sovGaps, rivalSources, reviews, site, authority, entities] = await Promise.all([
    gatherSovGaps({ tenantId, brandProfileId, brandName, rivalName }),
    gatherRivalSources({ tenantId, brandProfileId, rivalName }),
    gatherReviews({ tenantId, rivalPlaceId, yourPlaceId }),
    gatherSite({ tenantId, rivalDomain, yourDomain }),
    gatherAuthority({ tenantId, rivalDomain, yourDomain }),
    gatherEntities({ rivalName, brandName }),
  ]);

  const gather: ExplainGather = { sovGaps, rivalSources, reviews, site, authority, entities };

  // What the run ACTUALLY spent, summed from the outcomes rather than from the
  // estimate in cost.ts. A cached upstream call contributes zero, so a second
  // rival compared in the same week honestly reports the smaller bill.
  const costUsd = round6(
    Object.values(gather).reduce((sum, outcome) => sum + outcome.costUsd, 0),
  );

  const factors = await buildFactors(gather, { tenantId, brandProfileId });

  logger.info(
    {
      tenantId,
      brandProfileId,
      rivalDomain,
      costUsd,
      measured: factors.filter((factor) => !factor.unavailable).length,
      unavailable: factors
        .filter((factor) => factor.unavailable)
        .map((factor) => `${factor.factor}:${factor.unavailable}`),
    },
    "explain: report generated",
  );

  return saveReport({ tenantId, rivalDomain, rivalName, brandProfileId, factors, costUsd });
}
