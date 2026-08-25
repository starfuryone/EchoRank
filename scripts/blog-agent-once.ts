/**
 * Enqueue ONE blog-agent discover job, right now.
 *
 *   npm run blog-agent:once
 *
 * The pipeline is otherwise reachable only through the 05:00 UTC repeatable
 * job, which makes every iteration of a change to discover/draft/gate/land a
 * one-day round trip. This is the same job the cron fires — same queue, same
 * name, same payload — just enqueued on demand, so a full cycle can be
 * exercised in minutes.
 *
 * ── IT ENQUEUES, IT DOES NOT RUN ───────────────────────────────────────────
 * The job is handed to the "blog-agent" queue and this process exits. The
 * WORKER does the work, so `npm run workers` (or the pm2 worker process) must
 * be running to see anything happen — that is deliberate: the point is to test
 * the real path, and the real path is the worker's. Watch the worker's log for
 * the fan-out, and blog_agent_runs for the ledger rows.
 *
 * ── RESPECTS THE KILL SWITCH, LOUDLY ───────────────────────────────────────
 * With BLOG_AGENT_ENABLED unset the worker would accept this job and return
 * `{ skipped: "disabled" }` — correct for a cron tick, useless for a human
 * waiting to see a draft appear. So the switch is checked HERE and nothing is
 * enqueued when it is off. Failing at the prompt with the variable named beats
 * a silent no-op found later in a log.
 *
 * The other required config is checked for the same reason: this is the moment
 * to learn BLOG_AGENT_ANTHROPIC_KEY is missing, not thirty seconds into a
 * draft job. Nothing is spent by this script; the pre-flight only reads env.
 *
 * ── IT SPENDS MONEY WHEN IT LANDS ──────────────────────────────────────────
 * A real discover run fans out up to BLOG_AGENT_DAILY_TARGET draft jobs, each
 * of which calls Anthropic and git-commits markdown into the tree that serves
 * production. The daily ceiling (BLOG_AGENT_DAILY_USD) is shared with the
 * cron's own run and is enforced in the pipeline, so a manual run eats into the
 * same budget rather than doubling it — but it is still a real run. Point it at
 * a dev checkout, or expect drafts.
 */

import "dotenv/config";

import { getQueue, closeAllQueues } from "@/infrastructure/queue/registry";
import { getRedisConnection } from "@/infrastructure/redis/connection";
import {
  BlogAgentConfigError,
  blogAgentApiKey,
  blogAgentDailyTarget,
  blogAgentDailyUsd,
  blogAgentEnabled,
  blogAgentMode,
  blogAgentModel,
} from "@/lib/blog-agent/config";
// Imported rather than retyped: the queue name and job name must be the ones
// the worker actually switches on, or this enqueues a job nothing consumes.
import { DISCOVER_JOB } from "@/infrastructure/queue/workers/blog-agent.worker";

const QUEUE_NAME = "blog-agent" as const;

async function main(): Promise<void> {
  if (!blogAgentEnabled()) {
    console.error(
      "BLOG_AGENT_ENABLED is not true — nothing enqueued.\n" +
        "The worker would have accepted the job and skipped it, which looks\n" +
        "exactly like a broken pipeline. Set BLOG_AGENT_ENABLED=true in .env\n" +
        "and restart the workers, then run this again.",
    );
    process.exitCode = 1;
    return;
  }

  // Reads only. Each of these throws BlogAgentConfigError naming its variable.
  blogAgentApiKey();
  const target = blogAgentDailyTarget();
  const dailyUsd = blogAgentDailyUsd();
  const mode = blogAgentMode();

  console.log(
    `[blog-agent:once] enabled — model ${blogAgentModel()}, mode ${mode}, ` +
      `up to ${target} draft(s), daily ceiling $${dailyUsd.toFixed(2)} (shared with the 05:00 run)`,
  );
  if (mode === "auto") {
    console.warn(
      "[blog-agent:once] BLOG_AGENT_MODE=auto — a passing gate PUBLISHES. " +
        "Set BLOG_AGENT_MODE=review to land drafts instead.",
    );
  }

  const queue = getQueue(QUEUE_NAME);
  const job = await queue.add(
    DISCOVER_JOB,
    { kind: "discover" },
    // Matches what the repeatable entry and the worker's own fan-out use, so a
    // manual run leaves the queue looking exactly like a cron run did.
    { removeOnComplete: true, removeOnFail: { count: 50 } },
  );

  console.log(
    `[blog-agent:once] enqueued ${DISCOVER_JOB} as job ${job.id}.\n` +
      "[blog-agent:once] The WORKER runs it — if `npm run workers` (or the pm2\n" +
      "[blog-agent:once] worker process) is not up, this job just waits.",
  );
}

main()
  .catch((err) => {
    if (err instanceof BlogAgentConfigError) {
      console.error(`[blog-agent:once] ${err.message}`);
    } else {
      console.error("[blog-agent:once] failed to enqueue:", err);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    // Both are needed to exit: closeAllQueues() releases the Queue objects, but
    // the ioredis instance was created here and BullMQ does not close a
    // connection it was handed. Without the quit() the process hangs on an idle
    // socket, which in a test loop reads as "the script is stuck".
    await closeAllQueues().catch(() => {});
    await getRedisConnection().quit().catch(() => {});
  });
