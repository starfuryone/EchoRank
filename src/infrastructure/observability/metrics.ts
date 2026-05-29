import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import { logger } from "./logger";

// ─── Predefined Metric Names ─────────────────────────────────────────

export const METRIC_NAMES = {
  // API
  API_REQUEST_DURATION: "api.request.duration",
  API_REQUEST_COUNT: "api.request.count",

  // Queue
  QUEUE_JOB_DURATION: "queue.job.duration",
  QUEUE_JOB_COUNT: "queue.job.count",
  QUEUE_JOB_FAILED: "queue.job.failed",

  // AI
  AI_INFERENCE_DURATION: "ai.inference.duration",
  AI_INFERENCE_TOKENS: "ai.inference.tokens",

  // Feedback
  FEEDBACK_SUBMITTED: "feedback.submitted",
  FEEDBACK_RESPONSE_RATE: "feedback.response_rate",

  // Escalation
  ESCALATION_DETECTED: "escalation.detected",
  ESCALATION_RESOLVED: "escalation.resolved",

  // Review
  REVIEW_REQUESTED: "review.requested",
  REVIEW_CLICKED: "review.clicked",
} as const;

export type MetricName = (typeof METRIC_NAMES)[keyof typeof METRIC_NAMES];

// ─── Buffer for batch writes ──────────────────────────────────────────

interface BufferedMetric {
  tenantId?: string;
  metricName: string;
  value: number;
  tags?: Record<string, string>;
  recordedAt: Date;
}

const FLUSH_INTERVAL_MS = 5_000; // 5 seconds
const MAX_BUFFER_SIZE = 200;

const buffer: BufferedMetric[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Flush all buffered metrics to the SystemMetric table in a single batch insert.
 */
async function flush(): Promise<void> {
  if (buffer.length === 0) return;

  const batch = buffer.splice(0, buffer.length);

  try {
    await prisma.systemMetric.createMany({
      data: batch.map((m) => ({
        tenantId: m.tenantId ?? null,
        metricName: m.metricName,
        value: m.value,
        tags: (m.tags as Prisma.InputJsonValue) ?? undefined,
        recordedAt: m.recordedAt,
      })),
    });
  } catch (error) {
    // Put metrics back into buffer for retry on next flush
    buffer.unshift(...batch);
    logger.error({ error, batchSize: batch.length }, "Failed to flush metrics");
  }
}

/**
 * Ensures the periodic flush timer is running.
 */
function ensureFlushTimer(): void {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    flush().catch(() => {
      /* swallow -- logged inside flush */
    });
  }, FLUSH_INTERVAL_MS);

  // Allow the process to exit without waiting for this timer
  if (flushTimer && typeof flushTimer === "object" && "unref" in flushTimer) {
    flushTimer.unref();
  }
}

/**
 * Add a metric to the write buffer. Triggers immediate flush if buffer is full.
 */
function enqueue(metric: BufferedMetric): void {
  ensureFlushTimer();
  buffer.push(metric);

  if (buffer.length >= MAX_BUFFER_SIZE) {
    flush().catch(() => {
      /* swallow */
    });
  }
}

// ─── Public API ───────────────────────────────────────────────────────

/**
 * Records a raw metric value.
 */
export function recordMetric(
  name: string,
  value: number,
  tags?: Record<string, string>
): void {
  enqueue({
    tenantId: tags?.tenantId,
    metricName: name,
    value,
    tags,
    recordedAt: new Date(),
  });
}

/**
 * Records a latency / duration metric in milliseconds.
 */
export function recordLatency(
  name: string,
  durationMs: number,
  tags?: Record<string, string>
): void {
  enqueue({
    tenantId: tags?.tenantId,
    metricName: name,
    value: durationMs,
    tags: { ...tags, unit: "ms" },
    recordedAt: new Date(),
  });
}

/**
 * Records a counter increment.
 */
export function recordCounter(
  name: string,
  increment: number = 1,
  tags?: Record<string, string>
): void {
  enqueue({
    tenantId: tags?.tenantId,
    metricName: name,
    value: increment,
    tags: { ...tags, type: "counter" },
    recordedAt: new Date(),
  });
}

/**
 * Records a gauge (point-in-time) value.
 */
export function recordGauge(
  name: string,
  value: number,
  tags?: Record<string, string>
): void {
  enqueue({
    tenantId: tags?.tenantId,
    metricName: name,
    value,
    tags: { ...tags, type: "gauge" },
    recordedAt: new Date(),
  });
}

/**
 * Force-flush all buffered metrics immediately.
 * Useful during graceful shutdown.
 */
export async function flushMetrics(): Promise<void> {
  await flush();
}

/**
 * Stop the periodic flush timer and flush remaining metrics.
 * Call during application shutdown.
 */
export async function shutdownMetrics(): Promise<void> {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  await flush();
}
