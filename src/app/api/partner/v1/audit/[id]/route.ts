// GET /api/partner/v1/audit/:id — an audit this key created, and only this key.
import { NextResponse } from "next/server";
import { authenticatePartnerRequest } from "@/lib/partner/auth";
import { toResponse } from "@/lib/partner/http";
import { partnerAuditById } from "@/lib/partner/service";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticatePartnerRequest(req);
    if (!auth.ok) return auth.response;
    const { id } = await params;
    return toResponse(await partnerAuditById(auth.ctx, id));
  } catch (err) {
    console.error("[partner audit GET]", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
