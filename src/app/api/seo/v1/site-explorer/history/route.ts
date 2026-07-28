/**
 * GET /api/seo/v1/site-explorer/history — this tenant's past analyses, plus
 * the monthly quota line and total spend the page header shows.
 *
 * Rows carry no section payloads: the history table only needs domain, status,
 * cost and date, and 50 analyses × a 100-row keyword table is a needlessly
 * large body. Clicking a row fetches the full analysis from [id].
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { siteExplorerAnalysesUsed, siteExplorerLimit } from "@/lib/site-explorer/quota";
import { siteExplorerRouteError } from "@/lib/site-explorer/http";
import type { SiteExplorerHistoryRow, SiteExplorerStatus } from "@/lib/site-explorer/types";

const HISTORY_LIMIT = 50;

export async function GET() {
  try {
    const tenant = await requirePaidPlan();

    const [rows, spend, used] = await Promise.all([
      prisma.siteExplorerAnalysis.findMany({
        where: { tenantId: tenant.tenantId },
        orderBy: { createdAt: "desc" },
        take: HISTORY_LIMIT,
        select: {
          id: true,
          domain: true,
          status: true,
          costUsd: true,
          createdAt: true,
        },
      }),
      prisma.siteExplorerAnalysis.aggregate({
        _sum: { costUsd: true },
        where: { tenantId: tenant.tenantId },
      }),
      siteExplorerAnalysesUsed(tenant.tenantId),
    ]);

    const analyses: SiteExplorerHistoryRow[] = rows.map((row) => ({
      id: row.id,
      domain: row.domain,
      status: row.status as SiteExplorerStatus,
      costUsd: Number(row.costUsd),
      createdAt: row.createdAt.toISOString(),
    }));

    return NextResponse.json({
      analyses,
      usage: {
        used,
        limit: siteExplorerLimit(tenant.tenant.planType),
        plan: tenant.tenant.planType,
      },
      totalCostUsd: Number(spend._sum.costUsd ?? 0),
    });
  } catch (err) {
    return siteExplorerRouteError(err);
  }
}
