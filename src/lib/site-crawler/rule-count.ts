// src/lib/site-crawler/rule-count.ts
//
// How many rules the crawler checks, for marketing copy. DERIVED, never typed:
// the number comes from the registry, so adding a rule moves every page that
// quotes it, and a test fails any page that prints a count of its own.
//
// Shown rounded DOWN to the nearest ten with a "+" once there are 100 or more
// (183 → "180+"), the bare number below that. Never rounded up: "190+" with
// 183 rules would be a claim the product does not meet.
//
// Server-side: the registry pulls the hreflang code lists along with it, so a
// Client Component takes the label as a prop rather than importing this.

import { RULES, type RuleFamily } from "@/lib/crawl-rules";
import { flag, type FlagName } from "@/lib/flags";

/**
 * Phase 4d: families that only exist with an integration. They stay out of
 * every public count and of the public issue library until the integration
 * ships in production.
 */
export const FAMILY_FLAGS: Partial<Record<RuleFamily, FlagName>> = {
  search_console: "crawl.gsc",
  analytics: "crawl.ga4",
  backlinks: "crawl.backlinks",
  amp: "crawl.amp",
};

export function familyIsPublic(f: RuleFamily): boolean {
  const name = FAMILY_FLAGS[f];
  return name === undefined || flag(name);
}

export const PUBLIC_RULES = RULES.filter((r) => familyIsPublic(r.family));
export const RULE_COUNT: number = PUBLIC_RULES.length;

export function ruleCountLabel(n: number = RULE_COUNT): string {
  return n < 100 ? String(n) : `${Math.floor(n / 10) * 10}+`;
}
