// src/lib/explain/store.ts
//
// Persistence and the 7-day re-run window.
//
// ── The window is a spend brake, not a freshness policy ────────────────────
// A report costs real money (~$0.09 of DataForSEO + Places). Nothing it
// measures moves meaningfully inside a week: backlink profiles are monthly
// data, Places ratings drift slowly, and the SOV rollup it reads is nightly but
// its own inputs are a 28-day window. So a second run inside seven days would
// buy the same answer twice, and the window says no. Past seven days a re-run
// is permitted — not automatic. Nothing here refreshes on a schedule; the
// customer asks, or nothing happens.
//
// EVERY QUERY IS TENANT-SCOPED.

import { prisma } from "@/lib/prisma";
import { registrableDomain } from "@/lib/registrable-domain";
import { EXPLAIN_RERUN_MS } from "./window";
import type { ExplainFactor, ExplainReportView } from "./types";

export { EXPLAIN_RERUN_DAYS } from "./window";

/** Normalised identity of a rival. Domains are stored the way `sources` and
 *  `citations` store them, so a report joins to the citation rows about the
 *  same company without a second spelling. */
export function normalizeRivalDomain(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const domain = registrableDomain(trimmed);
  return domain || null;
}

/**
 * The newest report for one rival, or null.
 *
 * One indexed read — (tenantId, rivalDomain, createdAt DESC) covers it without
 * a sort. The tenant filter is not redundant with the index: it IS the
 * isolation guarantee, and the same rival domain exists under every tenant that
 * has ever asked about it.
 */
export async function latestReport(
  tenantId: string,
  rivalDomain: string,
): Promise<ExplainReportView | null> {
  const row = await prisma.explainReport.findFirst({
    where: { tenantId, rivalDomain },
    orderBy: { createdAt: "desc" },
  });
  return row ? toView(row, true) : null;
}

/** True when a stored report is still inside its window and must be served
 *  rather than re-gathered. */
export function isFresh(report: { createdAt: string }, now = Date.now()): boolean {
  return now - new Date(report.createdAt).getTime() < EXPLAIN_RERUN_MS;
}

export async function saveReport(input: {
  tenantId: string;
  rivalDomain: string;
  rivalName: string;
  brandProfileId: string;
  factors: ExplainFactor[];
  costUsd: number;
}): Promise<ExplainReportView> {
  const row = await prisma.explainReport.create({
    data: {
      tenantId: input.tenantId,
      rivalDomain: input.rivalDomain,
      rivalName: input.rivalName,
      brandProfileId: input.brandProfileId,
      // Prisma's Json input rejects a typed array without the cast; the shape
      // is ExplainFactor[] and types.ts is the contract for reading it back.
      factors: input.factors as unknown as object[],
      costUsd: input.costUsd,
    },
  });
  return toView(row, false);
}

function toView(
  row: {
    id: string;
    rivalDomain: string;
    rivalName: string;
    brandProfileId: string;
    factors: unknown;
    costUsd: unknown;
    createdAt: Date;
  },
  cached: boolean,
): ExplainReportView {
  return {
    id: row.id,
    rivalDomain: row.rivalDomain,
    rivalName: row.rivalName,
    brandProfileId: row.brandProfileId,
    factors: (row.factors ?? []) as ExplainFactor[],
    costUsd: Number(row.costUsd),
    createdAt: row.createdAt.toISOString(),
    cached,
    rerunAllowedAt: new Date(row.createdAt.getTime() + EXPLAIN_RERUN_MS).toISOString(),
  };
}
