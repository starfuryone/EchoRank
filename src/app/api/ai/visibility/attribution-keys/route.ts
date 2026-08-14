// Session-side management of publishable er_pub_ site keys for the AI Lead
// Attribution tool page. Paid-gated; keys are scoped to the caller's own tenant.
// Mirrors ../api-keys/route.ts — same guard chain, same error mapping.
import { NextRequest, NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { enforcementErrorResponse } from "@/lib/plan-enforcement";
import { createAttributionKey, listAttributionKeys } from "@/lib/attribution/keys";

function mapError(error: unknown, tag: string): NextResponse {
  const resp = enforcementErrorResponse(error);
  if (resp) return resp;
  if (error instanceof Error && error.message === "Not authenticated or no tenant access") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  console.error(tag, error);
  return NextResponse.json({ error: "Request failed." }, { status: 500 });
}

export async function GET() {
  try {
    const membership = await requirePaidPlan();
    return NextResponse.json({ keys: await listAttributionKeys(membership.tenantId) });
  } catch (error) {
    return mapError(error, "[attribution-keys GET]");
  }
}

export async function POST(request: NextRequest) {
  try {
    const membership = await requirePaidPlan();
    const body = await request.json().catch(() => ({}));
    const label = typeof body?.label === "string" ? body.label : "";
    const issued = await createAttributionKey(membership.tenantId, label);
    // Returned exactly once and never logged. Unlike an er_api_ key this one
    // then lives in the customer's page source, so "lost it" is recoverable by
    // reading their own HTML — but we still cannot re-serve it from here.
    return NextResponse.json(issued, { status: 201 });
  } catch (error) {
    return mapError(error, "[attribution-keys POST]");
  }
}
