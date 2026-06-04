import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireFeature, enforcementErrorResponse } from "@/lib/plan-enforcement";
import { createAuditLog } from "@/lib/audit";
import { addJob } from "@/infrastructure/queue/registry";
import { generateCorrelationId } from "@/infrastructure/observability/tracing";
import { commitImportSchema } from "@/monitoring/import/validation";
import type { Prisma, MonitoringPlatform } from "@/generated/prisma";

const IMPORT_FEATURE = "ai_analysis" as const;

// Stable externalId for the per-(tenant,platform) synthetic CSV source. The
// MonitoringSource unique key is (tenantId, platform, externalId), so all CSV
// imports for a given platform attach to one source row.
const CSV_SOURCE_EXTERNAL_ID = "csv-import";

const PLATFORM_LABELS: Record<string, string> = {
  GOOGLE: "Google",
  FACEBOOK: "Facebook",
  TRUSTPILOT: "Trustpilot",
  YELP: "Yelp",
  REDDIT: "Reddit",
  TWITTER: "Twitter",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  APP_STORE: "App Store",
  CUSTOM: "Custom",
};

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
 * POST /api/imports/[id]/commit — confirm the column mapping + platform, attach
 * the import to a synthetic MonitoringSource, and enqueue the csv-import worker.
 * The worker re-parses the staged content with the confirmed mapping and feeds
 * every row through the shared normalize → dedup → AI → reputation pipeline.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const membership = await requireTenant();
    const tenantId = membership.tenantId;
    await requireFeature(IMPORT_FEATURE);

    const { id } = await params;

    const body = await request.json();
    const parsed = commitImportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid mapping", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { mapping, platform, format, hasHeaderRow } = parsed.data;

    const importJob = await prisma.importJob.findFirst({
      where: { id, tenantId },
    });
    if (!importJob) {
      return NextResponse.json({ error: "Import not found" }, { status: 404 });
    }
    if (importJob.status !== "PENDING_MAPPING") {
      return NextResponse.json(
        { error: `Import is not awaiting mapping (status: ${importJob.status})` },
        { status: 409 },
      );
    }
    if (!importJob.rawContent) {
      return NextResponse.json(
        { error: "Staged file content has expired; please re-upload" },
        { status: 410 },
      );
    }

    // Upsert the synthetic CSV source for this (tenant, platform).
    const sourceName = `CSV Import (${PLATFORM_LABELS[platform] ?? platform})`;
    const source = await prisma.monitoringSource.upsert({
      where: {
        tenantId_platform_externalId: {
          tenantId,
          platform: platform as MonitoringPlatform,
          externalId: CSV_SOURCE_EXTERNAL_ID,
        },
      },
      update: { name: sourceName, isActive: true },
      create: {
        tenantId,
        platform: platform as MonitoringPlatform,
        externalId: CSV_SOURCE_EXTERNAL_ID,
        name: sourceName,
        credentials: {},
        // CSV sources are not polled; large interval keeps any scheduler away.
        checkInterval: 86_400,
        isActive: true,
      },
    });

    const correlationId = generateCorrelationId();

    await prisma.importJob.update({
      where: { id: importJob.id },
      data: {
        status: "QUEUED",
        platform: platform as MonitoringPlatform,
        format: format ?? importJob.format,
        hasHeaderRow,
        columnMapping: mapping as unknown as Prisma.InputJsonValue,
        sourceId: source.id,
      },
    });

    await addJob("csv-import", "import", { tenantId, importJobId: importJob.id, correlationId });

    await createAuditLog({
      tenantId,
      userId: membership.userId,
      action: "CREATE",
      entity: "ImportJob",
      entityId: importJob.id,
      details: { platform, format: format ?? importJob.format, filename: importJob.filename },
    });

    return NextResponse.json(
      { data: { importId: importJob.id, status: "QUEUED", sourceId: source.id } },
      { status: 202 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
