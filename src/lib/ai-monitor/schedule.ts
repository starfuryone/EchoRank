// src/lib/ai-monitor/schedule.ts
//
// When a prompt is next due, and how a tier's checkup frequency maps onto the
// per-prompt frequency the scheduler actually sweeps.
//
// PURE. Every function takes `now` as an argument. A scheduler whose tests can
// only assert "roughly a week from whenever the suite ran" is a scheduler whose
// off-by-one-day bug ships.
//
// TWO FREQUENCIES EXIST AND THEY ARE NOT THE SAME THING.
//   - The TIER's `aiCheckup.frequency` (plan-config.ts) is how often a whole
//     checkup runs. It is what the customer bought.
//   - A PROMPT's `trackingFrequency` is how often that one question is asked.
//     It starts as the tier's frequency and Phase 5 raises it for prompts whose
//     answers turn out to be volatile.
// A prompt can therefore be sampled more often than the tier's headline
// cadence, and the spend cap — not this file — is what bounds that.

import type { PromptFrequency } from "@/generated/prisma";
import type { CheckupFrequency } from "@/lib/plan-config";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days between runs for each per-prompt frequency. */
export const FREQUENCY_DAYS: Readonly<Record<PromptFrequency, number>> = {
  DAILY: 1,
  WEEKLY: 7,
  BIWEEKLY: 14,
  MONTHLY: 30,
};

/**
 * Ordered cheapest-to-most-frequent.
 *
 * Volatility escalation walks this array rather than switching on the value, so
 * adding a frequency does not mean finding every escalation site.
 */
export const FREQUENCY_LADDER: readonly PromptFrequency[] = [
  "MONTHLY",
  "BIWEEKLY",
  "WEEKLY",
  "DAILY",
];

/**
 * The per-prompt frequency a tier's checkup cadence implies.
 *
 * "twice_weekly" has no per-prompt equivalent — a prompt is asked on a whole
 * number of days — so it resolves to WEEKLY and the tier gets its second
 * sampling from the checkup scheduler running twice, not from every prompt
 * being due twice. Rounding it up to DAILY instead would multiply a GROWTH
 * tenant's spend by three-and-a-half without anyone asking for it.
 *
 * "custom" is ENTERPRISE, whose cadence is a contract term rather than a
 * config value; WEEKLY is the safe default until one is set.
 */
export function promptFrequencyFor(frequency: CheckupFrequency): PromptFrequency {
  switch (frequency) {
    case "daily":
      return "DAILY";
    case "twice_weekly":
    case "weekly":
    case "custom":
      return "WEEKLY";
    case "none":
      // A tier with no monitor still gets a value: the column is NOT NULL, and
      // nothing will ever sweep these rows because the tier enqueues nothing.
      return "MONTHLY";
  }
}

/** One step more frequent, or the same value when already at the top. */
export function escalate(frequency: PromptFrequency): PromptFrequency {
  const index = FREQUENCY_LADDER.indexOf(frequency);
  if (index === -1 || index === FREQUENCY_LADDER.length - 1) return frequency;
  return FREQUENCY_LADDER[index + 1];
}

/** One step less frequent, or the same value when already at the bottom. */
export function deescalate(frequency: PromptFrequency): PromptFrequency {
  const index = FREQUENCY_LADDER.indexOf(frequency);
  if (index <= 0) return frequency;
  return FREQUENCY_LADDER[index - 1];
}

/**
 * When a prompt should next run, given when it last ran.
 *
 * MEASURED FROM THE LAST RUN, NOT FROM NOW. Anchoring to `now` would let a
 * queue backlog drift the whole schedule later every cycle — a daily prompt
 * delayed twenty minutes each morning is asked at noon by the end of the month.
 *
 * Except when the last run is far enough in the past that the next slot has
 * already gone by: then the answer is `now`, not a time in the past, so a
 * project resumed after a pause runs once and rejoins the cadence rather than
 * firing every missed interval at once.
 */
export function nextRunAt(
  frequency: PromptFrequency,
  lastRunAt: Date | null,
  now: Date = new Date(),
): Date {
  if (!lastRunAt) return now;
  const due = new Date(lastRunAt.getTime() + FREQUENCY_DAYS[frequency] * DAY_MS);
  return due.getTime() <= now.getTime() ? now : due;
}

/**
 * Spread a project's prompts across the interval instead of firing them all at
 * midnight.
 *
 * Every prompt created in one onboarding shares a `nextRunAt` of now, so the
 * first checkup lands as one burst against every provider at once — which is
 * the shape of traffic that earns a rate limit. Staggering by index over the
 * first day of the interval costs nothing and turns the burst into a trickle.
 *
 * DETERMINISTIC, not random: a re-run of the same seeding produces the same
 * offsets, so an interrupted onboarding that is retried does not double-book
 * the queue at a new set of times.
 */
export function staggeredStart(
  index: number,
  total: number,
  now: Date = new Date(),
  windowMs: number = DAY_MS,
): Date {
  if (total <= 1) return now;
  const offset = Math.floor((index / total) * windowMs);
  return new Date(now.getTime() + offset);
}
