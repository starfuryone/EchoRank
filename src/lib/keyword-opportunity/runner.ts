// src/lib/keyword-opportunity/runner.ts
//
// The five steps, in order, against real providers.
//
// ── WHAT FAILS THE RUN, AND WHAT DOES NOT ───────────────────────────────────
//
// Three different things can stop this, and they are NOT the same outcome:
//
//   DataForSEO cap reached  -> FAILED, stoppedReason "cap_reached".
//                              Nothing to score, no allowance consumed. A cap
//                              is a decision not to spend, not a fault, and the
//                              UI says so.
//   Discovery found nothing -> FAILED, no allowance consumed. An analysis with
//                              no keywords is not a result, and charging for it
//                              would bill a customer for our empty hands.
//   AI cap reached mid-test -> COMPLETED, stoppedReason "ai_cap_reached".
//                              The keywords that were tested keep their aiGap;
//                              the rest render "not AI-tested", which the
//                              scorer models natively (null, renormalised). The
//                              customer got a scored keyword set, so the
//                              allowance IS consumed.
//
// That last one is the interesting case and it is deliberate. Failing the whole
// analysis because the fifteenth AI call was refused would throw away a hundred
// scored keywords to punish the absence of evidence on a few — and the score
// already knows how to say "we did not ask".
//
// ── THE AI CAP IS THE WATCHER'S, NOT THIS FEATURE'S ─────────────────────────
//
// Model spend goes through ai-monitor/metering.ts meteredAiCall, which enforces
// aiMonthlyCapUsd — the same pot the Watcher spends from. That is the briefed
// design (no new rate plumbing) and it has a consequence worth stating: this
// feature's USD cap, KEYWORD_OPPORTUNITY_CAP_USD, bounds its DATAFORSEO spend
// only. A tenant sitting at their AI cap gets domain analyses that complete
// with nothing AI-tested rather than analyses that fail — see above — but they
// do get less of the product until the month turns.

import type { PlanType, Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { logger } from "@/infrastructure/observability/logger";
import { AiCapReachedError, meteredAiCall } from "@/lib/ai-monitor/metering";
import { JSON_CALL_MODEL } from "@/lib/ai-monitor/json-call";
import { askEngine } from "@/lib/ai-monitor/runner/providers";
import { analyzeResponse } from "@/lib/ai-monitor/analysis/analyze-response";
import { costUsdFor } from "@/lib/ai-monitor/pricing";
import {
  discoverKeywords,
  discoveryFailureReason,
  type DiscoveryCounts,
} from "./discover";
import { KofCapReachedError } from "./metering";
import { generateKeywordPrompts } from "./prompts";
import { rankFor, rankingsForDomain, trackedKeywordsFrom } from "./rankings";
import { releaseCredit } from "./credits";
import {
  AI_TESTED_KEYWORD_LIMIT,
  OPPORTUNITY_SCORE_VERSION,
  scoreOpportunity,
  selectAiTestKeywords,
  type AiEvidence,
  type OpportunityInput,
} from "./score";
import { addSpend, markCompleted, markFailed, markRunning, markStep } from "./store";

/** Default market. BrandProfile.country/language override per project. */
const DEFAULT_LOCATION_CODE = 2840; // United States
const DEFAULT_LANGUAGE_CODE = "en";

export interface RunSummary {
  analysisId: string;
  status: "COMPLETED" | "FAILED";
  keywordCount: number;
  aiTestedCount: number;
  dataforseoCostUsd: number;
  aiCostUsd: number;
  stoppedReason: string | null;
  /** Prompts that came from the model rather than the deterministic fallback. */
  generatedPrompts: number;
  /** Generated prompts dropped for naming the brand. */
  droppedForBrand: number;
  /** How the discovery funnel narrowed. Null when discovery never ran. */
  discovery: DiscoveryCounts | null;
}

/**
 * Visibility for a brand the answer named.
 *
 * 100/position, the shape ai-monitor/metrics.ts positionComponent() uses, and
 * ZERO for a brand named in prose but never ranked. Being mentioned in passing
 * and being recommended are different outcomes and only the second earns points.
 */
function visibilityFrom(mentioned: boolean, position: number | null): number | null {
  if (!mentioned) return null;
  if (position === null) return 0;
  return 100 / position;
}

/** Run one analysis to completion. Never throws — every exit updates the row. */
export async function runAnalysis(analysisId: string): Promise<RunSummary> {
  const analysis = await prisma.keywordOpportunityAnalysis.findUnique({
    where: { id: analysisId },
    select: {
      id: true,
      tenantId: true,
      domain: true,
      fundingSource: true,
      brandProfile: {
        select: {
          name: true,
          website: true,
          industry: true,
          language: true,
          aliases: true,
          competitors: true,
          topics: true,
        },
      },
      tenant: { select: { planType: true } },
    },
  });

  if (!analysis) throw new Error(`analysis ${analysisId} not found`);

  const plan = analysis.tenant.planType as PlanType;
  const ctx = { tenantId: analysis.tenantId, plan };
  const brand = analysis.brandProfile;
  const aliases = [brand.name, ...brand.aliases].filter((a) => a?.trim());

  const summary: RunSummary = {
    analysisId,
    status: "FAILED",
    keywordCount: 0,
    aiTestedCount: 0,
    dataforseoCostUsd: 0,
    aiCostUsd: 0,
    stoppedReason: null,
    generatedPrompts: 0,
    droppedForBrand: 0,
    discovery: null,
  };

  const fail = async (reason: { stoppedReason?: string; error?: string }) => {
    await markFailed(analysisId, reason);
    // A credit-funded run that failed gets its credit back. An allowance-funded
    // one never had anything held — markCompleted is the only place the
    // allowance moves, and it was not reached.
    await releaseCredit(analysis.tenantId, analysisId);
    summary.stoppedReason = reason.stoppedReason ?? null;
    return summary;
  };

  try {
    await markRunning(analysisId);

    // ── Rankings first: free, and its keyword list feeds discovery ──────────
    const ranks = await rankingsForDomain(analysis.tenantId, analysis.domain);

    // ── Steps 1 + 2: discover and enrich (one pair of Labs calls) ───────────
    const discovery = await discoverKeywords(ctx, {
      domain: analysis.domain,
      locationCode: DEFAULT_LOCATION_CODE,
      languageCode: brand.language || DEFAULT_LANGUAGE_CODE,
      brandAliases: aliases,
      trackedKeywords: trackedKeywordsFrom(ranks),
    });

    summary.dataforseoCostUsd = discovery.costUsd;
    summary.discovery = discovery.counts;
    await addSpend(analysisId, { dataforseoCostUsd: discovery.costUsd });
    await markStep(analysisId, "demand");

    if (discovery.keywords.length === 0) {
      // THREE DIFFERENT FAILURES, NAMED SEPARATELY — see discoveryFailureReason.
      return await fail({
        error: discoveryFailureReason(analysis.domain, discovery.counts, discovery.failed),
      });
    }

    // ── Step 3: attach our own rankings. Nothing bought. ────────────────────
    await markStep(analysisId, "rankings");
    const inputs: OpportunityInput[] = discovery.keywords.map((row) => {
      const lookup = rankFor(ranks, row.keyword);
      return {
        keyword: row.keyword,
        monthlyVolume: row.monthlyVolume,
        cpcUsd: row.cpcUsd,
        competition: row.competition,
        trendPercent: row.trendPercent,
        googleRank: lookup.rank,
        intent: row.intent,
        ai: null,
      };
    });

    // ── Step 5: the top fifteen by pre-AI score get one question each ──────
    await markStep(analysisId, "ai");
    const tested = selectAiTestKeywords(inputs, AI_TESTED_KEYWORD_LIMIT);
    const evidence = new Map<string, AiEvidence>();
    const promptRows = new Map<string, { text: string; intent: string }>();
    const resultRows = new Map<
      string,
      {
        brandMentioned: boolean;
        brandPosition: number | null;
        answerSnapshot: string;
        competitors: unknown;
        inputTokens: number;
        outputTokens: number;
        costUsd: number;
        model: string;
      }
    >();

    let aiCost = 0;
    let aiCapped = false;

    if (tested.length > 0) {
      const generated = await generateKeywordPrompts({
        keywords: tested.map((t) => ({ keyword: t.keyword, intent: t.intent })),
        brandAliases: aliases,
        industry: brand.industry ?? undefined,
        language: brand.language || DEFAULT_LANGUAGE_CODE,
      });
      summary.generatedPrompts = generated.prompts.filter((p) => p.generated).length;
      summary.droppedForBrand = generated.droppedForBrand;

      // The generation call is metered like any other, from its own usage.
      const generationCost = costUsdFor(
        "CLAUDE",
        generated.model ?? JSON_CALL_MODEL,
        {
          inputTokens: generated.inputTokens,
          outputTokens: generated.outputTokens,
          cachedInputTokens: 0,
        },
      ).costUsd;
      aiCost += generationCost;

      for (const prompt of generated.prompts) {
        promptRows.set(prompt.keyword, { text: prompt.text, intent: prompt.intent });

        try {
          // ONE PROMPT, ONE REPETITION, ONE PROVIDER. Deep multi-rep testing
          // across providers is the Watcher's product and is priced as one.
          const answer = await meteredAiCall(
            ctx,
            { provider: "CLAUDE", model: JSON_CALL_MODEL, purpose: "answer" },
            async () => {
              const asked = await askEngine({
                provider: "CLAUDE",
                model: JSON_CALL_MODEL,
                promptText: prompt.text,
              });
              return {
                value: asked,
                usage: { inputTokens: asked.inputTokens, outputTokens: asked.outputTokens },
                model: asked.model,
              };
            },
          );

          aiCost += costUsdFor("CLAUDE", answer.model, {
            inputTokens: answer.inputTokens,
            outputTokens: answer.outputTokens,
            cachedInputTokens: 0,
          }).costUsd;

          const analysed = await analyzeResponse(
            { answer: answer.answer, promptText: prompt.text },
            {
              brand: brand.name,
              domain: analysis.domain,
              brandVariations: brand.aliases,
              competitors: brand.competitors,
              categoryVocabulary: brand.topics,
            },
            ctx,
            { meter: meteredAiCall },
          );

          aiCost += costUsdFor("CLAUDE", analysed.extraction.model, {
            inputTokens: analysed.extraction.inputTokens,
            outputTokens: analysed.extraction.outputTokens,
            cachedInputTokens: 0,
          }).costUsd;

          evidence.set(prompt.keyword, {
            mentioned: analysed.brandMentioned,
            visibilityScore: visibilityFrom(analysed.brandMentioned, analysed.brandPosition),
            mentionRate: analysed.brandMentioned ? 1 : 0,
            averagePosition: analysed.brandPosition,
          });

          resultRows.set(prompt.keyword, {
            brandMentioned: analysed.brandMentioned,
            brandPosition: analysed.brandPosition,
            answerSnapshot: answer.answer,
            competitors: analysed.competitors.map((c) => ({
              name: c.name,
              position: c.position,
              classification: c.classification.classification,
            })),
            inputTokens: answer.inputTokens,
            outputTokens: answer.outputTokens,
            costUsd: 0,
            model: answer.model,
          });
        } catch (err) {
          if (err instanceof AiCapReachedError) {
            // Stop asking, keep what we have. The untested keywords score on
            // the five components that were measured; see the header.
            aiCapped = true;
            logger.warn(
              { analysisId, tenantId: analysis.tenantId, tested: evidence.size },
              "keyword-opportunity: AI cap reached mid-analysis; completing with partial AI coverage",
            );
            break;
          }
          // One bad answer is one untested keyword, not a failed analysis.
          logger.warn(
            { analysisId, keyword: prompt.keyword, err: err instanceof Error ? err.message : String(err) },
            "keyword-opportunity: AI test failed for one keyword",
          );
        }
      }
    }

    summary.aiCostUsd = aiCost;
    await addSpend(analysisId, { aiCostUsd: aiCost });

    // ── Step 6: final scores and persistence ───────────────────────────────
    await markStep(analysisId, "score");

    const scored = inputs.map((input) =>
      scoreOpportunity({ ...input, ai: evidence.get(input.keyword) ?? null }),
    );

    for (const row of scored) {
      const rank = rankFor(ranks, row.keyword);
      const opportunity = await prisma.keywordOpportunity.create({
        data: {
          analysisId,
          keyword: row.keyword,
          monthlyVolume: row.monthlyVolume,
          cpcUsd: row.cpcUsd,
          competition: row.competition,
          trendPercent: row.trendPercent,
          googleRank: row.googleRank,
          rankSource: rank.source,
          intent: row.intent,
          // A closed interface has no index signature, which is what Prisma's
          // InputJsonValue requires. The shape is plain data either way.
          componentScores: row.components as unknown as Prisma.InputJsonObject,
          opportunityScore: row.opportunityScore,
          severity: row.severity,
          aiTested: row.aiTested,
          aiMentioned: row.ai === null ? null : row.ai.mentioned,
          aiMentionRate: row.ai === null ? null : row.ai.mentionRate,
          aiAveragePosition: row.ai?.averagePosition ?? null,
        },
        select: { id: true },
      });

      const prompt = promptRows.get(row.keyword);
      if (!prompt || !row.aiTested) continue;

      const promptRow = await prisma.opportunityPrompt.create({
        data: { opportunityId: opportunity.id, text: prompt.text, intent: prompt.intent },
        select: { id: true },
      });

      const result = resultRows.get(row.keyword);
      if (!result) continue;

      await prisma.opportunityPromptResult.create({
        data: {
          promptId: promptRow.id,
          provider: "CLAUDE",
          model: result.model,
          brandMentioned: result.brandMentioned,
          brandPosition: result.brandPosition,
          answerSnapshot: result.answerSnapshot,
          competitors: result.competitors as never,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          costUsd: result.costUsd,
        },
      });
    }

    summary.keywordCount = scored.length;
    summary.aiTestedCount = scored.filter((row) => row.aiTested).length;
    summary.status = "COMPLETED";
    summary.stoppedReason = aiCapped ? "ai_cap_reached" : null;

    await markCompleted(analysisId, {
      keywordCount: summary.keywordCount,
      aiTestedCount: summary.aiTestedCount,
      fundingSource: analysis.fundingSource === "credits" ? "credits" : "allowance",
    });

    if (aiCapped) {
      await prisma.keywordOpportunityAnalysis.update({
        where: { id: analysisId },
        data: { stoppedReason: "ai_cap_reached" },
      });
    }

    return summary;
  } catch (err) {
    if (err instanceof KofCapReachedError) {
      return await fail({ stoppedReason: "cap_reached", error: err.message });
    }
    return await fail({ error: err instanceof Error ? err.message : String(err) });
  }
}

export { OPPORTUNITY_SCORE_VERSION };
