// src/lib/serp/task-owner.ts
//
// SerpCheck's stake in the shared standard-queue drain. The polling protocol
// lives in dataforseo/standard-queue.ts; this file only knows how SerpCheck
// rows are found and written.

import { prisma } from "@/lib/prisma";
import type { PendingTask, StandardQueueOwner } from "@/lib/dataforseo/standard-queue";
import { parseSerpTaskResult } from "./parse";

export const serpCheckOwner: StandardQueueOwner = {
  name: "serp-check",

  async timeoutStale(cutoff: Date): Promise<number> {
    const { count } = await prisma.serpCheck.updateMany({
      where: { status: "queued", createdAt: { lt: cutoff } },
      data: {
        status: "failed",
        error: "The SERP data provider did not return results within 30 minutes.",
        completedAt: new Date(),
      },
    });
    return count;
  },

  async findPending(createdBefore: Date, limit: number): Promise<PendingTask[]> {
    const rows = await prisma.serpCheck.findMany({
      where: {
        status: "queued",
        dataforseoTaskId: { not: null },
        createdAt: { lte: createdBefore },
      },
      orderBy: { createdAt: "asc" },
      take: limit,
      select: { id: true, dataforseoTaskId: true, createdAt: true },
    });
    return rows.map((row) => ({
      rowId: row.id,
      taskId: row.dataforseoTaskId as string,
      createdAt: row.createdAt,
    }));
  },

  async complete(rowId: string, result: unknown[]): Promise<void> {
    const parsed = parseSerpTaskResult(result);
    await prisma.serpCheck.update({
      where: { id: rowId },
      data: {
        status: "completed",
        results: parsed.results as unknown as object,
        serpFeatures: parsed.serpFeatures,
        itemCount: parsed.itemCount,
        error: null,
        completedAt: new Date(),
      },
    });
  },

  async fail(rowId: string, message: string): Promise<void> {
    await prisma.serpCheck.update({
      where: { id: rowId },
      data: { status: "failed", error: message, completedAt: new Date() },
    });
  },
};
