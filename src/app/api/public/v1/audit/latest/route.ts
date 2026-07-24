// GET /api/public/v1/audit/latest — the tenant's most recent stored
// AI-visibility audit (existing VisibilityAudit data; no re-audit).
import { NextRequest, NextResponse } from "next/server";
import { authenticatePublicRequest } from "@/lib/api-keys";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const auth = await authenticatePublicRequest(req);
  if (!auth.ok) return auth.response;

  const audit = await prisma.visibilityAudit.findFirst({
    where: { tenantId: auth.tenantId },
    orderBy: { createdAt: "desc" },
    select: { url: true, score: true, grade: true, checks: true, createdAt: true },
  });
  if (!audit) {
    return NextResponse.json({ error: "no_audit_yet" }, { status: 404 });
  }
  return NextResponse.json(audit);
}
