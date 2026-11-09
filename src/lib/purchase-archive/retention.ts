// src/lib/purchase-archive/retention.ts — purchase-archive retention
// (ECHORANK-DATA-ARCHIVE.md Phase 3).
//
// Everything WITHOUT personal data is kept forever. Objects flagged
// personalData (SERP snippets, content-analysis citations, LLM answers) are
// deleted PURCHASE_ARCHIVE_PERSONAL_MONTHS (default 24) after they were
// archived, object first, then the index row, by the purchase-archive
// worker's nightly retention job. A failed object delete throws before the
// batch's rows are touched, so a row is deleted only once its object is gone
// and the next night retries the rest. Counts are logged.

import "server-only";

import type { ObjectStore } from "@/lib/spaces/client";

export const DEFAULT_PERSONAL_MONTHS = 24;

export function personalMonths(env: NodeJS.ProcessEnv = process.env): number {
  const n = Math.floor(Number(env.PURCHASE_ARCHIVE_PERSONAL_MONTHS ?? DEFAULT_PERSONAL_MONTHS));
  return Number.isFinite(n) && n >= 1 ? n : DEFAULT_PERSONAL_MONTHS;
}

/** The first instant still kept: `months` calendar months before now (UTC). */
export function personalCutoff(now: Date, months: number): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds()));
}

export interface RetentionIndex {
  /** Personal-data rows created before `cutoff`, at most `limit`. */
  expired(cutoff: Date, limit: number): Promise<Array<{ id: string; s3Key: string; storedAt: Date | null }>>;
  deleteRows(ids: string[]): Promise<number>;
}

export const RETENTION_BATCH = 500;

export async function purgePersonalData(deps: {
  store: ObjectStore;
  index: RetentionIndex;
  now?: Date;
  months?: number;
  batch?: number;
}): Promise<{ objects: number; rows: number; cutoff: string }> {
  const cutoff = personalCutoff(deps.now ?? new Date(), deps.months ?? personalMonths());
  const batch = deps.batch ?? RETENTION_BATCH;
  let objects = 0;
  let rows = 0;
  for (;;) {
    const expired = await deps.index.expired(cutoff, batch);
    if (!expired.length) break;
    const keys = expired.filter((r) => r.storedAt).map((r) => r.s3Key);
    if (keys.length) objects += await deps.store.deleteKeys(keys);
    rows += await deps.index.deleteRows(expired.map((r) => r.id));
    if (expired.length < batch) break;
  }
  return { objects, rows, cutoff: cutoff.toISOString() };
}

export const prismaRetentionIndex: RetentionIndex = {
  async expired(cutoff, limit) {
    const { prisma } = await import("@/lib/prisma");
    return prisma.purchaseArchive.findMany({
      where: { personalData: true, createdAt: { lt: cutoff } },
      select: { id: true, s3Key: true, storedAt: true },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
  },
  async deleteRows(ids) {
    const { prisma } = await import("@/lib/prisma");
    return (await prisma.purchaseArchive.deleteMany({ where: { id: { in: ids } } })).count;
  },
};
