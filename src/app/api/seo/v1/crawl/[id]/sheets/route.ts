/**
 * POST /api/seo/v1/crawl/[id]/sheets { spreadsheet? } — "Export to Sheets"
 * (Phase 4c, crawl.sheets). Writes Summary / Issues / Pages / Compare to the
 * spreadsheet given (URL or ID) or to a new one, with the tenant's Google
 * connection. The latest comparison of this crawl fills Compare.
 *
 *   200 { spreadsheetId, url, pages }
 *   409 SHEETS_NOT_CONNECTED | SHEETS_SCOPE_MISSING | SHEETS_REAUTH → { connectHref }
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { flag } from "@/lib/flags";
import { GscReauthError } from "@/lib/gsc/client";
import { crawlRouteError } from "@/lib/site-crawler/http";
import { SheetsNotConnectedError, SheetsScopeError, exportCrawlToSheets, spreadsheetIdOf, withSheetsClient } from "@/lib/site-crawler/sheets";

const CONNECT = "/api/seo/v1/crawl/sheets/connect";
const BodySchema = z.object({ spreadsheet: z.string().trim().max(300).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!flag("crawl.sheets")) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
    const tenant = await requirePaidPlan();
    const { id } = await params;
    const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
    const spreadsheetId = spreadsheetIdOf(parsed.success ? parsed.data.spreadsheet : "invalid");
    if (spreadsheetId === "invalid") return NextResponse.json({ error: "Not a spreadsheet URL or ID", code: "INVALID_REQUEST" }, { status: 400 });
    const crawl = await prisma.crawlJob.findFirst({ where: { id, tenantId: tenant.tenantId }, select: { id: true, status: true, dataPurgedAt: true } });
    if (!crawl) return NextResponse.json({ error: "Crawl not found", code: "NOT_FOUND" }, { status: 404 });
    if (crawl.status !== "COMPLETED" || crawl.dataPurgedAt) {
      return NextResponse.json({ error: "Only a completed crawl with its pages kept can be exported.", code: "NOT_EXPORTABLE" }, { status: 409 });
    }
    const cmp = await prisma.crawlComparison.findFirst({ where: { jobAId: crawl.id }, orderBy: { createdAt: "desc" }, select: { id: true } });
    const out = await withSheetsClient(tenant.tenantId, (client) =>
      exportCrawlToSheets({ tenantId: tenant.tenantId, crawlJobId: crawl.id, comparisonId: cmp?.id ?? null, spreadsheetId }, client),
    );
    return NextResponse.json(out);
  } catch (err) {
    if (err instanceof SheetsNotConnectedError || err instanceof SheetsScopeError) {
      return NextResponse.json({ error: err.message, code: err.code, connectHref: CONNECT }, { status: 409 });
    }
    if (err instanceof GscReauthError) {
      return NextResponse.json({ error: err.message, code: "SHEETS_REAUTH", connectHref: CONNECT }, { status: 409 });
    }
    return crawlRouteError(err);
  }
}
