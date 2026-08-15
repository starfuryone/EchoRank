// src/app/api/agency/funnels/[id]/leads/route.ts
//
// One funnel's captured leads, newest first, cursor-paginated.
//
// TENANT-SCOPED THROUGH THE STORE. listLeads() proves the funnel belongs to
// this tenant before it reads a single lead, and filters the leads on tenantId
// as well as funnelId — belt and braces on a table whose rows are email
// addresses somebody paid to collect. A bare funnelId query would hand one
// agency's prospect list to another on a guessed cuid.

import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { requireFeature, enforcementErrorResponse } from "@/lib/plan-enforcement";
import { listLeads, LEADS_PAGE_SIZE } from "@/lib/funnel/store";
import { logger } from "@/infrastructure/observability/logger";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const membership = await requireTenant();
    await requireFeature("whitelabel");

    const { id } = await params;
    const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;

    const page = await listLeads(membership.tenantId, id, cursor, LEADS_PAGE_SIZE);
    // Null means the funnel is not this tenant's. 404 rather than 403, so the
    // response cannot confirm that the id exists.
    if (!page) return NextResponse.json({ error: "Funnel not found." }, { status: 404 });

    return NextResponse.json(page);
  } catch (error) {
    const gated = enforcementErrorResponse(error);
    if (gated) return gated;
    logger.error({ err: error }, "[agency/funnels/:id/leads GET]");
    return NextResponse.json({ error: "Could not load those leads." }, { status: 500 });
  }
}
