// The purchase archive's worker (ECHORANK-DATA-ARCHIVE.md): queue
// "purchase-archive", concurrency 4.
//
//   store     one captured object (src/lib/purchase-archive/capture.ts), up to
//             5 attempts with exponential backoff. Idempotent by the index row.
//             The LAST attempt spools the object instead of failing, so a
//             Spaces outage never loses a purchase.
//   drain     repeatable, every 10 min (cron, never `every`; see
//             crawl-archive.worker.ts): uploads both spools (purchases, and
//             the page snapshots of src/lib/page-archive/) oldest first,
//             stopping at the first failure, then raises the once-a-day spool
//             alert (#echorank-alerts) past 1,000 files or 1 GB in total.
//   manifest  repeatable, 00:20 UTC: v1/echorank/_manifests/<yesterday>.ndjson.gz
//             from the index rows.
//   retention repeatable, 03:40 UTC: personal-data purchases older than
//             PURCHASE_ARCHIVE_PERSONAL_MONTHS (24) deleted, object then row
//             (src/lib/purchase-archive/retention.ts); other purchases kept.
//             In the archive bucket, AI Lens and audit page snapshots older
//             than PAGE_ARCHIVE_AUDIT_DAYS (365) and report copies older than
//             REPORT_ARCHIVE_DAYS (730) (src/lib/page-archive/retention.ts).
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
import { archiveStore, type ObjectStore } from "@/lib/spaces/client";
import { postMatrixAlert } from "@/lib/matrix/alert";
import { drainPageSpool } from "@/lib/page-archive/spool";
import { pageSpoolDir } from "@/lib/page-archive/config";
import { prismaRetentionIndex, purgePersonalData, type RetentionIndex } from "@/lib/purchase-archive/retention";
import { purgeArchiveRetention } from "@/lib/page-archive/retention";

export const DRAIN_JOB = "drain";
export const MANIFEST_JOB = "manifest";
export const RETENTION_JOB = "retention";
export const DRAIN_CRON = "*/10 * * * *";
export const MANIFEST_CRON = "20 0 * * *";
export const RETENTION_CRON = "40 3 * * *";

const SCHEDULES: ReadonlyArray<{ name: string; pattern: string }> = [
  { name: DRAIN_JOB, pattern: DRAIN_CRON },
  { name: MANIFEST_JOB, pattern: MANIFEST_CRON },
  { name: RETENTION_JOB, pattern: RETENTION_CRON },
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
  /** The page-snapshot spool (src/lib/page-archive/spool.ts), drained by the same job. */
  pageStore: () => ObjectStore | null;
  drainPages: (store: ObjectStore) => Promise<{ uploaded: number; remaining: number; failed: boolean }>;
  pageDir: () => string;
  retentionIndex: RetentionIndex;
}

export const defaultPurchaseWorkerDeps: PurchaseWorkerDeps = {
  retentionIndex: prismaRetentionIndex,
  pageStore: () => archiveStore(),
  drainPages: (s) => drainPageSpool(s),
  pageDir: () => pageSpoolDir(),
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

  if (data.kind === "drain") {
    // Both spools: purchases (PURCHASE_ARCHIVE_*) and page snapshots (SPACES_ARCHIVE_*).
    const drained = store ? await drainSpool({ store, index: deps.index }) : null;
    const pageStore = deps.pageStore();
    const pages = pageStore ? await deps.drainPages(pageStore) : null;
    const alert = await checkSpoolAlert({ claimToday: deps.claimAlertDay, post: deps.post, now: deps.now, extraDirs: [deps.pageDir()] });
    if (drained?.uploaded || drained?.failed || pages?.uploaded || pages?.failed) logger.info({ purchases: drained, pages, spool: alert }, "archive: spool drain");
    return { purchases: drained, pages, alert };
  }

  if (data.kind === "retention") {
    // Two independent purges, each on its own bucket and key:
    //   purchases  personal-data objects past PURCHASE_ARCHIVE_PERSONAL_MONTHS (object, then row);
    //   archive    AI Lens / audit page snapshots past PAGE_ARCHIVE_AUDIT_DAYS (365)
    //              and report copies past REPORT_ARCHIVE_DAYS (730).
    const purchases = store ? await purgePersonalData({ store, index: deps.retentionIndex, now: deps.now() }) : null;
    const pageStore = deps.pageStore();
    const archive = pageStore ? await purgeArchiveRetention({ store: pageStore, now: deps.now() }) : null;
    logger.info({ purchases, archive }, "archive: nightly retention");
    return { purchases, archive };
  }

  if (!store) return { skipped: "not_configured" };

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
      await queue.add(RETENTION_JOB, { kind: "retention" }, { repeat: { pattern: RETENTION_CRON, tz: "UTC" }, attempts: 1 });
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
