// src/lib/blog-agent/store.ts
//
// The blog_agent_runs ledger. Rows advance; nothing is deleted.
//
// Two reads matter and both are indexed: the 30-day dedupe lookback and the
// daily spend sum. Everything else here is a status transition.
//
// NOTE ON THE PRISMA CLIENT. The BlogAgentRun model landed with migration
// 20260821220000_blog_agent_runs. Until that migration is applied AND
// `prisma generate` has run, `prisma.blogAgentRun` does not exist at runtime —
// every function here will throw, which is correct and loud. The worker checks
// the kill switch before it reaches any of them, so an unmigrated box with the
// agent disabled behaves exactly as it did before.

import "server-only";

import { prisma } from "@/lib/prisma";

export type RunStage = "DISCOVER" | "RESEARCH" | "DRAFT" | "GATE" | "LAND";
export type RunStatus =
  | "DISCOVERED"
  | "DRAFTED"
  | "GATED_FAIL"
  | "AWAITING_REVIEW"
  | "APPROVED"
  | "PUBLISHED"
  | "REJECTED";

/** How far back the dedupe window reaches. */
export const DEDUPE_WINDOW_DAYS = 30;

export interface CreateRunInput {
  topicHash: string;
  topicTitle: string;
  sourceId: string;
  sourceUrls: string[];
}

export async function createRun(input: CreateRunInput): Promise<string> {
  const row = await prisma.blogAgentRun.create({
    data: {
      stage: "DISCOVER",
      status: "DISCOVERED",
      topicHash: input.topicHash,
      topicTitle: input.topicTitle,
      sourceId: input.sourceId,
      sourceUrls: input.sourceUrls,
    },
    select: { id: true },
  });
  return row.id;
}

export async function advanceRun(
  id: string,
  patch: {
    stage?: RunStage;
    status?: RunStatus;
    slug?: string | null;
    /** ADDED to the existing figure, not replacing it — a retry spends twice. */
    addCostUsd?: number;
    error?: string | null;
    sourceUrls?: string[];
  },
): Promise<void> {
  await prisma.blogAgentRun.update({
    where: { id },
    data: {
      ...(patch.stage ? { stage: patch.stage } : {}),
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.slug !== undefined ? { slug: patch.slug } : {}),
      ...(patch.error !== undefined ? { error: patch.error } : {}),
      ...(patch.sourceUrls ? { sourceUrls: patch.sourceUrls } : {}),
      ...(patch.addCostUsd ? { costUsd: { increment: patch.addCostUsd } } : {}),
    },
  });
}

/**
 * Topic hashes seen inside the dedupe window.
 *
 * INCLUDES failed runs. A story that failed the gate twice yesterday should not
 * be retried today — the failure was about the story being hard to write from,
 * and spending the budget on it again is how a bad topic eats a whole week.
 */
export async function seenTopicHashes(now: Date): Promise<Set<string>> {
  const since = new Date(now.getTime() - DEDUPE_WINDOW_DAYS * 86_400_000);
  const rows = await prisma.blogAgentRun.findMany({
    where: { createdAt: { gt: since } },
    select: { topicHash: true },
  });
  return new Set(rows.map((r) => r.topicHash));
}

/**
 * Anthropic spend since 00:00 UTC.
 *
 * UTC rather than local: the schedule is UTC, the cap is per calendar day, and
 * a server timezone change must not silently hand the agent a double budget for
 * one day.
 */
export async function spendTodayUsd(now: Date): Promise<number> {
  const startOfDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const agg = await prisma.blogAgentRun.aggregate({
    where: { createdAt: { gte: startOfDay } },
    _sum: { costUsd: true },
  });
  return agg._sum.costUsd ?? 0;
}

/** Runs waiting on a human, for the publish-check manifest. */
export async function awaitingReview(): Promise<
  Array<{ id: string; slug: string | null; topicTitle: string; createdAt: Date }>
> {
  return prisma.blogAgentRun.findMany({
    where: { status: "AWAITING_REVIEW" },
    select: { id: true, slug: true, topicTitle: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Mark the runs whose article a human has since published.
 *
 * The agent does not own that transition — a human edits `status: published` in
 * the file, and this reconciles the ledger with what is on disk. Passing the
 * published slug set in keeps this function free of the loader, so it stays a
 * pure database concern.
 */
export async function reconcilePublished(publishedSlugs: ReadonlySet<string>): Promise<number> {
  if (!publishedSlugs.size) return 0;
  const result = await prisma.blogAgentRun.updateMany({
    where: { slug: { in: [...publishedSlugs] }, status: { in: ["AWAITING_REVIEW", "APPROVED"] } },
    data: { status: "PUBLISHED" },
  });
  return result.count;
}
