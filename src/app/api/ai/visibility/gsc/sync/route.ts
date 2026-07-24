// POST — manual "Sync now": pulls the 3 most recent available days into
// GscQueryStat (idempotent upserts). Rate-limited per tenant: 3/hour.
import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { enforcementErrorResponse } from "@/lib/plan-enforcement";
import { rateLimit } from "@/lib/rate-limit";
import { getConnection, latestAvailableDay, syncDay } from "@/lib/gsc/service";
import { GscReauthError } from "@/lib/gsc/client";

export async function POST() {
  try {
    const membership = await requirePaidPlan();
    const rl = await rateLimit(`gsc-sync:${membership.tenantId}`, 3, 3_600_000);
    if (!rl.success) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    const conn = await getConnection(membership.tenantId);
    if (!conn) return NextResponse.json({ error: "not_connected" }, { status: 400 });
    if (!conn.siteUrl) return NextResponse.json({ error: "no_property" }, { status: 400 });

    const end = latestAvailableDay();
    let rows = 0;
    for (let i = 2; i >= 0; i--) {
      const day = new Date(Date.parse(end) - i * 86_400_000).toISOString().slice(0, 10);
      rows += await syncDay(conn, day);
    }
    return NextResponse.json({ ok: true, rows });
  } catch (error) {
    if (error instanceof GscReauthError) {
      return NextResponse.json({ error: "needs_reauth" }, { status: 409 });
    }
    const resp = enforcementErrorResponse(error);
    if (resp) return resp;
    if (error instanceof Error && error.message === "Not authenticated or no tenant access") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[gsc/sync POST]", error);
    return NextResponse.json({ error: "Sync failed." }, { status: 500 });
  }
}
