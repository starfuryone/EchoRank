import { Worker, type Job } from "bullmq";
import { getSubscriberConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import type { ExtensionImportJob } from "@/infrastructure/queue/jobs/schemas";
import { prisma } from "@/lib/prisma";
import { logger } from "@/infrastructure/observability/logger";
import { persistAndDispatchReviews } from "@/monitoring/ingestion/persist";
import { buildExtensionReviews } from "@/monitoring/ingestion/extension-ingest";
import { extensionImportSchema } from "@/monitoring/import/extension-schema";
import type { MonitoringPlatform } from "@/generated/prisma";

const QUEUE_NAME = "extension-import";

/**
 * Process a staged extension import. The route has already validated, upserted
 * the source, and stored the batch JSON in importJob.rawContent. This worker
 * re-validates (defense in depth), shapes the untrusted rows into
 * ExternalReviewInput[], and feeds them through the SAME ingestion seam as CSV
 * import (persistAndDispatchReviews → dedup → ai-processing → reputation).
 */
async function processExtensionImport(job: Job<ExtensionImportJob>): Promise<void> {
  const { tenantId, importJobId, correlationId } = job.data;

  const importJob = await prisma.importJob.findFirst({
    where: { id: importJobId, tenantId },
  });
  if (!importJob) {
    logger.warn({ jobId: job.id, importJobId, queue: QUEUE_NAME }, "Import job not found");
    return;
  }

  // Idempotency: only QUEUED/PROCESSING are processable.
  if (importJob.status !== "QUEUED" && importJob.status !== "PROCESSING") {
    logger.info(
      { jobId: job.id, importJobId, status: importJob.status, queue: QUEUE_NAME },
      "Import job not in a processable state, skipping",
    );
    return;
  }
  if (!importJob.rawContent || !importJob.sourceId) {
    await prisma.importJob.update({
      where: { id: importJob.id },
      data: { status: "FAILED", errorMessage: "Missing staged content or source" },
    });
    return;
  }

  await prisma.importJob.update({
    where: { id: importJob.id },
    data: { status: "PROCESSING", startedAt: new Date() },
  });

  try {
    const parsed = extensionImportSchema.safeParse(JSON.parse(importJob.rawContent));
    if (!parsed.success) {
      throw new Error("Staged batch failed re-validation");
    }

    const { reviews, skipped } = buildExtensionReviews(
      tenantId,
      importJob.sourceId,
      importJob.platform as MonitoringPlatform,
      parsed.data.reviews,
    );

    const { inserted, duplicates } = await persistAndDispatchReviews(
      tenantId,
      reviews,
      correlationId,
    );

    // Meter one ingestion run, consistent with the CSV worker.
    await prisma.usageMeter.create({
      data: {
        tenantId,
        meterType: "MONITORING_CHECK",
        quantity: 1,
        metadata: { importJobId, source: "extension", inserted, duplicates, skipped, correlationId },
      },
    });

    await prisma.importJob.update({
      where: { id: importJob.id },
      data: {
        status: skipped > 0 ? "PARTIAL" : "COMPLETED",
        totalRows: parsed.data.reviews.length,
        importedRows: inserted,
        duplicateRows: duplicates,
        failedRows: skipped,
        completedAt: new Date(),
        rawContent: null, // free the staged payload
      },
    });

    logger.info(
      { jobId: job.id, importJobId, inserted, duplicates, skipped, queue: QUEUE_NAME },
      "Extension import complete",
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.importJob.update({
      where: { id: importJob.id },
      data: { status: "FAILED", errorMessage: message, completedAt: new Date() },
    });
    logger.error({ jobId: job.id, importJobId, err, queue: QUEUE_NAME }, "Extension import failed");
    throw err;
  }
}

let worker: Worker<ExtensionImportJob> | null = null;

export function startExtensionImportWorker(): Worker<ExtensionImportJob> {
  if (worker) return worker;

  worker = new Worker<ExtensionImportJob>(QUEUE_NAME, processExtensionImport, {
    connection: getSubscriberConnection(),
    prefix: REDIS_CONFIG.queues.prefix,
    concurrency: 2,
    limiter: { max: 10, duration: 60_000 },
  });

  worker.on("completed", (j) => logger.info({ jobId: j.id, queue: QUEUE_NAME }, "Job completed"));
  worker.on("failed", (j, err) =>
    logger.error({ jobId: j?.id, attempt: j?.attemptsMade, err, queue: QUEUE_NAME }, "Job failed"),
  );
  worker.on("error", (err) => logger.error({ err, queue: QUEUE_NAME }, "Worker error"));

  logger.info({ queue: QUEUE_NAME }, "Worker started");
  return worker;
}

export async function stopExtensionImportWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info({ queue: QUEUE_NAME }, "Worker stopped");
  }
}

export { processExtensionImport };
