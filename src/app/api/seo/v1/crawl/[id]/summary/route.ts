/**
 * GET /api/seo/v1/crawl/[id]/summary — the site-wide aggregation output.
 *
 * 404 until the crawl has COMPLETED and aggregation has written the column.
 * A running crawl has no summary to give, and returning a half-built one would
 * make the Overview tab flicker between wrong numbers.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
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
      select: { id: true, status: true, summary: true },
    });

    if (!row || row.status !== "COMPLETED" || row.summary === null) {
      return NextResponse.json(
        { error: "No summary for this crawl", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    return NextResponse.json(row.summary);
  } catch (err) {
    return crawlRouteError(err);
  }
}
