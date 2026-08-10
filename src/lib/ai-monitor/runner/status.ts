// src/lib/ai-monitor/runner/status.ts
//
// How a finished checkup describes itself, and whether its metrics row admits
// to a gap.
//
// PURE, and separate from the runner for one reason: this is the decision a
// customer sees. "READY" and "PARTIAL" are the difference between a number they
// can act on and a number they should discount, and that call has to be
// testable without a database, a provider or a clock.
//
// A CAP IS NOT A FAILURE. A tenant that hits its monthly ceiling has not had an
// error; it has run out of the budget it chose. The runner skips what it cannot
// afford, finishes the rest, and the checkup lands PARTIAL with a flagged
// metrics row. Failing the whole checkup would throw away every answer already
// paid for, which is both wasteful and a worse report.
//
// ZERO ANSWERS IS FAILED EVEN WHEN NOTHING WENT WRONG. A checkup where every
// slot was skipped at the cap has nothing to score, so there is no metrics row
// to write — and a score of 0 would read as "you are invisible" when the truth
// is "we did not ask". Same distinction metrics.ts makes by returning null for
// an empty run set.

import type { CheckupStatus, RunStatus } from "@/generated/prisma";

export interface RunOutcome {
  status: RunStatus;
}

export interface CheckupTally {
  planned: number;
  ok: number;
  skippedCap: number;
  failed: number;
}

export function tally(outcomes: readonly RunOutcome[]): CheckupTally {
  return {
    planned: outcomes.length,
    ok: outcomes.filter((o) => o.status === "OK").length,
    skippedCap: outcomes.filter((o) => o.status === "SKIPPED_CAP").length,
    failed: outcomes.filter((o) => o.status === "FAILED").length,
  };
}

/**
 * The terminal status for a checkup that has stopped running.
 *
 * A plan with no slots at all is FAILED rather than READY: a checkup that
 * asked nothing has not succeeded, and calling it ready would put a brand with
 * no prompts selected on the dashboard as though it were being monitored.
 */
export function terminalStatus(tally: CheckupTally): CheckupStatus {
  if (tally.ok === 0) return "FAILED";
  if (tally.ok < tally.planned) return "PARTIAL";
  return "READY";
}

/** Whether the metrics row for this checkup must be flagged. */
export function isPartialCoverage(tally: CheckupTally): boolean {
  return tally.ok > 0 && tally.ok < tally.planned;
}

/**
 * What to record in Checkup.stoppedReason.
 *
 * Null on a clean finish. Names the cap specifically when that is what cost the
 * coverage, because "cap_reached" is an answer the customer can act on — raise
 * the tier, or narrow the plan — and "some runs failed" is not.
 */
export function stoppedReason(tally: CheckupTally): string | null {
  if (tally.skippedCap > 0 && tally.failed > 0) {
    return `cap_reached: ${tally.skippedCap} skipped, ${tally.failed} failed`;
  }
  if (tally.skippedCap > 0) return `cap_reached: ${tally.skippedCap} of ${tally.planned} skipped`;
  if (tally.failed > 0) return `provider_errors: ${tally.failed} of ${tally.planned} failed`;
  return null;
}
