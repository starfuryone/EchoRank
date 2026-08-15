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
  // Sweep-only queue: a failed tick is retried by the next tick 60 s later,
  // so a single attempt is enough and retries would just pile up.
  "serp-checks": {
    attempts: 1,
    removeOnComplete: { age: REDIS_CONFIG.ttl.completedJobs },
    removeOnFail: { age: REDIS_CONFIG.ttl.failedJobs },
  },
  // Run jobs post real money upstream, so a blind retry could double-spend a
  // project. One attempt; a failed run is visible in the UI and re-runnable.
  "rank-tracker": {
    attempts: 1,
    removeOnComplete: { age: REDIS_CONFIG.ttl.completedJobs },
    removeOnFail: { age: REDIS_CONFIG.ttl.failedJobs },
  },
  // One notice per trial. Retried a couple of times because a transient
  // failure here means the customer is charged without warning, which is the
  // outcome the whole job exists to prevent.
  "trial-notice": {
    attempts: 3,
    backoff: { type: "exponential", delay: 30_000 },
    removeOnComplete: { age: REDIS_CONFIG.ttl.completedJobs },
    removeOnFail: { age: REDIS_CONFIG.ttl.failedJobs },
  },
  // Sweep-only queue: a failed tick is retried by the next tick, so a single
  // attempt is enough and retries would just pile up.
  "site-audit": {
    attempts: 1,
    removeOnComplete: { age: REDIS_CONFIG.ttl.completedJobs },
    removeOnFail: { age: REDIS_CONFIG.ttl.failedJobs },
  },
  // One attempt, deliberately. The job DELETES the uploaded log once it has
  // parsed it, so attempt 2 would find no file and fail differently for a
  // confusing reason. A failed parse is recorded on the row and re-uploadable.
  // One attempt, deliberately. A crawl writes rows as it goes, so a retry
  // would re-crawl a site that already has partial results and double every
  // page row. A failed crawl is visible in the UI and re-runnable by hand.
  "site-crawl": {
    attempts: 1,
    removeOnComplete: { age: REDIS_CONFIG.ttl.completedJobs },
    removeOnFail: { age: REDIS_CONFIG.ttl.failedJobs },
  },
  // Tick-only queue: a failed tick is retried by the next one an hour later,
  // and a retry that posted the basket twice would double the day's spend.
  "free-tools-volatility": {
    attempts: 1,
    removeOnComplete: { age: REDIS_CONFIG.ttl.completedJobs },
    removeOnFail: { age: REDIS_CONFIG.ttl.failedJobs },
  },
  "ai-checkup": {
    // Retries are SAFE here and that is not incidental: runs are keyed on
    // (checkupId, promptId, engine, repetition), so a second attempt resumes
    // the slots the first never reached instead of re-buying the answers it
    // already paid for. Backoff is long because the usual reason a checkup
    // fails is an upstream provider having a bad minute.
    attempts: 3,
    backoff: { type: "exponential", delay: 30_000 },
    removeOnComplete: { age: REDIS_CONFIG.ttl.completedJobs },
    removeOnFail: { age: REDIS_CONFIG.ttl.failedJobs },
  },
  "bot-log-analysis": {
    attempts: 1,
    removeOnComplete: { age: REDIS_CONFIG.ttl.completedJobs },
    removeOnFail: { age: REDIS_CONFIG.ttl.failedJobs },
  },
  // Retries are SAFE and worth having: the rollup only ever upserts on
  // (promptSetId, engine, date, brand) and the notification only ever upserts
  // on its dedupeKey, so a second attempt restates the same night rather than
  // doubling a share or re-alerting. Nothing upstream is bought, so there is
  // no spend to protect — the only cost of a retry is a repeated read.
  "sov-aggregation": {
    attempts: 3,
    backoff: { type: "exponential", delay: 30_000 },
    removeOnComplete: { age: REDIS_CONFIG.ttl.completedJobs },
    removeOnFail: { age: REDIS_CONFIG.ttl.failedJobs },
  },
  // Retryable for the same reason, by a different mechanism: the rollup's scope
  // is "citations with no sourceId", and a successful attempt stamps the rows
  // it counted in the same transaction that counted them. A retry therefore
  // picks up exactly what the failed attempt did not commit, rather than
  // recounting what it did. Nothing upstream is bought, so a retry costs a read.
  "citation-aggregation": {
    attempts: 3,
    backoff: { type: "exponential", delay: 30_000 },
    removeOnComplete: { age: REDIS_CONFIG.ttl.completedJobs },
    removeOnFail: { age: REDIS_CONFIG.ttl.failedJobs },
  },
  // ONE ATTEMPT, unlike both of its siblings, and for the reason rank-tracker
  // gives: this job posts real money upstream. Its two neighbours above spend
  // nothing and retry freely; this one buys a DataForSEO referring-domains call
  // per tenant per week, and a blind retry after a partial failure could buy it
  // twice. The 7-day cache in citation-opportunities/listed.ts is written the
  // instant the call returns, which shrinks that window to near zero — but
  // "near zero" is not zero, and a missed week costs a customer nothing. The
  // worklist is recomputed from scratch every Monday, so nothing is lost by
  // skipping one; the rows from the previous sweep stay exactly as they were.
  "citation-opportunities": {
    attempts: 1,
    removeOnComplete: { age: REDIS_CONFIG.ttl.completedJobs },
    removeOnFail: { age: REDIS_CONFIG.ttl.failedJobs },
  },
  // TWO ATTEMPTS, which is neither of the two policies above, and the middle
  // ground is the right one here for a reason specific to what this job does.
  //
  // Most failures are a stranger's website being briefly unreachable — a DNS
  // blip, a WAF rate-limiting an unfamiliar user agent, a slow origin past the
  // sidecar's 12s. Those are exactly the failures a single retry fixes, and a
  // batch that reports "failed" for a site that was up thirty seconds later is
  // a prospect an agency does not call.
  //
  // Not three, because of the money. The worker runs the free audit FIRST and
  // only buys a Places lookup for a row that already scored (see the ordering
  // note in opportunity-scan.worker.ts), so the ordinary failure path — an
  // unreachable site — costs nothing to retry. What retries can still re-buy is
  // the narrow case of a crash after the Places call and before the row is
  // committed. Two attempts caps that at 2x the quoted estimate; three would
  // make the number shown at submit a third of what an unlucky batch could
  // actually spend.
  "opportunity-scan": {
    attempts: 2,
    backoff: { type: "exponential", delay: 15_000 },
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
