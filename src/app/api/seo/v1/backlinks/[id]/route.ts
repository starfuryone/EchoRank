/**
 * GET /api/seo/v1/backlinks/[id] — one stored analysis, for the history list's
 * "View" action. Costs nothing: this only ever reads the row.
 *
 * Tenant-scoped by construction: the lookup filters on BOTH id and the
 * caller's tenantId, so another workspace's analysis id is a 404, never a leak.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { toAnalysisDto } from "@/lib/backlinks/service";
import { backlinksRouteError } from "@/lib/backlinks/http";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenant = await requirePaidPlan();
    const { id } = await params;

    const row = await prisma.backlinksAnalysis.findFirst({
      where: { id, tenantId: tenant.tenantId },
    });

    if (!row) {
      return NextResponse.json(
        { error: "Analysis not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    return NextResponse.json(toAnalysisDto(row));
  } catch (err) {
    return backlinksRouteError(err);
  }
}
