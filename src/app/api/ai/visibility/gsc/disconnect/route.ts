// POST — delete the connection (encrypted token goes with the row).
// Synced GscQueryStat history is retained for Rank Tracker continuity.
import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { enforcementErrorResponse } from "@/lib/plan-enforcement";
import { disconnect } from "@/lib/gsc/service";

export async function POST() {
  try {
    const membership = await requirePaidPlan();
    await disconnect(membership.tenantId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const resp = enforcementErrorResponse(error);
    if (resp) return resp;
    if (error instanceof Error && error.message === "Not authenticated or no tenant access") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[gsc/disconnect POST]", error);
    return NextResponse.json({ error: "Failed to disconnect." }, { status: 500 });
  }
}
