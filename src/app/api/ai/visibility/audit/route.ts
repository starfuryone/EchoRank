import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { enforcementErrorResponse } from "@/lib/plan-enforcement";
import { sidecarPost } from "@/lib/av-sidecar";

export async function POST(request: NextRequest) {
  try {
    await requireTenant();

    const body = await request.json();
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    if (!url) {
      return NextResponse.json({ error: "Enter a URL to audit." }, { status: 400 });
    }
    const crawl = body?.crawl !== false;

    const { status, data } = await sidecarPost("/audit", { url, crawl });
    return NextResponse.json(data, { status });
  } catch (error) {
    const enforcement = enforcementErrorResponse(error);
    if (enforcement) return enforcement;
    if (error instanceof Error && error.message === "Not authenticated or no tenant access") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error running visibility audit:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
