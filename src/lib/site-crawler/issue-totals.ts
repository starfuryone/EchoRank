// src/lib/site-crawler/issue-totals.ts
//
// Errors / warnings / notices for one crawl — the ONE source for both the
// header tiles and the Overview tab, so the two can never disagree again.
// (They did: the header showed 0 / 0 / 0 on Phase 2 crawls while Overview
// showed the real split, because each read a different place.)
//
// crawl_jobs.summary is a cache here, not the truth: it is trusted only when
// it carries `totals` in the current shape, which aggregation writes from 3a
// on. Anything older — a null summary, a Phase 2 summary without totals —
// falls through to a groupBy on crawl_issues by crawlJobId (backfilled by the
// 3a migration, so pre-3a rows are counted too).

import "server-only";
import { prisma } from "@/lib/prisma";
import type { SeverityCounts } from "./types";

const SEVERITIES = ["ERROR", "WARNING", "NOTICE"] as const;

/** Raw severity → count map, folded into the fixed three-key shape. */
export function toTotals(bySeverity: Record<string, number>): SeverityCounts {
  return { ERROR: bySeverity.ERROR ?? 0, WARNING: bySeverity.WARNING ?? 0, NOTICE: bySeverity.NOTICE ?? 0 };
}

/** summary.totals when it is present and well-formed; null otherwise. */
export function cachedTotals(summary: unknown): SeverityCounts | null {
  const totals = (summary as { totals?: unknown } | null)?.totals as Record<string, unknown> | undefined;
  if (!totals || typeof totals !== "object") return null;
  if (!SEVERITIES.every((s) => typeof totals[s] === "number" && Number.isFinite(totals[s]))) return null;
  return { ERROR: totals.ERROR as number, WARNING: totals.WARNING as number, NOTICE: totals.NOTICE as number };
}

export async function getIssueTotals(jobId: string, summary?: unknown): Promise<SeverityCounts> {
  const cached = cachedTotals(summary);
  if (cached) return cached;
  const grouped = await prisma.crawlIssue.groupBy({
    by: ["severity"],
    where: { crawlJobId: jobId },
    _count: { _all: true },
  });
  return toTotals(Object.fromEntries(grouped.map((g) => [g.severity, g._count._all])));
}
