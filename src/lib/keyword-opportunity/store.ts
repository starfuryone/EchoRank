// src/lib/keyword-opportunity/store.ts
//
// Reads and writes for domain analyses: the entitlement probe, the 24h cache,
// and the row lifecycle.
//
// ── THE TWO COUNTERS, ENFORCED HERE ─────────────────────────────────────────
//
// USD spend accrues on every run, at the moment a provider bills us, and is
// capped by keywordOpportunityCapUsd(plan) inside ./metering.ts. The user's
// monthly ALLOWANCE is decremented in exactly one place — markCompleted() —
// and never on a run that failed or was served from cache.
//
// So a failed analysis costs US capped dollars and costs the CUSTOMER nothing.
// That asymmetry is the point: we chose to spend the money on an attempt, they
// did not choose to lose the run. Deriving one counter from the other collapses
// it, which is why the allowance is counted from `allowanceConsumed` rows
// rather than from "analyses this month" — the second would charge for
// failures.
//
// ── ALLOWANCE IS COUNTED FROM ROWS, NOT A COUNTER ───────────────────────────
//
// The same call seo-quota.ts and site-crawler/quota.ts both make, for the same
// reason CLAUDE.md gives: this box restarts several times a day and an
// in-process tally would hand every tenant a fresh allowance on each deploy.
// The rows have to exist anyway.

import type { PlanType } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { analysisAllowanceFor, dateBucket } from "./entitlement";
import { creditBalance } from "./credits";
import type { AnalysisEntitlement, AnalysisStep } from "./types";

/** First instant of the current UTC calendar month. */
export function monthStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Analyses that actually drew down this month's allowance.
 *
 * COUNTS `allowanceConsumed`, NOT COMPLETED ROWS. A cache hit completes without
 * consuming, and a failure consumes nothing at all — counting either would bill
 * the customer for something they did not get. See the header.
 */
export async function analysesUsedThisMonth(
  tenantId: string,
  now: Date = new Date(),
): Promise<number> {
  return prisma.keywordOpportunityAnalysis.count({
    where: {
      tenantId,
      allowanceConsumed: true,
      completedAt: { gte: monthStart(now) },
    },
  });
}

/**
 * The most recent COMPLETED analysis for this domain in today's UTC bucket.
 *
 * `fromCache: false` excludes rows that were themselves cache hits, so a chain
 * of repeat requests all point back at the one run that was actually paid for
 * rather than at each other.
 */
export async function cachedAnalysisId(
  domain: string,
  now: Date = new Date(),
): Promise<string | null> {
  const row = await prisma.keywordOpportunityAnalysis.findFirst({
    where: {
      domain: domain.trim().toLowerCase(),
      dateBucket: dateBucket(now),
      status: "COMPLETED",
      fromCache: false,
    },
    orderBy: { completedAt: "desc" },
    select: { id: true },
  });
  return row?.id ?? null;
}

/**
 * Everything the entitlement check and the CTA copy need.
 *
 * NO SIDE EFFECTS. This answers "what would happen", and the caller that starts
 * the run is the one that writes the ledger row. Splitting them is what lets
 * the page render "3 of 5 domain analyses left this month" without consuming
 * one to find out.
 */
export async function entitlementFor(
  tenantId: string,
  plan: PlanType,
  domain: string,
  now: Date = new Date(),
): Promise<AnalysisEntitlement> {
  const [allowanceUsed, credits, cacheId] = await Promise.all([
    analysesUsedThisMonth(tenantId, now),
    creditBalance(tenantId),
    cachedAnalysisId(domain, now),
  ]);

  const allowanceTotal = analysisAllowanceFor(plan);

  return {
    allowanceTotal,
    allowanceUsed,
    allowanceRemaining: allowanceTotal === null ? null : Math.max(0, allowanceTotal - allowanceUsed),
    credits,
    cacheHit: cacheId !== null,
  };
}

export interface CreateAnalysisInput {
  tenantId: string;
  brandProfileId: string;
  domain: string;
  scoreVersion: number;
  now?: Date;
}

/** A QUEUED row. The worker moves it on from here. */
export async function createAnalysis(input: CreateAnalysisInput): Promise<string> {
  const now = input.now ?? new Date();
  const row = await prisma.keywordOpportunityAnalysis.create({
    data: {
      tenantId: input.tenantId,
      brandProfileId: input.brandProfileId,
      domain: input.domain.trim().toLowerCase(),
      dateBucket: dateBucket(now),
      scoreVersion: input.scoreVersion,
      status: "QUEUED",
    },
    select: { id: true },
  });
  return row.id;
}

/**
 * A completed row that copies an earlier run's result.
 *
 * WRITTEN RATHER THAN RETURNING THE OLD ROW'S ID, so the tenant's history shows
 * that they asked. `fromCache` is what keeps it out of the allowance count and
 * out of the next cache probe — a cache hit must never become the thing a
 * later cache hit points at.
 */
export async function createCacheHit(
  input: CreateAnalysisInput & { sourceAnalysisId: string },
): Promise<string> {
  const now = input.now ?? new Date();
  const source = await prisma.keywordOpportunityAnalysis.findUnique({
    where: { id: input.sourceAnalysisId },
    select: { keywordCount: true, aiTestedCount: true, scoreVersion: true },
  });

  const row = await prisma.keywordOpportunityAnalysis.create({
    data: {
      tenantId: input.tenantId,
      brandProfileId: input.brandProfileId,
      domain: input.domain.trim().toLowerCase(),
      dateBucket: dateBucket(now),
      scoreVersion: source?.scoreVersion ?? input.scoreVersion,
      status: "COMPLETED",
      fromCache: true,
      fundingSource: "cache",
      // Explicit, though both are the defaults: a cache hit consumes no
      // allowance and spends nothing. Stating it here is cheaper than
      // rediscovering it from the schema later.
      allowanceConsumed: false,
      costUsd: 0,
      keywordCount: source?.keywordCount ?? 0,
      aiTestedCount: source?.aiTestedCount ?? 0,
      completedAt: now,
    },
    select: { id: true },
  });
  return row.id;
}

export async function markRunning(analysisId: string, now: Date = new Date()): Promise<void> {
  await prisma.keywordOpportunityAnalysis.update({
    where: { id: analysisId },
    data: { status: "RUNNING", startedAt: now, currentStep: "discover" },
  });
}

export async function markStep(analysisId: string, step: AnalysisStep): Promise<void> {
  await prisma.keywordOpportunityAnalysis.update({
    where: { id: analysisId },
    data: { currentStep: step },
  });
}

/** Accrue spend as it happens, so a crash mid-run still leaves the cap honest. */
export async function addSpend(
  analysisId: string,
  spend: { dataforseoCostUsd?: number; aiCostUsd?: number },
): Promise<void> {
  const dataforseo = spend.dataforseoCostUsd ?? 0;
  const ai = spend.aiCostUsd ?? 0;
  if (dataforseo === 0 && ai === 0) return;

  await prisma.keywordOpportunityAnalysis.update({
    where: { id: analysisId },
    data: {
      dataforseoCostUsd: { increment: dataforseo },
      aiCostUsd: { increment: ai },
      costUsd: { increment: dataforseo + ai },
    },
  });
}

/**
 * The one place the allowance is consumed.
 *
 * `fundingSource` records which pot paid, decided by the caller before the run
 * started — an analysis funded by a credit has already had that credit held, so
 * this only records the fact.
 */
export async function markCompleted(
  analysisId: string,
  result: {
    keywordCount: number;
    aiTestedCount: number;
    fundingSource: "allowance" | "credits";
  },
  now: Date = new Date(),
): Promise<void> {
  await prisma.keywordOpportunityAnalysis.update({
    where: { id: analysisId },
    data: {
      status: "COMPLETED",
      currentStep: null,
      completedAt: now,
      keywordCount: result.keywordCount,
      aiTestedCount: result.aiTestedCount,
      allowanceConsumed: true,
      fundingSource: result.fundingSource,
    },
  });
}

/**
 * A failed run. NEVER sets allowanceConsumed.
 *
 * `stoppedReason` distinguishes a cap from a fault: "cap_reached" is a decision
 * not to spend and the UI says so, anything else is an error. Same vocabulary
 * as Checkup.stoppedReason.
 */
export async function markFailed(
  analysisId: string,
  reason: { stoppedReason?: string | null; error?: string | null },
  now: Date = new Date(),
): Promise<void> {
  await prisma.keywordOpportunityAnalysis.update({
    where: { id: analysisId },
    data: {
      status: "FAILED",
      currentStep: null,
      completedAt: now,
      allowanceConsumed: false,
      stoppedReason: reason.stoppedReason ?? null,
      error: reason.error ? reason.error.slice(0, 500) : null,
    },
  });
}

/**
 * Runs that started and never finished.
 *
 * A worker killed mid-analysis leaves a RUNNING row that no longer has a
 * process behind it, and a tenant looking at a permanent spinner will not
 * think to tell us. Reaped rather than resumed: the steps are not idempotent
 * (a resumed run re-buys discovery), and a re-run is one click.
 */
export async function staleRunningIds(
  olderThan: Date,
  limit = 50,
): Promise<string[]> {
  const rows = await prisma.keywordOpportunityAnalysis.findMany({
    where: { status: "RUNNING", startedAt: { lt: olderThan } },
    orderBy: { startedAt: "asc" },
    take: limit,
    select: { id: true },
  });
  return rows.map((row) => row.id);
}
