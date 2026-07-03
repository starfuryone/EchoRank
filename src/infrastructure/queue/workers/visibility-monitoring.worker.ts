import { Worker, type Job } from "bullmq";
import { getSubscriberConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import type { VisibilityMonitoringJob } from "@/infrastructure/queue/jobs/schemas";
import { getQueue, addJob } from "@/infrastructure/queue/registry";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma";
import { sidecarPost } from "@/lib/av-sidecar";
import { meteringService } from "@/infrastructure/metering/service";
import { sendVisibilityAlert, type BotFlip } from "@/lib/visibility-alerts";
import { logger } from "@/infrastructure/observability/logger";
import { withSpan } from "@/infrastructure/observability/telemetry";

const QUEUE_NAME = "visibility-monitoring";
const SWEEP_JOB_NAME = "sweep";
const RUN_JOB_NAME = "run-monitor";
const SWEEP_INTERVAL_MS = 15 * 60_000; // find due monitors every 15 min
const SWEEP_BATCH = 25;
const SCORE_DROP_THRESHOLD = 5; // alert when score falls by more than this

const DAY_MS = 24 * 60 * 60 * 1000;

const PROMPT_SWEEP_JOB_NAME = "prompt-sweep";
const PROMPT_BATCH_JOB_NAME = "run-prompt-batch";
const PROMPT_BATCH_SIZE = 25; // sidecar MAX_PROMPTS_PER_CALL

interface TrackCompetitor {
  name: string;
  mentioned: boolean;
}
interface TrackResult {
  id: string;
  prompt: string;
  brand_mentioned: boolean;
  brand_rank: number | null;
  competitors: TrackCompetitor[];
  excerpt: string;
  error: string | null;
  model: string;
}
interface TrackResponse {
  engine?: string;
  model?: string;
  results?: TrackResult[];
  error?: string;
}

function domainRoot(url: string): string | null {
  const host = url.replace(/^https?:\/\//, "").split("/")[0];
  const parts = host.split(".").filter(Boolean);
  const root = parts[0] === "www" ? parts[1] : parts[0];
  return root && root.length >= 3 ? root : null;
}

interface AuditCheck {
  category: string;
  points: number;
  max: number;
  status: string;
  recommendation: string;
}
interface AuditBot {
  status: string;
  detail: string;
}
interface AuditResult {
  url?: string;
  score?: number;
  grade?: string;
  checks?: AuditCheck[];
  robots?: { present?: boolean; bots?: Record<string, AuditBot> };
  error?: string;
}

/** Enqueue one run job per due monitor. jobId dedupes overlapping sweeps. */
async function processSweep(): Promise<void> {
  const due = await prisma.visibilityMonitor.findMany({
    where: { active: true, nextRunAt: { lte: new Date() } },
    orderBy: { nextRunAt: "asc" },
    take: SWEEP_BATCH,
    select: { id: true, tenantId: true },
  });
  if (due.length === 0) return;
  logger.info({ count: due.length, queue: QUEUE_NAME }, "Sweep: enqueueing due monitors");
  for (const m of due) {
    await addJob<VisibilityMonitoringJob>(
      QUEUE_NAME,
      RUN_JOB_NAME,
      { tenantId: m.tenantId, monitorId: m.id },
      { jobId: `vm-${m.id}`, removeOnComplete: true, removeOnFail: true },
    );
  }
}

async function processMonitorRun(monitorId: string): Promise<void> {
  const monitor = await prisma.visibilityMonitor.findUnique({ where: { id: monitorId } });
  if (!monitor || !monitor.active) return;

  const interval = monitor.cadence === "DAILY" ? DAY_MS : 7 * DAY_MS;

  // Config-enforced monitoring quota (plan-config maxMonitoringChecks).
  const quota = await meteringService.checkQuota(monitor.tenantId, "MONITORING_CHECK", 1);
  if (!quota.allowed) {
    logger.warn(
      { monitorId, tenantId: monitor.tenantId, limit: quota.limit, queue: QUEUE_NAME },
      "Monitoring quota exhausted - skipping run",
    );
    await prisma.visibilityMonitor.update({
      where: { id: monitor.id },
      data: { nextRunAt: new Date(Date.now() + interval) },
    });
    return;
  }

  const { status, data } = await sidecarPost<AuditResult>("/audit", { url: monitor.url });
  if (status !== 200 || typeof data.score !== "number") {
    logger.error(
      { monitorId, url: monitor.url, status, error: data.error, queue: QUEUE_NAME },
      "Audit failed",
    );
    // Throw for BullMQ retry; nextRunAt is not advanced, so the next sweep
    // picks it up again if retries exhaust.
    throw new Error(`sidecar audit failed (${status})`);
  }

  const newScore = data.score;
  const newGrade = data.grade ?? "?";
  const newBots: Record<string, AuditBot> = data.robots?.bots ?? {};
  const checks: AuditCheck[] = data.checks ?? [];

  const prev = await prisma.visibilityAudit.findFirst({
    where: { monitorId },
    orderBy: { createdAt: "desc" },
    select: { score: true, bots: true },
  });

  await prisma.visibilityAudit.create({
    data: {
      tenantId: monitor.tenantId,
      monitorId: monitor.id,
      url: data.url ?? monitor.url,
      score: newScore,
      grade: newGrade,
      checks: checks as unknown as Prisma.InputJsonValue,
      bots: newBots as unknown as Prisma.InputJsonValue,
      raw: data as unknown as Prisma.InputJsonValue,
    },
  });

  await prisma.visibilityMonitor.update({
    where: { id: monitor.id },
    data: {
      lastRunAt: new Date(),
      lastScore: newScore,
      lastGrade: newGrade,
      nextRunAt: new Date(Date.now() + interval),
    },
  });

  await meteringService.record(monitor.tenantId, "MONITORING_CHECK", 1, {
    monitorId: monitor.id,
    url: monitor.url,
    source: "visibility",
  });

  // ── Diff vs previous run ──────────────────────────────────────────────────
  if (!prev) {
    logger.info({ monitorId, score: newScore, queue: QUEUE_NAME }, "Baseline audit stored");
    return;
  }
  const prevBots = (prev.bots ?? {}) as Record<string, Partial<AuditBot>>;
  const flippedBlocked: BotFlip[] = [];
  const flippedAllowed: string[] = [];
  for (const [bot, info] of Object.entries(newBots)) {
    const was = prevBots[bot]?.status;
    if (was === "ALLOWED" && info.status !== "ALLOWED") {
      flippedBlocked.push({ bot, detail: info.detail || info.status });
    } else if (was && was !== "ALLOWED" && info.status === "ALLOWED") {
      flippedAllowed.push(bot);
    }
  }
  const dropped = newScore < prev.score - SCORE_DROP_THRESHOLD;

  logger.info(
    {
      monitorId,
      url: monitor.url,
      score: `${prev.score} -> ${newScore}`,
      flippedBlocked: flippedBlocked.length,
      queue: QUEUE_NAME,
    },
    "Monitor run complete",
  );

  if (dropped || flippedBlocked.length > 0) {
    await sendVisibilityAlert({
      tenantId: monitor.tenantId,
      url: monitor.url,
      prevScore: prev.score,
      newScore,
      newGrade,
      flippedBlocked,
      flippedAllowed,
      failingChecks: checks
        .filter((c) => c.recommendation)
        .slice(0, 3)
        .map((c) => ({ category: c.category, recommendation: c.recommendation })),
    });
  }
}

async function processPromptSweep(): Promise<void> {
  const due = await prisma.trackedPrompt.findMany({
    where: { active: true, nextRunAt: { lte: new Date() } },
    select: { tenantId: true },
    distinct: ["tenantId"],
    take: 20,
  });
  if (due.length === 0) return;
  logger.info({ tenants: due.length, queue: QUEUE_NAME }, "Prompt sweep: enqueueing batches");
  for (const d of due) {
    await addJob<VisibilityMonitoringJob>(
      QUEUE_NAME,
      PROMPT_BATCH_JOB_NAME,
      { promptTenantId: d.tenantId },
      { jobId: `pt-${d.tenantId}`, removeOnComplete: true, removeOnFail: true },
    );
  }
}

async function processPromptBatch(tenantId: string): Promise<void> {
  const prompts = await prisma.trackedPrompt.findMany({
    where: { tenantId, active: true, nextRunAt: { lte: new Date() } },
    orderBy: { nextRunAt: "asc" },
    take: PROMPT_BATCH_SIZE,
  });
  if (prompts.length === 0) return;

  const advance = { nextRunAt: new Date(Date.now() + DAY_MS) };

  const quota = await meteringService.checkQuota(tenantId, "AI_INFERENCE", prompts.length);
  if (!quota.allowed) {
    logger.warn(
      { tenantId, prompts: prompts.length, limit: quota.limit, queue: QUEUE_NAME },
      "AI inference quota exhausted - skipping prompt batch",
    );
    await prisma.trackedPrompt.updateMany({
      where: { id: { in: prompts.map((p) => p.id) } },
      data: advance,
    });
    return;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true },
  });
  const monitors = await prisma.visibilityMonitor.findMany({
    where: { tenantId },
    select: { url: true },
  });
  const brandTerms = new Set<string>();
  if (tenant?.name && tenant.name.length >= 3) brandTerms.add(tenant.name);
  for (const m of monitors) {
    const root = domainRoot(m.url);
    if (root) brandTerms.add(root);
  }
  if (brandTerms.size === 0) brandTerms.add(tenant?.name ?? "unknown");

  const { status, data } = await sidecarPost<TrackResponse>("/track", {
    prompts: prompts.map((p) => ({ id: p.id, text: p.text })),
    brand_terms: Array.from(brandTerms),
    competitors: [],
  });
  if (status !== 200 || !Array.isArray(data.results)) {
    logger.error({ tenantId, status, error: data.error, queue: QUEUE_NAME }, "Track call failed");
    throw new Error(`sidecar track failed (${status})`);
  }

  const now = new Date();
  for (const r of data.results) {
    await prisma.promptRun.create({
      data: {
        tenantId,
        promptId: r.id,
        engine: data.engine ?? "claude",
        model: r.model ?? data.model ?? "unknown",
        brandMentioned: r.brand_mentioned,
        brandRank: r.brand_rank,
        competitors: (r.competitors ?? []) as unknown as Prisma.InputJsonValue,
        excerpt: r.excerpt || null,
        error: r.error,
      },
    });
    await prisma.trackedPrompt.update({
      where: { id: r.id },
      data: { lastRunAt: now, ...advance },
    });
  }

  await meteringService.record(tenantId, "AI_INFERENCE", data.results.length, {
    source: "answer_tracking",
  });

  const mentioned = data.results.filter((r) => r.brand_mentioned).length;
  logger.info(
    { tenantId, prompts: data.results.length, mentioned, queue: QUEUE_NAME },
    "Prompt batch complete",
  );
}

async function processVisibilityJob(job: Job<VisibilityMonitoringJob>): Promise<void> {
  await withSpan("visibility-monitoring.process", async () => {
    if (job.data.sweep) return processSweep();
    if (job.data.promptSweep) return processPromptSweep();
    if (job.data.promptTenantId) return processPromptBatch(job.data.promptTenantId);
    if (job.data.monitorId) return processMonitorRun(job.data.monitorId);
    logger.warn({ jobId: job.id, queue: QUEUE_NAME }, "Job without sweep flag or monitorId");
  });
}

// ─── Worker Factory ───────────────────────────────────────────────────────────

let worker: Worker<VisibilityMonitoringJob> | null = null;

export function startVisibilityMonitoringWorker(): Worker<VisibilityMonitoringJob> {
  if (worker) return worker;

  worker = new Worker<VisibilityMonitoringJob>(QUEUE_NAME, processVisibilityJob, {
    connection: getSubscriberConnection(),
    prefix: REDIS_CONFIG.queues.prefix,
    concurrency: 3,
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
      logger.error({ err, queue: QUEUE_NAME }, "Failed to schedule visibility sweep");
    });

  getQueue(QUEUE_NAME)
    .add(
      PROMPT_SWEEP_JOB_NAME,
      { promptSweep: true },
      {
        repeat: { every: SWEEP_INTERVAL_MS },
        removeOnComplete: true,
        removeOnFail: { count: 50 },
      },
    )
    .catch((err) => {
      logger.error({ err, queue: QUEUE_NAME }, "Failed to schedule prompt sweep");
    });

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id, queue: QUEUE_NAME }, "Job completed");
  });
  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, attempt: job?.attemptsMade, err, queue: QUEUE_NAME }, "Job failed");
  });
  worker.on("error", (err) => {
    logger.error({ err, queue: QUEUE_NAME }, "Worker error");
  });

  logger.info({ queue: QUEUE_NAME }, "Worker started");
  return worker;
}

export async function stopVisibilityMonitoringWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info({ queue: QUEUE_NAME }, "Worker stopped");
  }
}
