import { Queue, type JobsOptions } from "bullmq";
import { getRedisConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG, type QueueName, QUEUE_NAMES } from "@/infrastructure/redis/config";

/**
 * Central queue registry: creates, caches, and manages all BullMQ queues.
 */

// ─── Default job options per queue ────────────────────────────────────────────

const DEFAULT_JOB_OPTIONS: Record<QueueName, JobsOptions> = {
  "email-delivery": {
    attempts: 3,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: { age: REDIS_CONFIG.ttl.completedJobs },
    removeOnFail: { age: REDIS_CONFIG.ttl.failedJobs },
  },
  "sms-delivery": {
    attempts: 3,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: { age: REDIS_CONFIG.ttl.completedJobs },
    removeOnFail: { age: REDIS_CONFIG.ttl.failedJobs },
  },
  "webhook-delivery": {
    attempts: 5,
    backoff: { type: "exponential", delay: 5_000 },
    removeOnComplete: { age: REDIS_CONFIG.ttl.completedJobs },
    removeOnFail: { age: REDIS_CONFIG.ttl.failedJobs },
  },
  "ai-processing": {
    attempts: 3,
    backoff: { type: "exponential", delay: 10_000 },
    removeOnComplete: { age: REDIS_CONFIG.ttl.completedJobs },
    removeOnFail: { age: REDIS_CONFIG.ttl.failedJobs },
  },
  "review-monitoring": {
    attempts: 3,
    backoff: { type: "exponential", delay: 30_000 },
    removeOnComplete: { age: REDIS_CONFIG.ttl.completedJobs },
    removeOnFail: { age: REDIS_CONFIG.ttl.failedJobs },
  },
  "reputation-scoring": {
    attempts: 3,
    backoff: { type: "exponential", delay: 5_000 },
    removeOnComplete: { age: REDIS_CONFIG.ttl.completedJobs },
    removeOnFail: { age: REDIS_CONFIG.ttl.failedJobs },
  },
  "escalation-detection": {
    attempts: 3,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: { age: REDIS_CONFIG.ttl.completedJobs },
    removeOnFail: { age: REDIS_CONFIG.ttl.failedJobs },
  },
  "analytics-aggregation": {
    attempts: 3,
    backoff: { type: "exponential", delay: 10_000 },
    removeOnComplete: { age: REDIS_CONFIG.ttl.completedJobs },
    removeOnFail: { age: REDIS_CONFIG.ttl.failedJobs },
  },
  "feedback-routing": {
    attempts: 5,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: { age: REDIS_CONFIG.ttl.completedJobs },
    removeOnFail: { age: REDIS_CONFIG.ttl.failedJobs },
  },
  "csv-import": {
    attempts: 2,
    backoff: { type: "exponential", delay: 5_000 },
    removeOnComplete: { age: REDIS_CONFIG.ttl.completedJobs },
    removeOnFail: { age: REDIS_CONFIG.ttl.failedJobs },
  },
  "extension-import": {
    attempts: 2,
    backoff: { type: "exponential", delay: 5_000 },
    removeOnComplete: { age: REDIS_CONFIG.ttl.completedJobs },
    removeOnFail: { age: REDIS_CONFIG.ttl.failedJobs },
  },
  "visibility-monitoring": {
    attempts: 2,
    backoff: { type: "exponential", delay: 30_000 },
    removeOnComplete: { age: REDIS_CONFIG.ttl.completedJobs },
    removeOnFail: { age: REDIS_CONFIG.ttl.failedJobs },
  },
  "onboarding-email": {
    attempts: 3,
    backoff: { type: "exponential", delay: 60_000 },
    removeOnComplete: { age: REDIS_CONFIG.ttl.completedJobs },
    removeOnFail: { age: REDIS_CONFIG.ttl.failedJobs },
  },
};

// ─── Queue registry ───────────────────────────────────────────────────────────

const queues = new Map<QueueName, Queue>();

/**
 * Get (or create) a BullMQ Queue by name.
 * Queues are lazily instantiated and cached.
 */
export function getQueue(name: QueueName): Queue {
  let queue = queues.get(name);
  if (queue) return queue;

  const connection = getRedisConnection();
  const rateLimit = REDIS_CONFIG.rateLimits[name];

  queue = new Queue(name, {
    connection,
    prefix: REDIS_CONFIG.queues.prefix,
    defaultJobOptions: DEFAULT_JOB_OPTIONS[name],
    ...(rateLimit
      ? {
          limiter: {
            max: rateLimit.max,
            duration: rateLimit.duration,
          },
        }
      : {}),
  });

  queue.on("error", (err) => {
    console.error(`[Queue:${name}] Error:`, err.message);
  });

  queues.set(name, queue);
  console.log(`[Queue:${name}] Queue registered`);

  return queue;
}

/**
 * Add a job to a named queue with optional overrides.
 */
export async function addJob<T>(
  queueName: QueueName,
  jobName: string,
  data: T,
  opts?: JobsOptions,
) {
  const queue = getQueue(queueName);
  const job = await queue.add(jobName, data, opts);
  console.log(`[Queue:${queueName}] Job added: ${job.id} (${jobName})`);
  return job;
}

/**
 * Gracefully close all registered queues.
 */
export async function closeAllQueues(): Promise<void> {
  console.log(`[QueueRegistry] Closing ${queues.size} queues...`);
  const closing = Array.from(queues.entries()).map(async ([name, queue]) => {
    try {
      await queue.close();
      console.log(`[QueueRegistry] Queue "${name}" closed`);
    } catch (err) {
      console.error(
        `[QueueRegistry] Error closing queue "${name}":`,
        err instanceof Error ? err.message : err,
      );
    }
  });

  await Promise.allSettled(closing);
  queues.clear();
  console.log("[QueueRegistry] All queues closed.");
}

/**
 * Get all registered queue names (for admin/monitoring).
 */
export function getRegisteredQueues(): QueueName[] {
  return Array.from(queues.keys());
}

/**
 * Initialize all queues eagerly (useful at startup).
 */
export function initializeAllQueues(): void {
  for (const name of QUEUE_NAMES) {
    getQueue(name);
  }
  console.log(`[QueueRegistry] All ${QUEUE_NAMES.length} queues initialized.`);
}

/**
 * Get the default job options for a queue (useful for overriding).
 */
export function getDefaultJobOptions(name: QueueName): JobsOptions {
  return { ...DEFAULT_JOB_OPTIONS[name] };
}
