// GET /api/seo/v1/ai-citations/<id> — one stored lookup.
//
// Tenant-scoped in the SERVICE, with findFirst on both ids — never findUnique
// on the id alone. CLAUDE.md's rule for every route taking an :id, and this row
// holds a competitor comparison the customer paid for.
import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { requirePaidPlan } from "@/lib/paid-plan";
import { readAiCitationsAnalysis } from "@/lib/ai-citations/service";
import { aiCitationsRouteError } from "@/lib/ai-citations/http";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePaidPlan();
    const { tenantId } = await requireTenant();
    const { id } = await params;

    const analysis = await readAiCitationsAnalysis(tenantId, id);
    if (!analysis) {
      return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ analysis });
  } catch (err) {
    return aiCitationsRouteError(err);
  }
}
