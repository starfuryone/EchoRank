// src/app/api/ai/visibility/keywords/route.ts
// Dashboard keyword suggester — full sidecar response, site depth, optional
// AI enhancement. Gated on the ai_visibility feature (AI_VISIBILITY, GROWTH,
// AGENCY, ENTERPRISE plans), caller's own tenant only.
//
// v1 does not persist results: there is no keyword-shaped model in the schema
// (VisibilityAudit stores score/checks) — results are returned to the client
// only. Revisit if a KeywordScan model is added.
import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { requireFeature, enforcementErrorResponse } from "@/lib/plan-enforcement";
import { sidecarPost } from "@/lib/av-sidecar";

interface KeywordsResponse {
  seed_keywords?: unknown[];
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    await requireTenant();
    await requireFeature("ai_visibility");

    const body = await request.json();
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    if (!url) {
      return NextResponse.json({ error: "Enter a URL to analyze." }, { status: 400 });
    }
    const ai = body?.ai === true;

    const { status, data } = await sidecarPost<KeywordsResponse>("/keywords", {
      url,
      depth: "site",
      ai,
    });
    return NextResponse.json(data, { status });
  } catch (error) {
    const enforcement = enforcementErrorResponse(error);
    if (enforcement) return enforcement;
    if (error instanceof Error && error.message === "Not authenticated or no tenant access") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error running keyword suggestion:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
