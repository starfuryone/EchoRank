/**
 * GET /api/seo/v1/crawl/[id]/duplicates?type=title|meta|content
 *
 * Paginated duplicate GROUPS with their member URLs. The grouping is redone
 * here rather than read back from the issue rows: an issue says "this page is
 * a duplicate", and the UI needs "these five pages are each other's
 * duplicates", which is a different shape.
 *
 * The member list per group is capped — a group of 4,000 identical pages is a
 * real thing on a broken site, and shipping all of them would defeat the
 * pagination around it.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { crawlRouteError } from "@/lib/site-crawler/http";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
/** Members returned per group. The count is exact; the list is a sample. */
const MEMBERS_PER_GROUP = 25;

type DuplicateKind = "title" | "meta" | "content";
const KINDS: DuplicateKind[] = ["title", "meta", "content"];

interface GroupRow {
  value: string | null;
  members: number;
  urls: string[];
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenant = await requirePaidPlan();
    const { id } = await params;

    const crawl = await prisma.crawlJob.findFirst({
      where: { id, tenantId: tenant.tenantId },
      select: { id: true },
    });
    if (!crawl) {
      return NextResponse.json({ error: "Crawl not found", code: "NOT_FOUND" }, { status: 404 });
    }

    const url = new URL(request.url);
    const kind = (url.searchParams.get("type") ?? "title") as DuplicateKind;
    if (!KINDS.includes(kind)) {
      return NextResponse.json(
        { error: "Unknown duplicate type", code: "INVALID_REQUEST" },
        { status: 400 },
      );
    }

    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Number(url.searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE),
    );
    const offset = (page - 1) * pageSize;

    // Column names are literals per branch, never interpolated.
    const groups: GroupRow[] =
      kind === "title"
        ? await prisma.$queryRaw`
            SELECT title AS value, count(*)::int AS members,
                   (array_agg(url ORDER BY url))[1:${MEMBERS_PER_GROUP}] AS urls
            FROM crawl_pages
            WHERE "crawlJobId" = ${crawl.id}
              AND "statusCode" >= 200 AND "statusCode" < 300
              AND "contentType" LIKE 'text/html%'
              AND title IS NOT NULL AND title <> ''
            GROUP BY title HAVING count(*) > 1
            ORDER BY count(*) DESC, title ASC
            LIMIT ${pageSize} OFFSET ${offset}`
        : kind === "meta"
          ? await prisma.$queryRaw`
              SELECT "metaDescription" AS value, count(*)::int AS members,
                     (array_agg(url ORDER BY url))[1:${MEMBERS_PER_GROUP}] AS urls
              FROM crawl_pages
              WHERE "crawlJobId" = ${crawl.id}
                AND "statusCode" >= 200 AND "statusCode" < 300
                AND "contentType" LIKE 'text/html%'
                AND "metaDescription" IS NOT NULL AND "metaDescription" <> ''
              GROUP BY "metaDescription" HAVING count(*) > 1
              ORDER BY count(*) DESC, "metaDescription" ASC
              LIMIT ${pageSize} OFFSET ${offset}`
          : await prisma.$queryRaw`
              SELECT "contentHash" AS value, count(*)::int AS members,
                     (array_agg(url ORDER BY url))[1:${MEMBERS_PER_GROUP}] AS urls
              FROM crawl_pages
              WHERE "crawlJobId" = ${crawl.id}
                AND "statusCode" >= 200 AND "statusCode" < 300
                AND "contentType" LIKE 'text/html%'
                AND "contentHash" IS NOT NULL
              GROUP BY "contentHash" HAVING count(*) > 1
              ORDER BY count(*) DESC, "contentHash" ASC
              LIMIT ${pageSize} OFFSET ${offset}`;

    const totalRows = await prisma.$queryRaw<{ total: bigint }[]>`
      SELECT count(*)::bigint AS total FROM (
        SELECT 1 FROM crawl_pages
        WHERE "crawlJobId" = ${crawl.id}
          AND "statusCode" >= 200 AND "statusCode" < 300
          AND "contentType" LIKE 'text/html%'
        GROUP BY CASE
          WHEN ${kind} = 'title' THEN title
          WHEN ${kind} = 'meta' THEN "metaDescription"
          ELSE "contentHash"
        END
        HAVING count(*) > 1 AND CASE
          WHEN ${kind} = 'title' THEN title
          WHEN ${kind} = 'meta' THEN "metaDescription"
          ELSE "contentHash"
        END IS NOT NULL
      ) g`;
    const total = Number(totalRows[0]?.total ?? 0);

    return NextResponse.json({
      type: kind,
      groups: groups.map((g) => ({
        // The content hash is an implementation detail; the UI shows the URLs.
        value: kind === "content" ? null : g.value,
        members: g.members,
        urls: g.urls ?? [],
        truncated: g.members > (g.urls?.length ?? 0),
      })),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (err) {
    return crawlRouteError(err);
  }
}
