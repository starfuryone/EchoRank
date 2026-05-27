import { prisma } from "@/lib/prisma";
import type { DomainEvent } from "@/generated/prisma";
import { getQueue } from "@/infrastructure/queue/registry";
import { QUEUE_NAMES, type QueueName } from "@/infrastructure/redis/config";
import { getFailedJobs, type DlqJobInfo } from "./handler";

const LOG_PREFIX = "[DLQ:recovery]";

/**
 * DLQ recovery utilities.
 *
 * Provides functions to list, retry, and purge dead-letter jobs
 * from both the BullMQ failed queue and the DomainEvent table.
 */

// ─── List DLQ Jobs ────────────────────────────────────────────────────────────

/**
 * List DLQ entries from the DomainEvent table.
 */
export async function listDlqEvents(options?: {
  tenantId?: string;
  queueName?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  events: DomainEvent[];
  total: number;
}> {
  const { tenantId, queueName, limit = 50, offset = 0 } = options ?? {};

  const where = {
    status: "DEAD_LETTER" as const,
    ...(tenantId ? { tenantId } : {}),
    ...(queueName ? { eventType: `dlq.${queueName}` } : {}),
  };

  const [events, total] = await Promise.all([
    prisma.domainEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.domainEvent.count({ where }),
  ]);

  return { events, total };
}

/**
 * List failed BullMQ jobs across all queues (or a specific queue).
 */
export async function listFailedBullMQJobs(
  queueName?: QueueName,
  start: number = 0,
  end: number = 50,
): Promise<DlqJobInfo[]> {
  if (queueName) {
    return getFailedJobs(queueName, start, end);
  }

  // Gather failed jobs from all queues
  const allFailed: DlqJobInfo[] = [];
  for (const name of QUEUE_NAMES) {
    try {
      const jobs = await getFailedJobs(name, start, end);
      allFailed.push(...jobs);
    } catch (err) {
      console.error(
        `${LOG_PREFIX} Error listing failed jobs for "${name}":`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  // Sort by timestamp descending
  allFailed.sort((a, b) => b.timestamp - a.timestamp);
  return allFailed.slice(0, end - start);
}

// ─── Retry DLQ Jobs ───────────────────────────────────────────────────────────

/**
 * Retry a specific DLQ event by ID.
 * Resets the DomainEvent to PENDING and re-queues the original job.
 */
export async function retryDlqEvent(eventId: string): Promise<boolean> {
  const event = await prisma.domainEvent.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    console.log(`${LOG_PREFIX} Event ${eventId} not found.`);
    return false;
  }

  if (event.status !== "DEAD_LETTER") {
    console.log(`${LOG_PREFIX} Event ${eventId} is not in DEAD_LETTER status.`);
    return false;
  }

  const payload = event.payload as Record<string, unknown>;

  // Check if this is a DLQ job event (from BullMQ)
  if (event.eventType.startsWith("dlq.")) {
    const queueName = event.eventType.replace("dlq.", "") as QueueName;
    const jobData = payload.data as Record<string, unknown>;
    const jobName = payload.jobName as string;

    if (QUEUE_NAMES.includes(queueName) && jobData) {
      try {
        const queue = getQueue(queueName);
        await queue.add(jobName ?? "retry", jobData);

        // Reset the DomainEvent
        await prisma.domainEvent.update({
          where: { id: eventId },
          data: {
            status: "PENDING",
            retryCount: 0,
            error: null,
            failedAt: null,
            processedAt: null,
          },
        });

        console.log(`${LOG_PREFIX} Event ${eventId} re-queued to "${queueName}".`);
        return true;
      } catch (err) {
        console.error(
          `${LOG_PREFIX} Failed to re-queue event ${eventId}:`,
          err instanceof Error ? err.message : err,
        );
        return false;
      }
    }
  }

  // For regular domain events, just reset to PENDING for event bus replay
  await prisma.domainEvent.update({
    where: { id: eventId },
    data: {
      status: "PENDING",
      retryCount: 0,
      error: null,
      failedAt: null,
      processedAt: null,
    },
  });

  console.log(`${LOG_PREFIX} Event ${eventId} reset to PENDING for replay.`);
  return true;
}

/**
 * Retry all DLQ events for a specific tenant.
 */
export async function retryAllForTenant(tenantId: string): Promise<{
  attempted: number;
  succeeded: number;
  failed: number;
}> {
  const { events } = await listDlqEvents({ tenantId, limit: 1000 });

  let succeeded = 0;
  let failed = 0;

  for (const event of events) {
    const ok = await retryDlqEvent(event.id);
    if (ok) succeeded++;
    else failed++;
  }

  console.log(
    `${LOG_PREFIX} Tenant ${tenantId} retry: ${succeeded} succeeded, ${failed} failed out of ${events.length}.`,
  );

  return { attempted: events.length, succeeded, failed };
}

/**
 * Retry a specific BullMQ job by ID within its queue.
 */
export async function retryBullMQJob(
  queueName: QueueName,
  jobId: string,
): Promise<boolean> {
  try {
    const queue = getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) {
      console.log(`${LOG_PREFIX} BullMQ job ${jobId} not found in "${queueName}".`);
      return false;
    }

    await job.retry();
    console.log(`${LOG_PREFIX} BullMQ job ${jobId} retried in "${queueName}".`);
    return true;
  } catch (err) {
    console.error(
      `${LOG_PREFIX} Failed to retry BullMQ job ${jobId}:`,
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

// ─── Purge DLQ ────────────────────────────────────────────────────────────────

/**
 * Purge old DLQ events older than the specified number of days.
 */
export async function purgeDlqEvents(options?: {
  tenantId?: string;
  olderThanDays?: number;
}): Promise<number> {
  const { tenantId, olderThanDays = 30 } = options ?? {};
  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000);

  const where = {
    status: "DEAD_LETTER" as const,
    createdAt: { lt: cutoff },
    ...(tenantId ? { tenantId } : {}),
  };

  const result = await prisma.domainEvent.deleteMany({ where });

  console.log(
    `${LOG_PREFIX} Purged ${result.count} DLQ events older than ${olderThanDays} days${tenantId ? ` for tenant ${tenantId}` : ""}.`,
  );

  return result.count;
}

/**
 * Clean failed jobs from a BullMQ queue.
 */
export async function cleanFailedBullMQJobs(
  queueName: QueueName,
  gracePeriodMs: number = 7 * 86_400_000, // 7 days
): Promise<number[]> {
  const queue = getQueue(queueName);
  const removed = await queue.clean(gracePeriodMs, 1000, "failed");
  console.log(
    `${LOG_PREFIX} Cleaned ${removed.length} failed jobs from "${queueName}" (grace: ${gracePeriodMs}ms).`,
  );
  return removed.map((id) => Number(id)).filter((n) => !isNaN(n));
}

// ─── Stats ────────────────────────────────────────────────────────────────────

/**
 * Get DLQ statistics per queue.
 */
export async function getDlqStats(tenantId?: string): Promise<
  Record<
    string,
    { total: number; oldest: Date | null; newest: Date | null }
  >
> {
  const where = {
    status: "DEAD_LETTER" as const,
    ...(tenantId ? { tenantId } : {}),
  };

  const events = await prisma.domainEvent.findMany({
    where,
    select: { eventType: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const stats: Record<string, { total: number; oldest: Date | null; newest: Date | null }> =
    {};

  for (const event of events) {
    const key = event.eventType;
    if (!stats[key]) {
      stats[key] = { total: 0, oldest: null, newest: null };
    }
    stats[key].total++;
    if (!stats[key].oldest || event.createdAt < stats[key].oldest!) {
      stats[key].oldest = event.createdAt;
    }
    if (!stats[key].newest || event.createdAt > stats[key].newest!) {
      stats[key].newest = event.createdAt;
    }
  }

  return stats;
}
