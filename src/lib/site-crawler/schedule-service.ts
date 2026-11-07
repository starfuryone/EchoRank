// src/lib/site-crawler/schedule-service.ts
//
// Scheduled crawls (Phase 4c): save / list / change / delete, the BullMQ
// repeatable behind each enabled row, the tick that starts a run, and the
// completion hook (compare with the last run, then the exports).
//
// A run is a normal crawl_jobs row created by startCrawl: same SSRF guard,
// same monthly quota (an exhausted quota skips the run with a logged reason),
// same caps. The sealed configuration stored with the schedule is re-checked
// against today's plan at every run.

import "server-only";
import type { Queue } from "bullmq";
import type { PlanType, Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { logger } from "@/infrastructure/observability/logger";
import { flag } from "@/lib/flags";
import { checkCrawlConfig, readStoredConfig, type StoredCrawlConfig } from "./crawl-config";
import { sealCrawlConfig } from "./crawl-config-secrets";
import { checkExtractorExpr } from "./extraction";
import { featureCapsForPlan, getCrawlQuota, metricCapsForPlan, scheduleCapsForPlan } from "./quota";
import { validateRootUrl } from "./url";
import { startCrawl } from "./service";
import { CrawlQuotaExceededError, InvalidCrawlConfigError, InvalidCrawlUrlError } from "./errors";
import { resolveCompare, runComparison } from "./compare";
import {
  SCHEDULE_JOB_NAME,
  SCHEDULE_KEY_PREFIX,
  cronPattern,
  nextRunAt,
  repeatKey,
  scheduleProblem,
  type ExportTo,
  type ScheduleConfig,
  type ScheduleInput,
} from "./schedule";

const log = logger.child({ module: "crawl-schedule" });

export class ScheduleRefusedError extends Error {
  readonly statusCode = 400;
  constructor(readonly reason: "over_plan_cap" | "cadence_not_in_plan") {
    super(reason === "over_plan_cap" ? "Your plan's scheduled crawls are all in use." : "Your plan does not include this cadence.");
    this.name = "ScheduleRefusedError";
  }
}

export type RepeatableQueue = Pick<Queue, "getRepeatableJobs" | "removeRepeatableByKey" | "add">;

export interface ScheduleRow {
  id: string;
  tenantId: string;
  host: string;
  config: unknown;
  cadence: string;
  hourUtc: number;
  enabled: boolean;
  nextRunAt: Date;
  lastJobId: string | null;
  exportTo: unknown;
  createdAt: Date;
}

/** The API view: the root and render mode, never the sealed configuration. */
export function toScheduleDto(row: ScheduleRow) {
  const cfg = row.config as ScheduleConfig;
  return {
    id: row.id,
    host: row.host,
    rootUrl: cfg.rootUrl,
    renderMode: cfg.renderMode,
    hasConfig: cfg.crawl !== null,
    cadence: row.cadence,
    hourUtc: row.hourUtc,
    enabled: row.enabled,
    nextRunAt: row.nextRunAt.toISOString(),
    lastJobId: row.lastJobId,
    exportTo: row.exportTo as ExportTo | null,
    createdAt: row.createdAt.toISOString(),
  };
}

// ── The repeatable behind each schedule ─────────────────────────────────────

export async function syncScheduleRepeatable(queue: RepeatableQueue, row: Pick<ScheduleRow, "id" | "cadence" | "hourUtc" | "enabled">): Promise<void> {
  const key = repeatKey(row.id);
  for (const r of await queue.getRepeatableJobs()) if (r.key === key) await queue.removeRepeatableByKey(r.key);
  if (!row.enabled) return;
  await queue.add(
    SCHEDULE_JOB_NAME,
    { scheduleId: row.id },
    {
      repeat: { pattern: cronPattern(row.cadence as never, row.hourUtc), tz: "UTC", key },
      removeOnComplete: true,
      removeOnFail: { count: 20 },
    },
  );
}

export async function removeScheduleRepeatable(queue: RepeatableQueue, scheduleId: string): Promise<void> {
  const key = repeatKey(scheduleId);
  for (const r of await queue.getRepeatableJobs()) if (r.key === key) await queue.removeRepeatableByKey(r.key);
}

/**
 * Worker start: make Redis match the table. Keeps the retention job (its
 * `every` comes back from Redis as a STRING — compared as a number, the SERP
 * poller's fix) and each enabled schedule whose pattern still matches;
 * removes everything else; adds what is missing.
 */
export async function syncAllRepeatables(
  queue: RepeatableQueue,
  retention: { name: string; every: number },
  schedules: Pick<ScheduleRow, "id" | "cadence" | "hourUtc" | "enabled">[],
): Promise<{ removed: number; added: number }> {
  const want = new Map(schedules.filter((s) => s.enabled).map((s) => [repeatKey(s.id), s]));
  const have = new Set<string>();
  let removed = 0;
  let retentionOk = false;
  for (const r of await queue.getRepeatableJobs()) {
    if (r.name === retention.name && Number(r.every) === retention.every && !retentionOk) {
      retentionOk = true;
      continue;
    }
    const s = r.name === SCHEDULE_JOB_NAME ? want.get(r.key) : undefined;
    if (s && r.pattern === cronPattern(s.cadence as never, s.hourUtc) && !have.has(r.key)) {
      have.add(r.key);
      continue;
    }
    await queue.removeRepeatableByKey(r.key);
    removed++;
    log.warn({ key: r.key, name: r.name, every: r.every, pattern: r.pattern }, "removed stale site-crawl repeatable");
  }
  // Always (re-)added: BullMQ dedupes an identical repeat, and this restores a deleted one.
  await queue.add(retention.name, { retention: true }, { repeat: { every: retention.every }, removeOnComplete: true, removeOnFail: { count: 20 } });
  let added = 0;
  for (const [key, s] of want) {
    if (have.has(key)) continue;
    await syncScheduleRepeatable(queue, s);
    added++;
  }
  return { removed, added };
}

// ── CRUD ────────────────────────────────────────────────────────────────────

export async function listSchedules(tenantId: string) {
  return prisma.crawlSchedule.findMany({ where: { tenantId }, orderBy: { createdAt: "asc" } });
}

/** Validate like a crawl start (SSRF guard, config check, caps), seal secrets, store, schedule. */
export async function createSchedule(tenantId: string, plan: PlanType, input: ScheduleInput, queue: RepeatableQueue) {
  const caps = scheduleCapsForPlan(plan);
  const problem = scheduleProblem(input, caps, await prisma.crawlSchedule.count({ where: { tenantId } }));
  if (problem) throw new ScheduleRefusedError(problem);

  const v = validateRootUrl(input.rootUrl);
  if (!v.ok || !v.url) throw new InvalidCrawlUrlError((v as { reason?: string }).reason ?? "not_a_url");
  const host = new URL(v.url).hostname;

  let crawl: StoredCrawlConfig | null = null;
  if (input.config) {
    const quota = await getCrawlQuota(tenantId, plan);
    const site = await prisma.crawlSiteDefault.findUnique({ where: { tenantId_host: { tenantId, host } }, select: { verifiedAt: true, config: true } });
    const checked = checkCrawlConfig(input.config, {
      urlCap: quota.urlCap,
      verified: Boolean(site?.verifiedAt),
      ...featureCapsForPlan(plan),
      ...metricCapsForPlan(plan),
      checkExpr: checkExtractorExpr,
    });
    if (checked.problems.length) throw new InvalidCrawlConfigError(checked.problems);
    crawl = sealCrawlConfig(checked.config, readStoredConfig(site?.config));
  }

  const config: ScheduleConfig = { rootUrl: v.url, renderMode: input.renderMode, crawl };
  const row = await prisma.crawlSchedule.create({
    data: {
      tenantId,
      host,
      config: config as unknown as Prisma.InputJsonValue,
      cadence: input.cadence,
      hourUtc: input.hourUtc,
      nextRunAt: nextRunAt(input.cadence, input.hourUtc),
      enabled: input.enabled,
      exportTo: input.exportTo as Prisma.InputJsonValue,
    },
  });
  await syncScheduleRepeatable(queue, row);
  return row;
}

export async function updateSchedule(
  tenantId: string,
  plan: PlanType,
  id: string,
  patch: { enabled?: boolean; cadence?: "daily" | "weekly" | "monthly"; hourUtc?: number; exportTo?: ExportTo },
  queue: RepeatableQueue,
) {
  const row = await prisma.crawlSchedule.findFirst({ where: { id, tenantId } });
  if (!row) return null;
  const cadence = (patch.cadence ?? row.cadence) as "daily" | "weekly" | "monthly";
  if (!scheduleCapsForPlan(plan).scheduleCadences.includes(cadence)) throw new ScheduleRefusedError("cadence_not_in_plan");
  const hourUtc = patch.hourUtc ?? row.hourUtc;
  const next = await prisma.crawlSchedule.update({
    where: { id: row.id },
    data: {
      cadence,
      hourUtc,
      nextRunAt: nextRunAt(cadence, hourUtc),
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
      ...(patch.exportTo ? { exportTo: patch.exportTo as Prisma.InputJsonValue } : {}),
    },
  });
  await syncScheduleRepeatable(queue, next);
  return next;
}

export async function deleteSchedule(tenantId: string, id: string, queue: RepeatableQueue): Promise<boolean> {
  const { count } = await prisma.crawlSchedule.deleteMany({ where: { id, tenantId } });
  if (count) await removeScheduleRepeatable(queue, id);
  return count > 0;
}

// ── The tick ────────────────────────────────────────────────────────────────

export type TickOutcome =
  | { status: "started"; crawlJobId: string }
  | { status: "skipped"; reason: "missing" | "disabled" | "locked" | "quota_exhausted" | "config_refused" | "url_refused" };

/** One scheduled run: start a normal crawl, or skip with a logged reason. Never throws for a skip. */
export async function runScheduledCrawl(scheduleId: string, now: Date = new Date()): Promise<TickOutcome> {
  const row = await prisma.crawlSchedule.findUnique({ where: { id: scheduleId }, include: { tenant: { select: { planType: true } } } });
  const skip = (reason: Extract<TickOutcome, { status: "skipped" }>["reason"]): TickOutcome => {
    log.info({ scheduleId, reason }, "scheduled crawl skipped");
    return { status: "skipped", reason };
  };
  if (!row) return skip("missing");
  if (!row.enabled) return skip("disabled");
  await prisma.crawlSchedule.update({ where: { id: row.id }, data: { nextRunAt: nextRunAt(row.cadence as never, row.hourUtc, now) } });

  const plan = row.tenant.planType;
  const quota = await getCrawlQuota(row.tenantId, plan);
  if (quota.locked) return skip("locked");
  if (!quota.allowed) return skip("quota_exhausted");

  const cfg = row.config as unknown as ScheduleConfig;
  try {
    const job = await startCrawl(row.tenantId, plan, cfg.rootUrl, cfg.renderMode, {
      sealed: (cfg.crawl as StoredCrawlConfig | null) ?? null,
      scheduleId: row.id,
    });
    log.info({ scheduleId, crawlJobId: job.id }, "scheduled crawl started");
    return { status: "started", crawlJobId: job.id };
  } catch (err) {
    if (err instanceof CrawlQuotaExceededError) return skip("quota_exhausted");
    if (err instanceof InvalidCrawlConfigError) return skip("config_refused");
    if (err instanceof InvalidCrawlUrlError) return skip("url_refused");
    throw err;
  }
}

// ── After a scheduled crawl ─────────────────────────────────────────────────

export interface AfterRunHooks {
  email?: (ctx: { tenantId: string; crawlJobId: string; comparisonId: string | null }) => Promise<unknown>;
  sheets?: (ctx: { tenantId: string; crawlJobId: string; comparisonId: string | null; scheduleId: string; spreadsheetId: string | null }) => Promise<unknown>;
}

/**
 * A scheduled crawl finished. COMPLETED only: compare against lastJobId (when
 * that crawl is still comparable), move lastJobId, then the exports. Each
 * step is caught and logged so one failure does not stop the next.
 */
export async function afterScheduledCrawl(scheduleId: string, crawlJobId: string, hooks: AfterRunHooks = {}) {
  const row = await prisma.crawlSchedule.findUnique({ where: { id: scheduleId } });
  const job = await prisma.crawlJob.findFirst({
    where: { id: crawlJobId, ...(row ? { tenantId: row.tenantId } : {}) },
    select: { id: true, tenantId: true, rootUrl: true, mode: true, config: true, createdAt: true, status: true },
  });
  if (!row || !job || job.status !== "COMPLETED") return { compared: false, comparisonId: null as string | null };

  let comparisonId: string | null = null;
  if (row.lastJobId && row.lastJobId !== job.id) {
    try {
      const cmp = await runComparison(await resolveCompare(job, row.lastJobId, null, []));
      comparisonId = cmp.id;
    } catch (err) {
      log.warn({ scheduleId, crawlJobId, lastJobId: row.lastJobId, err: err instanceof Error ? err.message : err }, "scheduled compare skipped");
    }
  }
  await prisma.crawlSchedule.update({ where: { id: row.id }, data: { lastJobId: job.id } });

  const exportTo = (row.exportTo ?? {}) as Partial<ExportTo>;
  if (exportTo.email && flag("crawl.reports") && hooks.email) {
    await hooks.email({ tenantId: row.tenantId, crawlJobId: job.id, comparisonId }).catch((err) =>
      log.error({ scheduleId, crawlJobId, err: err instanceof Error ? err.message : err }, "scheduled crawl email failed"),
    );
  }
  if (exportTo.sheets && flag("crawl.sheets") && hooks.sheets) {
    await hooks
      .sheets({ tenantId: row.tenantId, crawlJobId: job.id, comparisonId, scheduleId: row.id, spreadsheetId: exportTo.sheets.spreadsheetId })
      .catch((err) => log.error({ scheduleId, crawlJobId, err: err instanceof Error ? err.message : err }, "scheduled sheets export failed"));
  }
  return { compared: comparisonId !== null, comparisonId };
}

export { SCHEDULE_KEY_PREFIX };
