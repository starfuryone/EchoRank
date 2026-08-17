// src/lib/keyword-opportunity/intent.ts
//
// Which of the five commercial intents a keyword carries.
//
// ── WHY THE PROVIDER'S OWN INTENT IS NOT ENOUGH ─────────────────────────────
//
// DataForSEO Labs returns `search_intent_info.main_intent`, and it has FOUR
// values: informational, navigational, commercial, transactional. The scorer
// has FIVE, and the two it adds — product_comparison (90) and solution_seeking
// (80) — have no provider equivalent. Taking the provider's taxonomy verbatim
// would leave two of the five intent scores permanently unassignable: dead
// branches in production that the fixtures exercise and no real keyword ever
// reaches.
//
// That matters beyond the 15% the component is worth, because intent also
// selects the prompt template. "HubSpot alternatives" and "how do we choose a
// CRM" are both `commercial` to the provider and are completely different
// questions to ask an assistant — one wants a head-to-head, the other wants
// advice. Collapsing them would make the AI test measure the wrong thing.
//
// ── DETERMINISTIC, AND NO MODEL CALL ────────────────────────────────────────
//
// Patterns decide; the provider's intent is one input signal, consulted when no
// pattern matches. An LLM classification pass would cost a call per keyword
// across a hundred keywords, be unreproducible between runs, and put a model in
// the path of a number the customer is going to argue with. Crude and stable
// beats clever and drifting for a sort key — the same call ai-monitor's
// categoryMatch() and topicalRelevance() make, and for the same reason.
//
// ── ORDER IS THE RULE ───────────────────────────────────────────────────────
//
// First match wins, most specific first, and the order is load-bearing:
// "cheapest CRM alternatives" is a comparison that happens to mention price,
// not a purchase. Reordering these changes classifications; the tests pin the
// cases where two patterns overlap.

import type { KeywordIntent } from "./score";

/** Lowercased, punctuation reduced to spaces, so \b behaves predictably. */
export function normalizeKeyword(keyword: string): string {
  return (keyword ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * The ordered rules. Exported so a test can assert the order rather than infer
 * it, and so the dogfood report can name which rule fired.
 */
export const INTENT_RULES: readonly { intent: KeywordIntent; pattern: RegExp }[] = [
  // Head-to-head, or looking for a replacement. FIRST, because these very
  // often also carry a price or a superlative word and are neither.
  {
    intent: "product_comparison",
    pattern:
      /\b(vs|versus|compared? (to|with)|comparison|alternatives?|alternative to|instead of|switch from|or\b.*\b(better|best))\b/,
  },
  // Somebody with a problem rather than a shortlist. Before transactional,
  // because "how much does X cost" is advice-shaped, not purchase-shaped.
  {
    intent: "solution_seeking",
    pattern:
      /\b(how (to|do|does|can|much)|why (is|are|does|do)|what (to|should)|best way|guide|checklist|tutorial|steps?|fix|troubleshoot|problem|issue|struggling|migrat\w*|set ?up|integrat\w*)\b/,
  },
  // Ready to buy. Price words, trial words, purchase verbs.
  {
    intent: "transactional",
    pattern:
      /\b(buy|purchase|order|pricing|price|prices|cost|costs|cheap|cheapest|affordable|budget|discount|deal|coupon|free trial|trial|demo|sign ?up|subscribe|plans?)\b/,
  },
  // Building a shortlist. Superlatives, reviews, and the "X for Y" segment
  // shape that is the commonest B2B research query there is.
  {
    intent: "commercial_investigation",
    pattern:
      /\b(best|top|leading|review|reviews|rated|recommended|software|tool|tools|platform|platforms|vendor|vendors|service|services|solution|solutions|company|companies|for (small|large|enterprise|startups?|agencies|teams?|business(es)?|nonprofits?))\b/,
  },
];

/**
 * The provider's four-value taxonomy, mapped onto ours.
 *
 * NAVIGATIONAL BECOMES INFORMATIONAL, not a class of its own. Someone typing a
 * brand name to reach a site has no gap for this tool to find — they already
 * know who they want — so it lands on the default 40 rather than earning a
 * commercial score. `commercial` maps to commercial_investigation because that
 * is the shortlist-building intent it describes; the two classes the provider
 * cannot express are reached by pattern only.
 */
export const PROVIDER_INTENT_MAP: Readonly<Record<string, KeywordIntent>> = {
  transactional: "transactional",
  commercial: "commercial_investigation",
  navigational: "informational",
  informational: "informational",
};

export interface IntentClassification {
  intent: KeywordIntent;
  /** Which rule decided, for the dogfood report and for debugging a surprise. */
  source: "pattern" | "provider" | "default";
  /** The matched rule's intent name, when source is "pattern". */
  matchedRule: KeywordIntent | null;
}

/**
 * Classify one keyword.
 *
 * Patterns first, the provider's own reading second, informational last. The
 * fallback is deliberately the LOWEST-scoring class: a keyword we cannot
 * classify is not one to spend a customer's attention on, and guessing
 * "commercial" to be generous would inflate every unrecognised long tail into
 * the recommendations.
 */
export function classifyIntentDetailed(
  keyword: string,
  providerIntent?: string | null,
): IntentClassification {
  const normalized = normalizeKeyword(keyword);

  for (const rule of INTENT_RULES) {
    if (rule.pattern.test(normalized)) {
      return { intent: rule.intent, source: "pattern", matchedRule: rule.intent };
    }
  }

  const mapped = providerIntent ? PROVIDER_INTENT_MAP[providerIntent.toLowerCase().trim()] : undefined;
  if (mapped) return { intent: mapped, source: "provider", matchedRule: null };

  return { intent: "informational", source: "default", matchedRule: null };
}

/** The intent alone, for callers that do not need the provenance. */
export function classifyIntent(keyword: string, providerIntent?: string | null): KeywordIntent {
  return classifyIntentDetailed(keyword, providerIntent).intent;
}
