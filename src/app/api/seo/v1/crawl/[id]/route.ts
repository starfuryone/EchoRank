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
import { getIssueTotals } from "@/lib/site-crawler/issue-totals";

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

    // Per-severity totals for the header tiles — the same getIssueTotals the
    // Overview tab reads. Skipped while the crawl is still running: the numbers
    // would be stale by the time they rendered, and this endpoint is polled
    // every 3 s — a groupBy per poll is a cost the running view does not need.
    const severityCounts =
      row.status !== "QUEUED" && row.status !== "RUNNING"
        ? await getIssueTotals(row.id, row.summary)
        : { ERROR: 0, WARNING: 0, NOTICE: 0 };

    return NextResponse.json({ ...toCrawlDto(row), severityCounts });
  } catch (err) {
    return crawlRouteError(err);
  }
}
