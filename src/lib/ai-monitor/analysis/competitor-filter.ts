// src/lib/ai-monitor/analysis/competitor-filter.ts
//
// Is this named entity actually a rival, or is it the assistant naming the
// tool it is speaking through?
//
// WHY THIS IS NOT A MODEL CALL. The ranking pass already extracted the entities
// and was paid for; deciding which of them compete with the brand is a judgement
// over text we already hold. A second call would cost money per run, vary
// between repetitions — poisoning the repeatability score with our own noise —
// and produce an answer nobody could explain to a customer. A weighted signal
// table gives the same shape of judgement, deterministically, and every rule can
// be shown in the UI: "flagged as a platform because it appears after 'using'".
//
// STORED, NEVER DELETED. A classification is a LENS over a raw observation, not
// a replacement for it. Every entity keeps its row with its verdict attached, so
// tuning these rules later is a re-run of a pure function over stored data
// rather than a re-run of the provider calls that produced it. The competitor
// rollup filters to RIVAL at read time; nothing is discarded at write time.
//
// VERSIONED, for the reason scoreVersion is. Rules change; the rows written
// under the old ones keep meaning what they meant, and a re-classification is an
// explicit new version rather than a silent restatement of history.
//
// THE SHAPE IS REUSABLE. Weighted signals + a threshold + a version column is
// the pattern to reach for wherever the temptation is another LLM call —
// citation quality, alert severity. It reads to a customer as judgement, and it
// is explainable, cheap and testable.

import { matchesAlias } from "./similarity";

/**
 * Bump when a weight, a threshold or a list below changes.
 *
 * 2: added the "like <brand>" comparison cue, and the cross-prompt signal now
 *    counts DISTINCT prompts rather than mentions — with repetitions above 1 a
 *    single prompt ranking an entity twice used to read as two.
 */
export const CLASSIFIER_VERSION = 2;

export type EntityClassification = "RIVAL" | "PLATFORM" | "GENERIC";

/**
 * The assistants, clouds and consoles an answer names because it IS one, or
 * because it is telling the reader where to look.
 *
 * A CONFIG ARRAY, IN ONE PLACE, matched through the 0.90 similarity matcher
 * rather than by equality — an answer writes "Chat GPT", "ChatGPT-4" and
 * "chatgpt" and all three mean the platform. Equality matching would let the
 * spacing variant through as a rival, which is exactly the noise the dogfood run
 * surfaced: ChatGPT, Perplexity and Google Search Console were being counted as
 * competitors of an AI-visibility product.
 */
export const PLATFORM_DENYLIST: readonly string[] = [
  "ChatGPT",
  "GPT-4",
  "GPT-5",
  "Claude",
  "Gemini",
  "Perplexity",
  "Copilot",
  "Grok",
  "Google Search Console",
  "Google Analytics",
  "Google AI Overviews",
  "Google Alerts",
  "Bing",
  "Bing Webmaster Tools",
  "Meta AI",
  "HuggingFace",
  "OpenAI",
  "Anthropic",
  "Google",
  "Microsoft",
];

/**
 * Bare category words. Not brands, however often an answer capitalises them.
 *
 * "SEO" is not a competitor of an SEO tool, and an entity list that contains it
 * turns the top-competitors panel into a glossary.
 */
export const GENERIC_TERMS: readonly string[] = [
  "SEO",
  "AI",
  "AI search",
  "analytics",
  "marketing",
  "software",
  "platform",
  "tool",
  "tools",
  "agency",
  "content",
  "search",
  "monitoring",
  "visibility",
  "automation",
  "dashboard",
];

/**
 * Signal weights. Additive; the sum is compared to RIVAL_THRESHOLD.
 *
 * COMPARISON LANGUAGE IS THE STRONGEST SIGNAL because it is the only one that
 * states the relationship outright — "an alternative to X" is the answer telling
 * us these two things compete. The TOOL PREPOSITIONS are weighted equally
 * negative and deliberately so: "using Semrush" and "compared to Semrush" are
 * the same word in two different roles, and without the negative cue every
 * mention of a tool the reader is told to use would count as a rival.
 */
export const WEIGHTS = {
  /** "alternative to", "vs", "competitor", "instead of", "similar to". */
  comparisonLanguage: 2,
  /** Named inside the answer's ranked recommendation list. */
  rankedRecommendation: 1,
  /** "using X", "via X", "according to X" — a tool or a source, not a rival. */
  toolPreposition: -2,
  /** The question was shopping-shaped. */
  commercialPrompt: 1,
  /** The question was not about choosing anything. */
  nonCommercialPrompt: -1,
  /** Ranked in two or more distinct prompts this checkup. */
  crossPromptConsistency: 1,
} as const;

/** At or above this, an entity is a rival. */
export const RIVAL_THRESHOLD = 2;

/** Prompt categories that mean the asker is choosing between options. */
export const COMMERCIAL_CATEGORIES: readonly string[] = [
  "DISCOVERY",
  "COMPARISON",
  "ALTERNATIVES",
  "PURCHASE",
  "RECOMMENDATION",
];

/** Categories where a named tool is usually an instruction, not an option. */
export const NON_COMMERCIAL_CATEGORIES: readonly string[] = [
  "PROBLEM_SOLVING",
  "HOW_TO",
  "EDUCATION",
];

const COMPARISON_CUES =
  /\b(alternatives?\s+to|competitors?|competing|similar\s+to|vs\.?|versus|instead\s+of|compared\s+to|rather\s+than|switch\s+(?:to|from))\b/i;

/**
 * "like Echorank360" — the answer positioning this entity against the brand.
 *
 * Needs the brand's own name, so it is built per call rather than living in the
 * constant above. Only the brand: "like a spreadsheet" is a simile, and a bare
 * `like` would fire on every one of them.
 */
function likeBrandCue(brandName: string | undefined): RegExp | null {
  const name = (brandName ?? "").trim();
  if (!name) return null;
  return new RegExp(`\\blike\\s+${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
}

/**
 * Prepositions that put the entity in the role of instrument or source.
 *
 * Matched only when they sit IMMEDIATELY BEFORE the entity — "using Semrush" is
 * a tool, "using it you can beat Semrush" is not, and a whole-window search
 * cannot tell those apart.
 */
const TOOL_PREPOSITIONS = [
  "using",
  "via",
  "through",
  "on",
  "in",
  "powered by",
  "according to",
  "with",
];

export interface ClassifyContext {
  /**
   * 1-based place in the answer's ranked list, from the ranking pass. Null when
   * the answer named it in prose without ranking it. Reused rather than
   * recomputed — ./entities.ts already paid to work this out.
   */
  position?: number | null;
  /** ±1 sentence around the mention. Use sentenceWindow() to build it. */
  context?: string | null;
  /** The prompt's stored category, from the wizard's mix. */
  promptCategory?: string | null;
  /** Distinct prompts in this checkup that ranked this entity. */
  rankedInPrompts?: number;
  /**
   * The brand's own category words. An entity equal to one of these is the
   * category, not a competitor in it.
   */
  categoryVocabulary?: readonly string[];
  /** The monitored brand's name, for the "like <brand>" comparison cue. */
  brandName?: string;
}

export interface SignalTrace {
  signal: string;
  delta: number;
  /** Shown in the UI verbatim, so it is written for a customer to read. */
  why: string;
}

export interface Classification {
  entity: string;
  classification: EntityClassification;
  score: number;
  classifierVersion: number;
  trace: SignalTrace[];
}

/**
 * The sentence containing the entity, plus its neighbours either side.
 *
 * A window rather than the whole answer: "alternative to" three paragraphs away
 * is about something else, and counting it would make every entity in a long
 * comparison article a rival.
 */
export function sentenceWindow(text: string, entity: string): string {
  const sentences = (text ?? "").split(/(?<=[.!?])\s+/);
  const index = sentences.findIndex((sentence) =>
    sentence.toLowerCase().includes(entity.toLowerCase()),
  );
  if (index === -1) return "";
  return sentences.slice(Math.max(0, index - 1), index + 2).join(" ");
}

/** Is the entity immediately preceded by a tool/source preposition? */
export function hasToolPreposition(window: string, entity: string): boolean {
  if (!window || !entity) return false;
  const escaped = entity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return TOOL_PREPOSITIONS.some((preposition) =>
    new RegExp(`\\b${preposition}\\s+${escaped}\\b`, "i").test(window),
  );
}

/**
 * Classify one named entity.
 *
 * The two hard rules run first and stop: a platform is a platform however the
 * sentence around it reads, and a bare category word cannot be argued into
 * being a brand by context. Only then do the weighted signals run.
 */
export function classifyEntity(entity: string, ctx: ClassifyContext = {}): Classification {
  const trace: SignalTrace[] = [];
  const name = (entity ?? "").trim();

  if (!name) {
    return {
      entity: name,
      classification: "GENERIC",
      score: 0,
      classifierVersion: CLASSIFIER_VERSION,
      trace: [{ signal: "empty", delta: 0, why: "No entity name." }],
    };
  }

  // 1. Platform denylist — hard, via the fuzzy matcher so spacing variants land.
  if (matchesAlias(name, PLATFORM_DENYLIST)) {
    return {
      entity: name,
      classification: "PLATFORM",
      score: 0,
      classifierVersion: CLASSIFIER_VERSION,
      trace: [
        {
          signal: "platform_denylist",
          delta: 0,
          why: `"${name}" is an AI assistant or platform, not a competing product.`,
        },
      ],
    };
  }

  // 2. Generic terms — hard. Includes the brand's own category vocabulary,
  //    because "AI visibility" is what the brand SELLS, not who it competes with.
  const vocabulary = [...GENERIC_TERMS, ...(ctx.categoryVocabulary ?? [])];
  const isGeneric = vocabulary.some(
    (term) => term.trim().toLowerCase() === name.toLowerCase(),
  );
  if (isGeneric) {
    return {
      entity: name,
      classification: "GENERIC",
      score: 0,
      classifierVersion: CLASSIFIER_VERSION,
      trace: [
        {
          signal: "generic_term",
          delta: 0,
          why: `"${name}" is a category, not a company.`,
        },
      ],
    };
  }

  let score = 0;
  const add = (delta: number, signal: string, why: string) => {
    score += delta;
    trace.push({ signal, delta, why });
  };

  // 3. Context cues.
  const window = ctx.context ?? "";
  const likeBrand = likeBrandCue(ctx.brandName);
  if (window && (COMPARISON_CUES.test(window) || (likeBrand?.test(window) ?? false))) {
    add(
      WEIGHTS.comparisonLanguage,
      "comparison_language",
      likeBrand?.test(window)
        ? `The answer offers it as something like ${ctx.brandName}.`
        : "The answer compares it with other options.",
    );
  }
  if (hasToolPreposition(window, name)) {
    add(
      WEIGHTS.toolPreposition,
      "tool_preposition",
      `The answer says to use something "with" or "via" ${name}, so it reads as a tool rather than a rival.`,
    );
  }
  if (ctx.position !== null && ctx.position !== undefined && ctx.position >= 1) {
    add(
      WEIGHTS.rankedRecommendation,
      "ranked_recommendation",
      `Named at position ${ctx.position} in the answer's recommendations.`,
    );
  }

  // 4. What the question was for.
  const category = ctx.promptCategory ?? "";
  if (COMMERCIAL_CATEGORIES.includes(category)) {
    add(WEIGHTS.commercialPrompt, "commercial_prompt", "The question was about choosing a product.");
  } else if (NON_COMMERCIAL_CATEGORIES.includes(category)) {
    add(
      WEIGHTS.nonCommercialPrompt,
      "non_commercial_prompt",
      "The question was about solving a problem, not choosing a product.",
    );
  }

  // 5. Consistency across the checkup.
  if ((ctx.rankedInPrompts ?? 0) >= 2) {
    add(
      WEIGHTS.crossPromptConsistency,
      "cross_prompt_consistency",
      `Recommended for ${ctx.rankedInPrompts} different questions.`,
    );
  }

  return {
    entity: name,
    classification: score >= RIVAL_THRESHOLD ? "RIVAL" : "GENERIC",
    score,
    classifierVersion: CLASSIFIER_VERSION,
    trace,
  };
}

/** Only rivals belong in the competitor rollup. */
export function isRival(classification: EntityClassification): boolean {
  return classification === "RIVAL";
}
