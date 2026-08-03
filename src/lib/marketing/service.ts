// src/lib/marketing/service.ts
//
// Marketing Studio orchestration.
//
// GATE ORDER, cheapest first, every one of them before a token is spent:
//   1. plan gate     — marketing_studio feature flag (AI_VISIBILITY is locked)
//   2. validation    — required fields present, values within length
//   3. heuristics    — free, local, and for category 08 the entire answer
//   4. result cache  — Redis, 24 h, free, and never touches the budget
//   5. token budget  — Redis, per plan
//   6. the call      — Haiku, once
//   7. meter         — AiApiCall row + Redis INCRBY
//
// The heuristic step runs BEFORE the cache and the budget on purpose. For 08 it
// terminates the request with a complete deliverable and no call at all, and
// for the hybrids it produces the summary that the cache key would otherwise
// have to be computed without.

import { prisma } from "@/lib/prisma";
import type { PlanType } from "@/generated/prisma";
import type { DashLocale } from "@/lib/i18n/dashboard";
import {
  MARKETING_MODEL,
  type MarketingCategory,
} from "@/lib/marketing-templates";
import { analyzeVoice, renderVoiceGuide } from "./voice";
import { analyzeVoc, topPhrasesForAi } from "./voc";
import { parseAnalytics, summaryForAi } from "./analytics";
import { buildCalendar, scheduleForAi } from "./calendar";
import { assemblePrompt, collectValues, MarketingValidationError } from "./prompt";
import { callMarketingModel } from "./client";
import {
  marketingCacheKey,
  readCachedGeneration,
  writeCachedGeneration,
} from "./cache";
import {
  assertMarketingBudget,
  marketingTokenLimit,
  marketingTokensUsed,
  planCanUseMarketing,
  MarketingPlanLockedError,
  recordMarketingTokens,
} from "./quota";
import type { MarketingComputeResult, MarketingResult, MarketingUsage } from "./types";

export async function buildMarketingUsage(
  tenantId: string,
  plan: PlanType,
): Promise<MarketingUsage> {
  return {
    used: await marketingTokensUsed(tenantId),
    limit: marketingTokenLimit(plan),
    plan,
    unlocked: planCanUseMarketing(plan),
  };
}

/** The heuristic half of a category, or null when it has none. */
interface Computed {
  /** Rendered for the user. */
  display: string;
  /** The ONLY thing the model may see. Never the corpus. */
  forAi: string | null;
}

/**
 * Run the local analysis for a category.
 *
 * Every branch here is pure computation over the submitted values — no network,
 * no Prisma, no Redis. `tests/marketing-heuristics.test.ts` asserts the zero-fetch
 * property on the underlying functions.
 */
export function computeForCategory(
  category: MarketingCategory,
  raw: Record<string, unknown>,
): Computed | null {
  const text = (key: string): string => {
    const value = raw[key];
    return typeof value === "string" ? value : "";
  };

  switch (category.id) {
    case "voice": {
      const samples = text("WRITING_SAMPLES").trim();
      if (!samples) throw new MarketingValidationError("Paste a writing sample to analyse.");
      const stats = analyzeVoice(samples);
      if (stats.sentenceCount < 3) {
        throw new MarketingValidationError(
          "That sample is too short to read a voice from. Paste a few paragraphs.",
        );
      }
      // No AI half at all — the guide IS the deliverable.
      return { display: renderVoiceGuide(stats), forAi: null };
    }

    case "voc": {
      const feedback = text("RAW_FEEDBACK").trim();
      if (!feedback) throw new MarketingValidationError("Paste some customer feedback.");
      const analysis = analyzeVoc(feedback);
      const phrases = topPhrasesForAi(analysis);
      const buckets = analysis.buckets
        .filter((b) => b.hits > 0)
        .map((b) => `- ${b.bucket}: ${b.share}% of matched objection words`)
        .join("\n");
      const display = [
        `${analysis.entryCount} entries, ${analysis.wordCount} words.`,
        "",
        "Most repeated phrases (by how many separate customers used them):",
        ...(analysis.topPhrases.length
          ? analysis.topPhrases.map((p) => `- "${p.phrase}" — ${p.documents} customers, ${p.count} mentions`)
          : ["- nothing repeated across entries yet"]),
        "",
        "Objection mix:",
        buckets || "- no objection keywords matched",
      ].join("\n");

      return {
        display,
        forAi: phrases.length
          ? phrases.map((p, i) => `${i + 1}. "${p}"`).join("\n")
          : null,
      };
    }

    case "analytics": {
      const data = text("DATA").trim();
      if (!data) throw new MarketingValidationError("Paste your analytics rows.");
      const summary = parseAnalytics(data);
      if (summary.rowCount === 0) {
        throw new MarketingValidationError(
          "No metric rows found. Expect a label column followed by current and previous values.",
        );
      }
      const forAi = summaryForAi(summary);
      // The display and the AI payload are the same computed summary here —
      // shown side by side in the UI so "we did not send your table" is
      // verifiable by reading it, not just claimed in a tooltip.
      return { display: forAi, forAi };
    }

    case "social": {
      const days = Number.parseInt(text("DAYS"), 10);
      const maxConsecutive = Number.parseInt(text("MAX_CONSECUTIVE"), 10);
      const pillars = [text("PILLAR_1"), text("PILLAR_2"), text("PILLAR_3")]
        .map((p) => p.trim())
        .filter(Boolean);
      if (pillars.length === 0) {
        throw new MarketingValidationError("Name at least one content pillar.");
      }
      let slots;
      try {
        slots = buildCalendar({
          startDate: text("START_DATE").trim(),
          days: Number.isFinite(days) ? days : 30,
          pillars,
          maxConsecutive: Number.isFinite(maxConsecutive) ? maxConsecutive : 2,
        });
      } catch (err) {
        // buildCalendar throws on a bad ISO date or an empty pillar list; both
        // are the caller's input, so both are a 400 rather than a 500.
        throw new MarketingValidationError(
          err instanceof Error ? err.message : "That calendar could not be built.",
        );
      }
      const display = slots
        .map((s) => `${s.date}  ${s.pillar}  (${s.format})`)
        .join("\n");
      return { display, forAi: `Schedule:\n${scheduleForAi(slots)}` };
    }

    default:
      return null;
  }
}

export interface GenerateInput {
  tenantId: string;
  plan: PlanType;
  category: MarketingCategory;
  raw: Record<string, unknown>;
  locale: DashLocale;
  voiceGuide: string | null;
}

/** The heuristic-only path. No budget check, no model, no spend — so it stays
 *  available to a locked plan's preview and during a Redis outage. */
export function computeOnly(
  category: MarketingCategory,
  raw: Record<string, unknown>,
): MarketingComputeResult {
  const computed = computeForCategory(category, raw);
  if (!computed) {
    throw new MarketingValidationError("That brief has nothing to compute locally.");
  }
  return {
    categoryId: category.id,
    computed: computed.display,
    aiPayloadPreview: computed.forAi,
  };
}

export async function generate(input: GenerateInput): Promise<MarketingResult> {
  const { tenantId, plan, category, raw, locale, voiceGuide } = input;

  // 1. Plan gate, before anything reads the body's meaning.
  if (!planCanUseMarketing(plan)) throw new MarketingPlanLockedError(plan);

  // 2. Validation (throws MarketingValidationError -> 400).
  const values = collectValues(category, raw);

  // 3. Heuristics. For category 08 this is the whole answer.
  const computed = computeForCategory(category, raw);
  if (category.mode === "heuristic") {
    return {
      categoryId: category.id,
      mode: category.mode,
      output: computed?.display ?? "",
      computed: computed?.display ?? null,
      cached: false,
      outputTokens: 0,
      usage: await buildMarketingUsage(tenantId, plan),
    };
  }

  const prompt = assemblePrompt({
    category,
    values,
    locale,
    voiceGuide,
    computedContext: computed?.forAi ?? null,
  });

  // 4. Result cache. Keyed on the same things the prompt is built from, plus
  //    the computed context — two different pasted tables that summarise
  //    identically are genuinely the same question.
  const cacheKey = marketingCacheKey({
    tenantId,
    categoryId: category.id,
    values: { ...values, ...(computed?.forAi ? { __computed: computed.forAi } : {}) },
    language: locale,
    voiceGuide,
  });
  const hit = await readCachedGeneration(cacheKey);
  if (hit) {
    return {
      categoryId: category.id,
      mode: category.mode,
      output: hit.output,
      computed: computed?.display ?? null,
      cached: true,
      outputTokens: 0,
      usage: await buildMarketingUsage(tenantId, plan),
    };
  }

  // 5. Budget.
  await assertMarketingBudget(tenantId, plan);

  // 6. The call.
  const call = await callMarketingModel({
    system: prompt.system,
    userMessage: prompt.userMessage,
    maxTokens: prompt.maxTokens,
  });

  // 7. Meter. The Postgres row is the durable record; Redis is the fast counter.
  //    Neither is allowed to fail the request now that the tokens are spent and
  //    the tenant has their deliverable.
  await Promise.all([
    prisma.aiApiCall
      .create({
        data: {
          tenantId,
          categoryId: category.id,
          model: MARKETING_MODEL,
          inputTokens: call.inputTokens,
          outputTokens: call.outputTokens,
          cacheReadTokens: call.cacheReadTokens,
        },
      })
      .catch(() => undefined),
    recordMarketingTokens(tenantId, call.outputTokens),
    writeCachedGeneration(cacheKey, {
      output: call.text,
      originalOutputTokens: call.outputTokens,
    }),
  ]);

  return {
    categoryId: category.id,
    mode: category.mode,
    output: call.text,
    computed: computed?.display ?? null,
    cached: false,
    outputTokens: call.outputTokens,
    usage: await buildMarketingUsage(tenantId, plan),
  };
}
