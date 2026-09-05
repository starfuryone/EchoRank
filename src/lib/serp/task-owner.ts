// src/lib/serp/task-owner.ts
//
// SerpCheck's stake in the shared standard-queue drain. The polling protocol
// lives in dataforseo/standard-queue.ts; this file only knows how SerpCheck
// rows are found and written.

import { prisma } from "@/lib/prisma";
import type { PendingTask, StandardQueueOwner } from "@/lib/dataforseo/standard-queue";
import { recordResearch } from "@/lib/research-log/store";
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
    const row = await prisma.serpCheck.update({
      where: { id: rowId },
      data: {
        status: "completed",
        results: parsed.results as unknown as object,
        serpFeatures: parsed.serpFeatures,
        itemCount: parsed.itemCount,
        error: null,
        completedAt: new Date(),
      },
      select: { id: true, tenantId: true, keyword: true, costUsd: true, locationCode: true },
    });

    // DELIVERED SUCCESS, which for the standard queue is here and not at
    // task_post. The check was billed minutes ago; this is the first moment
    // the customer actually has something. Logging at submit would record
    // research for tasks that go on to expire without ever returning.
    // recordResearch never throws — see its header.
    await recordResearch({
      tenantId: row.tenantId,
      feature: "serp_check",
      target: row.keyword,
      metrics: {
        results: parsed.itemCount,
        serpFeatures: parsed.serpFeatures.length,
        locationCode: row.locationCode,
      },
      costUsd: Number(row.costUsd),
      sourceRef: row.id,
    });
  },

  async fail(rowId: string, message: string): Promise<void> {
    await prisma.serpCheck.update({
      where: { id: rowId },
      data: { status: "failed", error: message, completedAt: new Date() },
    });
  },
};
