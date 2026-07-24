// GET — connection status for the tool page. Includes the live property list
// only while no property is selected (the picker state). Never returns
// token material.
import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { enforcementErrorResponse } from "@/lib/plan-enforcement";
import { getConnection, listSitesFor } from "@/lib/gsc/service";
import { GscReauthError } from "@/lib/gsc/client";

export async function GET() {
  try {
    const membership = await requirePaidPlan();
    const conn = await getConnection(membership.tenantId);
    if (!conn) return NextResponse.json({ connected: false });

    let sites: { siteUrl: string }[] | undefined;
    if (!conn.siteUrl && conn.status === "ACTIVE") {
      try {
        sites = (await listSitesFor(conn)).map((s) => ({ siteUrl: s.siteUrl }));
      } catch (err) {
        if (!(err instanceof GscReauthError)) throw err;
        return NextResponse.json({ connected: true, status: "NEEDS_REAUTH", siteUrl: null });
      }
    }
    return NextResponse.json({
      connected: true,
      status: conn.status,
      siteUrl: conn.siteUrl,
      googleEmail: conn.googleEmail,
      connectedAt: conn.connectedAt,
      lastSyncAt: conn.lastSyncAt,
      sites,
    });
  } catch (error) {
    const resp = enforcementErrorResponse(error);
    if (resp) return resp;
    if (error instanceof Error && error.message === "Not authenticated or no tenant access") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[gsc/status GET]", error);
    return NextResponse.json({ error: "Failed to load status." }, { status: 500 });
  }
}
