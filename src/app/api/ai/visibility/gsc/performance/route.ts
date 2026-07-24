// GET — live 28-day performance for the tenant's selected property.
import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { enforcementErrorResponse } from "@/lib/plan-enforcement";
import { getConnection, getPerformance } from "@/lib/gsc/service";
import { GscReauthError } from "@/lib/gsc/client";

export async function GET() {
  try {
    const membership = await requirePaidPlan();
    const conn = await getConnection(membership.tenantId);
    if (!conn) return NextResponse.json({ error: "not_connected" }, { status: 400 });
    if (!conn.siteUrl) return NextResponse.json({ error: "no_property" }, { status: 400 });
    const perf = await getPerformance(conn);
    return NextResponse.json(perf);
  } catch (error) {
    if (error instanceof GscReauthError) {
      return NextResponse.json({ error: "needs_reauth" }, { status: 409 });
    }
    const resp = enforcementErrorResponse(error);
    if (resp) return resp;
    if (error instanceof Error && error.message === "Not authenticated or no tenant access") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[gsc/performance GET]", error);
    return NextResponse.json({ error: "Failed to load performance." }, { status: 500 });
  }
}
