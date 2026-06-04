import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireFeature, enforcementErrorResponse } from "@/lib/plan-enforcement";
import { generateCorrelationId } from "@/infrastructure/observability/tracing";
import { parsePreview } from "@/monitoring/import/csv-parser";
import { detectFormat, suggestMapping } from "@/monitoring/import/source-presets";
import type { Prisma } from "@/generated/prisma";

// Max uploaded file size. Review exports are small; large files should move to
// object storage rather than being staged in the ImportJob row.
const MAX_IMPORT_BYTES = 5 * 1024 * 1024; // 5MB

// The feature gate. CSV import is the cheapest path to feeding the AI engine
// real data, so it is gated at the AI-analysis tier (GROWTH+) rather than the
// ENTERPRISE-only reputation_monitoring gate used by the live connectors.
// Change this single constant to re-tier.
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
 * GET /api/imports — import history for the current tenant (newest first).
 * Never returns rawContent.
 */
export async function GET(request: NextRequest) {
  try {
    const membership = await requireTenant();
    const tenantId = membership.tenantId;
    await requireFeature(IMPORT_FEATURE);

    const limit = Math.min(
      100,
      Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? 25)),
    );

    const imports = await prisma.importJob.findMany({
      where: { tenantId },
      select: {
        id: true,
        filename: true,
        format: true,
        platform: true,
        status: true,
        totalRows: true,
        importedRows: true,
        duplicateRows: true,
        failedRows: true,
        errorMessage: true,
        createdAt: true,
        completedAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ data: imports, total: imports.length });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * POST /api/imports — multipart upload. Parses headers + a small sample and
 * stages the raw text in a PENDING_MAPPING ImportJob. Returns the detected
 * columns, sample rows, and a suggested mapping for the wizard. Does NOT ingest
 * anything yet — that happens at commit.
 */
export async function POST(request: NextRequest) {
  try {
    const membership = await requireTenant();
    const tenantId = membership.tenantId;
    await requireFeature(IMPORT_FEATURE);

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Content-Type must be multipart/form-data" },
        { status: 400 },
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing 'file' field" }, { status: 400 });
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }
    if (file.size > MAX_IMPORT_BYTES) {
      return NextResponse.json(
        { error: `File too large. Maximum is ${MAX_IMPORT_BYTES} bytes` },
        { status: 413 },
      );
    }

    const hasHeaderRow = form.get("hasHeaderRow") !== "false";
    const rawContent = await file.text();

    const { columns, sampleRows, totalRows } = parsePreview(rawContent, hasHeaderRow);
    if (columns.length === 0 || totalRows === 0) {
      return NextResponse.json(
        { error: "Could not parse any rows from the file" },
        { status: 422 },
      );
    }

    const detected = detectFormat(columns);
    const suggestedMapping = suggestMapping(columns);

    const importJob = await prisma.importJob.create({
      data: {
        tenantId,
        filename: file.name || "upload.csv",
        format: detected.format,
        platform: detected.platform,
        status: "PENDING_MAPPING",
        rawContent,
        hasHeaderRow,
        detectedColumns: columns as unknown as Prisma.InputJsonValue,
        columnMapping: suggestedMapping as unknown as Prisma.InputJsonValue,
        totalRows,
        createdById: membership.userId,
      },
      select: { id: true, filename: true, format: true, platform: true, totalRows: true },
    });

    return NextResponse.json(
      {
        data: {
          importId: importJob.id,
          filename: importJob.filename,
          format: importJob.format,
          platform: importJob.platform,
          totalRows: importJob.totalRows,
          columns,
          sampleRows,
          suggestedMapping,
          correlationId: generateCorrelationId(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
