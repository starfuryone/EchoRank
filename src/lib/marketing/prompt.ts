// src/lib/marketing/prompt.ts
//
// Prompt assembly. The ONLY place a Marketing Studio prompt is built.
//
// THE INJECTION BOUNDARY. The route accepts a category id and a map of variable
// VALUES. It never accepts prompt text, a system prompt, a model id or a token
// ceiling from the client — those all come from MARKETING_CATEGORIES. A caller
// therefore cannot rewrite the instructions; the worst they can do is put
// unusual text in a value, which lands in the user message where user text
// belongs and where the model already treats it as data.
//
// SYSTEM BLOCK ORDER, most-shared first:
//   1. audit instruction  — identical for all 12 categories, all tenants
//   2. brand voice guide  — per tenant, absent for most
// That is the correct ordering for a cached prefix. It does not currently earn
// a cache hit (Haiku 4.5's minimum cacheable prefix is 4096 tokens and this
// comes to ~500), and cache_control is deliberately NOT set for that reason —
// see HAIKU_MIN_CACHEABLE_PREFIX_TOKENS.
//
// The category template is NOT a third system block, though it is static per
// category and would look like the obvious thing to cache. Each template is a
// brief written in the user's own first person ("I sell X to Y, our competitor
// is Z") and it reads to the model as the user talking — so it belongs in the
// user message, filled in. The alternative, a placeholder template in the
// system block plus a separate list of values, splits one sentence across two
// roles and makes the model do the substitution itself. Since layer 1 does not
// engage at this size, that split would buy nothing and cost output quality.

import type { DashLocale } from "@/lib/i18n/dashboard";
import {
  AUDIT_INSTRUCTION,
  categoryVariables,
  type MarketingCategory,
} from "@/lib/marketing-templates";

export interface SystemBlock {
  type: "text";
  text: string;
}

export interface AssembledPrompt {
  system: SystemBlock[];
  userMessage: string;
  maxTokens: number;
}

/** Default ceiling for a category that declares none. */
const DEFAULT_MAX_TOKENS = 1500;

/**
 * Template text is English in v1 regardless of UI locale — these are prompts,
 * and translating a prompt costs generation quality. The deliverable language
 * is set by this line instead.
 */
const LANGUAGE_INSTRUCTION: Record<DashLocale, string | null> = {
  en: null,
  fr: "Write the deliverable in French. Use natural, idiomatic French — not translated English.",
  "de-CH": "Write the deliverable in Swiss High German. Use ss, never ß.",
};

/** Values whose length would be absurd for a single-line field. Long pasted
 *  corpora belong to the heuristics, which never reach this file. */
const MAX_VALUE_LENGTH = 2000;

export class MarketingValidationError extends Error {
  readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = "MarketingValidationError";
  }
}

/**
 * Check that every variable the template declares has a value, and trim them.
 *
 * Multiline (pasted-corpus) variables are EXCLUDED: those are the heuristic
 * inputs, they are analysed locally, and they must never reach the prompt. A
 * caller supplying one is ignored rather than rejected, so an over-eager client
 * that posts the whole form cannot leak the corpus by accident.
 */
export function collectValues(
  category: MarketingCategory,
  raw: Record<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {};
  const missing: string[] = [];

  for (const variable of categoryVariables(category)) {
    if (variable.multiline) continue;
    const value = raw[variable.k];
    const text = typeof value === "string" ? value.trim() : "";
    if (!text) {
      missing.push(variable.k);
      continue;
    }
    if (text.length > MAX_VALUE_LENGTH) {
      throw new MarketingValidationError(
        `${variable.k} is too long (max ${MAX_VALUE_LENGTH} characters).`,
      );
    }
    out[variable.k] = text;
  }

  if (missing.length) {
    throw new MarketingValidationError(`Missing required fields: ${missing.join(", ")}.`);
  }
  return out;
}

/**
 * The template as the PROMPT sees it: every multiline variable omitted.
 *
 * This is the structural half of the privacy guarantee, and it is why the
 * corpus fields are excluded here rather than merely "not filled in". For the
 * hybrid categories 09 and 12 the pasted data IS the first template part, so
 * filling the template naively would either paste the corpus into the prompt or
 * — since collectValues skips multiline fields — leave a literal "{DATA}" in
 * it. Dropping the part entirely means the prompt cannot carry the corpus even
 * if a caller supplies it and every other guard is bypassed. What the model
 * gets instead is the computed summary, appended by assemblePrompt.
 */
export function promptTemplate(category: MarketingCategory): string {
  return category.parts
    .filter((p) => typeof p === "string" || !p.multiline)
    .map((p) => (typeof p === "string" ? p : `{${p.k}}`))
    .join("")
    .trim();
}

/** Substitute {KEY} placeholders. Unknown placeholders are left intact rather
 *  than blanked, so a config typo is visible in the output instead of silently
 *  producing a brief with a hole in it. */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{([A-Z0-9_]+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match,
  );
}

export interface AssembleInput {
  category: MarketingCategory;
  values: Record<string, string>;
  locale: DashLocale;
  voiceGuide: string | null;
  /**
   * For hybrid categories: the COMPUTED summary the heuristic produced. This is
   * what the model sees in place of the pasted corpus — top phrases, a delta
   * table, a schedule. The corpus itself is never passed here.
   */
  computedContext?: string | null;
}

export function assemblePrompt(input: AssembleInput): AssembledPrompt {
  const { category, values, locale, voiceGuide, computedContext } = input;

  const system: SystemBlock[] = [{ type: "text", text: AUDIT_INSTRUCTION }];
  if (voiceGuide?.trim()) {
    system.push({
      type: "text",
      text: `Write in this brand's established voice:\n\n${voiceGuide.trim()}`,
    });
  }

  const parts = [fillTemplate(promptTemplate(category), values)];

  if (computedContext?.trim()) {
    parts.push("", computedContext.trim());
  }

  const language = LANGUAGE_INSTRUCTION[locale];
  if (language) parts.push("", language);

  return {
    system,
    userMessage: parts.join("\n"),
    maxTokens: category.maxTokens ?? DEFAULT_MAX_TOKENS,
  };
}
