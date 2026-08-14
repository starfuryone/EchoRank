// Revoke a publishable site key (idempotent), scoped to the caller's own
// tenant. Revoking also drops the collector's Redis cache entry for that key —
// see revokeAttributionKey() — so the snippet stops writing immediately rather
// than at the end of the cache TTL.
import { NextRequest, NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { enforcementErrorResponse } from "@/lib/plan-enforcement";
import { revokeAttributionKey } from "@/lib/attribution/keys";

export async function POST(request: NextRequest) {
  try {
    const membership = await requirePaidPlan();
    const body = await request.json().catch(() => ({}));
    const keyId = typeof body?.id === "string" ? body.id : "";
    if (!keyId) {
      return NextResponse.json({ error: "id_required" }, { status: 400 });
    }
    const revoked = await revokeAttributionKey(membership.tenantId, keyId);
    return NextResponse.json({ revoked });
  } catch (error) {
    const resp = enforcementErrorResponse(error);
    if (resp) return resp;
    if (error instanceof Error && error.message === "Not authenticated or no tenant access") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[attribution-keys/revoke POST]", error);
    return NextResponse.json({ error: "Failed to revoke key." }, { status: 500 });
  }
}
