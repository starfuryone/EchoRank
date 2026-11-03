// src/lib/site-crawler/legacy-map.ts
//
// Pre-3a crawl_issues rows carry one of 21 legacy `type`s and no ruleId.
// This maps each to the rule that replaced it, so old crawls render in the
// Issues tab and count in the summary fallback without a data backfill.
// Thresholds moved (title min 15 → 30, meta max 160 → 155, thin content
// 150 → 200 words), so an old row and a new verdict can disagree at the
// edges; the old row is shown as what it was found as.
//
// Dependency-free on purpose: the Issues tab (a Client Component) reads it.

import type { RuleKind, RulePriority } from "@/lib/crawl-rules";

export const LEGACY_RULE: Readonly<Record<string, string>> = {
  HTTP_4XX: "response_codes.internal_4xx",
  HTTP_5XX: "response_codes.internal_5xx",
  TITLE_MISSING: "page_titles.missing",
  H1_MISSING: "h1.missing",
  NOINDEX: "directives.noindex",
  TITLE_TOO_LONG: "page_titles.over_60_chars",
  TITLE_TOO_SHORT: "page_titles.under_30_chars",
  META_DESC_MISSING: "meta_description.missing",
  META_DESC_TOO_LONG: "meta_description.over_155_chars",
  MULTIPLE_H1: "h1.multiple",
  CANONICAL_MISMATCH: "canonicals.canonicalised",
  REDIRECT_CHAIN: "response_codes.redirect_chain",
  THIN_CONTENT: "content.low_word_count",
  BLOCKED_BY_ROBOTS: "response_codes.blocked_by_robots",
  CANONICAL_MISSING: "canonicals.missing",
  DUPLICATE_CONTENT: "content.exact_duplicate",
  DUPLICATE_TITLE: "page_titles.duplicate",
  DUPLICATE_META_DESC: "meta_description.duplicate",
  REDIRECT_LOOP: "response_codes.redirect_loop",
  // Phase 2's "nothing links here" has no exact 3a twin; orphan is the nearest.
  NO_INLINKS: "links.orphan",
  ORPHAN_PAGE: "links.orphan",
};

/** The rule id of any crawl_issues row, old or new; null for an unknown legacy type. */
export function ruleIdOf(row: { ruleId?: string | null; type: string }): string | null {
  return row.ruleId ?? LEGACY_RULE[row.type] ?? null;
}

export const SEVERITY_OF_KIND: Readonly<Record<RuleKind, string>> = {
  issue: "ERROR",
  warning: "WARNING",
  opportunity: "NOTICE",
};

export const PRIORITY_RANK: Readonly<Record<RulePriority, number>> = { high: 0, medium: 1, low: 2 };
