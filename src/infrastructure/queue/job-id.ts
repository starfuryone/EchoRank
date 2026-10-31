/**
 * Custom BullMQ job ids.
 *
 * BullMQ 5 rejects a custom id containing ":" unless it splits into exactly
 * three parts (a compatibility carve-out for legacy repeatable ids, marked in
 * its source as going away). `citations:<id>` and `revenue:<t>:<m>:<d>` were
 * rejected at Queue.add, so the nightly sweeps that enqueue them failed three
 * times a night from the upgrade on and no rollup ran. Build ids here and the
 * separator can never be the one BullMQ reserves.
 *
 * Dependency-free on purpose: API routes import it to enqueue.
 */

/** Joins the parts with "-", and replaces any ":" inside a part with "-". */
export function queueJobId(...parts: Array<string | number>): string {
  if (parts.length === 0) throw new Error("queueJobId needs at least one part");
  return parts.map((p) => String(p).replaceAll(":", "-")).join("-");
}

/** The UTC calendar day, YYYY-MM-DD, for once-a-day dedupe keys. */
export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}
