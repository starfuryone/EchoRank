/**
 * GET /api/seo/v1/serp/check/[id] — one check, for the UI's 5 s poll.
 *
 * Tenant-scoped by construction: the lookup filters on BOTH id and the
 * caller's tenantId, so another workspace's check id is a 404, never a leak.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { toSerpCheckDto } from "@/lib/serp/service";
import { serpRouteError } from "@/lib/serp/http";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenant = await requirePaidPlan();
    const { id } = await params;

    const row = await prisma.serpCheck.findFirst({
      where: { id, tenantId: tenant.tenantId },
    });

    if (!row) {
      return NextResponse.json(
        { error: "SERP check not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    return NextResponse.json(toSerpCheckDto(row));
  } catch (err) {
    return serpRouteError(err);
  }
}
