/**
 * GET /api/seo/v1/crawl/[id] — one crawl's status and counts.
 *
 * This is the poll target: the UI hits it every 3 s while a crawl runs, so it
 * reads one row and nothing else.
 *
 * Tenant-scoped by construction — the lookup filters on BOTH id and the
 * caller's tenantId, so another workspace's crawl id is a 404, never a leak.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { toCrawlDto } from "@/lib/site-crawler/service";
import { crawlRouteError } from "@/lib/site-crawler/http";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenant = await requirePaidPlan();
    const { id } = await params;

    const row = await prisma.crawlJob.findFirst({
      where: { id, tenantId: tenant.tenantId },
    });

    if (!row) {
      return NextResponse.json({ error: "Crawl not found", code: "NOT_FOUND" }, { status: 404 });
    }

    // Per-severity totals for the summary tiles. Skipped while the crawl is
    // still running: the numbers would be stale by the time they rendered, and
    // this endpoint is polled every 3 s — a groupBy per poll is a cost the
    // running view does not need.
    const severityCounts = { ERROR: 0, WARNING: 0, NOTICE: 0 };
    if (row.status !== "QUEUED" && row.status !== "RUNNING") {
      const grouped = await prisma.crawlIssue.groupBy({
        by: ["severity"],
        where: { crawlPage: { crawlJobId: row.id } },
        _count: { _all: true },
      });
      for (const g of grouped) {
        if (g.severity in severityCounts) {
          severityCounts[g.severity as keyof typeof severityCounts] = g._count._all;
        }
      }
    }

    return NextResponse.json({ ...toCrawlDto(row), severityCounts });
  } catch (err) {
    return crawlRouteError(err);
  }
}
