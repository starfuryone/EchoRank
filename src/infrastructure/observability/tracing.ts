import { AsyncLocalStorage } from "node:async_hooks";
import { nanoid } from "nanoid";

/**
 * Trace context carried through the async call chain.
 */
export interface TraceContext {
  correlationId: string;
  tenantId?: string;
  operation?: string;
  startedAt: number;
}

const asyncStorage = new AsyncLocalStorage<TraceContext>();

/**
 * Generates a unique correlation ID using nanoid (21-char URL-safe string).
 */
export function generateCorrelationId(): string {
  return nanoid();
}

/**
 * Runs the provided function within an async context that carries
 * the given correlation ID. Nested calls to `getCurrentCorrelationId()`
 * will return this ID.
 */
export function withCorrelation<T>(
  correlationId: string,
  fn: () => T
): T {
  const ctx: TraceContext = {
    correlationId,
    startedAt: Date.now(),
  };
  return asyncStorage.run(ctx, fn);
}

/**
 * Returns the correlation ID from the current async context,
 * or undefined if there is no active context.
 */
export function getCurrentCorrelationId(): string | undefined {
  return asyncStorage.getStore()?.correlationId;
}

/**
 * Returns the full trace context from the current async context,
 * or undefined if there is no active context.
 */
export function getCurrentTraceContext(): TraceContext | undefined {
  return asyncStorage.getStore();
}

/**
 * Assigns the tenant ID onto the current async trace context, if one exists.
 * Called once the request's tenant has been resolved so structured logs and
 * spans can attribute work to the correct tenant.
 */
export function setCurrentTenantId(tenantId: string): void {
  const store = asyncStorage.getStore();
  if (store) {
    store.tenantId = tenantId;
  }
}

/**
 * Creates a full trace context and runs the provided function within it.
 * Combines correlation ID, tenant ID, and operation name.
 */
export function createTraceContext<T>(
  tenantId: string | undefined,
  operation: string,
  fn: () => T,
  correlationId?: string
): T {
  const ctx: TraceContext = {
    correlationId: correlationId ?? generateCorrelationId(),
    tenantId,
    operation,
    startedAt: Date.now(),
  };
  return asyncStorage.run(ctx, fn);
}

/**
 * Returns the async local storage instance for advanced use cases
 * (e.g., running within an existing context).
 */
export function getTraceStorage(): AsyncLocalStorage<TraceContext> {
  return asyncStorage;
}
