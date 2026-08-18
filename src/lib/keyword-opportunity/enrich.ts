// src/lib/keyword-opportunity/enrich.ts
//
// Demand figures for a keyword set somebody handed us.
//
// ── WHY THIS EXISTS AT ALL ──────────────────────────────────────────────────
//
// A discovery run gets its demand data for free: keywords_for_site and
// ranked_keywords return `keyword_info` on every row they find, so discovery
// and enrichment are one call in ./discover.ts and there is no seam between
// them. A SEEDED run has no discovery step to ride along with — the keywords
// arrive from Keyword Explorer, chosen off the customer's own pages, and
// DataForSEO has never been asked about them.
//
// Without this, a seeded analysis would score every keyword at zero volume,
// zero CPC and a flat trend. v2's DEMAND pillar would collapse to intent alone
// and MOMENTUM would go null, which is not a worse score — it is a number that
// does not mean anything.
//
// ── keyword_overview, AND ON KOF'S OWN METER ────────────────────────────────
//
// LABS.keywordOverview takes an arbitrary keyword list and returns the same
// `keyword_info` shape the discovery endpoints do, so nothing downstream can
// tell where a row's demand came from. It is already used elsewhere in the app
// — /api/seo/v1/keywords/overview — but THAT call site is not reused and is not
// touched: it bills the pooled SEO research quota, and a domain analysis must
// spend from the domain-analysis budget. So this is KOF's own function, hitting
// the same endpoint through kofMeteredCall, under KEYWORD_OPPORTUNITY_CAP_USD.
//
// A cap reached here throws KofCapReachedError past the caller, exactly as it
// does in discovery: the runner turns that into FAILED with stoppedReason
// "cap_reached", and a FAILED run consumes nothing. That asymmetry — a DataForSEO
// cap fails the run, an AI cap completes it with partial coverage — is
// deliberate and predates this module. Enrichment is on the DataForSEO side of
// it, because a run with no demand data is not a partial result.

import type { PlanType } from "@/generated/prisma";
import { LABS, type KeywordOverviewItem } from "@/lib/dataforseo/endpoints";
import { classifyIntent } from "./intent";
import { trendPercentFrom, type MonthlySearch } from "./trend";
import type { DiscoveredKeyword } from "./discover";

/** Default market, mirroring ./runner.ts. */
const DEFAULT_LOCATION_CODE = 2840;

/**
 * DataForSEO caps keyword_overview at 700 keywords per task. The working set
 * is 100, so one call always suffices — this is a guard against a future cap
 * change, not a batching loop nobody would exercise.
 */
export const OVERVIEW_MAX_KEYWORDS = 700;

export interface EnrichRequest {
  /** Already normalised by ./seeds.ts. */
  seeds: readonly string[];
  locationCode?: number;
  languageCode: string;
}

export interface EnrichResult {
  keywords: DiscoveredKeyword[];
  costUsd: number;
  /** True when the endpoint answered badly. The run still has its keywords. */
  failed: boolean;
}

/**
 * One keyword_overview item -> the shape the scorer already consumes.
 *
 * The mapping is deliberately identical to ./discover.ts buildKeyword(), down
 * to the clamps: two producers of one type that round differently would show a
 * customer two different volumes for one keyword depending on how the analysis
 * was started.
 */
export function parseOverview(
  items: readonly KeywordOverviewItem[],
  requested: readonly string[],
): DiscoveredKeyword[] {
  const byKeyword = new Map<string, KeywordOverviewItem>();
  for (const item of items ?? []) {
    const kw = (item?.keyword ?? "").toLowerCase().trim();
    if (kw !== "") byKeyword.set(kw, item);
  }

  return requested.map((seed) => {
    const info = byKeyword.get(seed)?.keyword_info;
    const toNumber = (value: unknown): number => {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    };
    return {
      keyword: seed,
      monthlyVolume: Math.max(0, Math.round(toNumber(info?.search_volume))),
      cpcUsd: Math.max(0, toNumber(info?.cpc)),
      competition: Math.min(1, Math.max(0, toNumber(info?.competition))),
      trendPercent: trendPercentFrom((info?.monthly_searches ?? []) as MonthlySearch[]),
      intent: classifyIntent(seed, byKeyword.get(seed)?.search_intent_info?.main_intent ?? null),
      providerIntent: byKeyword.get(seed)?.search_intent_info?.main_intent ?? null,
      // Not a discovery endpoint. The provenance is the seed set itself, and
      // saying "keywords_for_site" here would be a lie the dogfood report reads.
      source: "seeded",
    } as DiscoveredKeyword;
  });
}

/**
 * Buy demand figures for the seeds. One Labs call, on KOF's meter.
 *
 * EVERY SEED COMES BACK, answered or not. A keyword DataForSEO has no data for
 * is a real finding — it is a phrase the customer's own pages use that nobody
 * searches — and dropping it would silently shrink a set the customer chose
 * and paid to have scored. It scores badly on volume, which is correct.
 */
export async function enrichSeeds(
  ctx: { tenantId: string; plan: PlanType },
  request: EnrichRequest,
): Promise<EnrichResult> {
  const seeds = request.seeds.slice(0, OVERVIEW_MAX_KEYWORDS);

  // Lazy, so this module's pure half stays importable without a database —
  // the same seam ./discover.ts uses and for the same reason.
  const { kofMeteredCall } = await import("./metering");

  try {
    const result = await kofMeteredCall<{ items?: KeywordOverviewItem[] }[]>(
      ctx,
      LABS.keywordOverview,
      {
        keywords: [...seeds],
        location_code: request.locationCode ?? DEFAULT_LOCATION_CODE,
        language_code: request.languageCode,
        include_serp_info: false,
      },
    );
    return {
      keywords: parseOverview(result.data?.[0]?.items ?? [], seeds),
      costUsd: result.billing.costUsd,
      failed: false,
    };
  } catch (err) {
    // KofCapReachedError is thrown BEFORE the request and must reach the
    // runner, which fails the analysis. Anything else is an endpoint that
    // answered badly: the seeds still get scored, on the signals we do have.
    const { KofCapReachedError } = await import("./metering");
    if (err instanceof KofCapReachedError) throw err;
    return { keywords: parseOverview([], seeds), costUsd: 0, failed: true };
  }
}
