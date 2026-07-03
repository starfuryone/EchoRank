import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { requireFeature, enforcementErrorResponse } from "@/lib/plan-enforcement";
import { sidecarPost } from "@/lib/av-sidecar";

export async function POST(request: NextRequest) {
  try {
    await requireTenant();
    await requireFeature("ai_visibility");

    const body = await request.json();
    const log = typeof body?.log === "string" ? body.log : "";
    const deploy = typeof body?.deploy === "string" ? body.deploy.trim() : "";
    if (!log.trim()) {
      return NextResponse.json({ error: "Paste access-log lines (Combined/CLF or Caddy JSON)." }, { status: 400 });
    }
    if (!deploy) {
      return NextResponse.json({ error: "Provide a deploy date (e.g. 2026-06-01)." }, { status: 400 });
    }

    const { status, data } = await sidecarPost("/attribute", {
      log,
      deploy,
      window_days: body?.window_days ?? null,
      fixed_urls: body?.fixed_urls ?? "",
      conversions: body?.conversions ?? "",
    });
    return NextResponse.json(data, { status });
  } catch (error) {
    const enforcement = enforcementErrorResponse(error);
    if (enforcement) return enforcement;
    if (error instanceof Error && error.message === "Not authenticated or no tenant access") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error running visibility attribution:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
