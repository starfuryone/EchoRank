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
import { legacyTypesFor, ruleIssueOnPage } from "./rule-summary";

/** The Pages view's scope select. Indexable = a 200 without noindex (graph.ts). */
export const PAGE_SCOPES = ["indexable", "nonindexable", "errors", "redirects", "orphans"] as const;
export type PageScope = (typeof PAGE_SCOPES)[number];
export const ORPHAN_RULE = "links.orphan";

/** Prisma form of a scope; the SQL form below must select the same rows. */
export function pageScopeWhere(scope: PageScope): Prisma.CrawlPageWhereInput {
  switch (scope) {
    case "indexable":
      return { statusCode: 200, OR: [{ noindex: false }, { noindex: null }] };
    case "nonindexable":
      return { OR: [{ statusCode: null }, { statusCode: { not: 200 } }, { noindex: true }] };
    case "errors":
      // No status = the fetch failed: an error too.
      return { OR: [{ statusCode: null }, { statusCode: { gte: 400 } }] };
    case "redirects":
      return { statusCode: { gte: 300, lt: 400 } };
    case "orphans":
      return { issues: { some: ruleIssueOnPage(ORPHAN_RULE) } };
  }
}

/** Search: URL or title contains the text, any case. */
export function pageSearchWhere(q: string): Prisma.CrawlPageWhereInput {
  return { OR: [{ url: { contains: q, mode: "insensitive" } }, { title: { contains: q, mode: "insensitive" } }] };
}

/** LIKE-escape a literal for a contains match. */
const likeContains = (s: string) => `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

function ruleExistsSql(ruleId: string): Prisma.Sql {
  const legacy = legacyTypesFor(ruleId);
  const legacySql = legacy.length ? Prisma.sql` OR (i."ruleId" IS NULL AND i."type" IN (${Prisma.join(legacy)}))` : Prisma.empty;
  return Prisma.sql`EXISTS (SELECT 1 FROM "crawl_issues" i WHERE i."crawlPageId" = p."id" AND (i."ruleId" = ${ruleId}${legacySql}))`;
}

function pageScopeSql(scope: PageScope): Prisma.Sql {
  switch (scope) {
    case "indexable":
      return Prisma.sql`(p."statusCode" = 200 AND p."noindex" IS NOT TRUE)`;
    case "nonindexable":
      return Prisma.sql`(p."statusCode" IS NULL OR p."statusCode" <> 200 OR p."noindex" IS TRUE)`;
    case "errors":
      return Prisma.sql`(p."statusCode" IS NULL OR p."statusCode" >= 400)`;
    case "redirects":
      return Prisma.sql`(p."statusCode" >= 300 AND p."statusCode" < 400)`;
    case "orphans":
      return ruleExistsSql(ORPHAN_RULE);
  }
}

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
  /** Pages view: URL or title contains this. */
  q?: string;
  scope?: PageScope;
  /** Pages with a finding of this rule (Issues › See all pages). */
  rule?: string;
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
  if (f.q) parts.push(Prisma.sql`(p."url" ILIKE ${likeContains(f.q)} OR p."title" ILIKE ${likeContains(f.q)})`);
  if (f.scope) parts.push(pageScopeSql(f.scope));
  if (f.rule) parts.push(ruleExistsSql(f.rule));
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
