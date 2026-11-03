/**
 * GET /api/seo/v1/crawl/[id]/summary — the site-wide aggregation output.
 *
 * 404 until the crawl has COMPLETED. A running crawl has no summary to give,
 * and returning a half-built one would make the Overview tab flicker between
 * wrong numbers.
 *
 * Per-rule tallies (`issues`, `issuesByKind`) come from the summary when
 * aggregation wrote them (3a+), and are computed from crawl_issues otherwise
 * (rule-summary.ts). A crawl from before Phase 2 has no summary column at all:
 * it answers `{ partial: true, issues, issuesByKind }`, the tallies alone.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { crawlRouteError } from "@/lib/site-crawler/http";
import { getIssueTotals } from "@/lib/site-crawler/issue-totals";
import { ruleTalliesFor } from "@/lib/site-crawler/rule-summary";

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

    if (!row || row.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "No summary for this crawl", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    const [{ issues, issuesByKind, computed }, totals] = await Promise.all([
      ruleTalliesFor(row.id, row.summary),
      getIssueTotals(row.id, row.summary),
    ]);
    if (row.summary === null) return NextResponse.json({ partial: true, issues, issuesByKind, totals, computed });
    return NextResponse.json({ ...(row.summary as object), issues, issuesByKind, totals, computed });
  } catch (err) {
    return crawlRouteError(err);
  }
}
