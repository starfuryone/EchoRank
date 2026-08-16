/**
 * AI Action Agent worker.
 *
 * One job shape, three generators, no schedule. Unlike every other worker in
 * this directory there is NO repeatable tick here: nothing about the Action
 * Agent is periodic. A draft exists because a human pressed Fix with AI, and a
 * nightly sweep that generated drafts nobody asked for would spend the tenant's
 * budget on a queue they never opened.
 *
 * ── THE SECOND BUDGET CHECK LIVES HERE ─────────────────────────────────────
 * The enqueue route asserts the budget before it puts anything on this queue,
 * which is what makes an exhausted tenant get an immediate 429 with a reset
 * date instead of a job that dies quietly. This worker asserts it AGAIN,
 * because the two are separated by a queue: a job enqueued at 199,900 tokens
 * can reach the head after a sibling job has drained the rest, and the route's
 * verdict was true when it was made and false by the time it mattered.
 *
 * That second refusal is UNRECOVERABLE — a BullMQ error class that skips the
 * remaining attempts. This queue is already attempts:1 (see registry.ts), so
 * today that changes nothing; it is written this way so that raising the
 * attempt count later cannot accidentally turn "you are out of budget" into
 * three retries of a request that cannot become affordable by waiting.
 *
 * ── NOT IDEMPOTENT, AND THAT IS WHY attempts IS 1 ──────────────────────────
 * The Anthropic call is committed the instant it returns. The meter is written
 * next and the draft row last, so a retry resuming after any of those spends
 * the budget again to produce a duplicate draft. The retries worth having are
 * the ones callMarketingModel already does inside a single attempt, before a
 * token is billed.
 *
 * ── CONCURRENCY IS 2 ───────────────────────────────────────────────────────
 * Higher than the sweeps that buy DataForSEO calls, because the budget here is
 * enforced by a Redis INCRBY rather than by a read-then-spend, so two jobs for
 * one tenant cannot both read a spend figure neither has updated. Not higher
 * than 2, because a review batch is up to ten sequential model calls and four
 * of those at once is a burst at one vendor for no gain in wall-clock that a
 * customer notices.
 */

import { Worker, UnrecoverableError, type Job } from "bullmq";
import { getSubscriberConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import { logger } from "@/infrastructure/observability/logger";
import type { ActionAgentJob } from "@/infrastructure/queue/jobs/schemas";
import type { PlanType } from "@/generated/prisma";
import { createAuditLog } from "@/lib/audit";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { ActionAgentBudgetError, assertActionAgentBudget, generate } from "@/lib/action-agent/generate";
import { isV1Kind } from "@/lib/action-agent/types";

const QUEUE_NAME = "action-agent" as const;
const CONCURRENCY = 2;

export async function processActionAgentJob(job: Job<ActionAgentJob>): Promise<void> {
  const { tenantId, kind, plan, locale, url, reviewLimit, reviewIds, requestedByUserId } =
    job.data;

  if (!tenantId) throw new UnrecoverableError("action agent job needs a tenantId");
  // A kind outside V1_KINDS is a bug in the enqueuer, not a transient failure.
  // `page` and `gbp_post` exist in the database enum and have no generator, so
  // this is the line that keeps that gap honest rather than a runtime crash.
  if (!isV1Kind(kind)) throw new UnrecoverableError(`no generator for kind "${kind}"`);

  // ── The second budget check. See this file's header. ──────────────────────
  try {
    await assertActionAgentBudget(tenantId, plan as PlanType);
  } catch (err) {
    if (err instanceof ActionAgentBudgetError) {
      // Attributable, not just logged: this is a request the customer made that
      // we refused, and "why did my draft never appear" has to be answerable
      // from the audit trail rather than from a log line that has rotated away.
      await createAuditLog({
        tenantId,
        userId: requestedByUserId,
        action: "action_agent.generation_blocked",
        entity: "ActionItem",
        details: {
          kind,
          reason: "budget_exhausted",
          limit: err.limit,
          plan: err.plan,
          resetsAt: err.resetsAt.toISOString(),
          // The gap the route's check could not see: the budget was there when
          // this was enqueued and gone by the time it ran.
          blockedAt: "worker",
        },
      }).catch(() => undefined);

      logger.warn(
        { queue: QUEUE_NAME, tenantId, kind, limit: err.limit },
        "action agent: generation blocked at the worker's budget check",
      );
      throw new UnrecoverableError(err.message);
    }
    throw err;
  }

  const outcome = await generate(kind, {
    tenantId,
    plan: plan as PlanType,
    locale: dashboardLocale(locale),
    url,
    reviewLimit,
    reviewIds,
  });

  logger.info(
    {
      queue: QUEUE_NAME,
      tenantId,
      kind,
      drafted: outcome.items.length,
      outputTokens: outcome.outputTokens,
      emptyReason: outcome.emptyReason ?? null,
    },
    "action agent: generation complete",
  );
}

// ─── Worker Factory ───────────────────────────────────────────────────────────

let worker: Worker<ActionAgentJob> | null = null;

export function startActionAgentWorker(): Worker<ActionAgentJob> {
  if (worker) return worker;

  worker = new Worker<ActionAgentJob>(QUEUE_NAME, processActionAgentJob, {
    connection: getSubscriberConnection(),
    prefix: REDIS_CONFIG.queues.prefix,
    concurrency: CONCURRENCY,
  });

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id, queue: QUEUE_NAME }, "Job completed");
  });
  worker.on("failed", (job, err) => {
    logger.error(
      { jobId: job?.id, attempt: job?.attemptsMade, err, queue: QUEUE_NAME },
      "Job failed",
    );
  });
  worker.on("error", (err) => {
    logger.error({ err, queue: QUEUE_NAME }, "Worker error");
  });

  return worker;
}

export async function stopActionAgentWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}

export { QUEUE_NAME as ACTION_AGENT_QUEUE };
