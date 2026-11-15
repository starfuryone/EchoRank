import { Worker, type Job } from "bullmq";
import { getSubscriberConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import type { MemoryAddJob } from "@/infrastructure/queue/jobs/schemas";
import { logger } from "@/infrastructure/observability/logger";
import { hasPaidPlan } from "@/lib/paid-plan";
import { tenantPlan } from "@/lib/plan-access-server";
import { addMemoryNow } from "@/lib/memory/client";
import { memoryAllowance } from "@/lib/memory/limits";
import { memoryBudgetExhausted, recordMemoryTokens, releaseMemoryAdd, reserveMemoryAdd } from "@/lib/memory/quota";
import { costUsdFor } from "@/lib/ai-monitor/pricing";

const QUEUE_NAME = "memory-add";
/** The sidecar runs one event loop; two at a time keeps its other routes responsive. */
const CONCURRENCY = 2;
/** av-service memory/config.py MODEL; the house model. */
const EXTRACTION_MODEL = "claude-haiku-5-5";

/**
 * One fact extraction (av-service POST /memory/add, infer=true).
 *
 * Re-checked here, not trusted from the enqueue: the plan can lapse between
 * the two. Order: paid status → plan allowance → global daily token budget →
 * this month's adds (reserved) → the sidecar call (which also checks the
 * tenant's on/off switch and maxStored before any model call). Anything that
 * spends nothing gives the reserved add back.
 *
 * Skips are logged, not thrown: a skipped add is the rule working, and a
 * throw would email support@ for every tenant over its allowance. A sidecar
 * failure IS thrown, so BullMQ retries it.
 */
export async function processMemoryAdd(job: Job<MemoryAddJob>): Promise<string> {
  const { tenantId, surface } = job.data;
  if (!tenantId) return "skipped:no-tenant";

  const [paid, plan] = await Promise.all([hasPaidPlan(tenantId), tenantPlan(tenantId)]);
  if (!paid || !plan) return "skipped:unpaid";
  const allowance = memoryAllowance(plan);
  if (allowance.addsPerMonth === 0) return "skipped:plan";
  if (await memoryBudgetExhausted()) {
    logger.warn({ queue: QUEUE_NAME, tenantId }, "memory add skipped: MEM0_DAILY_TOKEN_BUDGET reached");
    return "skipped:budget";
  }

  const quota = await reserveMemoryAdd(tenantId, plan);
  if (!quota.allowed) return "skipped:quota";

  let result;
  try {
    result = await addMemoryNow({
      tenantId,
      surface,
      messages: job.data.messages,
      text: job.data.text,
      metadata: {
        locale: job.data.locale,
        ...(job.data.userId ? { userId: job.data.userId } : {}),
        ...(job.data.category ? { category: job.data.category } : {}),
      },
      maxStored: allowance.maxStored,
    });
  } catch (err) {
    await releaseMemoryAdd(tenantId);
    throw err;
  }

  const tokens = result.usage.input_tokens + result.usage.output_tokens;
  if (result.skipped || tokens === 0) await releaseMemoryAdd(tenantId);
  await recordMemoryTokens(tokens);
  const { costUsd } = costUsdFor("CLAUDE", EXTRACTION_MODEL, {
    inputTokens: result.usage.input_tokens,
    outputTokens: result.usage.output_tokens,
    cachedInputTokens: 0,
  });
  logger.info(
    {
      queue: QUEUE_NAME,
      tenantId,
      surface,
      added: result.added.length,
      dropped: result.dropped,
      skipped: result.skipped ?? null,
      inputTokens: result.usage.input_tokens,
      outputTokens: result.usage.output_tokens,
      costUsd,
    },
    "memory add done",
  );
  return result.skipped ? `skipped:${result.skipped}` : `added:${result.added.length}`;
}

let worker: Worker<MemoryAddJob> | null = null;

export function startMemoryAddWorker(): Worker<MemoryAddJob> {
  if (worker) return worker;
  worker = new Worker<MemoryAddJob>(QUEUE_NAME, processMemoryAdd, {
    connection: getSubscriberConnection(),
    prefix: REDIS_CONFIG.queues.prefix,
    concurrency: CONCURRENCY,
  });
  worker.on("failed", (job, err) => {
    // No job data in the log line: it is tenant text.
    logger.error({ jobId: job?.id, err, queue: QUEUE_NAME }, "Memory add job failed");
  });
  return worker;
}
