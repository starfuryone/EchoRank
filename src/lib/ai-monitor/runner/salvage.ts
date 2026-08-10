// src/lib/ai-monitor/runner/salvage.ts
//
// Rebuilding scoreable runs from what a dead checkup left in the database.
//
// WHY THIS EXISTS. ./checkup-runner.ts persists each run as it completes but
// writes the metrics row once, at the end. A worker killed halfway therefore
// leaves a row of paid-for answers with nothing scoring them — the money is
// spent, the analysis is stored, and the day shows no data. The reaper reads
// those runs back through here and finishes the job the dead worker started.
//
// PURE, so the mapping is testable without a database. It is a mapping worth
// testing: the persisted shape and the scoring shape disagree in three places
// that a reader would not expect, and each is a silent wrong answer rather than
// a crash.
//
//   sentiment            stored lowercase ("positive"), scored uppercase
//   brandPosition        stored as MentionAnalysis.recommendationPosition
//   isMonitoredDomain    stored as Citation.supportsBrand
//
// Those are not arbitrary: ./ports.ts writes them that way because
// MentionAnalysis predates the ranking pass and Citation has no
// is_monitored_domain column by design. This is the inverse of that write, and
// the two must be changed together.

import type { ScoredRun } from "../metrics";
import type { Sentiment } from "../analysis/entities";

/** The persisted shape this reads. Structural, so a test needs no Prisma. */
export interface PersistedRun {
  engine: string;
  promptId: string;
  status: string;
  brandMentioned: boolean;
  analysis: {
    mentionCount: number;
    recommendationPosition: number | null;
    sentiment: string | null;
  } | null;
  citations: { domain: string; citationPosition: number | null; supportsBrand: boolean }[];
  competitorMentions: { name: string; recommendationPosition: number | null }[];
}

/**
 * Back to the enum the scorer uses.
 *
 * Null maps to null rather than to NEUTRAL: metrics.ts excludes a mentioned run
 * with no reading from the sentiment average precisely so that a missing
 * judgement cannot be mistaken for an indifferent one, and inventing NEUTRAL
 * here would defeat that from the other side.
 */
export function toSentiment(stored: string | null): Sentiment | null {
  if (!stored) return null;
  const upper = stored.toUpperCase();
  return upper === "POSITIVE" || upper === "NEGATIVE" || upper === "NEUTRAL"
    ? (upper as Sentiment)
    : null;
}

/** One persisted run, as the scorer wants it. */
export function scoredRunFromPersisted(run: PersistedRun): ScoredRun {
  return {
    engine: run.engine,
    promptId: run.promptId,
    brandMentioned: run.brandMentioned,
    mentionCount: run.analysis?.mentionCount ?? 0,
    brandPosition: run.analysis?.recommendationPosition ?? null,
    sentiment: toSentiment(run.analysis?.sentiment ?? null),
    citations: run.citations.map((citation) => ({
      domain: citation.domain,
      citationPosition: citation.citationPosition,
      isMonitoredDomain: citation.supportsBrand,
    })),
    competitors: run.competitorMentions.map((competitor) => ({
      name: competitor.name,
      position: competitor.recommendationPosition,
    })),
  };
}

/**
 * The scoreable subset of a dead checkup's runs.
 *
 * ONLY status OK. A row written SKIPPED_CAP or FAILED records that we did not
 * get an answer; scoring it would count "we never asked" as "you were absent",
 * which is the one confusion this whole pipeline is built to avoid.
 */
export function salvageScoredRuns(runs: readonly PersistedRun[]): ScoredRun[] {
  return runs.filter((run) => run.status === "OK").map(scoredRunFromPersisted);
}
