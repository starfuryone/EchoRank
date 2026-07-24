// Session-side API-key management for the API access tool page.
// Paid-gated; keys are scoped to the caller's own tenant.
import { NextRequest, NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { enforcementErrorResponse } from "@/lib/plan-enforcement";
import { createApiKey, listApiKeys } from "@/lib/api-keys";

export async function GET() {
  try {
    const membership = await requirePaidPlan();
    return NextResponse.json({ keys: await listApiKeys(membership.tenantId) });
  } catch (error) {
    const resp = enforcementErrorResponse(error);
    if (resp) return resp;
    if (error instanceof Error && error.message === "Not authenticated or no tenant access") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[api-keys GET]", error);
    return NextResponse.json({ error: "Failed to list keys." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const membership = await requirePaidPlan();
    const body = await request.json().catch(() => ({}));
    const label = typeof body?.label === "string" ? body.label : "";
    const issued = await createApiKey(membership.tenantId, label);
    // The full key is returned exactly once and never logged.
    return NextResponse.json(issued, { status: 201 });
  } catch (error) {
    const resp = enforcementErrorResponse(error);
    if (resp) return resp;
    if (error instanceof Error && error.message === "Not authenticated or no tenant access") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[api-keys POST]", error);
    return NextResponse.json({ error: "Failed to create key." }, { status: 500 });
  }
}
