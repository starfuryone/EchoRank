// src/app/api/agency/funnels/[id]/leads/export/route.ts
//
// One funnel's leads as a CSV.
//
// Not streamed: LEADS_EXPORT_CAP bounds this at 5,000 rows of four short
// columns, well under a megabyte. The streaming path elsewhere in the app
// exists for tables with no ceiling.
//
// UNLIKE THE SCANNER'S EXPORT, THIS ONE CAN TRUNCATE. A funnel has no upper
// bound on captured leads the way a scan batch has MAX_BATCH_ROWS, so the cap
// here is a real cut and the file says so via truncationNotice(). A silent
// truncation looks exactly like a complete export to whoever opens it, and the
// person most likely to hit 5,000 leads is the one whose missing tail matters
// most.

import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { requireFeature, enforcementErrorResponse } from "@/lib/plan-enforcement";
import { leadsForExport, LEADS_EXPORT_CAP } from "@/lib/funnel/store";
import { LEAD_CSV_COLUMNS } from "@/lib/funnel/csv";
import {
  toCsv,
  csvFilename,
  contentDisposition,
  truncationNotice,
} from "@/lib/csv-export";
import { logger } from "@/infrastructure/observability/logger";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const membership = await requireTenant();
    await requireFeature("whitelabel");

    const { id } = await params;
    const result = await leadsForExport(membership.tenantId, id);
    if (!result) return NextResponse.json({ error: "Funnel not found." }, { status: 404 });

    let body = toCsv(result.rows, LEAD_CSV_COLUMNS);
    if (result.truncated) {
      body += truncationNotice(LEAD_CSV_COLUMNS, LEADS_EXPORT_CAP) + "\r\n";
    }

    return new NextResponse(body, {
      headers: {
        // charset=utf-8 alongside the BOM toCsv writes. Both are cheap next to
        // the support thread that follows an export of accented names arriving
        // as mojibake.
        "Content-Type": "text/csv; charset=utf-8",
        // The filename carries OUR slug, not the agency's, and that is correct:
        // this file is downloaded by the agency into their own machine, not
        // handed to a prospect. The white-label filename rule applies to the
        // outreach artifacts a stranger receives — see the note in
        // src/app/api/agency/scan/[id]/rows/[rowId]/report/route.ts.
        "Content-Disposition": contentDisposition(csvFilename("funnel-leads")),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const gated = enforcementErrorResponse(error);
    if (gated) return gated;
    logger.error({ err: error }, "[agency/funnels/:id/leads/export GET]");
    return NextResponse.json({ error: "Could not export those leads." }, { status: 500 });
  }
}
