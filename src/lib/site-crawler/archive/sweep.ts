// src/lib/site-crawler/archive/sweep.ts
//
// The crawl-archive queue's daily job (05:17 UTC, crawl-archive.worker.ts),
// and the read-only plan the `crawl-archive:dry-run` script prints.
//
// One sweep, in order:
//   1. Exports: generated downloads in Spaces older than EXPORT_TTL_DAYS are
//      deleted (whenever Spaces is configured — the CRAWL_ARCHIVE_* flags are
//      the archive's, not the exports').
//   2. CRAWL_ARCHIVE_ENABLED=false → stop here.
//   3. Recovery. The queue runs one job at a time, so a crawl still ARCHIVING
//      when a sweep starts was left by a crash: its objects are deleted and it
//      goes back to HOT. A RESTORING crawl with no restore job waiting goes
//      back to ARCHIVED (its partial rows deleted). An ARCHIVED crawl that
//      still has rows (crash during the row delete) has them deleted.
//   4. Plan every tenant (policy.ts) and archive up to ARCHIVE_SWEEP_MAX
//      crawls, oldest first. A crawl whose metrics job is still running stays
//      hot until a later sweep.
// CRAWL_ARCHIVE_DRY_RUN (default on) logs steps 3–4 and touches nothing.
// Deletes of crawls retention no longer keeps stay in retention.ts.

import "server-only";

import { Prisma, type PlanType } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { logger } from "@/infrastructure/observability/logger";
import { crawlArchivePrefix, type ObjectStore } from "@/lib/spaces/client";
import { effectiveCaps } from "../tenant-caps";
import { metricsPending } from "../metrics-runner";
import { deleteCrawlRows } from "../retention";
import { hasCachedTotals } from "../summary-backfill";
import { ARCHIVE_DELETE_BATCH, ARCHIVE_SWEEP_MAX, EXPORT_TTL_DAYS } from "./constants";
import { ARCHIVED_TABLES } from "./format";
import { archiveCrawl, archivedWithRows, deleteArchiveObjects, finishArchivedDeletes } from "./engine";
import { planTenant, type TenantPlan } from "./policy";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface TenantArchivePlan extends TenantPlan {
  tenantId: string;
  planType: string;
}

/** Every (non-free) tenant's plan. Read-only. */
export async function planAllTenants(now: Date = new Date()): Promise<TenantArchivePlan[]> {
  const tenants = await prisma.crawlJob.groupBy({ by: ["tenantId"], where: { dataPurgedAt: null } });
  const out: TenantArchivePlan[] = [];
  for (const { tenantId } of tenants) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { planType: true, crawlConcurrencyOverride: true, crawlsKeptOverride: true, crawlUrlCapOverride: true, crawlPagesPerMonthOverride: true, source: true },
    });
    if (!tenant || tenant.source === "free") continue;
    const [crawls, schedules] = await Promise.all([
      prisma.crawlJob.findMany({
        where: { tenantId, dataPurgedAt: null },
        select: { id: true, status: true, pinned: true, finishedAt: true, createdAt: true, rootUrl: true, storageState: true, restoredAt: true },
      }),
      prisma.crawlSchedule.findMany({ where: { tenantId, lastJobId: { not: null } }, select: { lastJobId: true } }),
    ]);
    const baselines = new Set(schedules.map((s) => s.lastJobId!).filter(Boolean));
    const kept = effectiveCaps(tenant.planType as PlanType, tenant).crawlsKept;
    out.push({ tenantId, planType: tenant.planType, ...planTenant(crawls, kept, now, baselines) });
  }
  return out;
}

/** Delete export objects older than EXPORT_TTL_DAYS. Returns how many. */
export async function sweepExports(store: ObjectStore, now: Date = new Date()): Promise<number> {
  const cutoff = now.getTime() - EXPORT_TTL_DAYS * DAY_MS;
  let deleted = 0;
  for (const tenant of await store.listPrefixes("tenants/")) {
    const old: string[] = [];
    for await (const o of store.list(`${tenant}exports/`)) {
      if (o.lastModified && o.lastModified.getTime() < cutoff) old.push(o.key);
    }
    if (old.length) deleted += await store.deleteKeys(old);
  }
  return deleted;
}

export interface SweepDeps {
  store: ObjectStore | null;
  enabled: boolean;
  dryRun: boolean;
  now?: Date;
  max?: number;
  /** True when a restore job for this crawl is waiting in the queue. */
  restorePending?: (crawlId: string) => Promise<boolean>;
}

export interface SweepResult {
  skipped?: "not_configured" | "disabled";
  dryRun: boolean;
  exportsDeleted: number;
  recovered: { archiving: number; restoring: number; deletes: number };
  candidates: number;
  archived: number;
  reused: number;
  failed: { crawlId: string; error: string }[];
  bytes: number;
}

export async function runArchiveSweep(deps: SweepDeps): Promise<SweepResult> {
  const now = deps.now ?? new Date();
  const result: SweepResult = {
    dryRun: deps.dryRun,
    exportsDeleted: 0,
    recovered: { archiving: 0, restoring: 0, deletes: 0 },
    candidates: 0,
    archived: 0,
    reused: 0,
    failed: [],
    bytes: 0,
  };
  const store = deps.store;
  if (!store) return { ...result, skipped: "not_configured" };

  // 1. Exports.
  result.exportsDeleted = await sweepExports(store, now);
  if (!deps.enabled) return { ...result, skipped: "disabled" };

  // 3. Recovery.
  const stuck = await prisma.crawlJob.findMany({
    where: { storageState: { in: ["ARCHIVING", "RESTORING"] } },
    select: { id: true, tenantId: true, storageState: true },
  });
  for (const c of stuck) {
    if (c.storageState === "ARCHIVING") {
      result.recovered.archiving++;
      if (deps.dryRun) continue;
      await deleteArchiveObjects(store, crawlArchivePrefix(c.tenantId, c.id));
      await prisma.crawlJob.update({ where: { id: c.id }, data: { storageState: "HOT", archiveKeyPrefix: null, archiveBytes: null } });
    } else if (!(await deps.restorePending?.(c.id))) {
      result.recovered.restoring++;
      if (deps.dryRun) continue;
      await deleteCrawlRows(c.id, ARCHIVE_DELETE_BATCH);
      await prisma.crawlJob.update({ where: { id: c.id }, data: { storageState: "ARCHIVED" } });
    }
  }
  for (const id of await archivedWithRows()) {
    result.recovered.deletes++;
    if (!deps.dryRun) await finishArchivedDeletes(id);
  }

  // 4. Archive.
  const plans = await planAllTenants(now);
  const ids = plans.flatMap((p) => p.archive);
  const rows = ids.length
    ? await prisma.crawlJob.findMany({ where: { id: { in: ids } }, select: { id: true, createdAt: true, config: true, summary: true } })
    : [];
  const ready = rows
    .filter((r) => !metricsPending(r.config, r.summary))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .slice(0, deps.max ?? ARCHIVE_SWEEP_MAX);
  result.candidates = ready.length;

  if (deps.dryRun) {
    logger.info({ ...result, wouldArchive: ready.map((r) => r.id) }, "crawl-archive sweep (dry run): nothing touched");
    return result;
  }

  for (const r of ready) {
    try {
      const out = await archiveCrawl(r.id, store);
      if (out.status === "archived") {
        result.archived++;
        if (out.reused) result.reused++;
        result.bytes += out.bytes;
      }
    } catch (err) {
      result.failed.push({ crawlId: r.id, error: err instanceof Error ? err.message : String(err) });
      logger.error({ err, crawlId: r.id }, "crawl archive failed; the crawl is back to HOT and retried next sweep");
    }
  }
  logger.info({ ...result }, "crawl-archive sweep done");
  return result;
}

// ── The dry-run report (npm run crawl-archive:dry-run) ───────────────────

export interface DryRunRow {
  tenantId: string;
  planType: string;
  hot: number;
  archive: number;
  purge: number;
  /** Estimated Postgres bytes the archive would move out. */
  archiveBytes: number;
  /** Estimated Postgres bytes retention would delete. */
  purgeBytes: number;
}

/** Average on-disk bytes per row for each archived table (pg_total_relation_size ÷ reltuples). */
async function bytesPerRow(): Promise<Record<string, number>> {
  const rows = await prisma.$queryRaw<{ t: string; bytes: bigint; n: number }[]>`
    SELECT c.relname AS t, pg_total_relation_size(c.oid)::bigint AS bytes, GREATEST(c.reltuples, 0)::float8 AS n
    FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = current_schema() AND c.relname = ANY(${[...ARCHIVED_TABLES]}::text[])`;
  return Object.fromEntries(rows.map((r) => [r.t, r.n > 0 ? Number(r.bytes) / r.n : 0]));
}

async function estimateBytes(ids: readonly string[], per: Record<string, number>): Promise<number> {
  if (!ids.length) return 0;
  let total = 0;
  for (const t of ARCHIVED_TABLES) {
    const r = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM ${Prisma.raw(`"${t}"`)} WHERE "crawlJobId" = ANY(${[...ids]}::text[])`;
    total += Number(r[0]?.n ?? 0) * (per[t] ?? 0);
  }
  return Math.round(total);
}

/** Read-only: what a sweep (archive) and retention (purge) would do, per tenant. */
export async function dryRunReport(now: Date = new Date()): Promise<{ rows: DryRunRow[]; lackingTotals: number; archivedAlready: number }> {
  const per = await bytesPerRow();
  const plans = await planAllTenants(now);
  const rows: DryRunRow[] = [];
  for (const p of plans) {
    if (!p.archive.length && !p.purge.length) continue;
    rows.push({
      tenantId: p.tenantId,
      planType: p.planType,
      hot: p.hot.length,
      archive: p.archive.length,
      purge: p.purge.length,
      archiveBytes: await estimateBytes(p.archive, per),
      purgeBytes: await estimateBytes(p.purge, per),
    });
  }
  const candidates = plans.flatMap((p) => p.archive);
  const sums = candidates.length
    ? await prisma.crawlJob.findMany({ where: { id: { in: candidates } }, select: { summary: true } })
    : [];
  const archivedAlready = await prisma.crawlJob.count({ where: { storageState: "ARCHIVED", dataPurgedAt: null } });
  return { rows, lackingTotals: sums.filter((s) => !hasCachedTotals(s.summary)).length, archivedAlready };
}
