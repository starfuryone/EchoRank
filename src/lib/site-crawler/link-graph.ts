// src/lib/site-crawler/link-graph.ts
//
// Reads over crawl_links (Phase 4a): the broken-link export (one row per
// source page × broken target), a page's inlinks, and redirecting pages with
// their chains. Keyset-paged by id, a page of rows at a time, so a 25,000-page
// crawl with two million edges exports without holding them.
//
// "Broken" = the target was fetched and answered 4xx/5xx, or never answered
// (no status but a fetch time: timeout, DNS, refused). URLs robots.txt kept
// us out of have neither and are not broken, only unvisited.

import "server-only";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import type { BrokenLinkRow, InlinkRow, RedirectChainRow } from "./csv-columns";

/** `segment` (Phase 4b) keeps links whose SOURCE page is in that segment. */
export async function brokenLinksPage(
  jobId: string,
  cursor: string | null,
  take: number,
  segment: number | null = null,
): Promise<BrokenLinkRow[]> {
  return prisma.$queryRaw<BrokenLinkRow[]>`
    SELECT l."id", f."url" AS "source", l."toUrl" AS "target", l."anchor", t."statusCode", f."segmentIds"
    FROM "crawl_links" l
    JOIN "crawl_pages" t ON t."id" = l."toPageId"
    JOIN "crawl_pages" f ON f."id" = l."fromPageId"
    WHERE l."crawlJobId" = ${jobId}
      AND (t."statusCode" >= 400 OR (t."statusCode" IS NULL AND t."fetchMs" IS NOT NULL))
      ${segment === null ? Prisma.empty : Prisma.sql`AND f."segmentIds" @> ARRAY[${segment}]::smallint[]`}
      ${cursor ? Prisma.sql`AND l."id" > ${cursor}` : Prisma.empty}
    ORDER BY l."id"
    LIMIT ${take}`;
}

export async function inlinksPage(
  jobId: string,
  pageId: string,
  cursor: string | null,
  take: number,
): Promise<InlinkRow[]> {
  const rows = await prisma.crawlLink.findMany({
    where: { crawlJobId: jobId, toPageId: pageId, ...(cursor ? { id: { gt: cursor } } : {}) },
    orderBy: { id: "asc" },
    take,
    select: { id: true, anchor: true, nofollow: true, fromPage: { select: { url: true } } },
  });
  return rows.map((r) => ({ id: r.id, source: r.fromPage.url, anchor: r.anchor, nofollow: r.nofollow }));
}

export async function redirectChainsPage(
  jobId: string,
  cursor: string | null,
  take: number,
  segment: number | null = null,
): Promise<RedirectChainRow[]> {
  return prisma.crawlPage.findMany({
    where: {
      crawlJobId: jobId,
      redirectChain: { not: Prisma.DbNull },
      ...(segment === null ? {} : { segmentIds: { has: segment } }),
      ...(cursor ? { id: { gt: cursor } } : {}),
    },
    orderBy: { id: "asc" },
    take,
    select: { id: true, url: true, foundOn: true, redirectChain: true, segmentIds: true },
  });
}

/** Edges resolved per UPDATE: one short statement per window of crawl_links ids. */
export const LINK_RESOLVE_WINDOW = 50_000;

/**
 * Phase 4a: join the link graph to the page rows, in SQL. A link's target and
 * a page's discoverer are stored as URLs while crawling (the target may not
 * have a row yet); once the page set is final they resolve to page ids.
 *
 * The edges go in windows of `window` rows by id range, each its own
 * statement (autocommit, no surrounding transaction), so a 25,000-page crawl
 * with 2.5 million edges never holds one long transaction or one lock set.
 * The window's upper bound is the id `window` rows past the last one; the
 * final window is open-ended. Returns the number of windows run.
 */
export async function resolveLinkGraph(jobId: string, window = LINK_RESOLVE_WINDOW): Promise<number> {
  let lo: string | null = null;
  let windows = 0;
  for (;;) {
    const lower: Prisma.Sql = lo === null ? Prisma.empty : Prisma.sql`AND "id" > ${lo}`;
    const [edge] = await prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "crawl_links"
      WHERE "crawlJobId" = ${jobId} ${lower}
      ORDER BY "id" OFFSET ${window - 1} LIMIT 1`;
    const hi = edge?.id ?? null;
    await prisma.$executeRaw`
      UPDATE "crawl_links" l SET "toPageId" = p."id"
      FROM "crawl_pages" p
      WHERE l."crawlJobId" = ${jobId} AND p."crawlJobId" = ${jobId}
        AND p."url" = l."toUrl" AND l."toPageId" IS NULL
        ${lo === null ? Prisma.empty : Prisma.sql`AND l."id" > ${lo}`}
        ${hi === null ? Prisma.empty : Prisma.sql`AND l."id" <= ${hi}`}`;
    windows++;
    if (hi === null) break;
    lo = hi;
  }
  // One row per page (≤ the crawl's url cap): a single statement is fine.
  await prisma.$executeRaw`
    UPDATE "crawl_pages" c SET "parentPageId" = p."id"
    FROM "crawl_pages" p
    WHERE c."crawlJobId" = ${jobId} AND p."crawlJobId" = ${jobId}
      AND p."url" = c."foundOn" AND c."parentPageId" IS NULL`;
  return windows;
}
