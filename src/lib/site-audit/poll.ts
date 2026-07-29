// src/lib/site-audit/poll.ts
//
// The Site Audit crawl poller.
//
// WHY THIS IS A SEPARATE SWEEP AND NOT A StandardQueueOwner:
// dataforseo/standard-queue.ts exists because SERP's `tasks_ready` is a shared
// DRAIN — one reader, dispatching ids to whichever owner claims them. OnPage
// is a different protocol end to end:
//
//   - it is not on the SERP queue at all, so it never appears in
//     serp/google/organic/tasks_ready and cannot collide with SerpCheck or
//     RankSnapshot ids. There is no drain to share.
//   - progress must be read DURING the crawl: on_page/summary reports
//     pages_crawled while crawl_progress is still "in_progress", and that is
//     exactly what the progress bar shows. The standard-queue engine has no
//     concept of a partially-done task — a row is queued or it is collected.
//   - finishing takes TWO calls (summary, then pages), not one task_get.
//
// Forcing that into StandardQueueOwner would have meant making the fetch
// strategy, the readiness test and the completion arity all pluggable — at
// which point the "shared engine" shares nothing but a loop. The two sweeps
// poll disjoint id spaces, and a test asserts they never see each other's rows.
//
// summary and pages are FREE at DataForSEO. The crawl's per-page charge lands
// on the task and is reconciled here from the summary envelope's `cost`.

import { prisma } from "@/lib/prisma";
import { getEndpoint, postTask, DataforseoError } from "@/lib/dataforseo/client";
import { ONPAGE } from "@/lib/dataforseo/endpoints";
import { logger } from "@/infrastructure/observability/logger";
import {
  crawlIsFinished,
  crawlProgress,
  pagesCrawledFrom,
  parseIssues,
  parsePages,
  parseSummary,
  type RawSummaryResult,
} from "./parse";
import { CRAWL_TIMEOUT_MS, MAX_PAGE_ROWS } from "./options";

/** Don't ask about a crawl before DataForSEO has had a chance to start it. */
const MIN_AGE_MS = 20_000;
/** Cap the work of one tick; the next tick picks up the rest. */
const SWEEP_BATCH = 25;

/**
 * Upstream error text reaches the API (and support tickets), so the vendor
 * name is scrubbed — user-facing surfaces say Echorank360 or nothing.
 */
function sanitize(message: string): string {
  return message.replace(/dataforseo/gi, "the site crawler").slice(0, 500);
}

async function markFailed(rowId: string, message: string): Promise<void> {
  await prisma.siteAudit.update({
    where: { id: rowId },
    data: { status: "failed", error: sanitize(message), finishedAt: new Date() },
  });
}

/**
 * Reads the finished crawl's per-page results.
 *
 * A failure here does NOT fail the audit: the summary and issue counts are
 * already the bulk of the value, and losing the page table is not worth
 * discarding a crawl the tenant paid minutes and money for.
 */
async function fetchPages(taskId: string): Promise<ReturnType<typeof parsePages> | null> {
  try {
    const { data } = await postTask<{ items?: unknown[]; total_count?: number }[]>(
      ONPAGE.pages,
      { id: taskId, limit: MAX_PAGE_ROWS },
    );
    return parsePages(data as Parameters<typeof parsePages>[0]);
  } catch (err) {
    logger.error({ taskId, err }, "site-audit pages fetch failed; keeping the summary");
    return null;
  }
}

/** One row's poll. Returns what happened, for the sweep's log line. */
async function pollOne(row: {
  id: string;
  dataforseoTaskId: string;
  costUsd: unknown;
}): Promise<"finished" | "crawling" | "failed"> {
  const taskId = row.dataforseoTaskId;

  let summaryResult: RawSummaryResult | undefined;
  let summaryCost = 0;
  try {
    const { data, billing } = await getEndpoint<RawSummaryResult[]>(
      `${ONPAGE.summary}/${taskId}`,
      // The live path carries a per-task id; fixtures key on the stable prefix.
      { fixtureKey: ONPAGE.summary },
    );
    summaryResult = data?.[0];
    summaryCost = billing.costUsd;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // "Task In Queue" style responses mean the crawl has not started yet —
    // leave the row alone and try again next tick.
    if (err instanceof DataforseoError && /in queue|in progress|not found/i.test(message)) {
      return "crawling";
    }
    logger.error({ rowId: row.id, taskId, err }, "site-audit summary failed");
    await markFailed(row.id, message);
    return "failed";
  }

  const pagesCrawled = pagesCrawledFrom(summaryResult);

  if (!crawlIsFinished(summaryResult)) {
    // Still crawling — publish progress so the UI's bar advances, and leave
    // the row in flight.
    await prisma.siteAudit.update({
      where: { id: row.id },
      data: { status: "crawling", pagesCrawled },
    });
    return "crawling";
  }

  const summary = parseSummary(summaryResult);
  const issues = parseIssues(summaryResult);
  const pages = await fetchPages(taskId);

  if (issues.unclassified.length > 0) {
    // Not an error — a check we have not catalogued. Logged so a new upstream
    // check is visible rather than silently absent from every report.
    logger.info(
      { rowId: row.id, checks: issues.unclassified },
      "site-audit saw uncatalogued OnPage checks",
    );
  }

  await prisma.siteAudit.update({
    where: { id: row.id },
    data: {
      status: "completed",
      pagesCrawled,
      summary: summary as object,
      issues: issues as object,
      pages: (pages as object) ?? undefined,
      // Bill from the envelopes: task_post's charge plus whatever the crawl
      // itself accrued, never a price table.
      costUsd: Number(row.costUsd) + summaryCost,
      error: null,
      finishedAt: new Date(),
    },
  });

  logger.info(
    {
      rowId: row.id,
      pagesCrawled,
      onPageScore: summary.onPageScore,
      errors: issues.totals.error,
      warnings: issues.totals.warning,
    },
    "site-audit crawl completed",
  );
  return "finished";
}

/**
 * One sweep across every in-flight crawl.
 *
 * Exported for the e2e script and for ops, which occasionally needs to force a
 * poll without waiting for the next tick.
 */
export async function processSiteAuditSweep(now = new Date()): Promise<void> {
  // ── Time out anything stuck. ───────────────────────────────────────────
  const timedOut = await prisma.siteAudit.updateMany({
    where: {
      status: { in: ["queued", "crawling"] },
      createdAt: { lt: new Date(now.getTime() - CRAWL_TIMEOUT_MS) },
    },
    data: {
      status: "failed",
      error: "The crawl did not finish within an hour.",
      finishedAt: now,
    },
  });
  if (timedOut.count > 0) {
    logger.warn({ count: timedOut.count }, "site-audit crawls timed out");
  }

  const pending = await prisma.siteAudit.findMany({
    where: {
      status: { in: ["queued", "crawling"] },
      dataforseoTaskId: { not: null },
      createdAt: { lte: new Date(now.getTime() - MIN_AGE_MS) },
    },
    orderBy: { createdAt: "asc" },
    take: SWEEP_BATCH,
    select: { id: true, dataforseoTaskId: true, costUsd: true },
  });
  if (pending.length === 0) return;

  let finished = 0;
  let crawling = 0;
  let failed = 0;
  for (const row of pending) {
    try {
      const outcome = await pollOne({
        id: row.id,
        dataforseoTaskId: row.dataforseoTaskId as string,
        costUsd: row.costUsd,
      });
      if (outcome === "finished") finished++;
      else if (outcome === "crawling") crawling++;
      else failed++;
    } catch (err) {
      // One bad row must not stall the rest of the sweep.
      failed++;
      logger.error({ rowId: row.id, err }, "site-audit poll threw");
    }
  }

  logger.info({ pending: pending.length, finished, crawling, failed }, "site-audit sweep complete");
}

/** Exposed for the status endpoint's log line and the e2e script. */
export { crawlProgress };
