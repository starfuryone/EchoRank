// src/lib/ai-monitor/wizard/suggest.ts
//
// The wizard's suggestion step: read the homepage, ask once, rank, truncate.
//
// ONE FETCH AND ONE MODEL CALL, both of them budgeted. The fetch is
// ./site-analysis.ts; the call is ../prompts/generate.ts, which was already a
// single strict-JSON call and is reused rather than reimplemented. What this
// module adds is the part that was missing: metering the call, ranking what
// comes back, and cutting to what the tier bought.
//
// THE BRAND IS NOT PUT INTO THE QUESTIONS. That rule lives in the generator's
// system prompt, where it has always been — "Most questions must NOT name the
// brand ... only BRAND_AWARENESS names it directly" — and this module must not
// undo it by post-processing the brand back in. The whole measurement is
// whether an assistant volunteers the brand unprompted; a suggested question
// containing the name measures nothing but our own ability to type it.
//
// THE CALL IS METERED LIKE ANY OTHER. Suggestion generation spends the same
// tenant's money as a checkup does, and a tenant at its ceiling gets no
// suggestions rather than a free one — the wizard says so and still lets them
// write prompts by hand.

import type { PlanType } from "@/generated/prisma";
import type { AiCheckupShape } from "@/lib/plan-config";
import { AiCapReachedError } from "../cap";
import { JSON_CALL_MODEL } from "../json-call";
import { generatePrompts, type GeneratedPrompt } from "../prompts/generate";
import {
  INITIAL_CATEGORY_ORDER,
  type PromptCategory,
  type PromptIntent,
} from "../prompts/categories";
import { rankSuggestions, type RankedSuggestion, type ScorableCandidate } from "./scoring";
import { analyseSite, type SiteAnalysis } from "./site-analysis";
import type { AiCallOutcome, AiCallSpec } from "../metering";

/**
 * Candidates asked for, as a multiple of what will be kept.
 *
 * Ranking twenty down to twenty is not ranking. Asking for roughly twice the
 * allowance gives the score something to discard, and stays inside the single
 * call the wizard is allowed — the generator caps at 40 either way.
 */
export const CANDIDATE_MULTIPLIER = 2;

/**
 * The eight shapes the wizard asks for, in the spec's own words, expressed in
 * the vocabulary the database already stores.
 *
 * The labels are the wizard's; the values are PROMPT_CATEGORIES members, so a
 * prompt created here is indistinguishable from one created anywhere else and
 * the funnel round-robin, the commercial-value scorer and the dashboard all
 * keep working. A second vocabulary would have meant DISCOVERY and
 * "best-provider" both existing and meaning the same thing.
 */
export const WIZARD_MIX: readonly { label: string; category: PromptCategory }[] = [
  { label: "best-provider", category: "DISCOVERY" },
  { label: "comparison", category: "COMPARISON" },
  { label: "recommendation", category: "RECOMMENDATION" },
  { label: "product", category: "FEATURES" },
  { label: "problem-solving", category: "PROBLEM_SOLVING" },
  { label: "local", category: "LOCAL" },
  { label: "alternatives", category: "ALTERNATIVES" },
  { label: "buying-intent", category: "PURCHASE" },
];

/** The wizard's label for a stored category, when it has one. */
export function wizardLabelFor(category: PromptCategory): string | null {
  return WIZARD_MIX.find((entry) => entry.category === category)?.label ?? null;
}

/**
 * The mix, minus LOCAL for a business with no geography.
 *
 * Asking a global SaaS for "near me" questions produces either nonsense or
 * questions about a city it picked at random, and either way they crowd out a
 * slot that could have held a comparison. Geography is a fact the wizard knows
 * — the user picked a country, or did not.
 */
export function categoriesFor(hasGeography: boolean): PromptCategory[] {
  return WIZARD_MIX.filter((entry) => hasGeography || entry.category !== "LOCAL").map(
    (entry) => entry.category,
  );
}

export interface SuggestRequest {
  brand: string;
  domain: string;
  /** Free text from the wizard, or "" — the site summary fills the gap. */
  description?: string;
  industry?: string;
  competitors?: readonly string[];
  country?: string | null;
  language?: string;
}

export interface SuggestContext {
  tenantId: string;
  plan: PlanType;
  /**
   * The tenant's resolved checkup shape. Passed in rather than looked up: a
   * standalone watcher holder has a shape their tier does not describe, and
   * resolveWatcherShape() is the one place that decides which applies.
   */
  shape: AiCheckupShape;
}

export interface WizardSuggestion {
  text: string;
  category: PromptCategory;
  intent: PromptIntent;
  audience: string | null;
  /** The wizard's own label for the category, for grouping in the UI. */
  label: string | null;
  /** 0-100. What ordered the list; stored as TrackedPrompt.suggestionScore. */
  score: number;
}

export interface SuggestResult {
  site: SiteAnalysis;
  suggestions: WizardSuggestion[];
  /** The tier's ceiling, so the UI can say "20 of 20". */
  limit: number;
  /** True when the tenant was at its spend cap and nothing was generated. */
  capped: boolean;
  /** Set when the model produced nothing usable. */
  error: string | null;
}

export interface SuggestDeps {
  analyse?: typeof analyseSite;
  generate?: typeof generatePrompts;
  meter?: <T>(
    ctx: { tenantId: string; plan: PlanType },
    spec: AiCallSpec,
    fn: () => Promise<AiCallOutcome<T>>,
  ) => Promise<T>;
}

/**
 * How well the model's own category label fits what it wrote.
 *
 * DETERMINISTIC AND DELIBERATELY CRUDE. The generator was asked for a category
 * and returned one; the only cheap check available is whether the sentence
 * carries the shape that category implies. A second model call to grade the
 * first would double the cost of the step the tier is paying for once.
 *
 * A candidate in a category the wizard did not ask for scores low rather than
 * zero — it is still a real question, it is just not the gap we were filling.
 */
export function categoryMatch(
  candidate: GeneratedPrompt,
  requested: readonly PromptCategory[],
): number {
  if (!requested.includes(candidate.category)) return 40;

  const text = candidate.text.toLowerCase();
  const shapes: Partial<Record<PromptCategory, RegExp>> = {
    COMPARISON: /\b(vs|versus|compared?|better than|or\b.*\?)/,
    ALTERNATIVES: /\b(alternative|instead of|replace|switch from|other than)/,
    PURCHASE: /\b(buy|sign up|get started|worth it|should i (get|switch|pay))/,
    PRICING: /\b(cost|price|pricing|cheap|budget|free tier|how much)/,
    LOCAL: /\b(near me|nearby|in [a-z]|local|around here)/,
    PROBLEM_SOLVING: /\b(problem|struggling|nightmare|keeps? |cannot|can't|how do i (stop|fix))/,
    DISCOVERY: /\b(best|top|leading|good|recommend)/,
    RECOMMENDATION: /\b(recommend|suggest|which should|what should)/,
  };

  const shape = shapes[candidate.category];
  if (!shape) return 75; // Asked for, no cheap test — assume it fits.
  return shape.test(text) ? 100 : 55;
}

/**
 * Topical relevance, deterministically.
 *
 * Overlap between the candidate and what we know the business does — its
 * industry and the words on its homepage. Crude on purpose, for the same reason
 * as categoryMatch: this is a sort key over a list a human is about to edit,
 * not a number anyone bills against.
 */
export function topicalRelevance(text: string, context: string): number {
  const words = (value: string) =>
    new Set(
      value
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter((word) => word.length > 3),
    );

  const contextWords = words(context);
  if (contextWords.size === 0) return 60; // Nothing to compare against.

  const candidateWords = [...words(text)];
  if (candidateWords.length === 0) return 0;

  const shared = candidateWords.filter((word) => contextWords.has(word)).length;
  // Two shared content words is already a strong signal at this length, so the
  // scale saturates fast rather than rewarding a candidate that parrots the
  // homepage back.
  return Math.min(100, 45 + shared * 25);
}

/**
 * Generate, rank and truncate.
 *
 * Never throws. A cap, an unreachable site and an unparseable reply are each a
 * result the wizard renders — the user can always type their own questions, and
 * refusing to show the step because a model had a bad minute would block setup
 * entirely.
 */
export async function suggestPrompts(
  request: SuggestRequest,
  ctx: SuggestContext,
  deps: SuggestDeps = {},
): Promise<SuggestResult> {
  const analyse = deps.analyse ?? analyseSite;
  const generate = deps.generate ?? generatePrompts;
  const meter = deps.meter ?? (await import("../metering")).meteredAiCall;

  const limit = ctx.shape.prompts;
  const site = await analyse(request.domain);

  if (limit <= 0) {
    // A tier with no prompt allowance has no monitor at all; nothing to spend.
    return { site, suggestions: [], limit, capped: false, error: null };
  }

  const categories = categoriesFor(Boolean(request.country));
  const description = [request.description?.trim(), site.summary].filter(Boolean).join(" — ");

  let generated;
  try {
    generated = await meter(
      { tenantId: ctx.tenantId, plan: ctx.plan },
      { provider: "CLAUDE", model: JSON_CALL_MODEL, purpose: "inference" },
      async () => {
        const result = await generate({
          brandName: request.brand,
          description,
          industry: request.industry ?? "",
          competitors: request.competitors ?? [],
          language: request.language ?? "en",
          count: limit * CANDIDATE_MULTIPLIER,
          categories,
        });
        return {
          value: result,
          usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens },
          model: result.model,
        };
      },
    );
  } catch (err) {
    if (err instanceof AiCapReachedError) {
      return { site, suggestions: [], limit, capped: true, error: null };
    }
    throw err;
  }

  if (!generated.value) {
    return { site, suggestions: [], limit, capped: false, error: generated.error ?? "no suggestions" };
  }

  const context = [request.industry, description].filter(Boolean).join(" ");
  const candidates: (ScorableCandidate & { source: GeneratedPrompt })[] = generated.value.prompts.map(
    (prompt) => ({
      text: prompt.text,
      category: prompt.category,
      intent: prompt.intent,
      topicalRelevance: topicalRelevance(prompt.text, context),
      categoryMatch: categoryMatch(prompt, categories),
      source: prompt,
    }),
  );

  return {
    site,
    limit,
    capped: false,
    error: null,
    suggestions: rankSuggestions(candidates, limit).map(
      (ranked: RankedSuggestion<(typeof candidates)[number]>) => ({
        text: ranked.candidate.source.text,
        category: ranked.candidate.source.category,
        intent: ranked.candidate.source.intent,
        audience: ranked.candidate.source.audience,
        label: wizardLabelFor(ranked.candidate.source.category),
        score: ranked.score,
      }),
    ),
  };
}

export { INITIAL_CATEGORY_ORDER };
