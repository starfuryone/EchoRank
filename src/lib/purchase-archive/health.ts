// src/lib/purchase-archive/health.ts — what /api/admin/purchase-archive/health
// reports (ECHORANK-DATA-ARCHIVE.md Phase 3): last write, spool depth (both
// spools), objects and bytes this month and in total, and the estimated Spaces
// cost of the purchase bucket. Counts only; never a key, a tenant or a payload.

import "server-only";

import { purchaseArchiveEnabled, spoolDir } from "./config";
import { spoolStats } from "./spool";
import { pageSpoolDir } from "@/lib/page-archive/config";
import { listPageSpool } from "@/lib/page-archive/spool";

/** Spaces: $5/month covers 250 GB (and 1 TB transfer); each GB over is $0.02. */
export const SPACES_BASE_USD = 5;
export const SPACES_INCLUDED_GB = 250;
export const SPACES_EXTRA_USD_PER_GB = 0.02;

export function estimateSpacesUsd(bytes: number): number {
  const gb = bytes / 1024 ** 3;
  return Math.round((SPACES_BASE_USD + Math.max(0, gb - SPACES_INCLUDED_GB) * SPACES_EXTRA_USD_PER_GB) * 100) / 100;
}

export interface ArchiveHealth {
  configured: boolean;
  lastWriteAt: string | null;
  pendingUploads: number;
  spool: { purchases: { files: number; bytes: number }; pages: { files: number } };
  month: { objects: number; bytes: number; costUsd: number };
  total: { objects: number; bytes: number };
  estimatedSpacesUsdPerMonth: number;
}

export async function archiveHealth(now = new Date()): Promise<ArchiveHealth> {
  const { prisma } = await import("@/lib/prisma");
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [last, month, total, pending, purchases, pages] = await Promise.all([
    prisma.purchaseArchive.findFirst({ where: { storedAt: { not: null } }, orderBy: { storedAt: "desc" }, select: { storedAt: true } }),
    prisma.purchaseArchive.aggregate({ where: { storedAt: { not: null }, createdAt: { gte: monthStart } }, _count: { _all: true }, _sum: { bytes: true, costUsd: true } }),
    prisma.purchaseArchive.aggregate({ where: { storedAt: { not: null } }, _count: { _all: true }, _sum: { bytes: true } }),
    prisma.purchaseArchive.count({ where: { storedAt: null } }),
    spoolStats(spoolDir()).catch(() => ({ files: -1, bytes: -1 })),
    listPageSpool(pageSpoolDir()).then((n) => n.length).catch(() => -1),
  ]);
  const totalBytes = Number(total._sum.bytes ?? 0);
  return {
    configured: purchaseArchiveEnabled(),
    lastWriteAt: last?.storedAt?.toISOString() ?? null,
    pendingUploads: pending,
    spool: { purchases, pages: { files: pages } },
    month: { objects: month._count._all, bytes: Number(month._sum.bytes ?? 0), costUsd: Number(month._sum.costUsd ?? 0) },
    total: { objects: total._count._all, bytes: totalBytes },
    estimatedSpacesUsdPerMonth: estimateSpacesUsd(totalBytes),
  };
}
