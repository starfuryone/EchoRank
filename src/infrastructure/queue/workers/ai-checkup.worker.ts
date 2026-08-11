/**
 * AI Search checkup worker.
 *
 * Two jobs on one queue. A repeatable SWEEP finds the brands whose next checkup
 * is due and enqueues one RUN each; a RUN builds that brand's plan and drives
 * it through the runner.
 *
 * SEPARATE QUEUE FROM visibility-monitoring, which belongs to the AI Visibility
 * Audit and is untouched. The two look superficially alike — both ask models
 * about a brand on a schedule — but they have different data models, different
 * cost profiles and different owners, and sharing a queue would mean one
 * product's backlog delaying the other's.
 *
 * THE PER-PROVIDER LIMITER IS MODULE-SCOPED, deliberately. The runner asks its
 * slots one at a time, so a single checkup never needs throttling; what needs
 * it is four checkups running concurrently in this process and all reaching for
 * the same vendor. A limiter created per job would be four limiters of two, not
 * one limiter of two, and the rate limit it exists to respect is counted at the
 * vendor.
 *
 * DEFAULT OFF. Every brand is filtered through aiSearchEnabledFor() before it
 * is enqueued: the surface is behind a rollout flag, and a worker that started
 * spending money for every tenant the moment it deployed would be the worst
 * possible way to discover the flag was ignored.
 */

import { Worker, type Job } from "bullmq";
import { getSubscriberConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import { getQueue, addJob } from "@/infrastructure/queue/registry";
import { prisma } from "@/lib/prisma";
import { logger } from "@/infrastructure/observability/logger";
import { planConfig } from "@/lib/plan-config";
import { aiSearchEnabledFor } from "@/lib/ai-monitor/rollout";
import { enginesFor, resolveShapeForTenant } from "@/lib/ai-monitor/limits";

import { disabledProviders } from "@/lib/ai-monitor/engine-registry";
import { runnableEngines, refusals } from "@/lib/ai-monitor/runner/providers";
import { buildRunPlan, snapshotShape } from "@/lib/ai-monitor/runner/plan";
import { runCheckup } from "@/lib/ai-monitor/runner/checkup-runner";
import { prismaPorts } from "@/lib/ai-monitor/runner/ports";
import {
  createProviderLimiter,
  dueBrands,
  enqueueBucket,
  isStaleRunning,
  type SchedulableBrand,
} from "@/lib/ai-monitor/runner/scheduler";
import { salvageScoredRuns } from "@/lib/ai-monitor/runner/salvage";
import { aggregateCheckup } from "@/lib/ai-monitor/metrics";
import { writeVisibilityMetrics } from "@/lib/ai-monitor/metrics-store";
import { isPartialCoverage } from "@/lib/ai-monitor/runner/status";

const QUEUE_NAME = "ai-checkup" as const;
const SWEEP_JOB_NAME = "sweep";
const RUN_JOB_NAME = "run-checkup";

/** Find due brands every 15 minutes; the jitter inside decides which fire. */
const SWEEP_INTERVAL_MS = 15 * 60_000;

/**
 * Brands enqueued per sweep.
 *
 * A bound rather than a page size: a backlog drains over several sweeps instead
 * of one sweep enqueueing four hundred checkups and every one of them competing
 * for the same provider slots. dueBrands() orders oldest-first, so the cut is
 * always taken from the least overdue end.
 */
const SWEEP_BATCH = 25;

/** Checkups running at once in this process. */
const CONCURRENCY = 2;

export interface AiCheckupJob {
  /** The repeatable sweep tick. */
  sweep?: boolean;
  /** A single brand's checkup. */
  brandProfileId?: string;
  tenantId?: string;
  /** Set when an operator asked for one, rather than the schedule. */
  manual?: boolean;
}

/**
 * One limiter for the whole process. See the header — per-job would defeat it.
 *
 * PER PROCESS IS THE RESIDUAL LIMIT, and it is worth naming. Run two worker
 * processes and the effective ceiling at each vendor doubles, because neither
 * process can see the other's in-flight calls. That is fine at one worker and
 * is not worth a Redis-backed distributed semaphore today; it becomes wrong the
 * moment this queue is scaled horizontally, and the fix at that point is to
 * divide AI_CONCURRENCY_<PROVIDER> by the replica count or move the limiter
 * into Redis.
 */
const limiter = createProviderLimiter();

/** UTC midnight for the day a metrics row belongs to. */
function utcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Finish checkups whose worker died.
 *
 * A run persists each answer as it gets it but writes the metrics row once, at
 * the end. A process killed halfway therefore leaves a RUNNING row over a set
 * of answers that were paid for and never scored. Nothing else notices: the
 * cadence sweep ignores unfinished checkups by design, so the brand carries on
 * being scheduled while the corpse sits there saying "running" forever.
 *
 * SALVAGES RATHER THAN DISCARDS. The runs are already analysed and stored, so
 * the money is spent either way; scoring them is the same call the runner makes
 * when a cap cuts a checkup short, and for the same reason. A dead checkup with
 * usable answers lands PARTIAL with a flagged metrics row, one with none lands
 * FAILED — exactly the rule in runner/status.ts, so a reaped checkup is
 * indistinguishable from one that ended that way on its own.
 */
async function reapStale(now: Date): Promise<number> {
  const running = await prisma.checkup.findMany({
    where: { status: "RUNNING" },
    select: {
      id: true,
      brandProfileId: true,
      startedAt: true,
      promptCount: true,
      repetitions: true,
      providers: true,
    },
  });

  let reaped = 0;

  for (const checkup of running) {
    const planned =
      checkup.promptCount * Math.max(1, checkup.providers.length) * checkup.repetitions;
    if (!isStaleRunning(checkup.startedAt, planned, now)) continue;

    const runs = await prisma.promptRun.findMany({
      where: { checkupId: checkup.id },
      select: {
        engine: true,
        promptId: true,
        status: true,
        brandMentioned: true,
        analysis: {
          select: { mentionCount: true, recommendationPosition: true, sentiment: true },
        },
        citations: { select: { domain: true, citationPosition: true, supportsBrand: true } },
        competitorMentions: { select: { name: true, recommendationPosition: true } },
      },
    });

    const scored = salvageScoredRuns(runs);
    // The plan is the authority on how much was owed, not the rows that exist:
    // a worker killed before it wrote a slot left no row at all, and counting
    // only what is there would report full coverage over a third of a checkup.
    const counts = {
      planned,
      ok: scored.length,
      skippedCap: runs.filter((run) => run.status === "SKIPPED_CAP").length,
      failed: planned - scored.length - runs.filter((r) => r.status === "SKIPPED_CAP").length,
    };

    if (scored.length > 0) {
      const { byEngine } = aggregateCheckup(scored);
      await writeVisibilityMetrics(
        checkup.brandProfileId,
        utcDay(checkup.startedAt ?? now),
        Object.entries(byEngine).map(([engine, aggregate]) => ({ engine, aggregate })),
        { partialCoverage: isPartialCoverage(counts), skippedRuns: planned - scored.length },
      );
    }

    await prisma.checkup.update({
      where: { id: checkup.id },
      data: {
        status: scored.length === 0 ? "FAILED" : "PARTIAL",
        stoppedReason: `abandoned: ${scored.length} of ${planned} runs completed before the worker stopped`,
        completedAt: now,
      },
    });

    reaped += 1;
    logger.warn(
      { checkupId: checkup.id, brandProfileId: checkup.brandProfileId, planned, ok: scored.length },
      "reaped an abandoned checkup",
    );
  }

  return reaped;
}

/**
 * Find what is due and enqueue it.
 *
 * Reads the LAST COMPLETED checkup rather than the last created one: a checkup
 * that is still running, or that failed before it asked anything, has not
 * satisfied the cadence, and treating it as though it had would silently drop a
 * brand's coverage for a whole interval.
 */
async function sweep(now: Date): Promise<number> {
  // Before deciding what is due: finish anything abandoned. Doing it first
  // means a brand whose last checkup died is eligible again on THIS tick rather
  // than waiting another fifteen minutes to be noticed.
  await reapStale(now);

  // Whatever is still RUNNING after that is genuinely in flight. Skipping those
  // brands is the real guard against starting a second checkup on top of a live
  // one; the job id below is a cheaper first line, but it lives in Redis and
  // this lives in the same table the runner writes.
  const inFlight = new Set(
    (
      await prisma.checkup.findMany({
        where: { status: "RUNNING" },
        select: { brandProfileId: true },
      })
    ).map((checkup) => checkup.brandProfileId),
  );

  const brands = await prisma.brandProfile.findMany({
    where: { trackingActive: true },
    select: {
      id: true,
      tenantId: true,
      tenant: { select: { planType: true } },
      checkups: {
        where: { status: { in: ["READY", "PARTIAL"] } },
        orderBy: { completedAt: "desc" },
        take: 1,
        select: { completedAt: true },
      },
    },
  });

  const schedulable: (SchedulableBrand & { plan: ReturnType<typeof planConfig> })[] = brands
    // The rollout gate, before anything is scheduled or spent.
    .filter((brand) => aiSearchEnabledFor(brand.tenantId))
    .map((brand) => {
      const plan = planConfig(brand.tenant.planType);
      return {
        brandProfileId: brand.id,
        tenantId: brand.tenantId,
        frequency: plan.aiCheckup.frequency,
        lastCheckupAt: brand.checkups[0]?.completedAt ?? null,
        trackingActive: true,
        plan,
      };
    });

  const due = dueBrands(
    schedulable.filter((brand) => !inFlight.has(brand.brandProfileId)),
    now,
  ).slice(0, SWEEP_BATCH);

  for (const brand of due) {
    // BUCKETED BY INTERVAL, not just by brand. BullMQ silently ignores `add`
    // for a job id that still exists, and this queue keeps failed jobs for
    // seven days and completed ones for a day — so a bare `checkup:<brand>`
    // would mute a brand for a week after one exhausted checkup, and clip the
    // daily tier for the 24h a successful record is retained. The bucket
    // collapses repeat sweeps inside one interval and always gives the next
    // interval a fresh id, whatever Redis is still holding.
    const bucket = enqueueBucket(brand.frequency, now);
    await addJob<AiCheckupJob>(
      QUEUE_NAME,
      RUN_JOB_NAME,
      { brandProfileId: brand.brandProfileId, tenantId: brand.tenantId },
      { jobId: `checkup:${brand.brandProfileId}:${bucket}` },
    );
  }

  logger.info(
    { queue: QUEUE_NAME, considered: schedulable.length, enqueued: due.length },
    "AI checkup sweep complete",
  );
  return due.length;
}

/** Build and run one brand's checkup. */
async function runOne(job: AiCheckupJob, now: Date): Promise<void> {
  const { brandProfileId } = job;
  if (!brandProfileId) throw new Error("run-checkup job has no brandProfileId");

  const brand = await prisma.brandProfile.findUnique({
    where: { id: brandProfileId },
    select: {
      id: true,
      tenantId: true,
      name: true,
      website: true,
      aliases: true,
      competitors: true,
      tenant: { select: { planType: true } },
    },
  });
  if (!brand) {
    logger.warn({ brandProfileId }, "brand profile vanished before its checkup ran");
    return;
  }

  const planType = brand.tenant.planType;

  // THE ONE PLACE THE SHAPE IS RESOLVED. Everything below takes it as a value;
  // nothing downstream reads planConfig(plan).aiCheckup, so a standalone
  // watcher holder gets the solo shape everywhere rather than in whichever
  // call site remembered to ask.
  const { shape, source } = await resolveShapeForTenant(brand.tenantId, planType);

  // Both halves of "which engines": what the tier allows AND what can actually
  // be reached and billed. refusals() is logged rather than swallowed, so an
  // engine missing from a report reads as configuration and not as an outage.
  const allowed = enginesFor(shape, process.env, await disabledProviders());
  const engines = runnableEngines(allowed);
  const excluded = refusals(allowed);
  if (excluded.length > 0) {
    logger.info({ brandProfileId, excluded }, "engines excluded from this checkup");
  }
  if (engines.length === 0) {
    logger.warn({ brandProfileId, planType }, "no runnable engines — checkup not created");
    return;
  }

  const prompts = await prisma.trackedPrompt.findMany({
    where: { brandProfileId, active: true, selected: true },
    orderBy: [{ lastRunAt: "asc" }, { createdAt: "asc" }],
    take: shape.prompts,
    select: { id: true, text: true, category: true },
  });
  if (prompts.length === 0) {
    logger.warn({ brandProfileId }, "no selected prompts — checkup not created");
    return;
  }

  const snapshot = snapshotShape(prompts, engines, shape.repetitions);
  const checkup = await prisma.checkup.create({
    data: {
      tenantId: brand.tenantId,
      brandProfileId: brand.id,
      manual: job.manual ?? false,
      // The shape is copied onto the row at creation so the checkup keeps
      // reporting what it actually ran under after an upgrade or a config edit.
      providers: snapshot.providers,
      promptCount: snapshot.promptCount,
      repetitions: snapshot.repetitions,
    },
    select: { id: true },
  });

  const ports = prismaPorts({
    tenantId: brand.tenantId,
    plan: planType,
    checkupId: checkup.id,
    brand: {
      brand: brand.name,
      domain: brand.website,
      brandVariations: brand.aliases,
      competitors: brand.competitors,
    },
  });

  const result = await runCheckup(
    {
      checkupId: checkup.id,
      tenantId: brand.tenantId,
      brandProfileId: brand.id,
      plan: planType,
      brand: {
        brand: brand.name,
        domain: brand.website,
        brandVariations: brand.aliases,
        competitors: brand.competitors,
      },
      slots: buildRunPlan(checkup.id, prompts, engines, shape.repetitions),
      citationCapableEngines: new Set(
        engines.filter((engine) => engine.supportsCitations).map((engine) => engine.provider),
      ),
      day: utcDay(now),
    },
    {
      ...ports,
      // The one place the limiter binds. Every provider call in this process
      // passes through it, whichever checkup issued it.
      ask: (slot) => limiter.run(slot.engine, () => ports.ask(slot)),
    },
  );

  // The prompts that actually ran, so the per-prompt scheduler in schedule.ts
  // sees them as sampled. Skipped slots deliberately do not count.
  const askedPromptIds = [
    ...new Set(result.outcomes.filter((o) => o.status === "OK").map((o) => o.slot.promptId)),
  ];
  if (askedPromptIds.length > 0) {
    await prisma.trackedPrompt.updateMany({
      where: { id: { in: askedPromptIds } },
      data: { lastRunAt: now },
    });
  }

  logger.info(
    {
      checkupId: checkup.id,
      brandProfileId,
      status: result.status,
      // Which shape applied, and why. The first question on a "why did I only
      // get ten prompts" ticket.
      shapeSource: source,
      ...result.tally,
    },
    "AI checkup finished",
  );
}

async function processAiCheckupJob(job: Job<AiCheckupJob>): Promise<void> {
  const now = new Date();
  if (job.data.sweep) {
    await sweep(now);
    return;
  }
  await runOne(job.data, now);
}

// ─── Worker Factory ───────────────────────────────────────────────────────────

let worker: Worker<AiCheckupJob> | null = null;

export function startAiCheckupWorker(): Worker<AiCheckupJob> {
  if (worker) return worker;

  worker = new Worker<AiCheckupJob>(QUEUE_NAME, processAiCheckupJob, {
    connection: getSubscriberConnection(),
    prefix: REDIS_CONFIG.queues.prefix,
    concurrency: CONCURRENCY,
  });

  // Repeatable sweep. BullMQ dedupes the repeat config across restarts.
  getQueue(QUEUE_NAME)
    .add(
      SWEEP_JOB_NAME,
      { sweep: true },
      {
        repeat: { every: SWEEP_INTERVAL_MS },
        removeOnComplete: true,
        removeOnFail: { count: 50 },
      },
    )
    .catch((err) => {
      logger.error({ err, queue: QUEUE_NAME }, "Failed to schedule AI checkup sweep");
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

export const __testing = { sweep, runOne, reapStale, utcDay, QUEUE_NAME, SWEEP_BATCH };
