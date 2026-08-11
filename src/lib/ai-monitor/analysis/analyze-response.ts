// src/lib/ai-monitor/analysis/analyze-response.ts
//
// One provider answer in, one row of structured observations out.
//
// THREE PASSES, ONE LLM CALL. The deterministic scan (./deterministic.ts) and
// the citation scan (./citations.ts) cost nothing and always run; the ranking
// pass (./entities.ts) is the single metered call, and it is one call for the
// whole row rather than one per field. Batching per field would multiply the
// spend by four and give four chances for the passes to disagree about what the
// answer said.
//
// RAW OBSERVATIONS ONLY. Nothing here computes a composite score. Scores live
// in ../metrics.ts (cohort-level, versioned) and ../scoring.ts (per response),
// and both are recomputable from what this returns — which is the point: a
// weight change must never require re-asking a provider for an answer it gave
// last month.
//
// THE METER ARRIVES LAZILY. ../metering.ts imports @/lib/prisma, which builds a
// connection pool at module scope and throws without DATABASE_URL. Importing it
// statically would drag a database requirement into a module whose logic is
// entirely testable without one — so the default is resolved inside the call,
// and every test passes its own. Same reason cap.ts and pricing.ts are separate
// from metering.ts.

import type { PlanType } from "@/generated/prisma";
import type { AnthropicProvider } from "@/ai/providers/anthropic";
import type { AiCallOutcome, AiCallSpec } from "../metering";
import { JSON_CALL_MODEL } from "../json-call";
import { analyseDeterministic, type DeterministicAnalysis } from "./deterministic";
import { extractCitations, type AnalyzedCitation, type SourceLink } from "./citations";
import {
  classifyEntity,
  sentenceWindow,
  type Classification,
} from "./competitor-filter";
import {
  extractEntities,
  type EntityExtractionResult,
  type RankedCompetitor,
  type Sentiment,
} from "./entities";

/** Who we are watching, as the brand record describes it. */
export interface BrandContext {
  brand: string;
  domain: string | null;
  /** Other spellings that count as the brand. */
  brandVariations: string[];
  /** Known competitor names, for the deterministic name scan. */
  competitors?: string[];
  /** The brand's own category words — an entity equal to one is not a rival. */
  categoryVocabulary?: string[];
}

/** One provider answer, as the adapter hands it back. */
export interface ProviderResponse {
  answer: string;
  promptText: string;
  /** Structured source links, when the engine returns them. */
  sources?: SourceLink[] | null;
  /** The prompt's stored category, a signal for the entity classifier. */
  promptCategory?: string | null;
  /**
   * Lowercased entity name -> how many distinct prompts in this checkup have
   * ranked it. The cross-run consistency signal; absent on a first pass.
   */
  rankedInPrompts?: Record<string, number>;
}

/** Who is paying, so the call can be capped and billed. */
export interface AnalysisContext {
  tenantId: string;
  plan: PlanType;
  checkupId?: string | null;
}

/**
 * The metering seam.
 *
 * Structurally identical to ../metering.ts's `meteredAiCall`, minus its
 * optional clock — narrow enough that a test can supply a recorder and wide
 * enough that the real one is assignable.
 */
export interface MeteredCall {
  <T>(
    ctx: { tenantId: string; plan: PlanType },
    spec: AiCallSpec,
    fn: () => Promise<AiCallOutcome<T>>,
  ): Promise<T>;
}

export interface AnalyzeOptions {
  meter?: MeteredCall;
  provider?: AnthropicProvider;
}

export interface RunAnalysis {
  // ── Deterministic, always present ──
  brandMentioned: boolean;
  mentionCount: number;
  citations: AnalyzedCitation[];
  deterministic: DeterministicAnalysis;

  // ── From the ranking pass; null/empty when it failed ──
  /** 1-based place in the answer's ranked list. Null when named but not ranked. */
  brandPosition: number | null;
  /**
   * EVERY entity the ranking pass named, each carrying its verdict. Platforms
   * and category words are kept, not dropped: the rollup filters to RIVAL at
   * read time, so re-tuning the rules later is a re-run of a pure function over
   * stored rows rather than another provider call.
   */
  competitors: (RankedCompetitor & { classification: Classification })[];
  sentiment: Sentiment | null;

  /** What the metered call cost and whether it worked. */
  extraction: Pick<
    EntityExtractionResult,
    "inputTokens" | "outputTokens" | "model" | "attempts" | "error"
  > & { ok: boolean };
}

/**
 * Every spelling that counts as the brand.
 *
 * The domain is in here for the RANKING pass, where a model naming the vendor
 * as "echorank360.com" must resolve to the brand rather than to a competitor.
 * The prose scan gets it separately (BrandMatcher.domain), because there a bare
 * domain is a citation and is masked out before names are matched at all.
 */
export function brandAliases(brand: BrandContext): string[] {
  return [brand.brand, brand.domain ?? "", ...brand.brandVariations]
    .map((name) => name?.trim() ?? "")
    .filter((name) => name !== "");
}

/**
 * Analyse one answer.
 *
 * The LLM pass is metered even when it fails to produce usable JSON: the tokens
 * were spent either way, and a retry that parsed on neither attempt is exactly
 * the response that cost the most. It never throws, so a single unparseable
 * answer degrades that row to deterministic-only rather than taking the
 * checkup with it.
 */
export async function analyzeResponse(
  response: ProviderResponse,
  brand: BrandContext,
  ctx: AnalysisContext,
  options: AnalyzeOptions = {},
): Promise<RunAnalysis> {
  const aliases = brandAliases(brand);

  const deterministic = analyseDeterministic(response.answer, {
    names: [brand.brand, ...brand.brandVariations].filter((n) => n?.trim()),
    domain: brand.domain,
    competitors: brand.competitors ?? [],
  });

  const citations = extractCitations(response.answer, response.sources, brand.domain);

  const meter = options.meter ?? (await import("../metering")).meteredAiCall;
  const spec: AiCallSpec = {
    provider: "CLAUDE",
    // The requested model. `meteredAiCall` prices whatever the call reports it
    // was actually served, which is what reaches the ledger.
    model: JSON_CALL_MODEL,
    purpose: "analysis",
    checkupId: ctx.checkupId ?? null,
  };

  const extraction = await meter(
    { tenantId: ctx.tenantId, plan: ctx.plan },
    spec,
    async (): Promise<AiCallOutcome<EntityExtractionResult>> => {
      const result = await extractEntities(
        {
          brandName: brand.brand,
          promptText: response.promptText,
          answer: response.answer,
          aliases,
        },
        options.provider,
      );
      return {
        value: result,
        usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens },
        model: result.model,
      };
    },
  );

  return {
    brandMentioned: deterministic.brandMentioned,
    mentionCount: deterministic.mentionCount,
    citations,
    deterministic,
    brandPosition: extraction.extraction?.brandPosition ?? null,
    competitors: (extraction.extraction?.competitors ?? []).map((competitor) => ({
      ...competitor,
      classification: classifyEntity(competitor.name, {
        position: competitor.position,
        context: sentenceWindow(response.answer, competitor.name),
        promptCategory: response.promptCategory ?? null,
        rankedInPrompts: response.rankedInPrompts?.[competitor.name.toLowerCase()] ?? 0,
        categoryVocabulary: brand.categoryVocabulary,
      }),
    })),
    sentiment: extraction.extraction?.sentiment ?? null,
    extraction: {
      ok: extraction.extraction !== null,
      inputTokens: extraction.inputTokens,
      outputTokens: extraction.outputTokens,
      model: extraction.model,
      attempts: extraction.attempts,
      ...(extraction.error ? { error: extraction.error } : {}),
    },
  };
}
