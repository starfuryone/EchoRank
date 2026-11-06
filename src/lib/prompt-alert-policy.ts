// src/lib/prompt-alert-policy.ts
//
// When a tracked prompt's lost mention is worth an alert.
//
// One run is one sample of a noisy answer: a brand an engine names on most days
// will still be missing from some. Alerting on the first miss after a mention
// sends "you were dropped" for what is usually noise, then "you are back" the
// next day. So a lost-recommendation alert needs one of:
//
//   PERSISTENCE  the miss held for two consecutive runs: this run and the one
//                before both missed, and the run before THAT mentioned the
//                brand. Fires once, on the second miss.
//   EVIDENCE     the mention rate over the last RECENT runs is below the rate
//                over the EARLIER runs before them, with 90% Wilson intervals
//                that do not overlap — a real decline even when it never shows
//                as two misses in a row. Fires on the first run it becomes
//                true, not every run after.
//
// The history passed in must be runs on the SAME model as this one: a model
// change is a new baseline (visibility-monitoring.worker.ts).
//
// Pure; the worker passes the history, the tests drive it directly.

import { intervalsOverlap, wilsonInterval } from "@/lib/stats/noise";

/**
 * Five recent runs against the ten before them. With fewer recent runs the
 * interval rule could never fire before the persistence rule does: any three
 * runs low enough to separate from a strong baseline hold two misses in a row.
 * Five lets it catch an intermittent decline (2 of 5 after 10 of 10).
 */
export const RECENT_RUNS = 5;
export const EARLIER_RUNS = 10;

export type LostReason = "persisted" | "interval";

/** Recent window significantly below the earlier one, for a history ending at `end` (exclusive). */
function declinedAt(history: readonly boolean[], end: number): boolean {
  const recent = history.slice(Math.max(0, end - RECENT_RUNS), end);
  const earlier = history.slice(Math.max(0, end - RECENT_RUNS - EARLIER_RUNS), Math.max(0, end - RECENT_RUNS));
  if (recent.length < RECENT_RUNS || earlier.length < RECENT_RUNS) return false;
  const r = wilsonInterval(recent.filter(Boolean).length, recent.length);
  const e = wilsonInterval(earlier.filter(Boolean).length, earlier.length);
  return r.rate < e.rate && !intervalsOverlap(r, e);
}

/**
 * Should this run raise a regained alert? Only after a loss that persisted
 * (the last two runs both missed): a single miss raised no lost alert, so the
 * mention coming back is not news either.
 */
export function regainedRecommendation(history: readonly boolean[], current: boolean): boolean {
  const n = history.length;
  return current && n >= 2 && history[n - 1] === false && history[n - 2] === false;
}

/**
 * Should this run raise a lost-recommendation alert?
 *
 * `history` is every prior run's "brand mentioned", oldest first, on this
 * model; `current` is this run's.
 */
export function lostRecommendation(history: readonly boolean[], current: boolean): LostReason | null {
  if (current) return null;
  const all = [...history, current];
  const last = all.length - 1;
  if (persistedAt(all, last)) return "persisted";
  // The interval rule stands down when the persistence rule already fired
  // inside the recent window: that loss has been reported.
  for (let i = last - 1; i >= Math.max(0, last - RECENT_RUNS); i--) {
    if (persistedAt(all, i)) return null;
  }
  if (declinedAt(all, all.length) && !declinedAt(history, history.length)) return "interval";
  return null;
}

/** Run `i` is a second consecutive miss after a mention. */
function persistedAt(runs: readonly boolean[], i: number): boolean {
  return i >= 2 && runs[i] === false && runs[i - 1] === false && runs[i - 2] === true;
}
