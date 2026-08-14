// src/lib/sov/alerts.ts
//
// Week-over-week share drops, per engine.
//
// COMPARES TWO SNAPSHOTS, never a snapshot against a freshly-computed number.
// Both sides come out of SovSnapshot through the same reader, so the two
// readings cannot differ in units, in rounding, or in which entities the
// denominator held. Recomputing "last week" on the fly would compare a 28-day
// window ending today against a 28-day window ending today, and find nothing.

import { shareByEngineOn } from "./store";
import { isReportableDrop, type ShareDrop } from "./weighting";

/** How far back "week over week" reaches. */
export const DROP_LOOKBACK_DAYS = 7;

/**
 * Engines where this brand's share fell by more than the threshold since last
 * week.
 *
 * An engine with no snapshot a week ago is SKIPPED, not treated as a fall from
 * zero — a prompt set that started running six days ago would otherwise alert
 * on every engine at once, on the day it first produced data, for having
 * "lost" a share it never had.
 *
 * Ordered by size of drop so the worst engine leads.
 */
export async function detectShareDrops(
  tenantId: string,
  promptSetId: string,
  brand: string,
  date: Date,
): Promise<ShareDrop[]> {
  const previousDate = new Date(date);
  previousDate.setUTCDate(previousDate.getUTCDate() - DROP_LOOKBACK_DAYS);

  const [now, before] = await Promise.all([
    shareByEngineOn(tenantId, promptSetId, brand, date),
    shareByEngineOn(tenantId, promptSetId, brand, previousDate),
  ]);

  const drops: ShareDrop[] = [];

  for (const [engine, beforeShare] of before) {
    // Absent from `now` means the brand held share last week and appears in no
    // row this week — a fall to zero, which is the most severe version of this
    // alert and must not be skipped for want of a row.
    const afterShare = now.get(engine) ?? 0;
    if (isReportableDrop(beforeShare, afterShare)) {
      drops.push({ engine, before: beforeShare, after: afterShare });
    }
  }

  return drops.sort((a, b) => b.before - b.after - (a.before - a.after));
}
