/**
 * GET /api/seo/v1/backlinks/history — this tenant's past analyses, plus the
 * monthly quota line and total spend the page header shows.
 *
 * Rows carry no section payloads: the history table only needs target, mode,
 * status, cost and date, and 50 analyses × a 50-row domain table is a
 * needlessly large body. Clicking a row fetches the full analysis from [id].
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { backlinksRouteError } from "@/lib/backlinks/http";
import { buildUsage } from "@/lib/backlinks/usage";
import type {
  BacklinksHistoryRow,
  BacklinksStatus,
} from "@/lib/backlinks/types";
import type { BacklinksMode } from "@/lib/backlinks/target";

const HISTORY_LIMIT = 50;

export async function GET() {
  try {
    const tenant = await requirePaidPlan();

    const [rows, spend, usage] = await Promise.all([
      prisma.backlinksAnalysis.findMany({
        where: { tenantId: tenant.tenantId },
        orderBy: { createdAt: "desc" },
        take: HISTORY_LIMIT,
        select: {
          id: true,
          target: true,
          mode: true,
          status: true,
          costUsd: true,
          createdAt: true,
        },
      }),
      prisma.backlinksAnalysis.aggregate({
        _sum: { costUsd: true },
        where: { tenantId: tenant.tenantId },
      }),
      buildUsage(tenant.tenantId, tenant.tenant.planType),
    ]);

    const analyses: BacklinksHistoryRow[] = rows.map((row) => ({
      id: row.id,
      target: row.target,
      mode: row.mode as BacklinksMode,
      status: row.status as BacklinksStatus,
      costUsd: Number(row.costUsd),
      createdAt: row.createdAt.toISOString(),
    }));

    return NextResponse.json({
      analyses,
      usage,
      totalCostUsd: Number(spend._sum.costUsd ?? 0),
    });
  } catch (err) {
    return backlinksRouteError(err);
  }
}
