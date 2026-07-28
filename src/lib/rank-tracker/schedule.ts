// src/lib/rank-tracker/schedule.ts
//
// Which projects are due on a given scheduler tick. Pure and date-injectable
// so the weekly-anchor rule is testable without waiting a week.
//
// The tick fires once a day (SCHEDULE_HOUR_UTC). Daily projects are due every
// tick; weekly projects are due on the UTC weekday they were created — the
// anchor spreads load across the week for free instead of stacking every
// weekly project onto Monday.

import type { RankFrequency } from "./options";

/** The subset of a RankProject row the due-check needs. */
export interface SchedulableProject {
  id: string;
  frequency: string;
  active: boolean;
  createdAt: Date;
  lastRunAt?: Date | null;
}

/** UTC weekday, 0 = Sunday. */
export function weekdayAnchor(createdAt: Date): number {
  return createdAt.getUTCDay();
}

/**
 * Guard against a double-run when a tick is retried or the worker restarts
 * within the same day: a project that already ran today is not due again.
 * Daily cadence means at most one run per UTC calendar day.
 */
function alreadyRanToday(lastRunAt: Date | null | undefined, now: Date): boolean {
  if (!lastRunAt) return false;
  return lastRunAt.toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
}

export function isDue(project: SchedulableProject, now: Date): boolean {
  if (!project.active) return false;
  if (alreadyRanToday(project.lastRunAt, now)) return false;

  const frequency = project.frequency as RankFrequency;
  if (frequency === "daily") return true;
  if (frequency === "weekly") return now.getUTCDay() === weekdayAnchor(project.createdAt);

  // Unknown cadence (e.g. a value written by a future version): skip rather
  // than guess and spend money on the wrong day.
  return false;
}

/** Filters a batch of projects to the ones due on this tick. */
export function selectDueProjects<T extends SchedulableProject>(
  projects: T[],
  now: Date,
): T[] {
  return projects.filter((project) => isDue(project, now));
}
