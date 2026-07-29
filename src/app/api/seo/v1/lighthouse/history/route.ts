/**
 * GET /api/seo/v1/lighthouse/history — this tenant's past audits, plus the
 * hourly limiter line the page header shows.
 *
 * Rows carry the four category scores but no metrics/opportunities/CrUX: the
 * history table renders score chips, and shipping 50 full audits would be a
 * large body for data the list never displays. Clicking a row fetches the
 * full audit from [id].
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { lighthouseRouteError } from "@/lib/lighthouse/http";
import { buildUsage } from "@/lib/lighthouse/usage";
import { HISTORY_LIMIT, type LighthouseStrategy } from "@/lib/lighthouse/options";
import type { CategoryScores, LighthouseHistoryRow } from "@/lib/lighthouse/types";

export async function GET() {
  try {
    const tenant = await requirePaidPlan();

    const [rows, usage] = await Promise.all([
      prisma.lighthouseAudit.findMany({
        where: { tenantId: tenant.tenantId },
        orderBy: { fetchedAt: "desc" },
        take: HISTORY_LIMIT,
        select: {
          id: true,
          url: true,
          strategy: true,
          scores: true,
          fetchedAt: true,
        },
      }),
      buildUsage(tenant.tenantId),
    ]);

    const audits: LighthouseHistoryRow[] = rows.map((row) => ({
      id: row.id,
      url: row.url,
      strategy: row.strategy as LighthouseStrategy,
      scores: row.scores as unknown as CategoryScores,
      fetchedAt: row.fetchedAt.toISOString(),
    }));

    return NextResponse.json({ audits, usage });
  } catch (err) {
    return lighthouseRouteError(err);
  }
}
