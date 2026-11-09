import { UnrecoverableError, Worker, type Job } from "bullmq";
import { getSubscriberConnection } from "@/infrastructure/redis/connection";
import { REDIS_CONFIG } from "@/infrastructure/redis/config";
import type { VisibilityMonitoringJob } from "@/infrastructure/queue/jobs/schemas";
import { getQueue, addJob } from "@/infrastructure/queue/registry";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma";
import { sidecarPost } from "@/lib/av-sidecar";
import { archiveSidecarPages, sidecarArchiveBody, takeSidecarArchive } from "@/lib/page-archive/sidecar";
import { meteringService } from "@/infrastructure/metering/service";
import {
  sendVisibilityAlert,
  recordPromptAlerts,
  type PromptTransition,
} from "@/lib/visibility-alerts";
import { monitorAlertDecision, scoreVersionOf, type BotMap } from "@/lib/visibility-score";
import { logger } from "@/infrastructure/observability/logger";
import {
  EARLIER_RUNS,
  RECENT_RUNS,
  lostRecommendation,
  regainedRecommendation,
} from "@/lib/prompt-alert-policy";
import { withSpan } from "@/infrastructure/observability/telemetry";

const QUEUE_NAME = "visibility-monitoring";
const SWEEP_JOB_NAME = "sweep";
const RUN_JOB_NAME = "run-monitor";
const SWEEP_INTERVAL_MS = 15 * 60_000; // find due monitors every 15 min
const SWEEP_BATCH = 25;
// A score drop alerts at SCORE_DROP_ALERT_POINTS (5) or more, within one score
// version: src/lib/visibility-score.ts monitorAlertDecision.

const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * A prompt whose answer errored (provider outage, rate limit) is asked again
 * after this, not tomorrow: the error cost nothing, and a day-long gap after a
 * five-minute outage is a day of "not run yet".
 */
const PROMPT_ERROR_RETRY_MS = 60 * 60 * 1000;

const PROMPT_SWEEP_JOB_NAME = "prompt-sweep";
const GSC_SWEEP_JOB_NAME = "gsc-sweep";
const DATA_DELETION_SWEEP_JOB_NAME = "data-deletion-sweep";
const LOGIN_EVENTS_PURGE_JOB_NAME = "login-events-purge";
const SALES_INQUIRIES_PURGE_JOB_NAME = "sales-inquiries-purge";
const PROMPT_BATCH_JOB_NAME = "run-prompt-batch";
const PROMPT_BATCH_SIZE = 25; // sidecar MAX_PROMPTS_PER_CALL
const RANK_DROP_THRESHOLD = 2; // alert when brandRank worsens by this many

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
  /** v2 (av-service ai_readiness.py): the scoring version and the fixes worth the most points. */
  score_version?: number;
  top_fixes?: { id?: string; title?: string; fix?: string }[];
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

export async function processMonitorRun(monitorId: string): Promise<void> {
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

  const { status, data } = await sidecarPost<AuditResult>("/audit", { url: monitor.url, ...sidecarArchiveBody() });
  // The pages read (page snapshots on): out before the response is stored.
  const pages = takeSidecarArchive(data);
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
  const newVersion = scoreVersionOf(data);
  const newBots: Record<string, AuditBot> = data.robots?.bots ?? {};
  const checks: AuditCheck[] = data.checks ?? [];

  const prev = await prisma.visibilityAudit.findFirst({
    where: { monitorId },
    orderBy: { createdAt: "desc" },
    select: { score: true, bots: true, scoreVersion: true },
  });

  const auditRow = await prisma.visibilityAudit.create({
    data: {
      tenantId: monitor.tenantId,
      monitorId: monitor.id,
      url: data.url ?? monitor.url,
      score: newScore,
      grade: newGrade,
      scoreVersion: newVersion,
      checks: checks as unknown as Prisma.InputJsonValue,
      bots: newBots as unknown as Prisma.InputJsonValue,
      raw: data as unknown as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
  if (pages) archiveSidecarPages({ tenantId: monitor.tenantId, source: "audit", runId: auditRow.id, archive: pages });

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
  // Only audits of the same score version are compared (src/lib/visibility-score.ts):
  // the first audit after a scoring change is a silent new baseline, so no
  // tenant is told their score "dropped" because the scoring got stricter.
  const decision = monitorAlertDecision(
    prev
      ? { score: prev.score, scoreVersion: prev.scoreVersion, bots: prev.bots as BotMap }
      : null,
    { score: newScore, scoreVersion: newVersion, bots: newBots },
  );
  if (decision.kind !== "compare") {
    logger.info(
      { monitorId, score: newScore, scoreVersion: newVersion, prevVersion: prev?.scoreVersion, queue: QUEUE_NAME },
      decision.kind === "baseline" ? "Baseline audit stored" : "Score version changed: new baseline stored, no alert",
    );
    return;
  }
  const { dropped, flippedBlocked, flippedAllowed } = decision;

  logger.info(
    {
      monitorId,
      url: monitor.url,
      score: `${prev!.score} -> ${newScore}`,
      dropped,
      flippedBlocked: flippedBlocked.length,
      queue: QUEUE_NAME,
    },
    "Monitor run complete",
  );

  if (decision.alert) {
    // v2 audits rank their fixes by points recoverable (top_fixes); a v1
    // audit falls back to its first checks with a recommendation.
    const topFixes = (data.top_fixes ?? [])
      .filter((f) => f && (f.title || f.fix))
      .slice(0, 3)
      .map((f) => ({ category: String(f.title ?? f.id ?? ""), recommendation: String(f.fix ?? "") }));
    await sendVisibilityAlert({
      tenantId: monitor.tenantId,
      url: monitor.url,
      prevScore: prev!.score,
      newScore,
      newGrade,
      flippedBlocked,
      flippedAllowed,
      failingChecks: topFixes.length
        ? topFixes
        : checks
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
  // The tenant's declared brands count too. A tenant can run more than one
  // brand (the owner tenant tracks prompts for two products), and without
  // these a prompt about the second brand could only ever read "not mentioned".
  const brands = await prisma.brandProfile.findMany({
    where: { tenantId },
    select: { name: true, aliases: true },
  });
  const brandTerms = new Set<string>();
  if (tenant?.name && tenant.name.length >= 3) brandTerms.add(tenant.name);
  for (const m of monitors) {
    const root = domainRoot(m.url);
    if (root) brandTerms.add(root);
  }
  for (const b of brands) {
    for (const term of [b.name, ...b.aliases]) {
      if (term.trim().length >= 3) brandTerms.add(term.trim());
    }
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

  // Prior runs per prompt, newest first, for transition detection: the latest
  // is "previous", and the recent history feeds the lost-recommendation policy
  // (src/lib/prompt-alert-policy.ts). Fetched before the inserts below so it
  // excludes this batch. 45 days covers the policy's windows at a daily cadence.
  const priorRuns = await prisma.promptRun.findMany({
    where: {
      promptId: { in: prompts.map((p) => p.id) },
      error: null,
      createdAt: { gte: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
    select: { promptId: true, brandMentioned: true, brandRank: true, model: true },
  });
  const historyByPrompt = new Map<string, typeof priorRuns>();
  for (const run of priorRuns) {
    const list = historyByPrompt.get(run.promptId) ?? [];
    if (list.length < RECENT_RUNS + EARLIER_RUNS + 2) list.push(run);
    historyByPrompt.set(run.promptId, list);
  }
  const prevByPrompt = new Map([...historyByPrompt].map(([id, runs]) => [id, runs[0]]));
  const promptTextById = new Map(prompts.map((p) => [p.id, p.text]));

  const now = new Date();
  const retryErrored = { nextRunAt: new Date(Date.now() + PROMPT_ERROR_RETRY_MS) };
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
      data: { lastRunAt: now, ...(r.error ? retryErrored : advance) },
    });
  }

  // The sidecar answers 200 with a per-prompt `error` and an empty answer when
  // the provider call fails, so a batch can "complete" with nothing answered.
  // Count it, meter only what was answered, and fail the job outright when
  // nothing was: an all-error batch is an outage, and it must reach the
  // failed-job alert (src/lib/queue-alerts.ts) rather than read as "0 mentioned".
  const errored = data.results.filter((r) => r.error);
  const answered = data.results.length - errored.length;
  if (answered > 0) {
    await meteringService.record(tenantId, "AI_INFERENCE", answered, {
      source: "answer_tracking",
    });
  }

  const mentioned = data.results.filter((r) => !r.error && r.brand_mentioned).length;
  const summary = {
    tenantId,
    prompts: data.results.length,
    answered,
    errored: errored.length,
    mentioned,
    firstError: errored[0]?.error ?? undefined,
    queue: QUEUE_NAME,
  };
  if (errored.length) logger.error(summary, "Prompt batch complete with errors");
  else logger.info(summary, "Prompt batch complete");
  if (data.results.length > 0 && answered === 0) {
    // Unrecoverable: a retry would find these prompts no longer due (they were
    // moved to retry in PROMPT_ERROR_RETRY_MS) and "complete" with nothing.
    throw new UnrecoverableError(
      `all ${data.results.length} prompts errored; first: ${String(errored[0]?.error).slice(0, 200)}`,
    );
  }

  // ── Transition detection (lost / rank drop / regained) ────────────────
  const transitions: PromptTransition[] = [];
  for (const r of data.results) {
    if (r.error) continue;
    const prev = prevByPrompt.get(r.id);
    if (!prev) continue; // first run = baseline, never alert
    // A run on a different model is a new baseline too: the answer changed
    // because the model did, not the market (the move from claude-haiku-4-5
    // to claude-haiku-5-5 on 2026-11-06 would otherwise alert on every prompt).
    const model = r.model ?? data.model ?? "unknown";
    if (prev.model !== model) continue;
    const text = promptTextById.get(r.id) ?? r.prompt;
    // Oldest first, this model only (a model change is a new baseline).
    const runs = historyByPrompt.get(r.id) ?? [];
    const cut = runs.findIndex((run) => run.model !== model);
    const history = (cut === -1 ? runs : runs.slice(0, cut)).map((run) => run.brandMentioned).reverse();
    if (lostRecommendation(history, r.brand_mentioned)) {
      // The rank it was last seen at: the newest run that mentioned it.
      const lastSeen = (cut === -1 ? runs : runs.slice(0, cut)).find((run) => run.brandMentioned);
      transitions.push({
        promptId: r.id,
        promptText: text,
        kind: "visibility_lost",
        prevRank: lastSeen?.brandRank ?? null,
        newRank: null,
      });
    } else if (regainedRecommendation(history, r.brand_mentioned)) {
      transitions.push({
        promptId: r.id,
        promptText: text,
        kind: "visibility_regained",
        prevRank: null,
        newRank: r.brand_rank,
      });
    } else if (
      prev.brandMentioned &&
      r.brand_mentioned &&
      prev.brandRank != null &&
      r.brand_rank != null &&
      r.brand_rank - prev.brandRank >= RANK_DROP_THRESHOLD
    ) {
      transitions.push({
        promptId: r.id,
        promptText: text,
        kind: "visibility_rank_drop",
        prevRank: prev.brandRank,
        newRank: r.brand_rank,
      });
    }
  }
  if (transitions.length > 0) {
    // Alerts must not fail the batch: runs are already persisted, and a
    // throw here would re-run the whole sidecar call on retry.
    try {
      await recordPromptAlerts(tenantId, transitions);
    } catch (err) {
      logger.error({ tenantId, err, queue: QUEUE_NAME }, "Prompt alert recording failed");
    }
  }
}

// ─── GSC nightly sync ─────────────────────────────────────────────────────────

/**
 * Pulls the latest available day of query-level Search Console rows into
 * GscQueryStat for every ACTIVE connection with a selected property.
 * Per-tenant failures are logged and skipped — one dead connection must not
 * starve the rest. Reauth failures are already marked NEEDS_REAUTH by the
 * service layer and surface on the GSC Insights page.
 */
async function processGscSweep(): Promise<void> {
  const { prisma } = await import("@/lib/prisma");
  const { syncDay, latestAvailableDay } = await import("@/lib/gsc/service");
  const connections = await prisma.gscConnection.findMany({
    where: { status: "ACTIVE", siteUrl: { not: null } },
  });
  const day = latestAvailableDay();
  const { tenantAllowsArea } = await import("@/lib/plan-access-server");
  for (const conn of connections) {
    // The plan allowlist, re-checked per run: GSC Insights is an SEO tool the
    // AI-only plan does not include. The connection is kept, unsynced.
    if (!(await tenantAllowsArea(conn.tenantId, "seo_tools"))) {
      logger.info({ tenantId: conn.tenantId, queue: QUEUE_NAME }, "GSC sync skipped: plan excludes SEO tools");
      continue;
    }
    try {
      const rows = await syncDay(conn, day);
      logger.info({ tenantId: conn.tenantId, day, rows, queue: QUEUE_NAME }, "GSC sync done");
    } catch (err) {
      logger.error({ tenantId: conn.tenantId, day, err, queue: QUEUE_NAME }, "GSC sync failed");
    }
  }
}

async function processVisibilityJob(job: Job<VisibilityMonitoringJob>): Promise<void> {
  await withSpan("visibility-monitoring.process", async () => {
    if (job.data.sweep) return processSweep();
    if (job.data.promptSweep) return processPromptSweep();
    if (job.data.gscSweep) return processGscSweep();
    if (job.data.dataDeletionSweep) {
      // Throws when a request failed, so the queue's support@ alert fires.
      const { runDueDeletions } = await import("@/lib/privacy/deletion");
      return runDueDeletions();
    }
    if (job.data.loginEventsPurge) {
      const { purgeOldLoginEvents } = await import("@/lib/login-events");
      await purgeOldLoginEvents();
      return;
    }
    if (job.data.salesInquiriesPurge) {
      const { purgeClosedInquiries } = await import("@/lib/sales/inquiries");
      await purgeClosedInquiries();
      return;
    }
    if (job.data.promptTenantId) return processPromptBatch(job.data.promptTenantId);
    // The free AI Visibility Check (src/lib/snapshot/job.ts).
    if (job.data.snapshotId) {
      const { processSnapshot } = await import("@/lib/snapshot/job");
      return processSnapshot(job.data.snapshotId, job.attemptsMade, job.opts.attempts ?? 1);
    }
    if (job.data.snapshotLeadId) {
      const { processSnapshotEmail } = await import("@/lib/snapshot/job");
      return processSnapshotEmail(job.data.snapshotLeadId);
    }
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

  // Nightly GSC query-stat sync (05:10 UTC — after Google finalizes the day).
  getQueue(QUEUE_NAME)
    .add(
      GSC_SWEEP_JOB_NAME,
      { gscSweep: true },
      {
        repeat: { pattern: "10 5 * * *" },
        removeOnComplete: true,
        removeOnFail: { count: 50 },
      },
    )
    .catch((err) => {
      logger.error({ err, queue: QUEUE_NAME }, "Failed to schedule GSC sweep");
    });

  // Nightly data-deletion sweep (03:20 UTC): requests past their 14-day grace period.
  getQueue(QUEUE_NAME)
    .add(
      DATA_DELETION_SWEEP_JOB_NAME,
      { dataDeletionSweep: true },
      {
        repeat: { pattern: "20 3 * * *", tz: "UTC" },
        removeOnComplete: true,
        removeOnFail: { count: 50 },
      },
    )
    .catch((err) => {
      logger.error({ err, queue: QUEUE_NAME }, "Failed to schedule the data-deletion sweep");
    });

  // Nightly login-log purge (03:35 UTC): sign-in records are kept 90 days.
  getQueue(QUEUE_NAME)
    .add(
      LOGIN_EVENTS_PURGE_JOB_NAME,
      { loginEventsPurge: true },
      {
        repeat: { pattern: "35 3 * * *", tz: "UTC" },
        removeOnComplete: true,
        removeOnFail: { count: 50 },
      },
    )
    .catch((err) => {
      logger.error({ err, queue: QUEUE_NAME }, "Failed to schedule the login-events purge");
    });

  // Nightly sales-inquiry purge (03:50 UTC): closed inquiries are kept 24 months.
  getQueue(QUEUE_NAME)
    .add(
      SALES_INQUIRIES_PURGE_JOB_NAME,
      { salesInquiriesPurge: true },
      {
        repeat: { pattern: "50 3 * * *", tz: "UTC" },
        removeOnComplete: true,
        removeOnFail: { count: 50 },
      },
    )
    .catch((err) => {
      logger.error({ err, queue: QUEUE_NAME }, "Failed to schedule the sales-inquiry purge");
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

/** Exported for tests/prompt-batch-errors.test.ts. */
export { processPromptBatch };
