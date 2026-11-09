// src/lib/purchase-archive/prisma-index.ts — purchase_archive through Prisma.

import "server-only";

import { prisma } from "@/lib/prisma";
import type { PreparedObject } from "./core";
import type { ArchiveIndex } from "./writer";

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string })?.code === "P2002";
}

export const prismaArchiveIndex: ArchiveIndex = {
  async find(dedupeKey) {
    return prisma.purchaseArchive.findUnique({ where: { dedupeKey }, select: { s3Key: true, storedAt: true } });
  },

  async reserve(o: PreparedObject) {
    try {
      await prisma.purchaseArchive.create({
        data: {
          app: o.app,
          provider: o.provider,
          endpoint: o.endpoint,
          requestHash: o.requestHash,
          dedupeKey: o.dedupeKey,
          providerTaskId: o.providerTaskId,
          s3Key: o.s3Key,
          costUsd: o.costUsd,
          bytes: o.bytes,
          tenantId: o.tenantId,
          purpose: o.purpose,
          personalData: o.personalData,
          receivedAt: new Date(o.receivedAt),
        },
      });
      return true;
    } catch (err) {
      if (isUniqueViolation(err)) return false;
      throw err;
    }
  },

  async markStored(dedupeKey, at) {
    await prisma.purchaseArchive.update({ where: { dedupeKey }, data: { storedAt: at } });
  },

  async rowsBetween(from, to) {
    const rows = await prisma.purchaseArchive.findMany({
      where: { createdAt: { gte: from, lt: to }, storedAt: { not: null } },
      orderBy: { createdAt: "asc" },
      select: { s3Key: true, requestHash: true, provider: true, endpoint: true, costUsd: true, bytes: true, tenantId: true, createdAt: true },
    });
    return rows.map((r) => ({ ...r, costUsd: r.costUsd === null ? null : Number(r.costUsd) }));
  },
};

/**
 * Who a task-read belongs to, and what its purchase cost. A task_get is not
 * billed; the task_post that created it was, and its metering row has the
 * tenant and the cost. SeoApiCall first (SERP, OnPage), then the LLM Scraper's
 * own table.
 */
export async function lookupTaskPurchase(taskId: string): Promise<{ tenantId: string | null; costUsd: number | null } | null> {
  const seo = await prisma.seoApiCall.findFirst({
    where: { dataforseoTaskId: taskId },
    select: { tenantId: true, costUsd: true },
  });
  if (seo) return { tenantId: seo.tenantId, costUsd: Number(seo.costUsd) };
  const llm = await prisma.llmScraperTask.findUnique({ where: { taskId }, select: { tenantId: true, costUsd: true } });
  if (llm) return { tenantId: llm.tenantId, costUsd: llm.costUsd };
  return null;
}
