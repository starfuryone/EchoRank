/**
 * GET /api/seo/v1/crawl/[id]/redirects — redirect chains and loops.
 *
 * Reads the issue rows aggregation already wrote rather than re-walking the
 * map: the walk needs the whole redirect graph in memory, and doing it per
 * request would put that cost on every page of the table. The detail column
 * carries the hop list, which is parsed back into an array here.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { crawlRouteError } from "@/lib/site-crawler/http";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

/** Aggregation writes "N hops: a → b → c" or "loop: a → b → a". */
function parseHops(detail: string | null): string[] {
  if (!detail) return [];
  const afterColon = detail.slice(detail.indexOf(":") + 1);
  return afterColon
    .split("→")
    .map((s) => s.trim())
    .filter(Boolean);
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
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Number(url.searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE),
    );

    const where = {
      crawlPage: { crawlJobId: crawl.id },
      type: { in: ["REDIRECT_CHAIN", "REDIRECT_LOOP"] },
    };

    const [total, rows] = await Promise.all([
      prisma.crawlIssue.count({ where }),
      prisma.crawlIssue.findMany({
        where,
        // Loops (ERROR) sort before chains (WARNING) alphabetically, which is
        // also the order of severity here.
        orderBy: [{ severity: "asc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          type: true,
          severity: true,
          detail: true,
          crawlPage: { select: { url: true, statusCode: true, redirectTarget: true } },
        },
      }),
    ]);

    return NextResponse.json({
      redirects: rows.map((r) => ({
        id: r.id,
        type: r.type,
        severity: r.severity,
        url: r.crawlPage.url,
        statusCode: r.crawlPage.statusCode,
        target: r.crawlPage.redirectTarget,
        hops: parseHops(r.detail),
        detail: r.detail,
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
