// src/lib/keyword-opportunity/read.ts
//
// Stored rows -> the shapes the UI already renders.
//
// ── THE CLIENT COMPONENT DOES NOT CHANGE ────────────────────────────────────
//
// Phase 2 shipped the whole flow against ./fixtures.ts, typed against
// ./types.ts. This module's whole job is to produce that same shape from
// Prisma, so going live is a swap at the page boundary rather than a rewrite of
// the table, the detail panel and their tests. If something here does not fit
// the contract, the contract is what is right and this is what bends — the
// fixture and the database are two sources for one view, and the view is the
// product.
//
// ── THE COMPETITOR ROLLUP IS THE WATCHER'S, AGAIN ───────────────────────────
//
// Exactly as in ./fixtures.ts: stored answers are mapped onto
// ai-monitor/metrics.ts ScoredRun and handed to topCompetitors(), which filters
// to RIVAL. The classification was decided at write time by classifier v3 and
// stored on the row, so this is a pure read — re-tuning the classifier later
// re-runs a pure function over stored rows rather than buying the answers
// again, which is exactly why MentionAnalysis keeps PLATFORM and GENERIC rows
// instead of dropping them.

import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { topCompetitors, type ScoredRun } from "@/lib/ai-monitor/metrics";
import { recommendedActions } from "./recommendations";
import type { KeywordIntent, OpportunityComponents } from "./score";
import type {
  AnalysisStatus,
  AnalysisStep,
  CompetitorVisibility,
  KeywordOpportunityAnalysis,
  OpportunityRow,
} from "./types";

/** What a stored competitor entry looks like inside the JSON column. */
interface StoredCompetitor {
  name?: string;
  position?: number;
  classification?: "RIVAL" | "PLATFORM" | "GENERIC";
}

const ANALYSIS_SELECT = {
  id: true,
  domain: true,
  status: true,
  currentStep: true,
  scoreVersion: true,
  fromCache: true,
  cachedFromId: true,
  keywordCount: true,
  aiTestedCount: true,
  discoveredCount: true,
  brandedCount: true,
  costUsd: true,
  stoppedReason: true,
  error: true,
  createdAt: true,
  completedAt: true,
  brandProfile: { select: { name: true } },
  opportunities: {
    orderBy: [{ opportunityScore: "desc" }, { keyword: "asc" }],
    select: {
      id: true,
      keyword: true,
      monthlyVolume: true,
      cpcUsd: true,
      competition: true,
      trendPercent: true,
      googleRank: true,
      rankSource: true,
      intent: true,
      componentScores: true,
      opportunityScore: true,
      severity: true,
      aiTested: true,
      aiMentioned: true,
      aiMentionRate: true,
      aiAveragePosition: true,
      prompt: {
        select: {
          text: true,
          intent: true,
          result: {
            select: {
              provider: true,
              model: true,
              brandMentioned: true,
              brandPosition: true,
              answerSnapshot: true,
              competitors: true,
              checkedAt: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.KeywordOpportunityAnalysisSelect;

type AnalysisRow = Prisma.KeywordOpportunityAnalysisGetPayload<{
  select: typeof ANALYSIS_SELECT;
}>;

function storedCompetitors(value: unknown): StoredCompetitor[] {
  return Array.isArray(value) ? (value as StoredCompetitor[]) : [];
}

/**
 * Rival share across this analysis's answers.
 *
 * ACROSS THE ANALYSIS, NOT WITHIN ONE KEYWORD — each keyword is asked once, so
 * a per-keyword percentage could only ever be 0 or 100. The number that means
 * something is "named in 12 of the 15 answers we bought".
 */
function competitorVisibility(row: AnalysisRow): CompetitorVisibility[] {
  const runs: ScoredRun[] = row.opportunities
    .filter((opportunity) => opportunity.prompt?.result != null)
    .map((opportunity) => {
      const result = opportunity.prompt!.result!;
      return {
        engine: result.provider,
        promptId: opportunity.id,
        brandMentioned: result.brandMentioned,
        mentionCount: result.brandMentioned ? 1 : 0,
        brandPosition: result.brandPosition,
        sentiment: result.brandMentioned ? "NEUTRAL" : "NOT_MENTIONED",
        citations: [],
        competitors: storedCompetitors(result.competitors).map((competitor) => ({
          name: competitor.name ?? "",
          position: competitor.position ?? null,
          ...(competitor.classification ? { classification: competitor.classification } : {}),
        })),
      };
    });

  return topCompetitors(runs).map((competitor) => ({
    name: competitor.name,
    sharePercent: Math.round(competitor.frequency * 100),
    averagePosition: competitor.averagePosition,
  }));
}

function toRow(opportunity: AnalysisRow["opportunities"][number]): OpportunityRow {
  const components = opportunity.componentScores as unknown as OpportunityComponents;
  const result = opportunity.prompt?.result ?? null;
  const competitors = storedCompetitors(result?.competitors);

  // Rebuilt from the stored booleans rather than stored on the row. AiEvidence
  // is the scorer's input shape and re-deriving it keeps one definition; the
  // score itself is NOT recomputed here — it is read, because a version bump
  // must not silently restate what a customer was already shown.
  const ai =
    opportunity.aiTested && opportunity.aiMentioned !== null
      ? {
          mentioned: opportunity.aiMentioned,
          visibilityScore:
            components.aiGap === null ? null : Math.max(0, 100 - components.aiGap),
          mentionRate: opportunity.aiMentionRate ?? 0,
          averagePosition: opportunity.aiAveragePosition,
        }
      : null;

  return {
    id: opportunity.id,
    keyword: opportunity.keyword,
    monthlyVolume: opportunity.monthlyVolume,
    cpcUsd: Number(opportunity.cpcUsd),
    competition: opportunity.competition,
    trendPercent: opportunity.trendPercent,
    googleRank: opportunity.googleRank,
    intent: opportunity.intent as KeywordIntent,
    ai,
    opportunityScore: opportunity.opportunityScore,
    components,
    aiTested: opportunity.aiTested,
    scoreVersion: 1,
    severity: opportunity.severity as OpportunityRow["severity"],
    prompt: opportunity.prompt
      ? { text: opportunity.prompt.text, intent: opportunity.prompt.intent as KeywordIntent }
      : null,
    result: result
      ? {
          provider: result.provider,
          model: result.model,
          brandMentioned: result.brandMentioned,
          brandPosition: result.brandPosition,
          answerSnapshot: result.answerSnapshot,
          competitors: competitors
            .filter((competitor) => competitor.name)
            .map((competitor) => ({
              name: competitor.name as string,
              position: competitor.position ?? 0,
            })),
          checkedAt: result.checkedAt.toISOString(),
        }
      : null,
    actions: recommendedActions({
      googleRank: opportunity.googleRank,
      intent: opportunity.intent,
      aiTested: opportunity.aiTested,
      aiMentioned: opportunity.aiMentioned,
      rivalsInAnswer: competitors.length,
    }),
  };
}

/**
 * A cache hit's own identity, with the source run's opportunities.
 *
 * The row records that the tenant asked and when; the RESULT lives on the run
 * that was actually paid for. Merging them here rather than at write time is
 * what keeps one free re-run from duplicating a hundred opportunity rows.
 *
 * A dangling `cachedFromId` degrades to an empty result rather than throwing —
 * the pointer is deliberately not a foreign key, so the row it names can be
 * deleted by an operator, and a tenant's history should survive that.
 */
function withCachedSource(row: AnalysisRow, source: AnalysisRow | null): AnalysisRow {
  if (!source) return row;
  return { ...row, opportunities: source.opportunities };
}

function toAnalysis(row: AnalysisRow): KeywordOpportunityAnalysis {
  return {
    id: row.id,
    domain: row.domain,
    brandName: row.brandProfile.name,
    status: row.status as AnalysisStatus,
    currentStep: (row.currentStep as AnalysisStep | null) ?? null,
    scoreVersion: row.scoreVersion,
    requestedAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    fromCache: row.fromCache,
    keywordCount: row.keywordCount,
    aiTestedCount: row.aiTestedCount,
    discoveredCount: row.discoveredCount,
    brandedCount: row.brandedCount,
    emptyReason: row.status === "COMPLETED" ? row.stoppedReason : null,
    costUsd: Number(row.costUsd),
    rows: row.opportunities.map(toRow),
    competitors: competitorVisibility(row),
    // ONLY A FAILED RUN HAS AN ERROR. A COMPLETED run's stoppedReason is a
    // finding ("every keyword was your own brand") and travels in emptyReason
    // above; putting it here would paint a correct, completed analysis red.
    error: row.status === "FAILED" ? (row.error ?? row.stoppedReason ?? null) : null,
  };
}

/**
 * One analysis, tenant-scoped.
 *
 * findFirst with both ids, never findUnique on the id alone — CLAUDE.md's rule
 * for every route taking an :id, and the reason is that this row contains a
 * competitor's whole keyword strategy.
 */
/** Follow a cache hit to the run it was served from. Tenant-scoped, again. */
async function resolveSource(row: AnalysisRow, tenantId: string): Promise<AnalysisRow> {
  if (!row.fromCache || !row.cachedFromId) return row;
  const source = await prisma.keywordOpportunityAnalysis.findFirst({
    where: { id: row.cachedFromId, tenantId },
    select: ANALYSIS_SELECT,
  });
  return withCachedSource(row, source);
}

export async function readAnalysis(
  tenantId: string,
  analysisId: string,
): Promise<KeywordOpportunityAnalysis | null> {
  const row = await prisma.keywordOpportunityAnalysis.findFirst({
    where: { id: analysisId, tenantId },
    select: ANALYSIS_SELECT,
  });
  return row ? toAnalysis(await resolveSource(row, tenantId)) : null;
}

/** The newest analysis for one project, whatever its status. */
export async function readLatestAnalysis(
  tenantId: string,
  brandProfileId: string,
): Promise<KeywordOpportunityAnalysis | null> {
  const row = await prisma.keywordOpportunityAnalysis.findFirst({
    where: { tenantId, brandProfileId },
    orderBy: { createdAt: "desc" },
    select: ANALYSIS_SELECT,
  });
  return row ? toAnalysis(await resolveSource(row, tenantId)) : null;
}
