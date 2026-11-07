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
    // scoreVersion: 1 = the seven-check score (until Nov 2026), 2 = the AI
    // readiness score. Compare scores only within one version.
    select: { url: true, score: true, grade: true, scoreVersion: true, checks: true, createdAt: true },
  });
  if (!audit) {
    return NextResponse.json({ error: "no_audit_yet" }, { status: 404 });
  }
  return NextResponse.json(audit);
}
