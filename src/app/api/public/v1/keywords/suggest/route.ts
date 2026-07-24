// GET /api/public/v1/keywords/suggest?url=...&depth=single|site
// Public API wrapper over the existing keyword suggester (sidecar /keywords).
// Bearer API key → tenant; paid plan required; per-key rate limit. AI
// enhancement is not exposed here (cost control) — heuristic pipeline only.
import { NextRequest, NextResponse } from "next/server";
import { authenticatePublicRequest } from "@/lib/api-keys";
import { sidecarPost } from "@/lib/av-sidecar";

export async function GET(req: NextRequest) {
  const auth = await authenticatePublicRequest(req);
  if (!auth.ok) return auth.response;

  const url = (req.nextUrl.searchParams.get("url") ?? "").trim();
  if (!url) {
    return NextResponse.json({ error: "url_parameter_required" }, { status: 400 });
  }
  const depth = req.nextUrl.searchParams.get("depth") === "site" ? "site" : "single";

  const { status, data } = await sidecarPost<{ error?: string }>("/keywords", {
    url,
    depth,
    ai: false,
  });
  return NextResponse.json(data, { status });
}
