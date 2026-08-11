// src/lib/ai-monitor/runner/checkup-runner.ts
//
// Running one checkup: ask every slot in the plan, analyse what came back, roll
// the day up, and say honestly how much of the plan actually happened.
//
// THE I/O IS A PORT, NOT AN IMPORT. Every database write, provider call and cap
// check arrives through `RunnerPorts`. That is not ceremony — it is the only
// way the three behaviours that matter here can be tested at all, because this
// repo has no test database and the box's only DATABASE_URL points at
// production. Cap enforcement, idempotency and status derivation are each
// driven by fakes in tests/ai-search-runner.test.ts; ./ports.ts is the thin
// Prisma implementation that binds them to the real thing.
//
// THE CAP IS CHECKED BEFORE EVERY CALL, NOT ONCE PER CHECKUP. A checkup can
// cross its tenant's ceiling halfway through — that is the normal case, not an
// edge one — and a single check at the start would let the whole plan through
// on the strength of the first reading.
//
// AT THE CAP THE RUN IS SKIPPED AND THE CHECKUP CONTINUES. It is not an error
// and it does not stop anything: the slot is written SKIPPED_CAP, the loop
// moves on, and the checkup finishes PARTIAL with a flagged metrics row. Two
// things follow that are easy to get wrong and are each pinned by a test.
// First, the remaining slots are still ATTEMPTED rather than abandoned — spend
// is per-call, and a cheap engine later in the plan may still fit under a
// ceiling an expensive one just hit. Second, the answers already paid for are
// still scored; throwing them away because the budget ran out would waste money
// already spent and report less than we know.
//
// EVERY SLOT GETS A ROW. Including the skipped ones. A missing row is
// indistinguishable from a slot that was never planned, and the difference
// between "we did not ask" and "we asked and you were absent" is the difference
// between a coverage gap and a visibility collapse.

import type { CheckupStatus, PlanType, RunStatus } from "@/generated/prisma";
import { logger } from "@/infrastructure/observability/logger";
import type { BrandContext, RunAnalysis } from "../analysis/analyze-response";
import type { Aggregate } from "../metrics";
import { aggregateCheckup, type ScoredRun } from "../metrics";
import type { RunSlot } from "./plan";
import { slotKey } from "./plan";
import { isPartialCoverage, stoppedReason, tally, type CheckupTally } from "./status";

/** One engine's reply, with what it cost to get it. */
export interface AskOutcome {
  answer: string;
  sources?: { url: string; title?: string | null }[] | null;
  /** The model actually served, when it differs from the one requested. */
  model?: string;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
}

/** What one slot produced, as the runner records it. */
export interface SlotOutcome {
  slot: RunSlot;
  status: RunStatus;
  /** Null unless the slot answered. */
  analysis: RunAnalysis | null;
  /**
   * The reply itself, so the row can keep it. Null for a skipped or failed
   * slot — there is nothing to keep, and an empty string stored as an answer
   * would be analysed later as a real one in which nobody was mentioned.
   */
  ask: AskOutcome | null;
  error?: string;
}

/** One run this checkup recorded on an earlier pass. */
export interface PriorRun {
  /** slotKey() of the run. */
  key: string;
  status: RunStatus;
  /** Null unless it answered — only OK runs are scoreable. */
  scored: ScoredRun | null;
}

export interface CapReading {
  capped: boolean;
  spent: number;
  cap: number | null;
}

/**
 * Everything the runner touches outside itself.
 *
 * Each port is deliberately small and side-effecting in exactly one way, so a
 * fake is a few lines and a real implementation has nowhere to hide logic.
 */
export interface RunnerPorts {
  /** Where the tenant stands against its ceiling, right now. */
  readCap: (tenantId: string, plan: PlanType) => Promise<CapReading>;
  /**
   * Ask one engine, metered. Implementations MUST route through
   * metering.meteredAiCall so the row reaches the ledger.
   */
  ask: (slot: RunSlot) => Promise<AskOutcome>;
  /** Analyse one answer, metered. */
  analyze: (slot: RunSlot, answer: string, sources: { url: string; title?: string | null }[] | null) => Promise<RunAnalysis>;
  /**
   * Write one run and its analysis.
   *
   * MUST be keyed on (checkupId, promptId, engine, repetition) and MUST NOT
   * create a second row for a key that already exists — the unique index on
   * prompt_runs is what enforces that when two workers race.
   */
  persistRun: (outcome: SlotOutcome) => Promise<void>;
  /**
   * What this checkup has ALREADY recorded, for a resumed run.
   *
   * Returns the outcome and the scoreable form of each prior run, not just its
   * key. Keys alone are enough to avoid re-asking, and that is the trap: a
   * resumed checkup would then tally only the slots THIS pass ran, so finishing
   * the last two runs of a four-run plan would write a metrics row computed
   * from two, and re-running a complete checkup would find nothing to do,
   * count zero successes and mark a READY checkup FAILED.
   */
  priorRuns: (checkupId: string) => Promise<PriorRun[]>;
  /** Upsert the day's per-engine metrics rows. */
  writeMetrics: (args: {
    brandProfileId: string;
    day: Date;
    engines: { engine: string; aggregate: Aggregate; supportsCitations?: boolean }[];
    partialCoverage: boolean;
    skippedRuns: number;
  }) => Promise<void>;
  /** Move the checkup through its lifecycle. */
  setStatus: (
    checkupId: string,
    status: CheckupStatus,
    fields?: { stoppedReason?: string | null; startedAt?: Date; completedAt?: Date },
  ) => Promise<void>;
}

export interface RunCheckupArgs {
  checkupId: string;
  tenantId: string;
  brandProfileId: string;
  plan: PlanType;
  brand: BrandContext;
  slots: readonly RunSlot[];
  /** Engines that cannot cite, so their citationScore is null not zero. */
  citationCapableEngines?: ReadonlySet<string>;
  /** The UTC day the metrics row belongs to. */
  day: Date;
}

export interface RunCheckupResult {
  status: CheckupStatus;
  tally: CheckupTally;
  outcomes: SlotOutcome[];
  /** False when nothing was scoreable, so no row was written. */
  wroteMetrics: boolean;
}

/** The analysis, reshaped into what metrics.ts scores. */
export function toScoredRun(slot: RunSlot, analysis: RunAnalysis): ScoredRun {
  return {
    engine: slot.engine,
    promptId: slot.promptId,
    brandMentioned: analysis.brandMentioned,
    mentionCount: analysis.mentionCount,
    brandPosition: analysis.brandPosition,
    sentiment: analysis.sentiment,
    citations: analysis.citations.map((citation) => ({
      domain: citation.domain,
      citationPosition: citation.citationPosition,
      isMonitoredDomain: citation.isMonitoredDomain,
    })),
    competitors: analysis.competitors.map((competitor) => ({
      name: competitor.name,
      position: competitor.position,
    })),
  };
}

/**
 * Run a checkup to completion.
 *
 * Never throws for a provider or cap problem — those are outcomes, recorded per
 * slot. It throws only if the ports themselves are broken, which is a bug
 * rather than a condition.
 */
export async function runCheckup(
  args: RunCheckupArgs,
  ports: RunnerPorts,
): Promise<RunCheckupResult> {
  const { checkupId, tenantId, plan, slots, day } = args;

  await ports.setStatus(checkupId, "RUNNING", { startedAt: new Date() });

  // A resumed checkup re-plans identically (the plan is a pure function of the
  // tier and the prompts), so anything already recorded is skipped here as well
  // as being refused by the unique index. Doing both is deliberate: the index
  // is what makes it correct under a race, this is what makes a retry cheap
  // rather than paying for every answer a second time to have it rejected.
  const prior = await ports.priorRuns(checkupId);
  const alreadyDone = new Set(prior.map((run) => run.key));

  const outcomes: SlotOutcome[] = [];
  // Seeded with what earlier passes already collected, so both the status and
  // the metrics row describe the WHOLE checkup rather than this attempt.
  const scored: ScoredRun[] = prior
    .map((run) => run.scored)
    .filter((run): run is ScoredRun => run !== null);

  for (const slot of slots) {
    if (alreadyDone.has(slotKey(slot))) continue;

    const cap = await ports.readCap(tenantId, plan);
    if (cap.capped) {
      const outcome: SlotOutcome = {
        slot,
        status: "SKIPPED_CAP",
        analysis: null,
        ask: null,
        error: `cap_reached: $${cap.spent.toFixed(2)} of $${(cap.cap ?? 0).toFixed(2)}`,
      };
      outcomes.push(outcome);
      await ports.persistRun(outcome);
      // No break. The next slot may be cheaper, and the cap is re-read for it.
      continue;
    }

    try {
      const ask = await ports.ask(slot);
      const analysis = await ports.analyze(slot, ask.answer, ask.sources ?? null);
      const outcome: SlotOutcome = { slot, status: "OK", analysis, ask };
      outcomes.push(outcome);
      scored.push(toScoredRun(slot, analysis));
      await ports.persistRun(outcome);
    } catch (err) {
      const outcome: SlotOutcome = {
        slot,
        status: "FAILED",
        analysis: null,
        ask: null,
        error: err instanceof Error ? err.message : String(err),
      };
      outcomes.push(outcome);
      await ports.persistRun(outcome);
      logger.warn(
        { checkupId, slot: slotKey(slot), error: outcome.error },
        "checkup run failed; continuing with the rest of the plan",
      );
    }
  }

  const counts = tally([...prior.map((run) => ({ status: run.status })), ...outcomes]);
  const partial = isPartialCoverage(counts);
  let wroteMetrics = false;

  if (scored.length > 0) {
    const { byEngine } = aggregateCheckup(scored);
    await ports.writeMetrics({
      brandProfileId: args.brandProfileId,
      day,
      engines: Object.entries(byEngine).map(([engine, aggregate]) => ({
        engine,
        aggregate,
        // Absent set means "assume every engine cites"; an engine listed as
        // incapable gets a null citationScore rather than a zero.
        supportsCitations: args.citationCapableEngines
          ? args.citationCapableEngines.has(engine)
          : true,
      })),
      partialCoverage: partial,
      skippedRuns: counts.skippedCap + counts.failed,
    });
    wroteMetrics = true;
  } else {
    // Nothing to score. metrics.ts would return null for this run set anyway;
    // writing a row of zeroes would put "you are invisible" on a chart for a
    // day we never managed to ask.
    logger.warn(
      { checkupId, planned: counts.planned, skippedCap: counts.skippedCap, failed: counts.failed },
      "checkup produced no scoreable runs — no metrics row written",
    );
  }

  const status: CheckupStatus = counts.ok === 0 ? "FAILED" : partial ? "PARTIAL" : "READY";
  await ports.setStatus(checkupId, status, {
    stoppedReason: stoppedReason(counts),
    completedAt: new Date(),
  });

  return { status, tally: counts, outcomes, wroteMetrics };
}
