/**
 * GET /api/seo/v1/ai-lens/[id] — one stored analysis.
 *
 * findFirst scoped by { id, tenantId }, never findUnique by id: the id is a cuid
 * supplied by the caller, and a cross-tenant read is exactly what the tenant
 * scope in the where clause exists to prevent. Reading a stored analysis costs
 * nothing and never touches the monthly allowance.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { toDto } from "@/lib/ai-lens/service";
import { aiLensRouteError } from "@/lib/ai-lens/http";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenant = await requirePaidPlan();
    const { id } = await params;

    const row = await prisma.aiLensAnalysis.findFirst({
      where: { id, tenantId: tenant.tenantId },
    });
    if (!row) {
      return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ analysis: toDto(row) });
  } catch (err) {
    return aiLensRouteError(err);
  }
}
