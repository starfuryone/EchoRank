/**
 * Blog agent worker — discovers topics, drafts articles, lands them as markdown.
 *
 * ── THE REPEATABLE-JOB TRAP, HANDLED ───────────────────────────────────────
 * Same as assistant-precompute.worker.ts, and for the same reason: BullMQ's
 * repeat key INCLUDES the schedule, so changing a cron does not replace the old
 * entry — it ADDS a second one and the queue ticks on both. That is how
 * serp-check ended up sweeping on a 60 s and a 30 s schedule at once. Pruning
 * first makes the schedule a normal thing to edit.
 *
 * `every` comes back from Redis as a STRING, so it is coerced with Number()
 * before comparison — `entry.every !== 0` is true for "0" and would delete a
 * schedule that is already correct. Both repeat shapes are pruned even though
 * this queue is on cron patterns, because swapping cron for an interval later
 * is precisely when a stale entry would otherwise survive.
 *
 * ── THIS QUEUE SPENDS MONEY AND WRITES FILES ───────────────────────────────
 * A draft job calls Anthropic and git-commits into the tree that serves
 * production. So: attempts: 1. A blind retry of a half-finished draft job would
 * spend the budget again and could commit a second copy of the same article.
 * Failures are visible in the ledger and in the notification log, and the next
 * day's run picks the topic up again if it is still worth writing about.
 *
 * ── OFF BY DEFAULT ─────────────────────────────────────────────────────────
 * Every stage checks BLOG_AGENT_ENABLED. With it unset the worker starts, the
 * schedules register, the jobs fire and each one returns immediately having
 * done nothing. That is deliberate: the schedule should already be correct on
 * the day someone turns the agent on.
 */

import { Worker, type Job } from "bullmq";
import { getSubscriberConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import { getQueue } from "@/infrastructure/queue/registry";
import { logger } from "@/infrastructure/observability/logger";
import {
  BlogAgentDisabled,
  runDiscover,
  runDraft,
  runPublishCheck,
  type DraftJobPayload,
} from "@/lib/blog-agent/pipeline";

const QUEUE_NAME = "blog-agent" as const;
/** One at a time. Three concurrent drafts would race on the same git index. */
const CONCURRENCY = 1;

export const DISCOVER_JOB = "blog-agent:discover";
export const DRAFT_JOB = "blog-agent:draft";
export const PUBLISH_CHECK_JOB = "blog-agent:publish-check";

/** 05:00 UTC — before the publisher, after the feeds have the night's stories. */
export const DISCOVER_CRON = "0 5 * * *";
/** 05:45 UTC — after drafting, before the 06:15 publisher timer. */
export const PUBLISH_CHECK_CRON = "45 5 * * *";

export type BlogAgentJob =
  | { kind: "discover" }
  | { kind: "draft"; payload: DraftJobPayload }
  | { kind: "publish-check" };

let worker: Worker<BlogAgentJob> | null = null;

/**
 * The schedules this queue should have. Exported so the prune test can assert
 * against the same source the worker registers from, rather than a copy.
 */
export const BLOG_AGENT_SCHEDULES: ReadonlyArray<{ name: string; cron: string }> = [
  { name: DISCOVER_JOB, cron: DISCOVER_CRON },
  { name: PUBLISH_CHECK_JOB, cron: PUBLISH_CHECK_CRON },
];

/**
 * Whether a registered repeatable entry matches the schedule we want.
 *
 * Pure and exported so the trap is tested directly: the `every`-as-string
 * coercion is the whole point, and a test that goes through Redis would not
 * prove the coercion happens.
 */
export function scheduleIsCurrent(
  // `every` is typed by BullMQ as string | null | undefined, and arrives from
  // Redis as a STRING. Both are accepted here so the coercion below is the
  // only thing that decides, rather than the shape it happened to arrive in.
  entry: { name?: string; pattern?: string | null; every?: number | string | null },
  want: { name: string; cron: string },
): boolean {
  if (entry.name !== want.name) return false;
  const hasInterval = entry.every !== undefined && Number(entry.every) > 0;
  return entry.pattern === want.cron && !hasInterval;
}

async function processBlogAgentJob(job: Job<BlogAgentJob>): Promise<unknown> {
  const data = job.data;

  switch (data.kind) {
    case "discover": {
      const payloads = await runDiscover();
      const queue = getQueue(QUEUE_NAME);
      // Fan out one job per topic rather than drafting inline: a single job
      // holding three model calls fails all three when the second one does.
      for (const payload of payloads) {
        await queue.add(
          DRAFT_JOB,
          { kind: "draft", payload },
          { removeOnComplete: true, removeOnFail: { count: 50 } },
        );
      }
      return { selected: payloads.length };
    }

    case "draft":
      return runDraft(data.payload);

    case "publish-check":
      return runPublishCheck();
  }
}

export function startBlogAgentWorker(): Worker<BlogAgentJob> {
  if (worker) return worker;

  worker = new Worker<BlogAgentJob>(
    QUEUE_NAME,
    async (job) => {
      try {
        return await processBlogAgentJob(job);
      } catch (err) {
        // The kill switch is not a failure. Returning rather than throwing
        // keeps a disabled agent from filling the DLQ with one dead job per
        // tick for however long it stays off.
        if (err instanceof BlogAgentDisabled) {
          logger.debug({ job: job.name }, "blog-agent: disabled, skipping");
          return { skipped: "disabled" };
        }
        throw err;
      }
    },
    {
      connection: getSubscriberConnection(),
      prefix: REDIS_CONFIG.queues.prefix,
      concurrency: CONCURRENCY,
    },
  );

  void (async () => {
    const queue = getQueue(QUEUE_NAME);
    try {
      // Prune first — see the header.
      for (const entry of await queue.getRepeatableJobs()) {
        const want = BLOG_AGENT_SCHEDULES.find((s) => s.name === entry.name);
        if (want && scheduleIsCurrent(entry, want)) continue;
        if (!want && !entry.name?.startsWith("blog-agent:")) continue;
        await queue.removeRepeatableByKey(entry.key);
        logger.warn(
          { queue: QUEUE_NAME, name: entry.name, stalePattern: entry.pattern, staleEvery: entry.every },
          "removed stale blog-agent schedule",
        );
      }

      for (const schedule of BLOG_AGENT_SCHEDULES) {
        await queue.add(
          schedule.name,
          schedule.name === DISCOVER_JOB ? { kind: "discover" } : { kind: "publish-check" },
          {
            repeat: { pattern: schedule.cron, tz: "UTC" },
            removeOnComplete: true,
            removeOnFail: { count: 50 },
          },
        );
      }
    } catch (err) {
      logger.error({ err, queue: QUEUE_NAME }, "Failed to schedule blog-agent jobs");
    }
  })();

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id, name: job.name, queue: QUEUE_NAME }, "Job completed");
  });
  worker.on("failed", (job, err) => {
    logger.error(
      { jobId: job?.id, name: job?.name, attempt: job?.attemptsMade, err, queue: QUEUE_NAME },
      "Job failed",
    );
  });
  worker.on("error", (err) => {
    logger.error({ err, queue: QUEUE_NAME }, "Worker error");
  });

  logger.info({ queue: QUEUE_NAME }, "Blog agent worker started");
  return worker;
}
