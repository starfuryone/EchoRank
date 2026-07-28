// src/lib/rank-tracker/position.ts
//
// task_get/advanced result -> where the tracked domain ranks.
//
// Reuses the SERP Checker's parsers (parseOrganicItems / parseSerpFeatures) so
// there is exactly one definition of "position" in the codebase: rank_group,
// the organic-only rank, never rank_absolute.
//
// A domain that does not appear in the top 100 yields position `null`. That is
// a real result, not missing data — the caller stores it as a completed
// snapshot so the history chart shows the gap honestly instead of skipping the
// day and implying continuity.

import { parseOrganicItems, parseSerpFeatures } from "@/lib/serp/parse";

/** Shape of one element of the task_get `result` array. */
interface RawSerpResult {
  keyword?: string;
  item_types?: string[];
  items?: { type?: string; rank_group?: number; domain?: string; url?: string }[];
}

export interface ExtractedPosition {
  /** null = the domain is not in the top 100 for this keyword. */
  position: number | null;
  /** Best-ranking URL for the domain, or null when it does not rank. */
  url: string | null;
  serpFeatures: string[];
}

/** "https://WWW.Example.com/a" / "Example.com" -> "example.com". */
function hostOf(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";
  const withoutScheme = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  return withoutScheme.split(/[/?#]/)[0].split(":")[0].replace(/^www\./, "");
}

/**
 * True when a result belongs to the tracked domain.
 *
 * Subdomains count: a tenant tracking "example.com" wants to know that
 * "blog.example.com" ranks — reporting "not found" there would be wrong. The
 * check is suffix-on-a-dot-boundary so "notexample.com" never matches.
 */
export function domainMatches(resultDomain: string, target: string): boolean {
  const host = hostOf(resultDomain);
  const want = hostOf(target);
  if (!host || !want) return false;
  return host === want || host.endsWith(`.${want}`);
}

/**
 * Best (lowest) organic position for `domain` in a task_get result.
 *
 * parseOrganicItems already sorts by rank_group ascending, so the first match
 * is the best one — no extra min() pass, and the URL reported is the URL that
 * actually holds that position.
 */
export function extractPosition(result: unknown[], domain: string): ExtractedPosition {
  const first = (result[0] ?? {}) as RawSerpResult;
  const items = parseOrganicItems(Array.isArray(first.items) ? first.items : []);
  const serpFeatures = parseSerpFeatures(first);

  const hit = items.find((item) => domainMatches(item.domain || item.url, domain));

  return {
    position: hit ? hit.position : null,
    url: hit ? hit.url || null : null,
    serpFeatures,
  };
}
