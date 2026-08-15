// src/app/api/agency/scan/[id]/rows/[rowId]/report/route.ts
//
// The outreach PDF for one prospect: assemble, POST to the sidecar's
// /outreach-report, stream the bytes back. Nothing is written to disk.
//
// Same shape as /api/intelligence/report and /api/av/audit/report, with two
// differences that both come from who reads the output.
//
// ── 1. It is white-labeled, so it must not leak our brand ───────────────────
// brandingFor() assembles the tenant's identity and the sidecar renders the
// whole document — header, footer and PDF metadata — from it. The
// Content-Disposition filename comes from the sidecar too, for the same reason:
// report_filename() prefixes "Echorank-360-", and a file called
// Echorank-360-something landing in a prospect's downloads folder undoes the
// feature more completely than anything visible on the page would.
//
// ── 2. The prospect is not our customer ─────────────────────────────────────
// Every other report route renders a tenant's own data. This one renders a
// third party's, which is why the row is fetched tenant-scoped through
// getRow(tenantId, batchId, rowId) — three ids, all checked — rather than by
// the rowId in the URL. That id is a cuid an agency can read off its own screen
// and change one character of.
//
// A row that has not finished has no score and no gaps, so it 409s rather than
// rendering an empty report. An agency that mails a prospect a PDF full of
// blanks does not get a second chance with them.

import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { requireFeature, enforcementErrorResponse } from "@/lib/plan-enforcement";
import { getRow } from "@/lib/opportunity-scanner/store";
import { brandingFor } from "@/lib/opportunity-scanner/branding";
import { logger } from "@/infrastructure/observability/logger";

const SIDECAR_URL = process.env.AV_SIDECAR_URL ?? "http://127.0.0.1:4500";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? "";

/**
 * The sidecar renders under a 30s budget on a two-worker pool. 45s here leaves
 * room for that plus the queue ahead of it without holding a browser request
 * open indefinitely — and it must stay under Cloudflare's 100s proxy timeout,
 * which is the ceiling this whole path actually lives under.
 */
const REPORT_TIMEOUT_MS = 45_000;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; rowId: string }> },
) {
  try {
    const membership = await requireTenant();
    await requireFeature("whitelabel");

    const { id, rowId } = await params;
    const row = await getRow(membership.tenantId, id, rowId);
    if (!row) {
      return NextResponse.json({ error: "Prospect not found." }, { status: 404 });
    }
    if (row.status !== "done" || row.score === null) {
      return NextResponse.json(
        { error: "That prospect has not finished scanning yet." },
        { status: 409 },
      );
    }

    const branding = await brandingFor(membership.tenantId);

    let res: Response;
    try {
      res = await fetch(`${SIDECAR_URL}/outreach-report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Secret": INTERNAL_SECRET,
        },
        body: JSON.stringify({
          domain: row.domain,
          score: row.score,
          grade: row.grade,
          topGaps: row.topGaps,
          place: row.place,
          branding,
        }),
        signal: AbortSignal.timeout(REPORT_TIMEOUT_MS),
        cache: "no-store",
      });
    } catch {
      return NextResponse.json(
        { error: "Report service is unavailable." },
        { status: 502 },
      );
    }

    if (!res.ok) {
      logger.error(
        { status: res.status, rowId, batchId: id },
        "[agency/scan report] sidecar refused",
      );
      return NextResponse.json({ error: "Could not build that report." }, { status: 502 });
    }

    return new NextResponse(await res.arrayBuffer(), {
      headers: {
        "Content-Type": "application/pdf",
        // Forwarded verbatim from the sidecar, which built it from the
        // prospect's domain with no house prefix. Falling back to a name
        // constructed here would have to duplicate that rule.
        "Content-Disposition":
          res.headers.get("content-disposition") ??
          `attachment; filename="ai-visibility-snapshot.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const gated = enforcementErrorResponse(error);
    if (gated) return gated;
    logger.error({ err: error }, "[agency/scan report GET]");
    return NextResponse.json({ error: "Could not build that report." }, { status: 500 });
  }
}
