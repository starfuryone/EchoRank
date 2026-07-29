/**
 * GET /api/seo/v1/lighthouse/[id] — one stored audit, for the history list's
 * "View" action. Runs nothing: this only reads the row.
 *
 * Tenant-scoped by construction: the lookup filters on BOTH id and the
 * caller's tenantId, so another workspace's audit id is a 404, never a leak.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { toAuditDto } from "@/lib/lighthouse/service";
import { lighthouseRouteError } from "@/lib/lighthouse/http";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenant = await requirePaidPlan();
    const { id } = await params;

    const row = await prisma.lighthouseAudit.findFirst({
      where: { id, tenantId: tenant.tenantId },
    });

    if (!row) {
      return NextResponse.json(
        { error: "Audit not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    return NextResponse.json(toAuditDto(row));
  } catch (err) {
    return lighthouseRouteError(err);
  }
}
