// src/app/api/ai/visibility/brand-radar/route.ts
// Brand Radar summary — thin wrapper over the shared visibility-summary
// aggregation (src/lib/visibility-summary.ts), which the public v1 API and
// MCP tools also consume, so numbers never diverge between surfaces.
// Paid-gated; tenant-scoped from the session only.
import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { enforcementErrorResponse } from "@/lib/plan-enforcement";
import { getVisibilitySummary } from "@/lib/visibility-summary";

export async function GET() {
  try {
    const membership = await requirePaidPlan();
    const summary = await getVisibilitySummary(
      membership.tenantId,
      membership.tenant.name,
      membership.tenant.planType,
      membership.tenant.auditDomain,
    );
    return NextResponse.json(summary);
  } catch (error) {
    const resp = enforcementErrorResponse(error);
    if (resp) return resp;
    if (error instanceof Error && error.message === "Not authenticated or no tenant access") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[visibility/brand-radar GET]", error);
    return NextResponse.json({ error: "Failed to load brand radar." }, { status: 500 });
  }
}
