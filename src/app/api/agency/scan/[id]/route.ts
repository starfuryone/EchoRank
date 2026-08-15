// src/app/api/agency/scan/[id]/route.ts
//
// One batch and its rows. Polled by the client while the batch is running.
//
// TENANT-SCOPED THROUGH THE STORE, never here. getBatch and listRows both take
// (tenantId, batchId) and filter on the ScanBatch relation — this route never
// touches prisma.scanRow, which has no tenantId of its own and would answer a
// bare batchId query with another agency's prospect list. See the header on
// src/lib/opportunity-scanner/store.ts.

import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { requireFeature, enforcementErrorResponse } from "@/lib/plan-enforcement";
import { getBatch, listRows } from "@/lib/opportunity-scanner/store";
import { logger } from "@/infrastructure/observability/logger";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const membership = await requireTenant();
    await requireFeature("whitelabel");

    const { id } = await params;
    const batch = await getBatch(membership.tenantId, id);
    // 404 rather than 403 for a batch belonging to someone else. The tenant
    // scoping already makes them indistinguishable to the query; saying
    // "forbidden" would confirm the id exists.
    if (!batch) {
      return NextResponse.json({ error: "Scan not found." }, { status: 404 });
    }

    return NextResponse.json({
      batch,
      rows: await listRows(membership.tenantId, id),
    });
  } catch (error) {
    const gated = enforcementErrorResponse(error);
    if (gated) return gated;
    logger.error({ err: error }, "[agency/scan/:id GET]");
    return NextResponse.json({ error: "Could not load that scan." }, { status: 500 });
  }
}
