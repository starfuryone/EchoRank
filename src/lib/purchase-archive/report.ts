// src/lib/purchase-archive/report.ts — purchases vs archive hits per provider
// per day, and the dollars the hits saved (ECHORANK-DATA-ARCHIVE.md Phase 2).
// Staff only: read by /admin/purchase-archive. Counts and sums, no payloads.

import "server-only";

import { prisma } from "@/lib/prisma";

export interface ReportRow {
  day: string;
  provider: string;
  purchases: number;
  purchasedUsd: number;
  hits: number;
  savedUsd: number;
}

export const REPORT_DAYS = 14;

/** Merge the two aggregates into one row per (day, provider), newest first. */
export function mergeReport(
  purchases: Array<{ day: Date | string; provider: string; n: number; usd: number }>,
  hits: Array<{ day: Date | string; provider: string; n: number; usd: number }>,
): ReportRow[] {
  const key = (d: Date | string, p: string) => `${new Date(d).toISOString().slice(0, 10)}|${p}`;
  const rows = new Map<string, ReportRow>();
  const at = (d: Date | string, p: string) => {
    const k = key(d, p);
    let r = rows.get(k);
    if (!r) {
      r = { day: k.slice(0, 10), provider: p, purchases: 0, purchasedUsd: 0, hits: 0, savedUsd: 0 };
      rows.set(k, r);
    }
    return r;
  };
  for (const p of purchases) {
    const r = at(p.day, p.provider);
    r.purchases += Number(p.n);
    r.purchasedUsd += Number(p.usd);
  }
  for (const h of hits) {
    const r = at(h.day, h.provider);
    r.hits += Number(h.n);
    r.savedUsd += Number(h.usd);
  }
  return [...rows.values()].sort((a, b) => (a.day === b.day ? a.provider.localeCompare(b.provider) : b.day.localeCompare(a.day)));
}

export async function archiveReport(days = REPORT_DAYS, now = new Date()): Promise<ReportRow[]> {
  const since = new Date(now.getTime() - days * 86_400_000);
  const purchases = await prisma.$queryRaw<Array<{ day: Date; provider: string; n: number; usd: number }>>`
    SELECT date_trunc('day', "createdAt") AS day, "provider", count(*)::int AS n, coalesce(sum("costUsd"), 0)::float AS usd
    FROM "purchase_archive" WHERE "createdAt" >= ${since} AND "storedAt" IS NOT NULL
    GROUP BY 1, 2`;
  const hits = await prisma.$queryRaw<Array<{ day: Date; provider: string; n: number; usd: number }>>`
    SELECT date_trunc('day', "createdAt") AS day, "provider", count(*)::int AS n, coalesce(sum("savedUsd"), 0)::float AS usd
    FROM "purchase_archive_hits" WHERE "createdAt" >= ${since}
    GROUP BY 1, 2`;
  return mergeReport(purchases, hits);
}
