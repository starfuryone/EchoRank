// src/lib/rank-tracker/service.ts
//
// Rank Tracker project lifecycle and run posting.
//
// Runs go through the SAME DataForSEO standard queue as the SERP Checker
// (task_post, priority 1, $0.0006/keyword). Nothing here polls: the shared
// sweep in serp-check.worker.ts collects finished tasks and routes them to
// RankSnapshot via rankSnapshotOwner.
//
// Order of operations for a run, and why:
//   1. plan/cap gates  — free, and a downgrade must stop a run before it spends
//   2. reserve checks  — Redis INCRBY, all-or-nothing (a half-run project shows
//                        a misleading gap in its history)
//   3. task_post each  — metered; each writes its own SeoApiCall row
//   4. release unused  — anything step 3 failed to post is handed back

import type { PlanType, RankProject } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { SERP } from "@/lib/dataforseo/endpoints";
import { seoMeteredCallResult } from "@/lib/dataforseo/metering";
import { normalizeDomain } from "@/lib/site-explorer/domain";
import { logger } from "@/infrastructure/observability/logger";
import {
  MAX_KEYWORDS_PER_REQUEST,
  planAllowsFrequency,
  planCanTrack,
  trackedKeywordLimit,
  type RankDevice,
  type RankFrequency,
} from "./options";
import {
  checkKeywordCap,
  RankCheckQuotaExceededError,
  RankKeywordCapExceededError,
  releaseRankChecks,
  reserveRankChecks,
} from "./quota";
import type { RankKeywordRow, RankPoint, RankProjectDetail, RankProjectSummary } from "./types";

/** Keywords posted concurrently. Keeps a 250-keyword run to ~1 min without
 * opening 250 sockets at DataForSEO at once. */
const POST_CONCURRENCY = 5;

/**
 * Organic results requested per keyword.
 *
 * DataForSEO bills the standard queue per result PAGE, so this is the price
 * lever: depth 10 is $0.0006 and depth 100 is $0.006. Depth 100 is deliberate
 * — a tracker that reports "not ranked" for everything below position 10 is
 * blind to exactly the range most tracked keywords live in, and a wrong
 * position is worse than an expensive one. COST_PER_KEYWORD_USD must move with
 * this constant.
 */
const RANK_DEPTH = 100;

export class RankPlanLockedError extends Error {
  readonly statusCode = 403;
  constructor(readonly plan: PlanType) {
    super("Rank Tracker is not included in this plan");
    this.name = "RankPlanLockedError";
  }
}

export class RankFrequencyNotAllowedError extends Error {
  readonly statusCode = 403;
  constructor(
    readonly frequency: RankFrequency,
    readonly plan: PlanType,
  ) {
    super(`The ${plan} plan cannot schedule ${frequency} checks. Upgrade for daily tracking.`);
    this.name = "RankFrequencyNotAllowedError";
  }
}

export class RankProjectNotFoundError extends Error {
  readonly statusCode = 404;
  constructor() {
    super("Tracking project not found");
    this.name = "RankProjectNotFoundError";
  }
}

export interface ProjectInput {
  name: string;
  domain: string;
  keywords: string[];
  locationCode: number;
  languageCode: string;
  device: RankDevice;
  frequency: RankFrequency;
}

// ─── Create / edit ──────────────────────────────────────────────────────────

/**
 * Gates shared by create and edit. Throws rather than returning a result so no
 * caller can forget to check — every one of these is a spend or entitlement
 * decision.
 */
async function assertAllowed(
  tenantId: string,
  plan: PlanType,
  input: ProjectInput,
  excludeProjectId?: string,
): Promise<void> {
  if (!planCanTrack(plan)) throw new RankPlanLockedError(plan);
  if (!planAllowsFrequency(plan, input.frequency)) {
    throw new RankFrequencyNotAllowedError(input.frequency, plan);
  }

  const cap = await checkKeywordCap(tenantId, plan, input.keywords.length, excludeProjectId);
  if (!cap.allowed) {
    throw new RankKeywordCapExceededError(cap.limit, cap.requested, plan);
  }
}

export async function createProject(
  tenantId: string,
  plan: PlanType,
  input: ProjectInput,
): Promise<RankProjectSummary> {
  // Throws InvalidDomainError (-> 400) before anything is written.
  const domain = normalizeDomain(input.domain);
  await assertAllowed(tenantId, plan, input);

  const project = await prisma.rankProject.create({
    data: {
      tenantId,
      name: input.name.trim() || domain,
      domain,
      locationCode: input.locationCode,
      languageCode: input.languageCode,
      device: input.device,
      frequency: input.frequency,
      keywords: {
        create: input.keywords.slice(0, MAX_KEYWORDS_PER_REQUEST).map((keyword) => ({ keyword })),
      },
    },
    include: { _count: { select: { keywords: true } } },
  });

  return toSummary(project, project._count.keywords, 0, null);
}

/**
 * Replaces the project's keyword set with `input.keywords`.
 *
 * Keywords that survive the edit keep their id — and therefore their entire
 * snapshot history. Deleting and recreating the whole set would silently wipe
 * the history of every keyword the user did not touch.
 */
export async function updateProject(
  tenantId: string,
  plan: PlanType,
  projectId: string,
  input: ProjectInput,
): Promise<RankProjectSummary> {
  const existing = await prisma.rankProject.findFirst({
    where: { id: projectId, tenantId },
    include: { keywords: { select: { id: true, keyword: true } } },
  });
  if (!existing) throw new RankProjectNotFoundError();

  const domain = normalizeDomain(input.domain);
  await assertAllowed(tenantId, plan, input, projectId);

  const wanted = new Set(input.keywords.slice(0, MAX_KEYWORDS_PER_REQUEST));
  const current = new Map(existing.keywords.map((k) => [k.keyword, k.id]));
  const toRemove = existing.keywords.filter((k) => !wanted.has(k.keyword)).map((k) => k.id);
  const toAdd = [...wanted].filter((k) => !current.has(k));

  const project = await prisma.rankProject.update({
    where: { id: projectId },
    data: {
      name: input.name.trim() || domain,
      domain,
      locationCode: input.locationCode,
      languageCode: input.languageCode,
      device: input.device,
      frequency: input.frequency,
      // A successful edit clears the over-cap flag: the new set passed the cap
      // check above, so whatever the scheduler objected to is resolved.
      overCap: false,
      keywords: {
        deleteMany: toRemove.length ? { id: { in: toRemove } } : undefined,
        create: toAdd.map((keyword) => ({ keyword })),
      },
    },
    include: { _count: { select: { keywords: true } } },
  });

  return toSummary(project, project._count.keywords, 0, null);
}

export async function deleteProject(tenantId: string, projectId: string): Promise<void> {
  // Tenant-scoped delete: deleteMany with both keys can never touch another
  // workspace's row, where a bare delete({ where: { id } }) could.
  const { count } = await prisma.rankProject.deleteMany({
    where: { id: projectId, tenantId },
  });
  if (count === 0) throw new RankProjectNotFoundError();
}

// ─── Running ────────────────────────────────────────────────────────────────

export interface RunResult {
  projectId: string;
  posted: number;
  failed: number;
  costUsd: number;
}

/**
 * Posts one standard-queue task per keyword and writes a `queued` snapshot for
 * each. The shared sweep completes them.
 *
 * Called by the worker (scheduled ticks and "Run now"), never inline in a
 * request — 250 keywords is 250 upstream calls.
 */
export async function runProject(projectId: string, now = new Date()): Promise<RunResult> {
  const project = await prisma.rankProject.findUnique({
    where: { id: projectId },
    include: { keywords: { select: { id: true, keyword: true } } },
  });
  if (!project) throw new RankProjectNotFoundError();

  const tenant = await prisma.tenant.findUnique({
    where: { id: project.tenantId },
    select: { planType: true },
  });
  const plan = tenant?.planType;
  if (!plan) throw new RankProjectNotFoundError();

  // Re-check entitlement at run time, not just at create time: a plan can be
  // downgraded between the two, and the scheduler must not keep spending on a
  // project the tenant no longer pays for.
  if (!planCanTrack(plan)) {
    await flagOverCap(project.id, "plan no longer includes Rank Tracker");
    return { projectId, posted: 0, failed: 0, costUsd: 0 };
  }
  const limit = trackedKeywordLimit(plan);
  if (project.keywords.length > limit) {
    await flagOverCap(
      project.id,
      `project holds ${project.keywords.length} keywords, plan allows ${limit}`,
    );
    return { projectId, posted: 0, failed: 0, costUsd: 0 };
  }

  const count = project.keywords.length;
  if (count === 0) return { projectId, posted: 0, failed: 0, costUsd: 0 };

  // All-or-nothing: a partially-run project shows a history gap that reads as
  // "we lost rankings" rather than "we ran out of quota".
  const quota = await reserveRankChecks(project.tenantId, plan, count, now);
  if (!quota.allowed) {
    throw new RankCheckQuotaExceededError(quota.limit, plan);
  }

  let posted = 0;
  let failed = 0;
  let costUsd = 0;

  for (let i = 0; i < project.keywords.length; i += POST_CONCURRENCY) {
    const batch = project.keywords.slice(i, i + POST_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (keyword) => {
        const result = await seoMeteredCallResult<unknown[]>(
          project.tenantId,
          SERP.organicTaskPost,
          {
            keyword: keyword.keyword,
            location_code: project.locationCode,
            language_code: project.languageCode,
            device: project.device,
            os: project.device === "mobile" ? "android" : "windows",
            // priority 1 = standard queue (the cheap one). 2 would be "high".
            priority: 1,
            depth: RANK_DEPTH,
          },
        );
        await prisma.rankSnapshot.create({
          data: {
            keywordId: keyword.id,
            runDate: now,
            status: "queued",
            dataforseoTaskId: result.taskId ?? null,
            // Bill from the envelope, never a price table.
            costUsd: result.billing.costUsd,
          },
        });
        return result.billing.costUsd;
      }),
    );

    for (const outcome of results) {
      if (outcome.status === "fulfilled") {
        posted++;
        costUsd += outcome.value;
      } else {
        failed++;
        logger.error(
          { projectId, err: outcome.reason },
          "rank-tracker keyword task_post failed",
        );
      }
    }
  }

  // Hand back the reservations for keywords that never made it upstream.
  if (failed > 0) await releaseRankChecks(project.tenantId, failed, now);

  await prisma.rankProject.update({
    where: { id: projectId },
    data: { lastRunAt: now, overCap: false },
  });

  logger.info(
    { projectId, tenantId: project.tenantId, posted, failed, costUsd: costUsd.toFixed(6) },
    "rank-tracker run posted",
  );

  return { projectId, posted, failed, costUsd };
}

async function flagOverCap(projectId: string, reason: string): Promise<void> {
  await prisma.rankProject.update({ where: { id: projectId }, data: { overCap: true } });
  logger.warn({ projectId, reason }, "rank-tracker project skipped: over plan cap");
}

// ─── Reads ──────────────────────────────────────────────────────────────────

function toSummary(
  project: RankProject,
  keywordCount: number,
  pendingCount: number,
  averagePosition: number | null,
): RankProjectSummary {
  return {
    id: project.id,
    name: project.name,
    domain: project.domain,
    locationCode: project.locationCode,
    languageCode: project.languageCode,
    device: project.device as RankDevice,
    frequency: project.frequency as RankFrequency,
    active: project.active,
    overCap: project.overCap,
    keywordCount,
    lastRunAt: project.lastRunAt?.toISOString() ?? null,
    createdAt: project.createdAt.toISOString(),
    pendingCount,
    averagePosition,
  };
}

export async function listProjects(tenantId: string): Promise<RankProjectSummary[]> {
  const projects = await prisma.rankProject.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { keywords: true } },
      keywords: {
        select: {
          snapshots: {
            where: { status: { in: ["queued", "completed"] } },
            orderBy: { runDate: "desc" },
            take: 1,
            select: { status: true, position: true },
          },
        },
      },
    },
  });

  return projects.map((project) => {
    const latest = project.keywords.map((k) => k.snapshots[0]).filter(Boolean);
    const pendingCount = latest.filter((s) => s.status === "queued").length;
    const ranked = latest
      .filter((s) => s.status === "completed" && s.position !== null)
      .map((s) => s.position as number);
    const averagePosition = ranked.length
      ? ranked.reduce((a, b) => a + b, 0) / ranked.length
      : null;
    return toSummary(project, project._count.keywords, pendingCount, averagePosition);
  });
}

/** Positive = improved (moved toward #1). null when either end is unranked. */
function delta(latest: number | null, earlier: number | null): number | null {
  if (latest === null || earlier === null) return null;
  return earlier - latest;
}

export async function getProjectDetail(
  tenantId: string,
  projectId: string,
): Promise<RankProjectDetail> {
  const project = await prisma.rankProject.findFirst({
    where: { id: projectId, tenantId },
    include: {
      keywords: {
        orderBy: { keyword: "asc" },
        include: {
          snapshots: { orderBy: { runDate: "desc" }, take: 120 },
        },
      },
    },
  });
  if (!project) throw new RankProjectNotFoundError();

  const cutoff30d = Date.now() - 30 * 24 * 60 * 60 * 1000;
  let totalCostUsd = 0;

  const keywords: RankKeywordRow[] = project.keywords.map((keyword) => {
    for (const snap of keyword.snapshots) totalCostUsd += Number(snap.costUsd);

    const done = keyword.snapshots.filter((s) => s.status === "completed");
    const latest = done[0] ?? null;
    const previous = done[1] ?? null;
    // Closest completed run at least 30 days old; falls back to the oldest
    // known run so a young project still shows a trend instead of a dash.
    const older =
      done.find((s) => s.runDate.getTime() <= cutoff30d) ?? done[done.length - 1] ?? null;

    return {
      id: keyword.id,
      keyword: keyword.keyword,
      position: latest?.position ?? null,
      url: latest?.url ?? null,
      deltaPrevious: delta(latest?.position ?? null, previous?.position ?? null),
      delta30d:
        older && older !== latest ? delta(latest?.position ?? null, older.position) : null,
      pending: keyword.snapshots.some((s) => s.status === "queued"),
      history: done
        .slice()
        .reverse()
        .map((s): RankPoint => ({
          date: s.runDate.toISOString().slice(0, 10),
          position: s.position,
        })),
    };
  });

  // Project-wide chart: mean position per run date across ranked keywords.
  const byDate = new Map<string, number[]>();
  for (const keyword of keywords) {
    for (const point of keyword.history) {
      if (point.position === null) continue;
      const bucket = byDate.get(point.date) ?? [];
      bucket.push(point.position);
      byDate.set(point.date, bucket);
    }
  }
  const chart: RankPoint[] = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, positions]) => ({
      date,
      position: positions.reduce((a, b) => a + b, 0) / positions.length,
    }));

  const ranked = keywords.map((k) => k.position).filter((p): p is number => p !== null);

  return {
    ...toSummary(
      project,
      project.keywords.length,
      keywords.filter((k) => k.pending).length,
      ranked.length ? ranked.reduce((a, b) => a + b, 0) / ranked.length : null,
    ),
    keywords,
    chart,
    totalCostUsd,
  };
}
