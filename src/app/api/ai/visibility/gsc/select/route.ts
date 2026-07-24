// POST {siteUrl} — pick a property. Validated against the tenant's own live
// GSC site list, so an arbitrary siteUrl cannot be attached.
import { NextRequest, NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { enforcementErrorResponse } from "@/lib/plan-enforcement";
import { getConnection, listSitesFor, selectSite } from "@/lib/gsc/service";

export async function POST(request: NextRequest) {
  try {
    const membership = await requirePaidPlan();
    const conn = await getConnection(membership.tenantId);
    if (!conn) return NextResponse.json({ error: "not_connected" }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const siteUrl = typeof body?.siteUrl === "string" ? body.siteUrl : "";
    const sites = await listSitesFor(conn);
    if (!sites.some((s) => s.siteUrl === siteUrl)) {
      return NextResponse.json({ error: "invalid_site" }, { status: 400 });
    }
    await selectSite(membership.tenantId, siteUrl);
    return NextResponse.json({ ok: true, siteUrl });
  } catch (error) {
    const resp = enforcementErrorResponse(error);
    if (resp) return resp;
    if (error instanceof Error && error.message === "Not authenticated or no tenant access") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[gsc/select POST]", error);
    return NextResponse.json({ error: "Failed to select property." }, { status: 500 });
  }
}
