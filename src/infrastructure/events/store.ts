import { prisma } from "@/lib/prisma";
import type { DomainEvent, DomainEventStatus, Prisma } from "@/generated/prisma";
import type { DomainEventEnvelope, DomainEventPayload } from "./types";

/**
 * Event persistence layer: reads and writes domain events to the database.
 */

/**
 * Persist a domain event to the DomainEvent table.
 */
export async function persist<T extends DomainEventPayload>(
  envelope: DomainEventEnvelope<T>,
): Promise<DomainEvent> {
  const event = await prisma.domainEvent.create({
    data: {
      tenantId: envelope.tenantId,
      eventType: envelope.eventType,
      eventVersion: envelope.eventVersion,
      aggregateType: envelope.aggregateType,
      aggregateId: envelope.aggregateId,
      payload: envelope.payload as unknown as Prisma.InputJsonValue,
      metadata: (envelope.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      correlationId: envelope.correlationId,
      causationId: envelope.causationId ?? null,
      status: "PENDING",
    },
  });

  console.log(
    `[EventStore] Persisted event ${event.id} (${envelope.eventType}) for tenant ${envelope.tenantId}`,
  );
  return event;
}

/**
 * Mark a domain event as PROCESSING.
 */
export async function markProcessing(eventId: string): Promise<DomainEvent> {
  return prisma.domainEvent.update({
    where: { id: eventId },
    data: { status: "PROCESSING" },
  });
}

/**
 * Mark a domain event as COMPLETED.
 */
export async function markProcessed(eventId: string): Promise<DomainEvent> {
  return prisma.domainEvent.update({
    where: { id: eventId },
    data: {
      status: "COMPLETED",
      processedAt: new Date(),
    },
  });
}

/**
 * Mark a domain event as FAILED with error details.
 */
export async function markFailed(eventId: string, error: string): Promise<DomainEvent> {
  const existing = await prisma.domainEvent.findUniqueOrThrow({
    where: { id: eventId },
  });

  const newRetryCount = existing.retryCount + 1;
  const newStatus: DomainEventStatus =
    newRetryCount >= existing.maxRetries ? "DEAD_LETTER" : "FAILED";

  return prisma.domainEvent.update({
    where: { id: eventId },
    data: {
      status: newStatus,
      failedAt: new Date(),
      error,
      retryCount: newRetryCount,
    },
  });
}

/**
 * Move a domain event to DEAD_LETTER status.
 */
export async function markDeadLetter(eventId: string, error: string): Promise<DomainEvent> {
  return prisma.domainEvent.update({
    where: { id: eventId },
    data: {
      status: "DEAD_LETTER",
      failedAt: new Date(),
      error,
    },
  });
}

/**
 * Get unprocessed events for recovery/replay (PENDING or FAILED with retries remaining).
 */
export async function getUnprocessed(limit: number = 100): Promise<DomainEvent[]> {
  return prisma.domainEvent.findMany({
    where: {
      OR: [{ status: "PENDING" }, { status: "FAILED" }],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

/**
 * Get unprocessed events scoped to a tenant.
 */
export async function getUnprocessedByTenant(
  tenantId: string,
  limit: number = 100,
): Promise<DomainEvent[]> {
  return prisma.domainEvent.findMany({
    where: {
      tenantId,
      OR: [{ status: "PENDING" }, { status: "FAILED" }],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

/**
 * Get events by correlation ID to trace the full event chain.
 */
export async function getByCorrelation(correlationId: string): Promise<DomainEvent[]> {
  return prisma.domainEvent.findMany({
    where: { correlationId },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Get events by type and date range (for replay).
 */
export async function getByTypeAndDateRange(
  eventType: string,
  fromDate: Date,
  toDate?: Date,
): Promise<DomainEvent[]> {
  return prisma.domainEvent.findMany({
    where: {
      eventType,
      createdAt: {
        gte: fromDate,
        ...(toDate ? { lte: toDate } : {}),
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Get dead letter events for inspection.
 */
export async function getDeadLetterEvents(
  tenantId?: string,
  limit: number = 100,
): Promise<DomainEvent[]> {
  return prisma.domainEvent.findMany({
    where: {
      status: "DEAD_LETTER",
      ...(tenantId ? { tenantId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Reset a dead-letter event back to PENDING for reprocessing.
 */
export async function resetForRetry(eventId: string): Promise<DomainEvent> {
  return prisma.domainEvent.update({
    where: { id: eventId },
    data: {
      status: "PENDING",
      retryCount: 0,
      error: null,
      failedAt: null,
      processedAt: null,
    },
  });
}

/**
 * Count events by status for monitoring.
 */
export async function countByStatus(
  tenantId?: string,
): Promise<Record<DomainEventStatus, number>> {
  const where = tenantId ? { tenantId } : {};
  const groups = await prisma.domainEvent.groupBy({
    by: ["status"],
    where,
    _count: { _all: true },
  });

  const counts: Record<string, number> = {
    PENDING: 0,
    PROCESSING: 0,
    COMPLETED: 0,
    FAILED: 0,
    DEAD_LETTER: 0,
  };

  for (const g of groups) {
    counts[g.status] = g._count._all;
  }

  return counts as Record<DomainEventStatus, number>;
}
