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

export async function brokenLinksPage(jobId: string, cursor: string | null, take: number): Promise<BrokenLinkRow[]> {
  return prisma.$queryRaw<BrokenLinkRow[]>`
    SELECT l."id", f."url" AS "source", l."toUrl" AS "target", l."anchor", t."statusCode"
    FROM "crawl_links" l
    JOIN "crawl_pages" t ON t."id" = l."toPageId"
    JOIN "crawl_pages" f ON f."id" = l."fromPageId"
    WHERE l."crawlJobId" = ${jobId}
      AND (t."statusCode" >= 400 OR (t."statusCode" IS NULL AND t."fetchMs" IS NOT NULL))
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

export async function redirectChainsPage(jobId: string, cursor: string | null, take: number): Promise<RedirectChainRow[]> {
  return prisma.crawlPage.findMany({
    where: { crawlJobId: jobId, redirectChain: { not: Prisma.DbNull }, ...(cursor ? { id: { gt: cursor } } : {}) },
    orderBy: { id: "asc" },
    take,
    select: { id: true, url: true, foundOn: true, redirectChain: true },
  });
}

/**
 * Phase 4a: join the link graph to the page rows, in SQL. A link's target and
 * a page's discoverer are stored as URLs while crawling (the target may not
 * have a row yet); once the page set is final they resolve to page ids.
 */
export async function resolveLinkGraph(jobId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "crawl_links" l SET "toPageId" = p."id"
    FROM "crawl_pages" p
    WHERE l."crawlJobId" = ${jobId} AND p."crawlJobId" = ${jobId}
      AND p."url" = l."toUrl" AND l."toPageId" IS NULL`;
  await prisma.$executeRaw`
    UPDATE "crawl_pages" c SET "parentPageId" = p."id"
    FROM "crawl_pages" p
    WHERE c."crawlJobId" = ${jobId} AND p."crawlJobId" = ${jobId}
      AND p."url" = c."foundOn" AND c."parentPageId" IS NULL`;
}
