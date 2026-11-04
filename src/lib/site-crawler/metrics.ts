// src/lib/site-crawler/metrics.ts
//
// Phase 4d metrics store: crawl_page_metrics reads and writes. Upserts are
// one statement per chunk (INSERT … ON CONFLICT (pageId, source)), and the
// URL joins walk the crawl's pages in keyset windows against ONE chunk of
// upstream rows at a time, so neither side is ever held whole in memory.

import "server-only";
import { randomUUID } from "crypto";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { METRIC_SOURCES, urlKey, type MetricSource } from "./metrics-shared";

export const METRIC_WRITE_CHUNK = 1_000;
const PAGE_WINDOW = 2_000;

/** Insert or replace one source's data for these pages. */
export async function upsertPageMetrics(jobId: string, source: MetricSource, rows: { pageId: string; data: unknown }[], now = new Date()): Promise<number> {
  let n = 0;
  for (let i = 0; i < rows.length; i += METRIC_WRITE_CHUNK) {
    const chunk = rows.slice(i, i + METRIC_WRITE_CHUNK);
    const values = chunk.map((r) => Prisma.sql`(${randomUUID()}, ${jobId}, ${r.pageId}, ${source}::"CrawlMetricSource", ${JSON.stringify(r.data)}::jsonb, ${now})`);
    n += await prisma.$executeRaw`
      INSERT INTO "crawl_page_metrics" ("id", "crawlJobId", "pageId", "source", "data", "fetchedAt")
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("pageId", "source") DO UPDATE SET "data" = EXCLUDED."data", "fetchedAt" = EXCLUDED."fetchedAt"`;
  }
  return n;
}

/**
 * Join one chunk of upstream rows (keyed by urlKey) onto the crawl's pages
 * and store the matches. Several pages can share a key (http vs https, a
 * trailing slash): each gets the row. Returns the pages matched.
 */
export async function joinChunkByUrl<T>(jobId: string, source: MetricSource, byKey: ReadonlyMap<string, T>): Promise<number> {
  if (byKey.size === 0) return 0;
  let cursor: string | undefined;
  let matched = 0;
  for (;;) {
    const pages = await prisma.crawlPage.findMany({
      where: { crawlJobId: jobId, ...(cursor ? { id: { gt: cursor } } : {}) },
      orderBy: { id: "asc" },
      take: PAGE_WINDOW,
      select: { id: true, url: true },
    });
    if (pages.length === 0) break;
    const rows = pages.flatMap((p) => {
      const k = urlKey(p.url);
      const d = k ? byKey.get(k) : undefined;
      return d === undefined ? [] : [{ pageId: p.id, data: d }];
    });
    matched += rows.length;
    await upsertPageMetrics(jobId, source, rows);
    if (pages.length < PAGE_WINDOW) break;
    cursor = pages[pages.length - 1]!.id;
  }
  return matched;
}

export type PageMetrics = Partial<Record<MetricSource, unknown>>;

/** Every source's data for these pages. */
export async function metricsForPages(pageIds: readonly string[]): Promise<Map<string, PageMetrics>> {
  const out = new Map<string, PageMetrics>();
  if (pageIds.length === 0) return out;
  const rows = await prisma.crawlPageMetric.findMany({ where: { pageId: { in: [...pageIds] } }, select: { pageId: true, source: true, data: true } });
  for (const r of rows) {
    const m = out.get(r.pageId) ?? {};
    m[r.source as MetricSource] = r.data;
    out.set(r.pageId, m);
  }
  return out;
}

/** Pages with data, per source (the Overview tiles). */
export async function metricCoverage(jobId: string): Promise<Record<MetricSource, number>> {
  const groups = await prisma.crawlPageMetric.groupBy({ by: ["source"], where: { crawlJobId: jobId }, _count: { _all: true } });
  const out = Object.fromEntries(METRIC_SOURCES.map((s) => [s, 0])) as Record<MetricSource, number>;
  for (const g of groups) out[g.source as MetricSource] = g._count._all;
  return out;
}
