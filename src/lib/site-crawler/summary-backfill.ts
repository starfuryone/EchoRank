// src/lib/site-crawler/summary-backfill.ts
//
// Before a crawl's rows leave Postgres, its summary must carry everything the
// summary-only views read: `totals` (getIssueTotals — header tiles, Overview,
// the PDF header, scheduled emails) and `issues` / `issuesByKind`
// (ruleTalliesFor — the Rules tab, the public API, Sheets). Crawls from 3a on
// already have them; older ones were computed on read from crawl_issues, which
// an archived crawl no longer has. This computes them from the rows once and
// merges them into the summary. Idempotent: a summary that has both is left
// untouched.

import "server-only";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { cachedTotals, countIssueTotals } from "./issue-totals";
import { cachedRuleTallies, computeRuleTallies } from "./rule-summary";

/** True when the summary already carries both caches. */
export function hasCachedTotals(summary: unknown): boolean {
  return cachedTotals(summary) !== null && cachedRuleTallies(summary) !== null;
}

/**
 * Write the missing caches into one HOT crawl's summary. Returns true when it
 * wrote. The caller guarantees the rows are in Postgres (the archive calls it
 * while the crawl is still HOT).
 */
export async function backfillCachedTotals(jobId: string): Promise<boolean> {
  const job = await prisma.crawlJob.findUnique({ where: { id: jobId }, select: { summary: true } });
  if (!job || hasCachedTotals(job.summary)) return false;
  const base = (job.summary && typeof job.summary === "object" && !Array.isArray(job.summary) ? job.summary : {}) as Record<string, unknown>;
  const totals = cachedTotals(base) ?? (await countIssueTotals(jobId));
  const tallies = cachedRuleTallies(base) ?? (await computeRuleTallies(jobId));
  await prisma.crawlJob.update({
    where: { id: jobId },
    data: { summary: { ...base, totals, issues: tallies.issues, issuesByKind: tallies.issuesByKind } as unknown as Prisma.InputJsonValue },
  });
  return true;
}
