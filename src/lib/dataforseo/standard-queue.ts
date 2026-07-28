// src/lib/dataforseo/standard-queue.ts
//
// The shared drain for DataForSEO's standard queue.
//
// WHY THIS IS ONE ENGINE AND NOT ONE SWEEP PER FEATURE:
// `tasks_ready` is a DRAIN — an id disappears from the list once any request
// reads it. Two independent sweeps polling it would each silently consume the
// other's ids ("not mine, skip") and each feature would then depend on the
// slow direct-task_get fallback to notice its own finished work. So there is
// exactly one reader, and it dispatches each id to whichever owner claims it.
//
// Adding a third consumer of the standard queue means writing a
// StandardQueueOwner and registering it — not another tasks_ready poller.
//
// Every call this engine makes (tasks_ready, task_get) is FREE at DataForSEO.
// The only billed call in these features is the task_post that created the row.

import { getEndpoint, DataforseoError } from "./client";
import { SERP } from "./endpoints";
import { logger } from "@/infrastructure/observability/logger";

/** A row waiting on an upstream task. */
export interface PendingTask {
  rowId: string;
  taskId: string;
  createdAt: Date;
}

/**
 * One table's stake in the standard queue. Implementations own their own
 * persistence; the engine owns the polling protocol.
 */
export interface StandardQueueOwner {
  /** Log label, and the tie-breaker if two owners ever claim one id. */
  readonly name: string;
  /** Mark rows older than `cutoff` failed. Returns how many. */
  timeoutStale(cutoff: Date): Promise<number>;
  /** Queued rows with a task id, created at or before `createdBefore`. */
  findPending(createdBefore: Date, limit: number): Promise<PendingTask[]>;
  /** Store a finished task_get result. */
  complete(rowId: string, result: unknown[]): Promise<void>;
  /** Record a terminal failure. */
  fail(rowId: string, message: string): Promise<void>;
}

/** One entry of the tasks_ready result array. */
interface ReadyTask {
  id?: string;
}

/** DataForSEO status codes meaning "posted, just not done yet". */
const IN_QUEUE_PATTERN = /task in queue|task handed|in progress|no results/i;

/** Don't look for a task before DataForSEO has had a chance to run it. */
export const MIN_AGE_MS = 30_000;
/**
 * Give up on a queued row after this long and surface the failure.
 *
 * 90 minutes, not 30. DataForSEO's standard queue is documented at 1–5 min but
 * its actual SLA is "within 45 minutes", and it does use that headroom — a
 * 2-keyword rank run posted 2026-07-28 was still `Task In Queue` 25 min in. At
 * 30 min this timeout was failing rows whose results DataForSEO went on to
 * deliver, which both loses the data and wastes the money already spent on it.
 */
export const TASK_TIMEOUT_MS = 90 * 60_000;
/** Rows this old that tasks_ready never mentioned get a direct task_get. */
export const DIRECT_GET_AFTER_MS = 5 * 60_000;
/** Cap the work of one tick; the next tick picks up the rest. */
export const SWEEP_BATCH = 50;

/**
 * Upstream error text reaches the API (and support tickets), so the vendor
 * name is scrubbed here — user-facing surfaces say Echorank360 or nothing.
 */
export function sanitizeUpstreamError(message: string): string {
  return message.replace(/dataforseo/gi, "the SERP data provider").slice(0, 500);
}

/**
 * Fetch one finished task and hand it to its owner. Returns false (leaving the
 * row queued for a later tick) when DataForSEO says it simply isn't done yet.
 */
async function collectTask(
  owner: StandardQueueOwner,
  rowId: string,
  taskId: string,
): Promise<boolean> {
  try {
    const { data } = await getEndpoint<unknown[]>(
      `${SERP.organicTaskGet}/${taskId}`,
      // The live path carries a per-task id; fixtures key on the stable prefix.
      { fixtureKey: SERP.organicTaskGet },
    );
    await owner.complete(rowId, data);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (err instanceof DataforseoError && IN_QUEUE_PATTERN.test(message)) {
      return false; // still cooking — try again next tick
    }

    logger.error({ owner: owner.name, rowId, taskId, err }, "standard-queue task_get failed");
    await owner.fail(rowId, sanitizeUpstreamError(message));
    return true;
  }
}

export interface SweepStats {
  pending: number;
  collected: number;
  retried: number;
  timedOut: number;
}

/**
 * One tick across every registered owner.
 *
 * Order matters: time out stale rows first (so they leave the pending set),
 * then read the ready list ONCE for all owners, then direct-fetch whatever the
 * ready list never mentioned.
 */
export async function sweepStandardQueue(
  owners: readonly StandardQueueOwner[],
  now = new Date(),
): Promise<SweepStats> {
  const nowMs = now.getTime();

  // ── 1. Time out anything stuck, per owner. ─────────────────────────────
  let timedOut = 0;
  for (const owner of owners) {
    try {
      timedOut += await owner.timeoutStale(new Date(nowMs - TASK_TIMEOUT_MS));
    } catch (err) {
      logger.error({ owner: owner.name, err }, "standard-queue timeout pass failed");
    }
  }

  // ── 2. Collect every owner's pending rows into one id map. ─────────────
  const createdBefore = new Date(nowMs - MIN_AGE_MS);
  const byTaskId = new Map<string, { owner: StandardQueueOwner; row: PendingTask }>();
  const pending: { owner: StandardQueueOwner; row: PendingTask }[] = [];

  for (const owner of owners) {
    try {
      for (const row of await owner.findPending(createdBefore, SWEEP_BATCH)) {
        const entry = { owner, row };
        pending.push(entry);
        // First registration wins. Task ids are DataForSEO uuids and unique
        // per owner table, so a clash means a bug, not a legitimate race.
        if (!byTaskId.has(row.taskId)) byTaskId.set(row.taskId, entry);
      }
    } catch (err) {
      logger.error({ owner: owner.name, err }, "standard-queue findPending failed");
    }
  }

  if (pending.length === 0) return { pending: 0, collected: 0, retried: 0, timedOut };

  // ── 3. Ready list -> dispatch to the claiming owner. ───────────────────
  const collected = new Set<string>();
  // Rows already fetched this tick, whether or not they were done — step 4
  // must not ask again for a task we just heard "in queue" about.
  const attempted = new Set<string>();
  try {
    const { data } = await getEndpoint<ReadyTask[]>(SERP.organicTasksReady);
    for (const ready of data) {
      const entry = ready.id ? byTaskId.get(ready.id) : undefined;
      if (!entry) continue; // not ours (or already handled this tick)
      const key = `${entry.owner.name}:${entry.row.rowId}`;
      attempted.add(key);
      if (await collectTask(entry.owner, entry.row.rowId, ready.id as string)) {
        collected.add(key);
      }
    }
  } catch (err) {
    // A tasks_ready outage must not stall the queue — step 4 still runs, and
    // the next tick retries.
    logger.error({ err }, "standard-queue tasks_ready failed");
  }

  // ── 4. Direct fetch for rows the ready list never mentioned. ───────────
  const stale = pending.filter(
    ({ owner, row }) =>
      !attempted.has(`${owner.name}:${row.rowId}`) &&
      row.createdAt.getTime() < nowMs - DIRECT_GET_AFTER_MS,
  );
  for (const { owner, row } of stale) {
    await collectTask(owner, row.rowId, row.taskId);
  }

  const stats = {
    pending: pending.length,
    collected: collected.size,
    retried: stale.length,
    timedOut,
  };
  logger.info({ ...stats, owners: owners.map((o) => o.name) }, "standard-queue sweep complete");
  return stats;
}
