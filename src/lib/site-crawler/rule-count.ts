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

import { RULES } from "@/lib/crawl-rules";

export const RULE_COUNT: number = RULES.length;

export function ruleCountLabel(n: number = RULE_COUNT): string {
  return n < 100 ? String(n) : `${Math.floor(n / 10) * 10}+`;
}
