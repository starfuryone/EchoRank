// src/lib/site-crawler/pages-sort.ts
//
// Phase 4d: the Pages tab sorted by a joined metric (gsc.clicks,
// psi.mobile.lcpMs, …). Prisma cannot order by a jsonb path on a related
// row, so the ordered id window is one SQL statement carrying the same
// filters the route builds for Prisma; the rows are then read by id. Only
// numeric values sort: a failed run ({error}) or a missing row sorts last.

import "server-only";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { sortPath } from "./metrics-shared";

export interface PageSqlFilters {
  jobId: string;
  inSitemap?: boolean;
  depth?: number;
  minInlinks?: number;
  maxInlinks?: number;
  /** Custom search index and whether it matched. */
  search?: { index: number; hit: boolean };
  urlPrefix?: string;
  segment?: number | null;
}

/** LIKE-escape a literal prefix. */
export const likePrefix = (s: string) => `${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export function pageWhereSql(f: PageSqlFilters): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`p."crawlJobId" = ${f.jobId}`];
  if (f.inSitemap !== undefined) parts.push(Prisma.sql`p."inSitemap" = ${f.inSitemap}`);
  if (f.depth !== undefined) parts.push(Prisma.sql`p."depth" = ${f.depth}`);
  if (f.minInlinks !== undefined) parts.push(Prisma.sql`p."inlinkCount" >= ${f.minInlinks}`);
  if (f.maxInlinks !== undefined) parts.push(Prisma.sql`p."inlinkCount" <= ${f.maxInlinks}`);
  if (f.search) {
    const k = String(f.search.index);
    const n = Prisma.sql`CASE WHEN jsonb_typeof(p."searchHits" -> ${k}) = 'number' THEN (p."searchHits" ->> ${k})::float8 END`;
    parts.push(f.search.hit ? Prisma.sql`${n} > 0` : Prisma.sql`${n} = 0`);
  }
  if (f.urlPrefix !== undefined) parts.push(Prisma.sql`p."url" LIKE ${likePrefix(f.urlPrefix)}`);
  if (f.segment !== null && f.segment !== undefined) parts.push(Prisma.sql`p."segmentIds" @> ARRAY[${f.segment}]::smallint[]`);
  return Prisma.join(parts, " AND ");
}

/** One page of ids ordered by a metric sort key. */
export async function pageIdsByMetric(f: PageSqlFilters, key: string, dir: "asc" | "desc", skip: number, take: number): Promise<string[]> {
  const sp = sortPath(key);
  if (!sp) throw new Error("not a metric sort key");
  const path = `{${sp.path.join(",")}}`;
  const value = Prisma.sql`CASE WHEN jsonb_typeof(m."data" #> ${path}::text[]) = 'number' THEN (m."data" #>> ${path}::text[])::float8 END`;
  const order = dir === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT p."id" FROM "crawl_pages" p
    LEFT JOIN "crawl_page_metrics" m ON m."pageId" = p."id" AND m."source" = ${sp.source}::"CrawlMetricSource"
    WHERE ${pageWhereSql(f)}
    ORDER BY ${value} ${order} NULLS LAST, p."id" ASC
    OFFSET ${skip} LIMIT ${take}`;
  return rows.map((r) => r.id);
}
