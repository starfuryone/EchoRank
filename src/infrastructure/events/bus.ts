import type { DomainEvent } from "@/generated/prisma";
import type {
  DomainEventEnvelope,
  DomainEventPayload,
  EventType,
  EventPayloadMap,
} from "./types";
import * as eventStore from "./store";
import { prisma } from "@/lib/prisma";

/**
 * Event handler function signature.
 */
type EventHandler<T extends DomainEventPayload = DomainEventPayload> = (
  event: DomainEvent,
  payload: T,
) => Promise<void>;

/**
 * Registered handler entry with metadata.
 */
interface HandlerRegistration {
  handler: EventHandler;
  name: string;
}

/**
 * EventBus: singleton that persists domain events and dispatches to registered handlers.
 *
 * - Events are first persisted to the DomainEvent table.
 * - Then dispatched to all registered handlers for that event type.
 * - Handler failures are isolated (one failing handler does not block others).
 * - Supports event replay from the database.
 * - Enforces tenant isolation in routing.
 * - Provides idempotency via correlation ID + event type deduplication.
 */
class EventBus {
  private handlers = new Map<string, HandlerRegistration[]>();

  /**
   * Register an event handler for a specific event type.
   */
  on<K extends EventType>(
    eventType: K,
    handler: EventHandler<EventPayloadMap[K]>,
    name?: string,
  ): void {
    const existing = this.handlers.get(eventType) ?? [];
    const handlerName = name ?? `handler_${existing.length}`;
    existing.push({
      handler: handler as EventHandler,
      name: handlerName,
    });
    this.handlers.set(eventType, existing);
    console.log(`[EventBus] Registered handler "${handlerName}" for "${eventType}"`);
  }

  /**
   * Emit a domain event: persist to DB, then dispatch to handlers.
   *
   * Uses the database unique constraint (event_idempotency_key) for
   * distributed idempotency instead of an in-memory Set.
   *
   * Returns the persisted DomainEvent record.
   */
  async emit<T extends DomainEventPayload>(
    envelope: DomainEventEnvelope<T>,
  ): Promise<DomainEvent> {
    let event: DomainEvent;

    try {
      // 1. Persist event – the DB unique constraint on
      //    (tenantId, eventType, aggregateId, correlationId) enforces idempotency.
      event = await eventStore.persist(envelope);
    } catch (err: unknown) {
      // Check for Prisma unique constraint violation (P2002)
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        console.log(
          `[EventBus] Duplicate event skipped: ${envelope.eventType} (${envelope.correlationId}:${envelope.aggregateId})`,
        );
        // Query for the existing event and return it
        const existing = await prisma.domainEvent.findFirst({
          where: {
            tenantId: envelope.tenantId,
            eventType: envelope.eventType,
            aggregateId: envelope.aggregateId,
            correlationId: envelope.correlationId,
          },
        });
        if (existing) return existing;
        // Shouldn't happen, but rethrow if the record is gone
        throw err;
      }
      throw err;
    }

    // 2. Mark as processing
    await eventStore.markProcessing(event.id);

    // 3. Dispatch to handlers
    await this.dispatch(event);

    return event;
  }

  /**
   * Dispatch a persisted event to all registered handlers.
   * Handler failures are isolated and logged.
   */
  private async dispatch(event: DomainEvent): Promise<void> {
    const registrations = this.handlers.get(event.eventType) ?? [];

    if (registrations.length === 0) {
      console.log(
        `[EventBus] No handlers registered for "${event.eventType}", marking completed.`,
      );
      await eventStore.markProcessed(event.id);
      return;
    }

    const payload = event.payload as unknown as DomainEventPayload;
    const results: { name: string; success: boolean; error?: string }[] = [];

    for (const registration of registrations) {
      try {
        await registration.handler(event, payload);
        results.push({ name: registration.name, success: true });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(
          `[EventBus] Handler "${registration.name}" failed for event ${event.id} (${event.eventType}):`,
          errorMsg,
        );
        results.push({ name: registration.name, success: false, error: errorMsg });
      }
    }

    const failures = results.filter((r) => !r.success);
    if (failures.length > 0) {
      const errorSummary = failures
        .map((f) => `${f.name}: ${f.error}`)
        .join("; ");

      if (failures.length === results.length) {
        // All handlers failed
        await eventStore.markFailed(event.id, `All handlers failed: ${errorSummary}`);
      } else {
        // Partial failure: still mark as completed but log the failures
        console.warn(
          `[EventBus] Partial handler failure for event ${event.id}: ${errorSummary}`,
        );
        await eventStore.markProcessed(event.id);
      }
    } else {
      await eventStore.markProcessed(event.id);
    }
  }

  /**
   * Replay events of a given type from a specific date.
   * Re-dispatches them through handlers.
   */
  async replay(eventType: EventType, fromDate: Date, toDate?: Date): Promise<number> {
    console.log(
      `[EventBus] Replaying "${eventType}" events from ${fromDate.toISOString()}...`,
    );

    const events = await eventStore.getByTypeAndDateRange(eventType, fromDate, toDate);
    console.log(`[EventBus] Found ${events.length} events to replay.`);

    let replayed = 0;
    for (const event of events) {
      try {
        // Reset status for replay
        await eventStore.markProcessing(event.id);
        await this.dispatch(event);
        replayed++;
      } catch (err) {
        console.error(
          `[EventBus] Error replaying event ${event.id}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    console.log(`[EventBus] Replay complete: ${replayed}/${events.length} events replayed.`);
    return replayed;
  }

  /**
   * Process unprocessed events (recovery on startup).
   */
  async processUnprocessed(limit: number = 100): Promise<number> {
    const events = await eventStore.getUnprocessed(limit);
    console.log(`[EventBus] Processing ${events.length} unprocessed events...`);

    let processed = 0;
    for (const event of events) {
      try {
        await eventStore.markProcessing(event.id);
        await this.dispatch(event);
        processed++;
      } catch (err) {
        console.error(
          `[EventBus] Error processing event ${event.id}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    return processed;
  }

  /**
   * Get registered handler names for an event type (for debugging/monitoring).
   */
  getHandlers(eventType: EventType): string[] {
    const registrations = this.handlers.get(eventType) ?? [];
    return registrations.map((r) => r.name);
  }

  /**
   * Remove all handlers (useful for testing).
   */
  clearHandlers(): void {
    this.handlers.clear();
    console.log("[EventBus] All handlers cleared.");
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

const globalForEventBus = globalThis as unknown as {
  eventBus: EventBus | undefined;
};

export const eventBus = globalForEventBus.eventBus ?? new EventBus();

if (process.env.NODE_ENV !== "production") {
  globalForEventBus.eventBus = eventBus;
}

export type { EventHandler };
