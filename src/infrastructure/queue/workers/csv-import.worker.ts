import { Worker, type Job } from "bullmq";
import { getSubscriberConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import type { CsvImportJob } from "@/infrastructure/queue/jobs/schemas";
import { prisma } from "@/lib/prisma";
import { logger } from "@/infrastructure/observability/logger";
import { buildReviews, MAX_RETAINED_ERRORS } from "@/monitoring/import/csv-parser";
import { persistAndDispatchReviews } from "@/monitoring/ingestion/persist";
import type { ColumnMapping } from "@/monitoring/import/source-presets";
import type { MonitoringPlatform, Prisma } from "@/generated/prisma";

const QUEUE_NAME = "csv-import";

async function processCsvImport(job: Job<CsvImportJob>): Promise<void> {
  const { tenantId, importJobId, correlationId } = job.data;

  const importJob = await prisma.importJob.findFirst({
    where: { id: importJobId, tenantId },
  });

  if (!importJob) {
    logger.warn({ jobId: job.id, importJobId, queue: QUEUE_NAME }, "Import job not found");
    return;
  }

  // Idempotency: only QUEUED jobs are processable. A retry that already
  // completed (or was cancelled) is a no-op.
  if (importJob.status !== "QUEUED" && importJob.status !== "PROCESSING") {
    logger.info(
      { jobId: job.id, importJobId, status: importJob.status, queue: QUEUE_NAME },
      "Import job not in a processable state, skipping",
    );
    return;
  }

  if (!importJob.rawContent || !importJob.columnMapping || !importJob.sourceId) {
    await prisma.importJob.update({
      where: { id: importJob.id },
      data: { status: "FAILED", errorMessage: "Missing staged content, mapping, or source" },
    });
    return;
  }

  await prisma.importJob.update({
    where: { id: importJob.id },
    data: { status: "PROCESSING", startedAt: new Date() },
  });

  try {
    const { reviews, errors, totalRows } = buildReviews(
      importJob.rawContent,
      importJob.hasHeaderRow,
      importJob.columnMapping as ColumnMapping,
      importJob.platform as MonitoringPlatform,
      tenantId,
      importJob.sourceId,
    );

    const { inserted, duplicates } = await persistAndDispatchReviews(
      tenantId,
      reviews,
      correlationId,
    );

    // Record one monitoring-check usage event per import, consistent with how
    // the monitoring pipeline meters an ingestion run.
    await prisma.usageMeter.create({
      data: {
        tenantId,
        meterType: "MONITORING_CHECK",
        quantity: 1,
        metadata: { importJobId, source: "csv", inserted, duplicates, correlationId },
      },
    });

    const failedRows = errors.length;
    const finalStatus = failedRows > 0 ? "PARTIAL" : "COMPLETED";

    await prisma.importJob.update({
      where: { id: importJob.id },
      data: {
        status: finalStatus,
        totalRows,
        importedRows: inserted,
        duplicateRows: duplicates,
        failedRows,
        errors: errors.slice(0, MAX_RETAINED_ERRORS) as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
        // Free the staged text once successfully ingested.
        rawContent: null,
      },
    });

    logger.info(
      { jobId: job.id, importJobId, inserted, duplicates, failedRows, queue: QUEUE_NAME },
      "CSV import complete",
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.importJob.update({
      where: { id: importJob.id },
      data: { status: "FAILED", errorMessage: message, completedAt: new Date() },
    });
    logger.error({ jobId: job.id, importJobId, err, queue: QUEUE_NAME }, "CSV import failed");
    throw err;
  }
}

let worker: Worker<CsvImportJob> | null = null;

export function startCsvImportWorker(): Worker<CsvImportJob> {
  if (worker) return worker;

  worker = new Worker<CsvImportJob>(QUEUE_NAME, processCsvImport, {
    connection: getSubscriberConnection(),
    prefix: REDIS_CONFIG.queues.prefix,
    concurrency: 2,
    limiter: { max: 10, duration: 60_000 },
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

  logger.info({ queue: QUEUE_NAME }, "Worker started");
  return worker;
}

export async function stopCsvImportWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info({ queue: QUEUE_NAME }, "Worker stopped");
  }
}

export { processCsvImport };
