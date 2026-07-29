// src/lib/site-explorer/parse.ts
//
// DataForSEO result arrays -> our persisted section shapes. Pure functions, no
// I/O, so tests/site-explorer-parse.test.ts can run them against the recorded
// fixtures with no network and no database.
//
// Everything upstream is optional (DataForSEO types almost every field as
// nullable), so every field lands through a coercion helper rather than a cast.
// Zero invented numbers: a missing metric becomes 0 / "" / null, never a guess.

import type {
  CompetitorsDomainItem,
  DomainRankOverviewItem,
  RankedKeywordItem,
} from "@/lib/dataforseo/endpoints";
import type {
  CompetitorRow,
  CompetitorsSection,
  OverviewSection,
  RankedKeywordRow,
  RankedKeywordsSection,
} from "./types";

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}


export function parseOverview(
  result: { items?: DomainRankOverviewItem[] }[] | undefined,
): OverviewSection {
  // The metrics sit at result[0].items[0].metrics — a level below the result
  // element itself. Reading result[0].metrics silently yields all zeros for a
  // domain with six figures of traffic, so this nesting is load-bearing.
  const organic = result?.[0]?.items?.[0]?.metrics?.organic ?? {};

  return {
    etv: num(organic.etv),
    keywordCount: num(organic.count),
    estimatedPaidTrafficCost: num(organic.estimated_paid_traffic_cost),
    // DataForSEO reports ten buckets; four of them (51-60 … 91-100) are noise
    // on their own, so page 3+ is collapsed into one "21-100" column.
    distribution: {
      pos1: num(organic.pos_1),
      pos2_3: num(organic.pos_2_3),
      pos4_10: num(organic.pos_4_10),
      pos11_20: num(organic.pos_11_20),
      pos21_100:
        num(organic.pos_21_30) +
        num(organic.pos_31_40) +
        num(organic.pos_41_50) +
        num(organic.pos_51_60) +
        num(organic.pos_61_70) +
        num(organic.pos_71_80) +
        num(organic.pos_81_90) +
        num(organic.pos_91_100),
    },
  };
}

export function parseRankedKeywords(
  result: { items?: RankedKeywordItem[]; total_count?: number }[] | undefined,
): RankedKeywordsSection {
  const first = result?.[0];
  const items: RankedKeywordRow[] = (first?.items ?? [])
    .map((item): RankedKeywordRow => {
      const serpItem = item.ranked_serp_element?.serp_item;
      return {
        keyword: str(item.keyword_data?.keyword),
        position: num(serpItem?.rank_group),
        searchVolume: num(item.keyword_data?.keyword_info?.search_volume),
        etv: num(serpItem?.etv),
        url: str(serpItem?.url),
      };
    })
    // A row with no keyword text is unrenderable — drop it rather than show a
    // blank cell with a real position next to it.
    .filter((row) => row.keyword.length > 0);

  return { items, totalCount: num(first?.total_count) };
}

export function parseCompetitors(
  result: { items?: CompetitorsDomainItem[] }[] | undefined,
  /** The analyzed domain — DataForSEO returns it as a row against itself. */
  target: string,
): CompetitorsSection {
  const items: CompetitorRow[] = (result?.[0]?.items ?? [])
    .map((item): CompetitorRow => {
      return {
        domain: str(item.domain).toLowerCase().replace(/^www\./, ""),
        intersections: num(item.intersections),
        avgPosition: num(item.avg_position),
        // competitor_metrics = what THEY pull from the shared keywords. `metrics`
        // is the target's own traffic on those keywords (near-identical on every
        // row, so useless as a column) — it is the fallback only, not the source.
        etv: num(
          item.competitor_metrics?.organic?.etv ??
            item.metrics?.organic?.etv ??
            item.full_domain_metrics?.organic?.etv,
        ),
      };
    })
    .filter((row) => row.domain.length > 0 && row.domain !== target);

  return { items };
}

/**
 * Site Explorer's Backlinks card. The parser itself lives in
 * dataforseo/backlinks-summary.ts because the dedicated Backlinks tool reads
 * the same endpoint — one definition, so the two tools can never disagree
 * about the same domain. Re-exported under the original name to keep this
 * module's public surface stable.
 */
export { parseBacklinksSummary as parseBacklinks } from "@/lib/dataforseo/backlinks-summary";
