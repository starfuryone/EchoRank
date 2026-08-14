/**
 * Citation Finder rollup worker.
 *
 * Two jobs on one queue, the same shape sov-aggregation.worker.ts uses. A
 * repeatable SWEEP finds every brand profile with tracking on and enqueues one
 * ROLLUP each; a rollup folds that brand's un-stamped citations into `sources`.
 *
 * READS THE WATCHER, WRITES ONLY THE ROLLUP. Nothing in src/lib/ai-monitor/ is
 * modified by this feature — not the analyzer, not the checkup runner, not the
 * scorer. The citations come out of the Citation table exactly as the runner
 * left them. The one column this worker writes back onto a Watcher row is
 * Citation.sourceId, which the schema has always reserved for it ("Set by the
 * Source aggregator") and which nothing else reads or writes.
 *
 * SEPARATE QUEUE, for the reason sov-aggregation gives: this job spends nothing
 * upstream, runs in seconds, and must not sit behind a backlog of checkups that
 * each take minutes and real money. The dependency runs the other way — this
 * reads what those wrote — so a slow checkup night delays the rollup by a day
 * rather than blocking the queue.
 *
 * NIGHTLY, AFTER THE CHECKUPS AND AFTER SHARE OF VOICE. The tick is at 03:35
 * UTC, fifteen minutes behind the SoV sweep, purely so the two rollups are not
 * competing for the same connection pool on the same box. Neither depends on
 * the other.
 *
 * A MISSED NIGHT IS SELF-HEALING, and more cleanly than SoV's is: the watermark
 * means the next run picks up exactly what the missed one would have, however
 * many nights later. Nothing has to be backfilled by hand.
 */

import { Worker, type Job } from "bullmq";
import { getSubscriberConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import { getQueue, addJob } from "@/infrastructure/queue/registry";
import { logger } from "@/infrastructure/observability/logger";
import type { CitationAggregationJob } from "@/infrastructure/queue/jobs/schemas";
import { listCitationBrandProfiles, rollUpBrandProfile } from "@/lib/citations/store";

const QUEUE_NAME = "citation-aggregation" as const;
const SWEEP_JOB_NAME = "sweep";
const ROLLUP_JOB_NAME = "rollup";

/** Nightly, behind the checkups and behind the share-of-voice sweep. */
const SWEEP_CRON = "35 3 * * *";

/**
 * Brand profiles rolled up at once in this process.
 *
 * Lower than sov-aggregation's 4 because each rollup holds a WRITE transaction
 * open while it upserts, where a SoV rollup is mostly reads. The ceiling that
 * matters is the connection pool, and a long-running transaction occupies one
 * for its whole life.
 */
const CONCURRENCY = 2;

/** Enqueue one rollup per tracked brand profile. */
async function sweep(): Promise<number> {
  const profiles = await listCitationBrandProfiles();

  for (const profile of profiles) {
    await addJob<CitationAggregationJob>(
      QUEUE_NAME,
      ROLLUP_JOB_NAME,
      { brandProfileId: profile.brandProfileId, tenantId: profile.tenantId },
      // Keyed on the brand profile alone, with no date: two rollups for one
      // brand must never run concurrently, because the read-merge-write on the
      // JSON columns is not atomic (see store.ts). A jobId that already exists
      // is dropped by BullMQ, which is exactly the mutual exclusion this needs
      // — and a dropped job costs nothing, since the watermark means the next
      // night picks up whatever this one skipped.
      { jobId: `citations:${profile.brandProfileId}` },
    );
  }

  logger.info({ queue: QUEUE_NAME, enqueued: profiles.length }, "citation sweep complete");
  return profiles.length;
}

/**
 * Roll up one brand profile.
 *
 * Re-reads the profile rather than trusting the job payload for the brand's
 * name: the payload was written by a sweep that may be hours old, and the brand
 * name is what decides whether a citation counted for us or for a rival.
 */
async function rollUpOne(job: CitationAggregationJob): Promise<void> {
  const { brandProfileId, tenantId } = job;
  if (!brandProfileId || !tenantId) {
    throw new Error("rollup job needs both brandProfileId and tenantId");
  }

  const profiles = await listCitationBrandProfiles(tenantId);
  const profile = profiles.find((candidate) => candidate.brandProfileId === brandProfileId);
  if (!profile) {
    logger.warn(
      { brandProfileId, tenantId },
      "brand profile vanished or paused before its citation rollup ran",
    );
    return;
  }

  const result = await rollUpBrandProfile(profile);

  logger.info(
    {
      queue: QUEUE_NAME,
      brandProfileId,
      tenantId,
      citations: result.citations,
      domains: result.domains,
    },
    "citation rollup complete",
  );
}

async function processCitationAggregationJob(job: Job<CitationAggregationJob>): Promise<void> {
  if (job.data.sweep) {
    await sweep();
    return;
  }
  await rollUpOne(job.data);
}

// ─── Worker Factory ───────────────────────────────────────────────────────────

let worker: Worker<CitationAggregationJob> | null = null;

export function startCitationAggregationWorker(): Worker<CitationAggregationJob> {
  if (worker) return worker;

  worker = new Worker<CitationAggregationJob>(QUEUE_NAME, processCitationAggregationJob, {
    connection: getSubscriberConnection(),
    prefix: REDIS_CONFIG.queues.prefix,
    concurrency: CONCURRENCY,
  });

  // Repeatable nightly tick. BullMQ dedupes the repeat config across restarts.
  getQueue(QUEUE_NAME)
    .add(
      SWEEP_JOB_NAME,
      { sweep: true },
      {
        repeat: { pattern: SWEEP_CRON, tz: "UTC" },
        removeOnComplete: true,
        removeOnFail: { count: 50 },
      },
    )
    .catch((err) => {
      logger.error({ err, queue: QUEUE_NAME }, "Failed to schedule citation sweep");
    });

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id, queue: QUEUE_NAME }, "Job completed");
  });
  worker.on("failed", (job, err) => {
    logger.error(
      { jobId: job?.id, attempt: job?.attemptsMade, err, queue: QUEUE_NAME },
      "Job failed",
    );
  });
  worker.on("error", (err) => {
    logger.error({ err, queue: QUEUE_NAME }, "Worker error");
  });

  return worker;
}

export async function stopCitationAggregationWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}

export { processCitationAggregationJob, sweep, rollUpOne };
