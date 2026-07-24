// src/app/api/ai/visibility/keywords/route.ts
// Dashboard keyword suggester ("Keywords Explorer" in the SEO Tools hub) —
// full sidecar response, site depth, optional AI enhancement. Gated on an
// ACTIVE paid subscription (requirePaidPlan) like the rest of the hub: every
// paid tier — including STARTER, which lacks the ai_visibility feature —
// can use it; trial/canceled tenants get 403. The anonymous landing widget
// (/api/av/keywords) is a separate, untouched public surface.
//
// v1 does not persist results: there is no keyword-shaped model in the schema
// (VisibilityAudit stores score/checks) — results are returned to the client
// only. Revisit if a KeywordScan model is added.
import { NextRequest, NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { enforcementErrorResponse } from "@/lib/plan-enforcement";
import { sidecarPost } from "@/lib/av-sidecar";

interface KeywordsResponse {
  seed_keywords?: unknown[];
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    await requirePaidPlan();

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
