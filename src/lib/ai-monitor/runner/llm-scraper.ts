import "server-only";

// src/lib/ai-monitor/runner/llm-scraper.ts
//
// ChatGPT and Gemini for the scheduled tracker, through DataForSEO's LLM
// Scraper standard queue. The pure parts (endpoints, task, parser) are in
// ./llm-scraper-parse.ts.
//
// THE FLOW, ACROSS TWO PASSES OF ONE CHECKUP:
//   1. The checkup asks the slot. No task yet: post one (metered: the AI
//      ledger and the AI cap through meteredAiCall, a SeoApiCall row with
//      feature "ai_tracking"), store an LlmScraperTask row carrying the whole
//      slot, and throw AnswerPending. The runner leaves the slot unwritten and
//      the checkup RUNNING.
//   2. The shared standard-queue drain (dataforseo/standard-queue.ts, the
//      serp-checks worker) collects the task through the owners below, stores
//      the answer on the row, and enqueues a resume of the checkup.
//   3. The resume rebuilds the slots from the rows and runs the checkup again.
//      Slots already written are skipped (priorRuns), these are answered from
//      the row at no further cost, and the checkup finishes as usual.
//
// A task the queue never returns is failed by the drain's 90-minute timeout,
// and the resume records that slot FAILED. The stale-checkup reaper leaves a
// checkup alone while it still has queued tasks.
//
// SHARED ANSWERS: the ask is still made through askShared, so a question
// another tenant already has today's answer to is a cache hit and posts
// nothing. Two tenants asking the same new question while its task is queued
// each post one; the second is a cache hit only once the first is collected.
import { prisma } from "@/lib/prisma";
import { logger } from "@/infrastructure/observability/logger";
import { addJob } from "@/infrastructure/queue/registry";
import { queueJobId } from "@/infrastructure/queue/job-id";
import type { StandardQueueOwner, PendingTask } from "@/lib/dataforseo/standard-queue";
import type { PlanType } from "@/generated/prisma";
import type { AiProvider } from "../pricing";
import type { MeteredCall } from "../analysis/analyze-response";
import type { RunSlot } from "./plan";
import { slotKey } from "./plan";
import type { AskResult } from "./providers";
import { AnswerPending } from "./pending";
import { postTrackingTask } from "./tracking-calls";
import {
  llmScraperPaths,
  llmScraperTask,
  parseLlmScraperResult,
  type LlmScraperProvider,
} from "./llm-scraper-parse";

const log = logger.child({ module: "llm-scraper" });

/** How long a resume waits, so tasks finishing close together share one pass. */
export const RESUME_DELAY_MS = 30_000;

/**
 * Run the checkup again once its queued answers have moved. Debounced by job
 * id: further completions inside the delay collapse into the waiting job.
 * `again` gives a follow-up its own id, for a completion that raced a running
 * resume (whose id is still taken until it finishes).
 */
export async function enqueueCheckupResume(checkupId: string, again = false): Promise<void> {
  try {
    await addJob(
      "ai-checkup",
      "resume",
      { resumeCheckupId: checkupId },
      {
        jobId: again ? queueJobId("checkup-resume", checkupId, Date.now()) : queueJobId("checkup-resume", checkupId),
        delay: RESUME_DELAY_MS,
        removeOnComplete: true,
        removeOnFail: { count: 50 },
      },
    );
  } catch (err) {
    log.error({ err, checkupId }, "could not enqueue a checkup resume");
  }
}

/** Is this slot already paid for (a task posted)? Its answer must not be refused at the cap. */
export async function hasPostedTask(slot: RunSlot): Promise<boolean> {
  const row = await prisma.llmScraperTask.findUnique({
    where: { checkupId_slotKey: { checkupId: slot.checkupId, slotKey: slotKey(slot) } },
    select: { id: true },
  });
  return row !== null;
}

/**
 * Ask ChatGPT or Gemini for one slot. Posts on the first pass, answers from the
 * stored result on the resume. Throws AnswerPending while the task is queued,
 * and an Error with the reason when it failed.
 */
export async function askViaLlmScraper(args: {
  provider: LlmScraperProvider;
  slot: RunSlot;
  tenantId: string;
  plan: PlanType;
  meter: MeteredCall;
  env?: NodeJS.ProcessEnv;
}): Promise<AskResult> {
  const { provider, slot, tenantId, plan, meter } = args;
  const key = slotKey(slot);
  const row = await prisma.llmScraperTask.findUnique({
    where: { checkupId_slotKey: { checkupId: slot.checkupId, slotKey: key } },
  });

  if (!row) {
    const paths = llmScraperPaths(provider);
    const posted = await meter(
      { tenantId, plan },
      { provider: provider as AiProvider, model: slot.model, purpose: "answer", checkupId: slot.checkupId },
      async () => {
        const result = await postTrackingTask<unknown>(tenantId, paths.taskPost, llmScraperTask(provider, slot.promptText, args.env));
        if (!result.taskId) throw new Error(`${provider}: DataForSEO returned no task id`);
        const created = await prisma.llmScraperTask.create({
          data: {
            tenantId,
            checkupId: slot.checkupId,
            slotKey: key,
            provider,
            model: slot.model,
            promptId: slot.promptId,
            promptText: slot.promptText,
            promptCategory: slot.promptCategory,
            repetition: slot.repetition,
            taskId: result.taskId,
            costUsd: result.billing.costUsd,
          },
          select: { taskId: true },
        });
        // The money is spent now, so the ledger and the AI cap see it now.
        return { value: created, usage: { inputTokens: 0, outputTokens: 0 }, model: slot.model, costUsd: result.billing.costUsd };
      },
    );
    throw new AnswerPending(key, posted.taskId);
  }

  if (row.status === "QUEUED") throw new AnswerPending(key, row.taskId);
  if (row.status === "FAILED") throw new Error(row.error ?? `${provider} did not return an answer`);

  return {
    answer: row.answer ?? "",
    sources: (row.sources as { url: string; title?: string | null }[] | null) ?? null,
    model: row.servedModel ?? row.model,
    inputTokens: 0,
    outputTokens: 0,
    latencyMs: row.completedAt ? row.completedAt.getTime() - row.createdAt.getTime() : 0,
    // Already on the ledger, from the post.
    costUsd: 0,
  };
}

/** The slots of a checkup's queued answers, rebuilt from their rows for a resume. */
export async function llmScraperSlots(checkupId: string): Promise<RunSlot[]> {
  const rows = await prisma.llmScraperTask.findMany({
    where: { checkupId },
    orderBy: { createdAt: "asc" },
    select: { promptId: true, promptText: true, provider: true, model: true, repetition: true, promptCategory: true },
  });
  return rows.map((r) => ({
    checkupId,
    promptId: r.promptId,
    promptText: r.promptText,
    engine: r.provider,
    model: r.model,
    repetition: r.repetition,
    promptCategory: r.promptCategory,
  }));
}

/** Does this checkup still wait on DataForSEO? The stale reaper must leave it alone. */
export async function hasQueuedTasks(checkupId: string): Promise<boolean> {
  return (await prisma.llmScraperTask.count({ where: { checkupId, status: "QUEUED" } })) > 0;
}

async function finish(rowId: string, data: Record<string, unknown>): Promise<void> {
  const row = await prisma.llmScraperTask.update({
    where: { id: rowId },
    data: { ...data, completedAt: new Date() },
    select: { checkupId: true },
  });
  await enqueueCheckupResume(row.checkupId);
}

/** The drain's owner for one engine's queue. */
export function llmScraperOwner(provider: LlmScraperProvider): StandardQueueOwner {
  const paths = llmScraperPaths(provider);
  return {
    name: `llm-scraper-${provider.toLowerCase()}`,
    queue: { tasksReady: paths.tasksReady, taskGet: paths.taskGet },

    async timeoutStale(cutoff: Date): Promise<number> {
      const stale = await prisma.llmScraperTask.findMany({
        where: { provider, status: "QUEUED", createdAt: { lt: cutoff } },
        select: { id: true, checkupId: true },
      });
      if (stale.length === 0) return 0;
      await prisma.llmScraperTask.updateMany({
        where: { id: { in: stale.map((s) => s.id) }, status: "QUEUED" },
        data: { status: "FAILED", error: `${provider === "CHATGPT" ? "ChatGPT" : "Gemini"} did not return an answer within 90 minutes`, completedAt: new Date() },
      });
      for (const checkupId of new Set(stale.map((s) => s.checkupId))) await enqueueCheckupResume(checkupId);
      return stale.length;
    },

    async findPending(createdBefore: Date, limit: number): Promise<PendingTask[]> {
      const rows = await prisma.llmScraperTask.findMany({
        where: { provider, status: "QUEUED", createdAt: { lte: createdBefore } },
        orderBy: { createdAt: "asc" },
        take: limit,
        select: { id: true, taskId: true, createdAt: true },
      });
      return rows.map((r) => ({ rowId: r.id, taskId: r.taskId, createdAt: r.createdAt }));
    },

    async complete(rowId: string, result: unknown[]): Promise<void> {
      const parsed = parseLlmScraperResult(result);
      if (!parsed) {
        await finish(rowId, { status: "FAILED", error: `${provider === "CHATGPT" ? "ChatGPT" : "Gemini"} returned an empty answer` });
        return;
      }
      await finish(rowId, {
        status: "DONE",
        answer: parsed.answer,
        sources: parsed.sources,
        servedModel: parsed.servedModel,
        error: null,
      });
    },

    async fail(rowId: string, message: string): Promise<void> {
      await finish(rowId, { status: "FAILED", error: message });
    },
  };
}

export const LLM_SCRAPER_OWNERS: readonly StandardQueueOwner[] = [llmScraperOwner("CHATGPT"), llmScraperOwner("GEMINI")];
