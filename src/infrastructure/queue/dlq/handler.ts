import { type Job } from "bullmq";
import { getQueue } from "@/infrastructure/queue/registry";
import type { QueueName } from "@/infrastructure/redis/config";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";

const LOG_PREFIX = "[DLQ:handler]";

/**
 * Dead Letter Queue handler.
 *
 * Inspects failed BullMQ jobs that have exhausted all retries, logs full
 * context, and tracks them in the DomainEvent table (DEAD_LETTER status).
 */

export interface DlqJobInfo {
  jobId: string;
  queueName: string;
  jobName: string;
  data: Record<string, unknown>;
  failedReason: string;
  attemptsMade: number;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
  stacktrace: string[];
  tenantId?: string;
}

/**
 * Handle a job that has permanently failed (max retries exhausted).
 * Called from BullMQ worker's "failed" event when attemptsMade >= maxAttempts.
 */
export async function handleDeadLetterJob(
  queueName: QueueName,
  job: Job,
  error: Error,
): Promise<void> {
  const tenantId = (job.data as Record<string, unknown>)?.tenantId as string | undefined;
  const correlationId = (job.data as Record<string, unknown>)?.correlationId as
    | string
    | undefined;

  console.error(
    `${LOG_PREFIX} Job ${job.id} in queue "${queueName}" moved to DLQ after ${job.attemptsMade} attempts.`,
  );
  console.error(`${LOG_PREFIX} Reason: ${error.message}`);
  console.error(`${LOG_PREFIX} Data: ${JSON.stringify(job.data)}`);

  try {
    // Record in DomainEvent table as DEAD_LETTER
    await prisma.domainEvent.create({
      data: {
        tenantId: tenantId ?? "system",
        eventType: `dlq.${queueName}`,
        eventVersion: 1,
        aggregateType: "Job",
        aggregateId: job.id ?? "unknown",
        payload: {
          queueName,
          jobName: job.name,
          data: job.data,
          failedReason: error.message,
          attemptsMade: job.attemptsMade,
          timestamp: job.timestamp,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
          stacktrace: job.stacktrace ?? [],
        } as unknown as Prisma.InputJsonValue,
        metadata: {
          correlationId: correlationId ?? null,
          movedToDlqAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
        status: "DEAD_LETTER",
        correlationId: correlationId ?? null,
        retryCount: job.attemptsMade,
        maxRetries: job.opts?.attempts ?? 3,
        failedAt: new Date(),
        error: error.message.substring(0, 1000),
      },
    });

    console.log(`${LOG_PREFIX} DLQ entry recorded for job ${job.id} in queue "${queueName}"`);
  } catch (dbErr) {
    console.error(
      `${LOG_PREFIX} Failed to record DLQ entry:`,
      dbErr instanceof Error ? dbErr.message : dbErr,
    );
  }
}

/**
 * Inspect a failed job and return structured information.
 */
export async function inspectFailedJob(
  queueName: QueueName,
  jobId: string,
): Promise<DlqJobInfo | null> {
  const queue = getQueue(queueName);
  const job = await queue.getJob(jobId);

  if (!job) {
    console.log(`${LOG_PREFIX} Job ${jobId} not found in queue "${queueName}"`);
    return null;
  }

  return {
    jobId: job.id ?? "unknown",
    queueName,
    jobName: job.name,
    data: job.data as Record<string, unknown>,
    failedReason: job.failedReason ?? "unknown",
    attemptsMade: job.attemptsMade,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
    stacktrace: job.stacktrace ?? [],
    tenantId: (job.data as Record<string, unknown>)?.tenantId as string | undefined,
  };
}

/**
 * Retry a specific failed job by re-adding it to the original queue.
 */
export async function retryFailedJob(
  queueName: QueueName,
  jobId: string,
): Promise<boolean> {
  const queue = getQueue(queueName);
  const job = await queue.getJob(jobId);

  if (!job) {
    console.log(`${LOG_PREFIX} Job ${jobId} not found in queue "${queueName}"`);
    return false;
  }

  try {
    await job.retry();
    console.log(`${LOG_PREFIX} Job ${jobId} retried in queue "${queueName}"`);
    return true;
  } catch (err) {
    console.error(
      `${LOG_PREFIX} Failed to retry job ${jobId}:`,
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

/**
 * Get all failed jobs from a queue.
 */
export async function getFailedJobs(
  queueName: QueueName,
  start: number = 0,
  end: number = 50,
): Promise<DlqJobInfo[]> {
  const queue = getQueue(queueName);
  const jobs = await queue.getFailed(start, end);

  return jobs.map((job) => ({
    jobId: job.id ?? "unknown",
    queueName,
    jobName: job.name,
    data: job.data as Record<string, unknown>,
    failedReason: job.failedReason ?? "unknown",
    attemptsMade: job.attemptsMade,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
    stacktrace: job.stacktrace ?? [],
    tenantId: (job.data as Record<string, unknown>)?.tenantId as string | undefined,
  }));
}

/**
 * Register DLQ handling on a worker's "failed" event.
 * Should be called when setting up workers.
 */
export function registerDlqHandler(
  queueName: QueueName,
  maxAttempts: number,
): (job: Job | undefined, err: Error) => void {
  return (job: Job | undefined, err: Error) => {
    if (!job) return;
    if (job.attemptsMade >= maxAttempts) {
      handleDeadLetterJob(queueName, job, err).catch((dlqErr) => {
        console.error(
          `${LOG_PREFIX} Error in DLQ handler:`,
          dlqErr instanceof Error ? dlqErr.message : dlqErr,
        );
      });
    }
  };
}
