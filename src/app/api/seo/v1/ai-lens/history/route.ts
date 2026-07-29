/**
 * GET /api/seo/v1/ai-lens/history — this tenant's recent analyses + usage.
 *
 * Tenant-scoped by the `where` clause, not by a filter applied afterwards.
 * Returns summary rows only: missingBlocks can be 60 entries of 300 chars, which
 * nothing on the history list renders.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import {
  AI_LENS_HISTORY_LIMIT,
  CROSS_DOMAIN_PLANS,
  aiLensVerdict,
} from "@/lib/ai-lens/options";
import { aiLensAnalysesUsed, aiLensLimit } from "@/lib/ai-lens/quota";
import { aiLensRouteError } from "@/lib/ai-lens/http";
import type { AiLensHistoryRow } from "@/lib/ai-lens/types";

export async function GET() {
  try {
    const tenant = await requirePaidPlan();

    const [rows, used] = await Promise.all([
      prisma.aiLensAnalysis.findMany({
        where: { tenantId: tenant.tenantId },
        orderBy: { createdAt: "desc" },
        take: AI_LENS_HISTORY_LIMIT,
        select: {
          id: true,
          url: true,
          gapPercent: true,
          renderedWordCount: true,
          meta: true,
          createdAt: true,
        },
      }),
      aiLensAnalysesUsed(tenant.tenantId),
    ]);

    const analyses: AiLensHistoryRow[] = rows.map((row) => {
      const gapPercent = Number(row.gapPercent);
      return {
        id: row.id,
        url: row.url,
        gapPercent,
        verdict: aiLensVerdict(gapPercent),
        renderedWordCount: row.renderedWordCount,
        missingBlockCount:
          ((row.meta as unknown as { missing_block_count?: number } | null)
            ?.missing_block_count) ?? 0,
        createdAt: row.createdAt.toISOString(),
      };
    });

    return NextResponse.json({
      analyses,
      usage: {
        used,
        limit: aiLensLimit(tenant.tenant.planType),
        plan: tenant.tenant.planType,
        crossDomain: CROSS_DOMAIN_PLANS.includes(tenant.tenant.planType),
      },
    });
  } catch (err) {
    return aiLensRouteError(err);
  }
}
