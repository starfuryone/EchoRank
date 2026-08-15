// src/app/api/agency/scan/[id]/export/route.ts
//
// The batch as a CSV.
//
// Not streamed, unlike the large exports elsewhere in the app: a batch is
// capped at MAX_BATCH_ROWS (1,000) by parse.ts, and 1,000 rows of fourteen
// short columns is well under a megabyte. The streaming path exists for tables
// with no ceiling; adding it here would be machinery guarding a bound that is
// already enforced two layers up. If MAX_BATCH_ROWS ever rises past a few
// thousand, this is the route that has to change.
//
// The truncationNotice helper is therefore not used, and that is correct rather
// than an omission — a file that cannot be truncated must not carry a line
// saying it might have been.

import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { requireFeature, enforcementErrorResponse } from "@/lib/plan-enforcement";
import { getBatch, listRows } from "@/lib/opportunity-scanner/store";
import { SCAN_CSV_COLUMNS } from "@/lib/opportunity-scanner/csv";
import { toCsv, csvFilename, contentDisposition } from "@/lib/csv-export";
import { logger } from "@/infrastructure/observability/logger";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const membership = await requireTenant();
    await requireFeature("whitelabel");

    const { id } = await params;
    const batch = await getBatch(membership.tenantId, id);
    if (!batch) {
      return NextResponse.json({ error: "Scan not found." }, { status: 404 });
    }

    const rows = await listRows(membership.tenantId, id);
    const body = toCsv(rows, SCAN_CSV_COLUMNS);

    return new NextResponse(body, {
      headers: {
        // charset=utf-8 alongside the BOM toCsv writes. Belt and braces, and
        // both are cheap next to the support thread that follows an export of
        // French company names arriving as mojibake.
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": contentDisposition(csvFilename("opportunity-scanner")),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const gated = enforcementErrorResponse(error);
    if (gated) return gated;
    logger.error({ err: error }, "[agency/scan/:id/export GET]");
    return NextResponse.json({ error: "Could not export that scan." }, { status: 500 });
  }
}
