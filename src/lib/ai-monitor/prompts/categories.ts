// src/lib/ai-monitor/prompts/categories.ts
//
// The prompt taxonomy, and the arithmetic that turns a prompt's shape into a
// commercial value.
//
// PURE. No Prisma, no LLM. The generator proposes prompts and the classifier
// labels them, but the NUMBER that decides which twenty of two hundred
// candidates a tenant pays to track is computed here, deterministically, from
// the label. That matters because the alternative — asking a model to score
// its own suggestions 0-100 — produces a number that drifts between calls, so
// the same prompt would rank differently on Tuesday and nobody could explain
// why. A model is good at "is this a comparison question"; it is not a reliable
// pricing analyst.
//
// THE EXISTING VOCABULARY IS EXTENDED, NOT REPLACED. TrackedPrompt.category
// already carries ten values written by the setup wizard (see the schema's
// comment on the column). Three are added here for question shapes the wizard
// never generated — how-to, problem-solving and industry education — and every
// original value keeps its meaning, so no stored row has to be migrated or
// silently reinterpreted.

/** Every category a tracked prompt can carry. */
export const PROMPT_CATEGORIES = [
  "DISCOVERY",
  "RECOMMENDATION",
  "COMPARISON",
  "ALTERNATIVES",
  "PRICING",
  "USE_CASE",
  "FEATURES",
  "TRUST",
  "PURCHASE",
  "BRAND_AWARENESS",
  "HOW_TO",
  "PROBLEM_SOLVING",
  "EDUCATION",
  "LOCAL",
] as const;

export type PromptCategory = (typeof PROMPT_CATEGORIES)[number];

export function isPromptCategory(value: string): value is PromptCategory {
  return (PROMPT_CATEGORIES as readonly string[]).includes(value);
}

/** What the asker is trying to do. Matches the existing `intent` column. */
export const PROMPT_INTENTS = ["commercial", "research", "navigational"] as const;
export type PromptIntent = (typeof PROMPT_INTENTS)[number];

export function isPromptIntent(value: string): value is PromptIntent {
  return (PROMPT_INTENTS as readonly string[]).includes(value);
}

export interface CategorySpec {
  category: PromptCategory;
  /** Shown in the wizard and the prompt table. */
  label: string;
  /** Handed to the generator as the shape of question to write. */
  guidance: string;
  /**
   * 0-100 before intent and demand adjust it.
   *
   * THE RANKING IS THE POINT, not the absolute values. A buyer typing "best X
   * for Y" is further down the funnel than one typing "what is X", and being
   * absent from the first costs a sale this quarter while being absent from the
   * second costs awareness. PURCHASE and PRICING therefore top the scale;
   * EDUCATION sits at the bottom without being zero, because category-defining
   * answers are how a brand becomes the default recommendation later.
   */
  baseValue: number;
  /** The intent this shape almost always carries. */
  defaultIntent: PromptIntent;
}

export const CATEGORY_SPECS: Readonly<Record<PromptCategory, CategorySpec>> = {
  LOCAL: {
    category: "LOCAL",
    label: "Local and near-me",
    guidance:
      'Someone asking for a provider in a named place: "near me", a city, a region. Only ' +
      "worth asking when the business actually serves a geography rather than the whole web.",
    // Below PURCHASE and RECOMMENDATION, above DISCOVERY: a local question is
    // usually late-funnel — nobody asks who is nearby out of curiosity — but it
    // is narrower than a national recommendation, so it wins fewer buyers.
    baseValue: 88,
    defaultIntent: "commercial",
  },
  PURCHASE: {
    category: "PURCHASE",
    label: "Purchase intent",
    guidance:
      "Someone ready to buy, asking which one to get, where to buy it, or whether to sign up now.",
    baseValue: 95,
    defaultIntent: "commercial",
  },
  RECOMMENDATION: {
    category: "RECOMMENDATION",
    label: "Recommendations",
    guidance:
      "Asking the assistant to recommend one option for a stated situation, budget or constraint.",
    baseValue: 90,
    defaultIntent: "commercial",
  },
  COMPARISON: {
    category: "COMPARISON",
    label: "Comparisons",
    guidance: "Head-to-head between two or three named options: which is better, and for whom.",
    baseValue: 85,
    defaultIntent: "commercial",
  },
  ALTERNATIVES: {
    category: "ALTERNATIVES",
    label: "Alternatives",
    guidance:
      "Looking for a replacement for a named product — cheaper, simpler, or without a specific drawback.",
    baseValue: 85,
    defaultIntent: "commercial",
  },
  DISCOVERY: {
    category: "DISCOVERY",
    label: "Best products and companies",
    guidance:
      'Open "best / top / leading" questions naming a category, a use case or a market, but no vendor.',
    baseValue: 80,
    defaultIntent: "commercial",
  },
  PRICING: {
    category: "PRICING",
    label: "Pricing",
    guidance: "What it costs, what a fair price is, whether there is a free tier.",
    baseValue: 75,
    defaultIntent: "commercial",
  },
  TRUST: {
    category: "TRUST",
    label: "Reviews and reputation",
    guidance:
      "Is this any good, is it legitimate, what do customers say, what are the common complaints.",
    baseValue: 70,
    defaultIntent: "research",
  },
  USE_CASE: {
    category: "USE_CASE",
    label: "Use cases",
    guidance: "Which option suits a specific job, industry, team size or workflow.",
    baseValue: 65,
    defaultIntent: "research",
  },
  FEATURES: {
    category: "FEATURES",
    label: "Features",
    guidance: "Whether something supports a specific capability, integration or standard.",
    baseValue: 60,
    defaultIntent: "research",
  },
  PROBLEM_SOLVING: {
    category: "PROBLEM_SOLVING",
    label: "Problem solving",
    guidance:
      "Someone describing a problem in their own words, not yet aware a product category exists for it.",
    baseValue: 55,
    defaultIntent: "research",
  },
  BRAND_AWARENESS: {
    category: "BRAND_AWARENESS",
    label: "Brand evaluation",
    guidance: "Questions naming the brand directly: what it is, who it is for, whether to trust it.",
    baseValue: 50,
    defaultIntent: "navigational",
  },
  HOW_TO: {
    category: "HOW_TO",
    label: "How-to",
    guidance: "How to accomplish a task that a product in this category would help with.",
    baseValue: 40,
    defaultIntent: "research",
  },
  EDUCATION: {
    category: "EDUCATION",
    label: "Industry education",
    guidance: "What a term means, how something works, why it matters. No purchase in view.",
    baseValue: 30,
    defaultIntent: "research",
  },
};

/**
 * Intent multipliers.
 *
 * A navigational question — one that already names the brand — is a weak
 * commercial signal even in a high-value category: the asker has already found
 * you, so appearing in the answer defends a position rather than winning one.
 */
export const INTENT_MULTIPLIERS: Readonly<Record<PromptIntent, number>> = {
  commercial: 1,
  research: 0.8,
  navigational: 0.6,
};

/**
 * Monthly searches at which the demand bonus saturates.
 *
 * AI-search volume is not measurable — nobody publishes it — so the SEO keyword
 * that seeded a prompt is the only demand proxy available. It is a WEAK signal
 * and is weighted as one: at most DEMAND_WEIGHT points, on a logarithmic curve,
 * because the difference between 100 and 1,000 searches matters far more than
 * between 50,000 and 51,000.
 */
export const DEMAND_SATURATION = 10_000;

/** Maximum points search demand can contribute. */
export const DEMAND_WEIGHT = 15;

export interface CommercialValueInput {
  category: PromptCategory;
  /** Falls back to the category's default when the classifier had no opinion. */
  intent?: PromptIntent | null;
  /** Monthly search volume of the keyword this prompt came from, if any. */
  searchVolume?: number | null;
}

/**
 * 0-100. How much money sits behind this question.
 *
 * DISTINCT FROM relevanceScore, which the setup wizard already computes and
 * which asks whether a prompt is about this brand at all. Both are needed and
 * they disagree constantly: "best free CRM" is perfectly relevant to a CRM
 * vendor and commercially weak, while "enterprise CRM migration cost" is
 * valuable to exactly one vendor in ten. Collapsing them into a single number
 * would rank the freebie hunters top of the list.
 */
export function commercialValue(input: CommercialValueInput): number {
  const spec = CATEGORY_SPECS[input.category];
  if (!spec) return 0;

  const intent = input.intent ?? spec.defaultIntent;
  const base = spec.baseValue * (INTENT_MULTIPLIERS[intent] ?? 1);

  const volume = input.searchVolume;
  const demandBonus =
    typeof volume === "number" && Number.isFinite(volume) && volume > 0
      ? DEMAND_WEIGHT * Math.min(1, Math.log10(volume + 1) / Math.log10(DEMAND_SATURATION + 1))
      : 0;

  return Math.round(Math.min(100, Math.max(0, base + demandBonus)));
}

/**
 * The categories a new project's first prompt set should cover, in order.
 *
 * COVERAGE BEFORE DEPTH. A first checkup that asks ten variations of "best X"
 * measures one question ten times; the point of the first set is to find out
 * WHERE a brand is invisible, which needs the whole funnel represented. The
 * generator therefore round-robins this list before it takes a second prompt
 * from any category.
 */
export const INITIAL_CATEGORY_ORDER: readonly PromptCategory[] = [
  "DISCOVERY",
  "RECOMMENDATION",
  "COMPARISON",
  "ALTERNATIVES",
  "PURCHASE",
  // Placed with the late-funnel block rather than at the end: a local question
  // is where a nearby buyer decides. It costs a brand nothing to sit here when
  // it has no geography — the generator is only asked for LOCAL candidates when
  // the wizard judges the business to serve one, so with none produced the
  // round-robin simply steps over it.
  "LOCAL",
  "USE_CASE",
  "TRUST",
  "PRICING",
  "PROBLEM_SOLVING",
  "FEATURES",
  "BRAND_AWARENESS",
  "HOW_TO",
  "EDUCATION",
];
