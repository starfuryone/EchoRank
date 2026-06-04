import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireFeature, enforcementErrorResponse } from "@/lib/plan-enforcement";

const IMPORT_FEATURE = "ai_analysis" as const;

function errorResponse(error: unknown): NextResponse {
  const enforcement = enforcementErrorResponse(error);
  if (enforcement) return enforcement;
  const message = error instanceof Error ? error.message : "Internal server error";
  if (message.includes("Not authenticated")) {
    return NextResponse.json({ error: message }, { status: 401 });
  }
  return NextResponse.json({ error: message }, { status: 500 });
}

/**
 * GET /api/imports/[id] — status + progress for one import. Used to poll while
 * the worker ingests. Returns detected columns + mapping so the wizard can be
 * rehydrated, but never the raw staged content.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const membership = await requireTenant();
    const tenantId = membership.tenantId;
    await requireFeature(IMPORT_FEATURE);

    const { id } = await params;

    const importJob = await prisma.importJob.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        filename: true,
        format: true,
        platform: true,
        status: true,
        hasHeaderRow: true,
        detectedColumns: true,
        columnMapping: true,
        totalRows: true,
        importedRows: true,
        duplicateRows: true,
        failedRows: true,
        errors: true,
        errorMessage: true,
        sourceId: true,
        createdAt: true,
        startedAt: true,
        completedAt: true,
      },
    });

    if (!importJob) {
      return NextResponse.json({ error: "Import not found" }, { status: 404 });
    }

    return NextResponse.json({ data: importJob });
  } catch (error) {
    return errorResponse(error);
  }
}
