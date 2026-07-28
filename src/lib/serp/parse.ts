// src/lib/serp/parse.ts
//
// task_get/advanced result -> the normalized shapes we persist.
//
// DataForSEO types nearly every field as optional, so every read here is
// defensive: a missing title or domain must degrade to an empty string, never
// throw and fail an otherwise good check.

import type { SerpResultItem, SerpResults } from "./types";

const MAX_ORGANIC_ITEMS = 100;
const MAX_SNIPPET_CHARS = 400;

/** A single element inside `result[0].items` — organic or a SERP feature. */
interface RawSerpItem {
  type?: string;
  rank_group?: number;
  rank_absolute?: number;
  domain?: string;
  title?: string;
  url?: string;
  description?: string;
}

interface RawSerpResult {
  keyword?: string;
  check_url?: string;
  se_results_count?: number;
  item_types?: string[];
  items?: RawSerpItem[];
}

function str(value: unknown, max = 0): string {
  if (typeof value !== "string") return "";
  return max > 0 && value.length > max ? `${value.slice(0, max)}…` : value;
}

/** Host of a result URL, used when DataForSEO omits `domain`. */
function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Top-100 organic results, in rank order.
 *
 * `rank_group` is the organic-only rank (what a user calls "position 3");
 * `rank_absolute` counts every SERP element including features, so it is NOT
 * the number to show. Items missing both are dropped rather than shown at 0.
 */
export function parseOrganicItems(items: RawSerpItem[]): SerpResultItem[] {
  return items
    .filter((item) => item.type === "organic")
    .map((item) => {
      const url = str(item.url);
      return {
        position: item.rank_group ?? item.rank_absolute ?? 0,
        title: str(item.title),
        url,
        domain: str(item.domain) || domainFromUrl(url),
        snippet: str(item.description, MAX_SNIPPET_CHARS),
      };
    })
    .filter((item) => item.position > 0)
    .sort((a, b) => a.position - b.position)
    .slice(0, MAX_ORGANIC_ITEMS);
}

/**
 * Non-organic element types present on the SERP (featured_snippet,
 * people_also_ask, local_pack, …). `item_types` is DataForSEO's own summary
 * and is authoritative when present; otherwise derive it from the items.
 */
export function parseSerpFeatures(result: RawSerpResult): string[] {
  const declared = Array.isArray(result.item_types) ? result.item_types : [];
  const source = declared.length
    ? declared
    : (result.items ?? []).map((item) => item.type ?? "");

  return [...new Set(source.filter((type) => type && type !== "organic"))].sort();
}

export interface ParsedSerp {
  results: SerpResults;
  serpFeatures: string[];
  itemCount: number;
}

/** Full task_get/advanced `result` array -> what we store on the SerpCheck row. */
export function parseSerpTaskResult(result: unknown[]): ParsedSerp {
  const first = (result[0] ?? {}) as RawSerpResult;
  const items = parseOrganicItems(Array.isArray(first.items) ? first.items : []);

  return {
    results: {
      items,
      seResultsCount:
        typeof first.se_results_count === "number" ? first.se_results_count : undefined,
      checkUrl: str(first.check_url) || undefined,
    },
    serpFeatures: parseSerpFeatures(first),
    itemCount: items.length,
  };
}
