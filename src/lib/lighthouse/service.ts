// src/lib/lighthouse/service.ts
//
// Lighthouse audit path, shared by the POST route, the e2e script and the
// tests.
//
// Order of operations:
//   1. 6 h cache        — free, instant, and never touches the hourly limiter
//   2. hourly limiter   — Redis; protects the SHARED PSI quota, not revenue
//   3. one PSI call     — 10-30 s, run inline (no queue: see below)
//   4. persist row
//
// No BullMQ. A queue would buy nothing here: the run is a single request with
// no polling protocol, the caller wants the result on screen, and PSI has no
// task id to reconnect to if we dropped the connection. The cost is a long
// HTTP request, which the 60 s client timeout bounds.
//
// There is no partial-failure concept either, unlike the DataForSEO tools: one
// call produces all four sections, so it either returns or it does not.

import type { LighthouseAudit } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { runPagespeed } from "@/lib/pagespeed/client";
import { rateLimit } from "@/lib/rate-limit";
import { parsePsiResponse } from "./parse";
import {
  AUDITS_PER_HOUR,
  AUDIT_WINDOW_MS,
  LIGHTHOUSE_CACHE_TTL_MS,
  type LighthouseStrategy,
} from "./options";
import type {
  CategoryScores,
  CruxData,
  LabMetric,
  LighthouseAuditDto,
  Opportunity,
} from "./types";

export { LIGHTHOUSE_CACHE_TTL_MS } from "./options";

export interface AuditParams {
  /** Already normalized by normalizeAuditUrl(). */
  url: string;
  strategy: LighthouseStrategy;
}

export class LighthouseRateLimitedError extends Error {
  readonly statusCode = 429;
  constructor(readonly limit: number) {
    super(
      `You have run ${limit} audits in the last hour. Wait a little before running more.`,
    );
    this.name = "LighthouseRateLimitedError";
  }
}

/** Prisma row -> API shape. Date never crosses the wire raw. */
export function toAuditDto(
  row: LighthouseAudit,
  extra?: { cached?: boolean; now?: Date },
): LighthouseAuditDto {
  const dto: LighthouseAuditDto = {
    id: row.id,
    url: row.url,
    strategy: row.strategy as LighthouseStrategy,
    scores: row.scores as unknown as CategoryScores,
    metrics: (row.metrics as unknown as LabMetric[]) ?? [],
    opportunities: (row.opportunities as unknown as Opportunity[]) ?? [],
    crux: (row.crux as unknown as CruxData | null) ?? null,
    lighthouseVersion: row.lighthouseVersion,
    fetchedAt: row.fetchedAt.toISOString(),
  };

  if (extra?.cached) {
    dto.cached = true;
    const elapsed = (extra.now ?? new Date()).getTime() - row.fetchedAt.getTime();
    dto.reRunAvailableInMs = Math.max(LIGHTHOUSE_CACHE_TTL_MS - elapsed, 0);
  }

  return dto;
}

/** Newest audit for this exact (url, strategy) inside the cache window. */
export async function findCachedAudit(
  tenantId: string,
  params: AuditParams,
  now = new Date(),
): Promise<LighthouseAudit | null> {
  return prisma.lighthouseAudit.findFirst({
    where: {
      tenantId,
      url: params.url,
      strategy: params.strategy,
      fetchedAt: { gte: new Date(now.getTime() - LIGHTHOUSE_CACHE_TTL_MS) },
    },
    orderBy: { fetchedAt: "desc" },
  });
}

/**
 * Cache hit -> the stored audit; otherwise take a limiter slot, run PSI and
 * persist.
 *
 * The limiter is checked AFTER the cache on purpose: replaying a stored audit
 * consumes no upstream quota, so it should not consume an allowance either.
 *
 * Throws LighthouseRateLimitedError (429) or PagespeedError (mapped by
 * lighthouseRouteError).
 */
export async function runAudit(
  tenantId: string,
  params: AuditParams,
  now = new Date(),
): Promise<{ audit: LighthouseAuditDto; cached: boolean }> {
  const cached = await findCachedAudit(tenantId, params, now);
  if (cached) {
    return { audit: toAuditDto(cached, { cached: true, now }), cached: true };
  }

  const limited = await rateLimit(`lighthouse:${tenantId}`, AUDITS_PER_HOUR, AUDIT_WINDOW_MS);
  if (!limited.success) {
    throw new LighthouseRateLimitedError(AUDITS_PER_HOUR);
  }

  const raw = await runPagespeed(params.url, params.strategy);
  const parsed = parsePsiResponse(raw);

  const row = await prisma.lighthouseAudit.create({
    data: {
      tenantId,
      // The REQUESTED url is stored, not parsed.finalUrl: the cache key and
      // the history list must match what the user typed, or a site that
      // redirects would miss its own cache on every run.
      url: params.url,
      strategy: params.strategy,
      // `as object`: Prisma's InputJsonValue wants an index signature, which
      // our named interfaces deliberately do not have.
      scores: parsed.scores as object,
      metrics: parsed.metrics as object,
      opportunities: parsed.opportunities as object,
      crux: (parsed.crux as object) ?? undefined,
      lighthouseVersion: parsed.lighthouseVersion,
      fetchedAt: now,
    },
  });

  console.info(
    `[lighthouse] tenant=${tenantId} url=${params.url} strategy=${params.strategy} ` +
      `perf=${parsed.scores.performance ?? "—"} a11y=${parsed.scores.accessibility ?? "—"} ` +
      `bp=${parsed.scores.bestPractices ?? "—"} seo=${parsed.scores.seo ?? "—"} ` +
      `crux=${parsed.crux ? parsed.crux.overall : "none"} lh=${parsed.lighthouseVersion ?? "—"}`,
  );

  return { audit: toAuditDto(row), cached: false };
}
