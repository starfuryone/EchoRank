// src/lib/ai-monitor/metrics-store.ts
//
// The database side of the analysis pipeline: what ./analysis produced onto the
// run, and what ./metrics computed onto the day.
//
// THIN BY DESIGN. Every decision worth arguing about — the score, the units,
// which aggregate maps to which column — is a pure function in ./metrics.ts
// with a test around it. What is left here is the writing, so a reader checking
// whether the numbers are right never has to read Prisma to find out.
//
// SEPARATE FROM ./metrics.ts for the reason ./metering.ts is separate from
// ./cap.ts: this file imports @/lib/prisma, which builds a connection pool at
// module scope and throws without DATABASE_URL. Keeping it out of the module
// that does the arithmetic is what lets the arithmetic be tested without a
// database.
//
// NOTHING CALLS THIS YET, AND SO NOTHING HAS RUN IT AGAINST A DATABASE. The
// checkup runner is step 3; until it exists these are the writers it will use,
// and the shapes they expect are pinned by the tests on the pure functions they
// consume. What those tests CANNOT catch is a column that does not exist, a
// unique constraint that fires, or a transaction that deadlocks — so step 3
// owes this file one integration test that round-trips a synthetic checkup
// through both writers against the test database. Until that exists, treat
// every line below as unverified against Postgres.

import { prisma } from "@/lib/prisma";
import { logger } from "@/infrastructure/observability/logger";
import type { RunAnalysis } from "./analysis/analyze-response";
import type { Sentiment } from "./analysis/entities";
import { MAX_ATTEMPTS } from "./json-call";
import { toVisibilityMetricRow, type Aggregate } from "./metrics";

/**
 * The ranking pass speaks in enum case; MentionAnalysis.sentiment predates it
 * and stores the lowercase form ./analysis/llm.ts writes. One mapper rather
 * than two conventions leaking into the column.
 *
 * NOT_MENTIONED becomes null: the column carries a tone, and "there was no
 * tone because we were not in the answer" is an absence, not a third value.
 */
export function toStoredSentiment(sentiment: Sentiment | null): string | null {
  if (sentiment === null || sentiment === "NOT_MENTIONED") return null;
  return sentiment.toLowerCase();
}

/**
 * Write one run's analysis.
 *
 * ONLY THE FIELDS THIS PIPELINE PRODUCES. MentionAnalysis is shared with
 * ./analysis/llm.ts, which owns the judgement columns (recommended,
 * recommendationStrength, quotedDescription, factualClaims,
 * possibleInaccuracies, confidence) and with ./scoring.ts, which owns
 * visibilityScore and prominenceScore. An upsert that blanked those on every
 * re-analysis would quietly delete another pass's work, so the update clause
 * names exactly what belongs here and nothing else.
 *
 * Citations and competitor mentions are REPLACED rather than merged: they are a
 * verbatim reading of one answer, so a re-analysis of that answer supersedes
 * the previous reading entirely, and merging would leave a citation the model
 * no longer makes.
 */
export async function persistRunAnalysis(
  args: { promptRunId: string; tenantId: string; analysis: RunAnalysis },
  now: Date = new Date(),
): Promise<void> {
  const { promptRunId, tenantId, analysis } = args;
  const d = analysis.deterministic;

  // Two failed strict-JSON attempts is the quarantine condition the column was
  // added for: not retried forever, not dropped, parked for review.
  const quarantined = !analysis.extraction.ok && analysis.extraction.attempts >= MAX_ATTEMPTS;
  const owned = {
    brandMentioned: d.brandMentioned,
    mentionCount: d.mentionCount,
    listPosition: d.listPosition,
    competitorNames: d.competitorNames,
    citedOwnDomain: d.citedOwnDomain,
    citedDomains: d.citedDomains,
    contextSnippets: d.contextSnippets,
    recommendationPosition: analysis.brandPosition,
    sentiment: toStoredSentiment(analysis.sentiment),
    quarantinedAt: quarantined ? now : null,
    quarantineReason: quarantined ? (analysis.extraction.error ?? "extraction failed") : null,
  };

  await prisma.$transaction([
    prisma.mentionAnalysis.upsert({
      where: { promptRunId },
      create: { promptRunId, ...owned },
      update: owned,
    }),
    prisma.citation.deleteMany({ where: { promptRunId } }),
    prisma.citation.createMany({
      data: analysis.citations.map((citation) => ({
        tenantId,
        promptRunId,
        url: citation.url,
        domain: citation.domain,
        title: citation.title,
        citationPosition: citation.citationPosition,
        // The citation supports the brand when it points at the brand's own
        // site. Whether a third-party page supports it is the verification
        // pass's question, not this one's.
        supportsBrand: citation.isMonitoredDomain,
      })),
    }),
    prisma.competitorMention.deleteMany({ where: { promptRunId } }),
    prisma.competitorMention.createMany({
      data: analysis.competitors.map((competitor) => ({
        tenantId,
        promptRunId,
        name: competitor.name,
        recommendationPosition: competitor.position,
      })),
    }),
  ]);
}

export interface EngineAggregate {
  engine: string;
  aggregate: Aggregate;
  /** From AIEngine.supportsCitations. Omitted means "it does". */
  supportsCitations?: boolean;
}

/**
 * Upsert one day's per-engine rows for a project.
 *
 * UPSERT, because (brandProfileId, engine, day) is unique and a checkup can run
 * twice in a day — the second run recomputes the day rather than adding a
 * second version of it.
 *
 * An empty set writes nothing and says so. The doc's rule is that zero runs
 * produces no metrics row: a row of zeroes is indistinguishable on a chart from
 * a day when every provider said no, and only one of those is a problem the
 * customer should act on.
 */
export async function writeVisibilityMetrics(
  brandProfileId: string,
  day: Date,
  engines: readonly EngineAggregate[],
): Promise<number> {
  if (engines.length === 0) {
    logger.warn(
      { brandProfileId, day: day.toISOString() },
      "no runs to aggregate — writing no visibility metrics for this day",
    );
    return 0;
  }

  for (const { engine, aggregate, supportsCitations } of engines) {
    // The row carries `engine` and `day`; on the update branch they are the key
    // being matched, so writing them back is a no-op rather than a change.
    const row = toVisibilityMetricRow(engine, day, aggregate, { supportsCitations });
    await prisma.visibilityMetric.upsert({
      where: { brandProfileId_engine_day: { brandProfileId, engine, day } },
      create: { brandProfileId, ...row },
      update: row,
    });
  }

  return engines.length;
}
