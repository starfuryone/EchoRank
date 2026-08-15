/**
 * Agency Opportunity Scanner worker.
 *
 * Two jobs on one queue. A `fanOut` job turns a submitted batch into one job
 * per queued row; a row job runs one passive audit and writes the result.
 *
 * ── CONCURRENCY 4, and it only became true today ────────────────────────────
 * The sidecar's POST /audit used to call the synchronous `audit_site` directly
 * from an `async def`, which held the process's only event loop for the whole
 * audit. Four workers against that got strictly serial throughput AND stalled
 * every other endpoint on the sidecar — /health, the free public /grade tool,
 * and all five PDF builders — for the duration. Measured: four concurrent
 * passive audits finished at 0.44/1.10/1.54/3.57s, cumulative, and /health went
 * from 0.5ms to 831ms while one was in flight.
 *
 * av_service.py now runs it through starlette's run_in_threadpool, so this
 * concurrency is real. IF THAT CHANGE IS EVER REVERTED, this number is a lie
 * and a thousand-row batch will wedge the sidecar for hours — the header on
 * that endpoint says the same thing from the other side.
 *
 * ── crawl:false, always ─────────────────────────────────────────────────────
 * A passive audit fetches the homepage, robots.txt, sitemap.xml and llms.txt —
 * four requests to a site whose owner has not asked us to look. A crawl would
 * walk their internal links as well, and doing that a thousand times to
 * strangers, unsolicited, is a different thing from auditing a customer's own
 * site. It is also all the outreach PDF needs: every check that feeds a grade
 * except `content` scores identically without the crawl.
 *
 * ── The order of operations is a spending decision ──────────────────────────
 * Audit first, Places second, and only for a row that scored. The common
 * failure here is a prospect's site being unreachable, and buying a $0.032
 * Places lookup for a domain we then cannot audit would spend real money on
 * rows the agency gets nothing for. It also makes a retry of that common
 * failure free, which is what lets the queue policy allow two attempts.
 */

import { Worker, type Job } from "bullmq";
import { getSubscriberConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import { addJob } from "@/infrastructure/queue/registry";
import { logger } from "@/infrastructure/observability/logger";
import type { OpportunityScanJob } from "@/infrastructure/queue/jobs/schemas";
import { sidecarPost } from "@/lib/av-sidecar";
import { gradeFor, topGaps } from "@/lib/opportunity-scanner/grade";
import { lookupPlace } from "@/lib/opportunity-scanner/places";
import {
  completeRow,
  failRow,
  markRowRunning,
  queuedRows,
} from "@/lib/opportunity-scanner/store";
import { prisma } from "@/lib/prisma";
import { notifyScanComplete } from "@/lib/notifications/adapters";
import { chargedRowCount } from "@/lib/opportunity-scanner/store";
import { consumedCredit } from "@/lib/credits/ledger";
import { releaseUnconsumed, reservedFor } from "@/lib/credits/store";

/**
 * Give back the part of a finished batch's credit hold that was never spent.
 *
 * CALLED FROM BOTH TERMINAL PATHS — the last row succeeding and the last row
 * failing — because either one ends the batch and both leave unspent credits
 * held. It is idempotent through the ledger's (tenantId, reason, ref) unique,
 * so the two paths racing, or a worker retrying after the batch was already
 * settled, gives the credits back exactly once.
 *
 * NEVER THROWS INTO THE CALLER. A batch that finished has finished; turning a
 * refund failure into a job failure would retry the whole row, re-run its
 * audit, and still not fix the ledger. A stranded hold is a support ticket, and
 * this logs loudly enough to raise one.
 */
async function settleBatchCredits(tenantId: string, batchId: string): Promise<void> {
  try {
    const reserved = await reservedFor(tenantId, batchId);
    // Nothing held: a batch submitted with Places off never reserved, so there
    // is nothing to give back and no ledger row worth writing.
    if (reserved <= 0) return;

    const consumed = await chargedRowCount(batchId);
    const released = await releaseUnconsumed({ tenantId, batchId, reserved, consumed });

    logger.info(
      { queue: QUEUE_NAME, batchId, tenantId, reserved, consumed, released },
      "batch credits settled",
    );
  } catch (err) {
    logger.error({ err, batchId, tenantId }, "batch credit settlement FAILED — hold stranded");
  }
}

const QUEUE_NAME = "opportunity-scan" as const;
const FAN_OUT_JOB_NAME = "fan-out";
const ROW_JOB_NAME = "row";

/** See this file's header. Real only because the sidecar stopped blocking. */
const CONCURRENCY = 4;

/**
 * Client-side ceiling on one passive audit.
 *
 * The sidecar's own worst case is four sequential fetches at TIMEOUT=12, so 60s
 * leaves headroom over 48s without abandoning a request the sidecar is still
 * legitimately serving. sidecarPost's default would give up early and bill the
 * row as failed for a site that was merely slow — the exact false negative that
 * makes an agency skip a real prospect.
 */
const AUDIT_TIMEOUT_MS = 60_000;

interface AuditResponse {
  score?: number;
  checks?: unknown;
  error?: string;
}

/** Turn a submitted batch into one job per queued row. */
async function fanOut(batchId: string): Promise<number> {
  const rows = await queuedRows(batchId);

  for (const row of rows) {
    await addJob<OpportunityScanJob>(
      QUEUE_NAME,
      ROW_JOB_NAME,
      { rowId: row.id, domain: row.domain, batchId },
      // Keyed on the row. A re-delivered fan-out job (BullMQ at-least-once, or
      // an operator replaying one) must not enqueue a second scan for a row
      // that is already queued — that would double the batch's `done` counter
      // and complete it at half its rows.
      { jobId: `scan-row:${row.id}` },
    );
  }

  logger.info({ queue: QUEUE_NAME, batchId, enqueued: rows.length }, "scan batch fanned out");
  return rows.length;
}

/** Scan one prospect. */
async function scanRow(job: OpportunityScanJob): Promise<void> {
  const { rowId, domain, batchId } = job;
  if (!rowId || !domain || !batchId) {
    throw new Error("scan row job needs rowId, domain and batchId");
  }

  // Re-read the batch rather than trusting the payload for tenantId and the
  // Places flag: the job was written by a fan-out that may be minutes old, and
  // placesEnabled is the flag that decides whether this row spends money.
  // A payload-carried spending flag is a spending flag an attacker can forge if
  // anything ever gains the ability to enqueue.
  const batch = await batchContext(batchId);
  if (!batch) {
    logger.warn({ batchId, rowId }, "scan batch disappeared before its row ran");
    return;
  }

  await markRowRunning(rowId);

  // ── 1. The audit. Free, and the gate on everything below it. ─────────────
  const { status, data } = await sidecarPost<AuditResponse>(
    "/audit",
    { url: domain, crawl: false },
    { timeoutMs: AUDIT_TIMEOUT_MS },
  );

  if (status !== 200 || typeof data?.score !== "number") {
    // Thrown, not recorded, so BullMQ can retry. The terminal failure is
    // written by the catch in processOpportunityScanJob on the last attempt.
    throw new Error(data?.error || `sidecar returned ${status}`);
  }

  const score = data.score;
  const gaps = topGaps(data.checks);

  // ── 2. Places. Metered, off by default, never a reason to fail a row. ────
  const place = await lookupPlace({
    tenantId: batch.tenantId,
    domain,
    enabled: batch.placesEnabled,
    // Every Places-enabled batch reserved one credit per row at submit — the
    // route refuses the batch otherwise — so a lookup reaching this point is
    // prepaid, and prepaid lookups are not subject to the plan's USD cap.
    creditFunded: batch.placesEnabled,
  });

  const result = await completeRow({
    batchId,
    rowId,
    score,
    grade: gradeFor(score),
    topGaps: gaps,
    place: place.place,
    // costUsd, not `place != null`. A search that found no listing still cost a
    // search; a skipped one cost nothing. See ScanRow.placesCharged.
    placesCharged: consumedCredit(place.costUsd),
  });

  if (result.batchComplete) {
    await settleBatchCredits(batch.tenantId, batchId);
    await notifyScanComplete({
      tenantId: batch.tenantId,
      batchId,
      total: result.total,
      done: result.done,
    });
  }

  logger.info(
    {
      queue: QUEUE_NAME,
      batchId,
      domain,
      score,
      grade: gradeFor(score),
      gaps: gaps.length,
      placesHit: Boolean(place.place),
      placesReason: place.reason ?? null,
      // Dollars, per row. A metered line item that quietly gets more expensive
      // is invisible until the monthly cap trips.
      costUsd: Number(place.costUsd.toFixed(6)),
    },
    "scan row complete",
  );
}

/**
 * The batch's tenant and spending flag, read fresh.
 *
 * THE ONE UNTENANTED BATCH READ IN THIS FEATURE, and the exception is
 * structural rather than an oversight: the worker has no tenantId yet — that is
 * precisely what it is here to learn — so it cannot go through the store's
 * tenant-scoped getBatch like every other caller does.
 *
 * It is safe because the batchId came off the queue, not off an HTTP request,
 * and it is confined: not exported, returns two fields, and the tenantId it
 * yields is what every subsequent call in this file is scoped by. Nothing else
 * in the feature may copy this shape — see the header on store.ts.
 */
async function batchContext(
  batchId: string,
): Promise<{ tenantId: string; placesEnabled: boolean } | null> {
  return prisma.scanBatch.findUnique({
    where: { id: batchId },
    select: { tenantId: true, placesEnabled: true },
  });
}

async function processOpportunityScanJob(job: Job<OpportunityScanJob>): Promise<void> {
  if (job.data.fanOut) {
    if (!job.data.batchId) throw new Error("fan-out job needs a batchId");
    await fanOut(job.data.batchId);
    return;
  }

  try {
    await scanRow(job.data);
  } catch (err) {
    const attempts = job.opts.attempts ?? 1;
    const isLastAttempt = job.attemptsMade + 1 >= attempts;
    const { rowId, batchId } = job.data;

    // NOT ON EVERY ATTEMPT. Writing the terminal failure on the first one would
    // increment ScanBatch.done, and the retry that then succeeded would
    // increment it again — a batch that reports 1,004 of 1,000 done and fires
    // its completion notification four rows early.
    if (!isLastAttempt || !rowId || !batchId) throw err;

    const message = err instanceof Error ? err.message : String(err);
    const result = await failRow({ batchId, rowId, error: message });

    logger.warn({ queue: QUEUE_NAME, batchId, domain: job.data.domain, err }, "scan row failed");

    if (result.batchComplete) {
      const batch = await batchContext(batchId);
      if (batch) {
        // THE TERMINAL FAILURE PATH REFUNDS TOO. A batch whose last row failed
        // is still finished, and the rows that never reached the Places step
        // never spent a credit. Settling only on the success path would strand
        // the whole hold of a batch that failed at its final row.
        await settleBatchCredits(batch.tenantId, batchId);
        // A batch whose LAST row failed still completed. The notification says
        // how many finished, and the table shows which ones failed — silence
        // here would leave an agency watching a progress bar that never moves.
        await notifyScanComplete({
          tenantId: batch.tenantId,
          batchId,
          total: result.total,
          done: result.done,
        });
      }
    }
  }
}

// ─── Worker Factory ───────────────────────────────────────────────────────────

let worker: Worker<OpportunityScanJob> | null = null;

export function startOpportunityScanWorker(): Worker<OpportunityScanJob> {
  if (worker) return worker;

  worker = new Worker<OpportunityScanJob>(QUEUE_NAME, processOpportunityScanJob, {
    connection: getSubscriberConnection(),
    prefix: REDIS_CONFIG.queues.prefix,
    concurrency: CONCURRENCY,
  });

  // No repeatable tick. Batches are user-initiated; the API route enqueues the
  // fan-out job at submit.

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

export async function stopOpportunityScanWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}

/** Enqueue the fan-out for a freshly created batch. Called by the API route. */
export async function enqueueBatch(batchId: string): Promise<void> {
  await addJob<OpportunityScanJob>(
    QUEUE_NAME,
    FAN_OUT_JOB_NAME,
    { fanOut: true, batchId },
    { jobId: `scan-fanout:${batchId}` },
  );
}

export {
  processOpportunityScanJob,
  fanOut,
  scanRow,
  QUEUE_NAME,
  CONCURRENCY,
  AUDIT_TIMEOUT_MS,
};
