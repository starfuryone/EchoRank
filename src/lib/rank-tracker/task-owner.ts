// src/lib/rank-tracker/task-owner.ts
//
// RankSnapshot's stake in the shared standard-queue drain (see
// dataforseo/standard-queue.ts). Same protocol as the SERP Checker's owner,
// different payload: a SERP check stores the whole top-100 table, a rank
// snapshot stores only where the tracked domain landed.
//
// The tracked domain lives on the project two joins up, so `complete` reads it
// alongside the row rather than trusting anything passed in — the sweep is
// generic and must not need to know what a project is.

import { prisma } from "@/lib/prisma";
import type { PendingTask, StandardQueueOwner } from "@/lib/dataforseo/standard-queue";
import { extractPosition } from "./position";

export const rankSnapshotOwner: StandardQueueOwner = {
  name: "rank-snapshot",

  async timeoutStale(cutoff: Date): Promise<number> {
    const { count } = await prisma.rankSnapshot.updateMany({
      where: { status: "queued", runDate: { lt: cutoff } },
      data: {
        status: "failed",
        error: "The SERP data provider did not return results within 30 minutes.",
        completedAt: new Date(),
      },
    });
    return count;
  },

  async findPending(createdBefore: Date, limit: number): Promise<PendingTask[]> {
    const rows = await prisma.rankSnapshot.findMany({
      where: {
        status: "queued",
        dataforseoTaskId: { not: null },
        runDate: { lte: createdBefore },
      },
      orderBy: { runDate: "asc" },
      take: limit,
      select: { id: true, dataforseoTaskId: true, runDate: true },
    });
    return rows.map((row) => ({
      rowId: row.id,
      taskId: row.dataforseoTaskId as string,
      createdAt: row.runDate,
    }));
  },

  async complete(rowId: string, result: unknown[]): Promise<void> {
    const row = await prisma.rankSnapshot.findUnique({
      where: { id: rowId },
      select: { keyword: { select: { project: { select: { domain: true } } } } },
    });
    // The project (or its keyword) was deleted while the task was in flight —
    // the cascade already removed the snapshot, so there is nothing to write.
    if (!row) return;

    const { position, url, serpFeatures } = extractPosition(
      result,
      row.keyword.project.domain,
    );

    await prisma.rankSnapshot.update({
      where: { id: rowId },
      data: {
        status: "completed",
        // null is a RESULT here ("not in the top 100"), not missing data.
        position,
        url,
        serpFeatures,
        error: null,
        completedAt: new Date(),
      },
    });
  },

  async fail(rowId: string, message: string): Promise<void> {
    await prisma.rankSnapshot.update({
      where: { id: rowId },
      data: { status: "failed", error: message, completedAt: new Date() },
    });
  },
};
