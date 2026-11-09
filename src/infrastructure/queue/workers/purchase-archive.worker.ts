// The purchase archive's worker (ECHORANK-DATA-ARCHIVE.md): queue
// "purchase-archive", concurrency 4.
//
//   store     one captured object (src/lib/purchase-archive/capture.ts), up to
//             5 attempts with exponential backoff. Idempotent by the index row.
//             The LAST attempt spools the object instead of failing, so a
//             Spaces outage never loses a purchase.
//   drain     repeatable, every 10 min (cron, never `every`; see
//             crawl-archive.worker.ts): uploads the spool oldest first, stops
//             at the first failure, then raises the once-a-day spool alert
//             (#echorank-alerts) past 1,000 files or 1 GB.
//   manifest  repeatable, 00:20 UTC: v1/echorank/_manifests/<yesterday>.ndjson.gz
//             from the index rows.
//
// Archive not configured (PURCHASE_ARCHIVE_* missing) → store spools, drain and
// manifest return at once.

import { Worker, type Job } from "bullmq";
import { getQueue } from "@/infrastructure/queue/registry";
import { getRedisConnection, getSubscriberConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import type { PurchaseArchiveJob } from "@/infrastructure/queue/jobs/schemas";
import { logger } from "@/infrastructure/observability/logger";
import { PURCHASE_ARCHIVE_QUEUE } from "@/lib/purchase-archive/capture";
import { purchaseStore } from "@/lib/purchase-archive/store";
import { prismaArchiveIndex } from "@/lib/purchase-archive/prisma-index";
import { deserializeObject, writeSpool } from "@/lib/purchase-archive/spool";
import { checkSpoolAlert, drainSpool, storeObject, writeManifest, type ArchiveIndex } from "@/lib/purchase-archive/writer";
import type { ObjectStore } from "@/lib/spaces/client";
import { postMatrixAlert } from "@/lib/matrix/alert";

export const DRAIN_JOB = "drain";
export const MANIFEST_JOB = "manifest";
export const DRAIN_CRON = "*/10 * * * *";
export const MANIFEST_CRON = "20 0 * * *";

const SCHEDULES: ReadonlyArray<{ name: string; pattern: string }> = [
  { name: DRAIN_JOB, pattern: DRAIN_CRON },
  { name: MANIFEST_JOB, pattern: MANIFEST_CRON },
];

/** Whether a registered repeatable is one we want (`every` arrives from Redis as a string). */
export function purchaseScheduleIsCurrent(entry: { name?: string; pattern?: string | null; every?: number | string | null }): boolean {
  const hasInterval = entry.every !== undefined && entry.every !== null && Number(entry.every) > 0;
  return !hasInterval && SCHEDULES.some((s) => s.name === entry.name && s.pattern === entry.pattern);
}

export interface PurchaseWorkerDeps {
  store: () => ObjectStore | null;
  index: ArchiveIndex;
  spool: typeof writeSpool;
  claimAlertDay: (day: string) => Promise<boolean>;
  post: (line: string) => Promise<boolean>;
  now: () => Date;
}

export const defaultPurchaseWorkerDeps: PurchaseWorkerDeps = {
  store: () => purchaseStore(),
  index: prismaArchiveIndex,
  spool: writeSpool,
  async claimAlertDay(day) {
    const res = await getRedisConnection().set(`echorank:purchase-archive:spool-alert:${day}`, "1", "EX", 2 * 86_400, "NX");
    return res === "OK";
  },
  post: (line) => postMatrixAlert(line),
  now: () => new Date(),
};

export async function processPurchaseArchiveJob(job: Job<PurchaseArchiveJob>, deps: PurchaseWorkerDeps = defaultPurchaseWorkerDeps): Promise<unknown> {
  const data = job.data;
  if (data.kind === "store") {
    const obj = deserializeObject(data.object);
    const store = deps.store();
    if (!store) {
      await deps.spool(obj);
      return { spooled: "not_configured" };
    }
    try {
      return { outcome: await storeObject(obj, { store, index: deps.index, now: deps.now }) };
    } catch (err) {
      const attempts = job.opts?.attempts ?? 1;
      if (job.attemptsMade + 1 >= attempts) {
        await deps.spool(obj);
        logger.warn({ err: (err as Error)?.message, endpoint: obj.endpoint }, "purchase-archive: store failed on its last attempt; spooled");
        return { spooled: "store_failed" };
      }
      throw err;
    }
  }

  const store = deps.store();
  if (!store) return { skipped: "not_configured" };

  if (data.kind === "drain") {
    const drained = await drainSpool({ store, index: deps.index });
    const alert = await checkSpoolAlert({ claimToday: deps.claimAlertDay, post: deps.post, now: deps.now });
    if (drained.uploaded || drained.failed) logger.info({ ...drained, spool: alert }, "purchase-archive: spool drain");
    return { ...drained, alert };
  }

  // manifest: yesterday (UTC) unless a day is given.
  const day = data.day ? new Date(`${data.day}T00:00:00Z`) : new Date(deps.now().getTime() - 86_400_000);
  const out = await writeManifest(day, { store, index: deps.index });
  logger.info(out, "purchase-archive: manifest written");
  return out;
}

let worker: Worker<PurchaseArchiveJob> | null = null;

export function startPurchaseArchiveWorker(): Worker<PurchaseArchiveJob> {
  if (worker) return worker;

  worker = new Worker<PurchaseArchiveJob>(PURCHASE_ARCHIVE_QUEUE, (job) => processPurchaseArchiveJob(job), {
    connection: getSubscriberConnection(),
    prefix: REDIS_CONFIG.queues.prefix,
    concurrency: 4,
  });

  void (async () => {
    const queue = getQueue(PURCHASE_ARCHIVE_QUEUE);
    try {
      for (const entry of await queue.getRepeatableJobs()) {
        if (purchaseScheduleIsCurrent(entry)) continue;
        await queue.removeRepeatableByKey(entry.key);
        logger.warn({ queue: PURCHASE_ARCHIVE_QUEUE, name: entry.name, stalePattern: entry.pattern }, "removed stale purchase-archive schedule");
      }
      await queue.add(DRAIN_JOB, { kind: "drain" }, { repeat: { pattern: DRAIN_CRON, tz: "UTC" }, attempts: 1 });
      await queue.add(MANIFEST_JOB, { kind: "manifest" }, { repeat: { pattern: MANIFEST_CRON, tz: "UTC" }, attempts: 2 });
    } catch (err) {
      logger.error({ err, queue: PURCHASE_ARCHIVE_QUEUE }, "failed to schedule the purchase-archive jobs");
    }
  })();

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, name: job?.name, err, queue: PURCHASE_ARCHIVE_QUEUE }, "purchase-archive job failed");
  });
  worker.on("error", (err) => {
    logger.error({ err, queue: PURCHASE_ARCHIVE_QUEUE }, "purchase-archive worker error");
  });

  logger.info({ queue: PURCHASE_ARCHIVE_QUEUE }, "purchase-archive worker started");
  return worker;
}
