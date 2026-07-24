// GET /api/public/v1/visibility/summary — same aggregation the Brand Radar
// page uses (src/lib/visibility-summary.ts). Trust score is not included
// anywhere because nothing persists one. /gsc/queries is intentionally NOT
// part of v1: no GSC connection exists in the product yet.
import { NextRequest, NextResponse } from "next/server";
import { authenticatePublicRequest } from "@/lib/api-keys";
import { getVisibilitySummary } from "@/lib/visibility-summary";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const auth = await authenticatePublicRequest(req);
  if (!auth.ok) return auth.response;

  const tenant = await prisma.tenant.findUnique({
    where: { id: auth.tenantId },
    select: { name: true, planType: true, auditDomain: true },
  });
  if (!tenant) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }
  const summary = await getVisibilitySummary(
    auth.tenantId,
    tenant.name,
    tenant.planType,
    tenant.auditDomain,
  );
  return NextResponse.json(summary);
}
