/**
 * GET /api/seo/v1/crawl/[id]/pages — paginated crawled pages.
 *
 * Tenant scoping is on the PARENT crawl, same as the issues endpoint.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { crawlRouteError } from "@/lib/site-crawler/http";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

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
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Number(url.searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE),
    );

    const where = { crawlJobId: crawl.id };

    const [total, rows] = await Promise.all([
      prisma.crawlPage.count({ where }),
      prisma.crawlPage.findMany({
        where,
        orderBy: [{ depth: "asc" }, { url: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          url: true,
          statusCode: true,
          title: true,
          titleLength: true,
          metaDescLength: true,
          h1Count: true,
          wordCount: true,
          depth: true,
          internalLinks: true,
          fetchMs: true,
          contentType: true,
          redirectTarget: true,
          canonical: true,
          _count: { select: { issues: true } },
        },
      }),
    ]);

    return NextResponse.json({
      pages: rows.map((r) => ({
        id: r.id,
        url: r.url,
        statusCode: r.statusCode,
        title: r.title,
        titleLength: r.titleLength,
        metaDescLength: r.metaDescLength,
        h1Count: r.h1Count,
        wordCount: r.wordCount,
        depth: r.depth,
        internalLinks: r.internalLinks,
        fetchMs: r.fetchMs,
        contentType: r.contentType,
        redirectTarget: r.redirectTarget,
        canonical: r.canonical,
        issueCount: r._count.issues,
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
