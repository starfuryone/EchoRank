// GET /api/seo/v1/ai-citations/history — this workspace's recent lookups.
// Read-only; never spends, and works even while the feature is not enabled,
// because a workspace's stored history does not depend on the provider.
import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { requirePaidPlan } from "@/lib/paid-plan";
import { listAiCitationsHistory } from "@/lib/ai-citations/service";
import { aiCitationsRouteError } from "@/lib/ai-citations/http";

export async function GET() {
  try {
    await requirePaidPlan();
    const { tenantId } = await requireTenant();
    return NextResponse.json({ items: await listAiCitationsHistory(tenantId) });
  } catch (err) {
    return aiCitationsRouteError(err);
  }
}
