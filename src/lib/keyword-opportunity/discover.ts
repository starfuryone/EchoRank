// src/lib/keyword-opportunity/discover.ts
//
// Step 1 and step 2: find the commercial keywords a domain is in the market
// for, and attach the demand figures to them.
//
// TWO LABS CALLS, AND ONLY LABS. `keywords_for_site` is the wide net (what is
// this site relevant to) and `ranked_keywords` is the narrow one (what does it
// already place for). They overlap heavily and are merged rather than
// concatenated. Nothing here calls Google Ads, Google Trends, Bing or a
// clickstream provider — the volume, CPC, competition and twelve-month history
// all arrive inside these two responses, which is exactly why the ADS block in
// endpoints.ts must not be reached for despite its inviting comment.
//
// ── THE PARSING IS PURE AND THE I/O IS NOT ──────────────────────────────────
// Everything above discoverKeywords() is a pure function over a decoded
// response, so the merge, the noise filter and the working-set cut are testable
// against a fixture with no network and no database. That split is the reason
// the branded-keyword filter has a test at all.
//
// WHICH IS WHY ./metering.ts IS IMPORTED LAZILY, INSIDE THE FUNCTION. It pulls
// in Prisma at module scope, and a static import here would put a DATABASE_URL
// requirement on every one of those pure functions — the exact problem
// ai-monitor/cap.ts was split out of metering.ts to solve, and the seam
// ai-monitor/wizard/suggest.ts already uses for the same reason.
//
// ── THE WORKING SET IS CAPPED AT 100 ────────────────────────────────────────
// A domain can be relevant to thousands of keywords. Scoring all of them costs
// nothing extra upstream (the discovery calls are already paid for) but it
// produces a table nobody can read and a top-15 cut taken from a population
// whose tail is noise. The cut is by search volume rather than by score,
// deliberately: the score depends on rank and intent, which are attached later,
// so cutting by score here would mean the cut and the ranking disagreed about
// what they were ranking.

import { namesBrand } from "@/lib/ai-monitor/wizard/suggest";
import type { PlanType } from "@/generated/prisma";
import {
  LABS,
  type KeywordsForSiteItem,
  type RankedKeywordItem,
} from "@/lib/dataforseo/endpoints";
import { classifyIntent } from "./intent";
import { trendPercentFrom, type MonthlySearch } from "./trend";
import type { KeywordIntent } from "./score";

/** Keywords carried forward into scoring. See the header. */
export const WORKING_SET_LIMIT = 100;

/** Rows asked of each Labs endpoint. Cut to WORKING_SET_LIMIT after merging. */
export const DISCOVERY_LIMIT = 300;

/**
 * A keyword with everything the scorer needs except its rank.
 *
 * `googleRank` is deliberately absent: it comes from our own tracker in the
 * next step, not from either of these responses. A provider's idea of where a
 * domain ranks is a snapshot of a SERP we did not observe, and mixing it with
 * our tracked positions would make one column mean two things.
 */
export interface DiscoveredKeyword {
  keyword: string;
  monthlyVolume: number;
  cpcUsd: number;
  competition: number;
  trendPercent: number;
  intent: KeywordIntent;
  /** The provider's own intent reading, kept for the dogfood report. */
  providerIntent: string | null;
  /** Which endpoint this row came from, for the same reason. */
  source: "keywords_for_site" | "ranked_keywords";
}

/**
 * Navigational shapes that are not branded but are still nobody's opportunity.
 *
 * A person typing "login" or "customer service number" has already chosen a
 * vendor. There is no answer for an assistant to get wrong and no page worth
 * writing, so these are dropped before they can occupy one of the hundred
 * slots. Kept short on purpose — an aggressive list here silently deletes real
 * commercial demand, and the brand filter below is what does the heavy lifting.
 */
export const NAVIGATIONAL_PATTERNS: readonly RegExp[] = [
  /\b(log ?in|sign ?in|sign ?on)\b/i,
  /\b(customer (service|support|care)|contact (us|number)|phone number|help ?desk)\b/i,
  /\b(download|app store|play store|apk)\b/i,
  /\b(careers?|jobs?|hiring|salary|glassdoor)\b/i,
  /\b(stock|share price|ticker|investor relations|crunchbase)\b/i,
];

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Normalised comparison key, so casing and spacing cannot duplicate a row. */
export function keywordKey(keyword: string): string {
  return (keyword ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function buildKeyword(
  keyword: string,
  info: KeywordsForSiteItem["keyword_info"],
  providerIntent: string | null,
  source: DiscoveredKeyword["source"],
): DiscoveredKeyword | null {
  const text = (keyword ?? "").trim();
  if (text === "") return null;
  return {
    keyword: text,
    monthlyVolume: Math.max(0, Math.round(toNumber(info?.search_volume))),
    cpcUsd: Math.max(0, toNumber(info?.cpc)),
    competition: Math.min(1, Math.max(0, toNumber(info?.competition))),
    trendPercent: trendPercentFrom((info?.monthly_searches ?? []) as MonthlySearch[]),
    intent: classifyIntent(text, providerIntent),
    providerIntent,
    source,
  };
}

/** keywords_for_site items → DiscoveredKeyword. Flat shape: see the type. */
export function parseKeywordsForSite(
  items: readonly KeywordsForSiteItem[],
): DiscoveredKeyword[] {
  return items
    .map((item) =>
      buildKeyword(
        item.keyword ?? "",
        item.keyword_info,
        item.search_intent_info?.main_intent ?? null,
        "keywords_for_site",
      ),
    )
    .filter((row): row is DiscoveredKeyword => row !== null);
}

/**
 * ranked_keywords items → DiscoveredKeyword.
 *
 * NESTED UNDER keyword_data, unlike the above. A parser written for one reads
 * undefined from the other and every keyword comes back with zero volume, which
 * looks like a quiet market rather than a bug.
 */
export function parseRankedKeywords(items: readonly RankedKeywordItem[]): DiscoveredKeyword[] {
  return items
    .map((item) =>
      buildKeyword(
        item.keyword_data?.keyword ?? "",
        item.keyword_data?.keyword_info,
        item.keyword_data?.search_intent_info?.main_intent ?? null,
        "ranked_keywords",
      ),
    )
    .filter((row): row is DiscoveredKeyword => row !== null);
}

/**
 * Is this keyword noise for this brand?
 *
 * BRANDED KEYWORDS ARE DROPPED, and that is not the same rule as the prompt
 * filter even though it uses the same matcher. There, a brand name in the
 * PROMPT corrupts the measurement. Here, a brand name in the KEYWORD means the
 * searcher already knows the brand — "acmecrm pricing" is a customer, not an
 * opportunity, and an assistant naming the brand in response to its own name
 * measures nothing. Competitor-branded keywords ("hubspot alternatives") are
 * KEPT: those are the best opportunities the tool finds.
 */
export function isNoise(keyword: string, brandAliases: readonly string[]): boolean {
  const aliases = brandAliases.filter((alias) => alias?.trim());
  if (aliases.length > 0 && namesBrand(keyword, aliases)) return true;
  return NAVIGATIONAL_PATTERNS.some((pattern) => pattern.test(keyword));
}

/**
 * Merge the two endpoints' rows, plus the tenant's own tracked keywords.
 *
 * LATER SOURCES DO NOT OVERWRITE EARLIER ONES, they fill gaps. The two Labs
 * responses report the same demand figures for a shared keyword, but one may
 * carry a history the other lacks; taking the row with real volume over the row
 * with zero is what stops a duplicate silently zeroing a good keyword.
 */
export function mergeKeywords(
  ...sources: readonly (readonly DiscoveredKeyword[])[]
): DiscoveredKeyword[] {
  const merged = new Map<string, DiscoveredKeyword>();

  for (const source of sources) {
    for (const row of source) {
      const key = keywordKey(row.keyword);
      if (key === "") continue;
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, row);
        continue;
      }
      merged.set(key, {
        ...existing,
        monthlyVolume: Math.max(existing.monthlyVolume, row.monthlyVolume),
        cpcUsd: Math.max(existing.cpcUsd, row.cpcUsd),
        competition: Math.max(existing.competition, row.competition),
        // A trend of exactly 0 is "we could not tell" (see trend.ts), so a real
        // reading from the other source wins over it.
        trendPercent: existing.trendPercent !== 0 ? existing.trendPercent : row.trendPercent,
        providerIntent: existing.providerIntent ?? row.providerIntent,
      });
    }
  }

  return [...merged.values()];
}

/**
 * Drop the noise, then keep the hundred biggest.
 *
 * Ties break on the keyword text so the working set is stable across runs — an
 * unstable cut here would mean the same domain analysed twice scored a
 * different hundred keywords for no reason the customer could see.
 */
export function selectWorkingSet(
  keywords: readonly DiscoveredKeyword[],
  brandAliases: readonly string[],
  limit: number = WORKING_SET_LIMIT,
): DiscoveredKeyword[] {
  return keywords
    .filter((row) => !isNoise(row.keyword, brandAliases))
    .sort((a, b) => b.monthlyVolume - a.monthlyVolume || a.keyword.localeCompare(b.keyword))
    .slice(0, Math.max(0, limit));
}

/**
 * Why discovery produced no working set, in words.
 *
 * PURE AND TESTED, because the first dogfood run failed and the row could not
 * say which of three things had happened. The distinction is not cosmetic:
 * "the provider knows nothing about this domain" sends you to check the domain,
 * "the endpoints errored" sends you to check the integration, and "our filter
 * ate all of it" sends you here. One sentence for all three sent the first
 * diagnosis to the wrong place.
 */
export function discoveryFailureReason(
  domain: string,
  counts: DiscoveryCounts,
  failed: readonly string[],
): string {
  const detail =
    `keywords_for_site ${counts.keywordsForSite}, ranked_keywords ${counts.rankedKeywords}, ` +
    `tracked ${counts.tracked}, merged ${counts.merged}, after noise filter ${counts.afterNoise}`;

  if (failed.length > 0 && counts.merged === 0) {
    return `keyword discovery failed at ${failed.join(", ")} (${detail})`;
  }
  if (counts.merged > 0 && counts.afterNoise === 0) {
    return `all ${counts.merged} discovered keywords were filtered as branded or navigational (${detail})`;
  }
  return `keyword discovery returned nothing for ${domain} (${detail})`;
}

export interface DiscoveryRequest {
  domain: string;
  locationCode: number;
  languageCode: string;
  brandAliases: readonly string[];
  /** The tenant's own tracked keywords for this domain, merged in as a source. */
  trackedKeywords?: readonly string[];
}

/**
 * How the funnel narrowed, stage by stage.
 *
 * ADDED AFTER A FAILED DOGFOOD RUN THAT COULD NOT BE DIAGNOSED. The run billed
 * $0.024 of Labs calls and scored zero keywords, and the only thing the row
 * could say was "discovery returned nothing" — which is one of THREE very
 * different failures wearing the same sentence:
 *
 *   both endpoints errored          -> an integration bug or bad credentials
 *   both returned zero items        -> a domain the provider knows nothing about
 *   everything was filtered as noise-> our own brand filter ate the working set
 *
 * The third is the one that matters most and was the least visible: a domain
 * whose keyword profile is mostly its own brand name is exactly the shape that
 * discovery finds two hundred keywords for and keeps none of. Reporting that as
 * "returned nothing" points the next person at the provider instead of at us.
 */
export interface DiscoveryCounts {
  keywordsForSite: number;
  rankedKeywords: number;
  tracked: number;
  /** Distinct keywords after the three sources are merged. */
  merged: number;
  /** Survivors of the brand + navigational filter. */
  afterNoise: number;
  /** Carried into scoring, after the working-set cut. */
  kept: number;
}

export interface DiscoveryResult {
  keywords: DiscoveredKeyword[];
  costUsd: number;
  /** Endpoints that failed. A partial discovery still produces an analysis. */
  failed: string[];
  counts: DiscoveryCounts;
}

/**
 * Run discovery.
 *
 * ONE ENDPOINT FAILING DOES NOT FAIL THE ANALYSIS. The two calls answer
 * overlapping questions, so a domain with a `ranked_keywords` timeout still has
 * a usable keyword set from `keywords_for_site` — and refusing to produce one
 * would mean the tenant spent an analysis on nothing. Both failing is a real
 * failure and the caller sees an empty set.
 *
 * Tracked keywords are merged in with zero demand figures rather than being
 * bought: they are keywords the tenant already told us they care about, and
 * buying volume for them would be a third call for data the merge above will
 * fill from the other two whenever the keyword is genuinely relevant.
 */
export async function discoverKeywords(
  ctx: { tenantId: string; plan: PlanType },
  request: DiscoveryRequest,
): Promise<DiscoveryResult> {
  const failed: string[] = [];
  let costUsd = 0;

  // Lazy, so this module's pure half stays importable without a database.
  const { kofMeteredCall } = await import("./metering");

  const call = async <T>(path: string, task: Record<string, unknown>): Promise<T | null> => {
    try {
      const result = await kofMeteredCall<T>(ctx, path, task);
      costUsd += result.billing.costUsd;
      return result.data;
    } catch {
      // KofCapReachedError propagates from kofMeteredCall before the request;
      // it is caught by the runner, not here, because a cap is not a failed
      // endpoint. Anything reaching this catch is an endpoint that answered
      // badly, and is recorded as such.
      failed.push(path);
      return null;
    }
  };

  const base = {
    target: request.domain,
    location_code: request.locationCode,
    language_code: request.languageCode,
    limit: DISCOVERY_LIMIT,
    include_serp_info: false,
  };

  const forSite = await call<{ items?: KeywordsForSiteItem[] }[]>(LABS.keywordsForSite, base);
  const ranked = await call<{ items?: RankedKeywordItem[] }[]>(LABS.rankedKeywords, base);

  const fromSite = parseKeywordsForSite(forSite?.[0]?.items ?? []);
  const fromRanked = parseRankedKeywords(ranked?.[0]?.items ?? []);
  const fromTracked: DiscoveredKeyword[] = (request.trackedKeywords ?? []).map((keyword) => ({
    keyword,
    monthlyVolume: 0,
    cpcUsd: 0,
    competition: 0,
    trendPercent: 0,
    intent: classifyIntent(keyword, null),
    providerIntent: null,
    source: "keywords_for_site",
  }));

  const merged = mergeKeywords(fromSite, fromRanked, fromTracked);
  const afterNoise = merged.filter((row) => !isNoise(row.keyword, request.brandAliases));
  const keywords = selectWorkingSet(merged, request.brandAliases);

  return {
    keywords,
    costUsd,
    failed,
    counts: {
      keywordsForSite: fromSite.length,
      rankedKeywords: fromRanked.length,
      tracked: fromTracked.length,
      merged: merged.length,
      afterNoise: afterNoise.length,
      kept: keywords.length,
    },
  };
}
