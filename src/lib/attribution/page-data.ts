// src/lib/attribution/page-data.ts
//
// Server-side read model for /visibility/tools/ai-attribution.
//
// ── What the numbers mean, exactly ──────────────────────────────────────────
// ai_visits holds one row per (visitor, source, landing page), not one per page
// view. So every figure on this page counts DISTINCT AI-REFERRED VISITORS, and
// the trend is keyed on firstSeen — "how many new AI-referred visitors arrived
// that day". `hits` carries the repeat arrivals for anyone who wants them, but
// no headline number is built from it, because a page-view count presented as a
// visitor count is the kind of inflation nobody notices until a customer does.
//
// Phase 1 is arrivals only. There is no conversion or revenue read here and no
// column to build one from — that is P2/P3.

import type { AiVisitSource } from "./sources";

/** The reporting window, everywhere on the page. */
export const ATTRIBUTION_WINDOW_DAYS = 28;

export interface SourceCount {
  source: AiVisitSource;
  visitors: number;
  hits: number;
}

export interface LandingPageRow {
  landingPath: string;
  visitors: number;
  hits: number;
  /** Sources that sent someone to this page, most visitors first. */
  sources: AiVisitSource[];
}

export interface TrendPoint {
  /** ISO date, YYYY-MM-DD, in UTC. */
  day: string;
  visitors: number;
}

export interface AttributionPageData {
  /** True once any er_pub_ key exists — drives install vs. results state. */
  installed: boolean;
  /** True once any visit has ever landed, at any time. */
  hasData: boolean;
  windowDays: number;
  totalVisitors: number;
  bySource: SourceCount[];
  landingPages: LandingPageRow[];
  /** Exactly ATTRIBUTION_WINDOW_DAYS points, oldest first, zeroes included. */
  trend: TrendPoint[];
}

/** Midnight UTC, `days` ago. The window boundary for every query below. */
function windowStart(days: number): Date {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function loadAttributionPageData(tenantId: string): Promise<AttributionPageData> {
  const { prisma } = await import("@/lib/prisma");
  const since = windowStart(ATTRIBUTION_WINDOW_DAYS);

  // Every query below is `where: { tenantId, … }`. There is no findUnique by id
  // anywhere on this page, so there is no shape here that could read across
  // tenants even if a caller passed the wrong id.
  const [keyCount, everCount, sourceGroups, pageGroups, pageSourceGroups, rows] =
    await Promise.all([
      prisma.attributionKey.count({ where: { tenantId, revokedAt: null } }),
      prisma.aiVisit.count({ where: { tenantId } }),
      prisma.aiVisit.groupBy({
        by: ["source"],
        where: { tenantId, firstSeen: { gte: since } },
        _count: { _all: true },
        _sum: { hits: true },
      }),
      prisma.aiVisit.groupBy({
        by: ["landingPath"],
        where: { tenantId, firstSeen: { gte: since } },
        _count: { _all: true },
        _sum: { hits: true },
        orderBy: { _count: { landingPath: "desc" } },
        take: 25,
      }),
      prisma.aiVisit.groupBy({
        by: ["landingPath", "source"],
        where: { tenantId, firstSeen: { gte: since } },
        _count: { _all: true },
      }),
      // Dates only, for the trend. One column, bounded by the window — cheap
      // enough to bucket in JS and it keeps the whole page on the query builder
      // rather than on raw SQL for one histogram.
      prisma.aiVisit.findMany({
        where: { tenantId, firstSeen: { gte: since } },
        select: { firstSeen: true },
      }),
    ]);

  const bySource: SourceCount[] = sourceGroups
    .map((g) => ({
      source: g.source as AiVisitSource,
      visitors: g._count._all,
      hits: g._sum.hits ?? 0,
    }))
    .sort((a, b) => b.visitors - a.visitors);

  const sourcesByPage = new Map<string, { source: AiVisitSource; visitors: number }[]>();
  for (const g of pageSourceGroups) {
    const list = sourcesByPage.get(g.landingPath) ?? [];
    list.push({ source: g.source as AiVisitSource, visitors: g._count._all });
    sourcesByPage.set(g.landingPath, list);
  }

  const landingPages: LandingPageRow[] = pageGroups.map((g) => ({
    landingPath: g.landingPath,
    visitors: g._count._all,
    hits: g._sum.hits ?? 0,
    sources: (sourcesByPage.get(g.landingPath) ?? [])
      .sort((a, b) => b.visitors - a.visitors)
      .map((s) => s.source),
  }));

  // Pre-seed every day in the window so the sparkline has no gaps to guess at:
  // a day with no AI traffic is a zero, not a missing point.
  const buckets = new Map<string, number>();
  for (let i = 0; i < ATTRIBUTION_WINDOW_DAYS; i++) {
    const day = new Date(since);
    day.setUTCDate(day.getUTCDate() + i);
    buckets.set(isoDay(day), 0);
  }
  for (const row of rows) {
    const day = isoDay(row.firstSeen);
    if (buckets.has(day)) buckets.set(day, (buckets.get(day) ?? 0) + 1);
  }

  return {
    installed: keyCount > 0,
    hasData: everCount > 0,
    windowDays: ATTRIBUTION_WINDOW_DAYS,
    totalVisitors: bySource.reduce((sum, s) => sum + s.visitors, 0),
    bySource,
    landingPages,
    trend: [...buckets.entries()].map(([day, visitors]) => ({ day, visitors })),
  };
}
