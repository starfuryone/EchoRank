/**
 * GET /api/seo/v1/crawl/[id]/export — every issue in a crawl, as CSV.
 *
 * NOW A THIN WRAPPER over the shared serializer. It previously carried its own
 * csvCell() and its own streaming loop, which meant it shipped without the
 * UTF-8 BOM (so Excel mangled every accented page title) and without the
 * formula-injection guard (so a crawled <title> beginning `=` reached a
 * spreadsheet as a formula). Both are fixed by delegating rather than by
 * patching a second copy — see src/lib/csv-export.ts.
 *
 * KEPT ALONGSIDE `?format=csv` on the issues route, and the difference is not
 * cosmetic: this endpoint exports the WHOLE crawl, the issues route exports
 * what the current severity/type filters match. The UI offers both, so
 * collapsing them would remove "give me everything" from a screen that is
 * usually filtered.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { crawlRouteError } from "@/lib/site-crawler/http";
import { csvFilename } from "@/lib/csv-export";
import { csvStreamResponse } from "@/lib/csv-stream";
import { ISSUE_COLUMNS, type CrawlIssueRow } from "@/lib/site-crawler/csv-columns";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenant = await requirePaidPlan();
    const { id } = await params;

    const crawl = await prisma.crawlJob.findFirst({
      where: { id, tenantId: tenant.tenantId },
      select: { id: true },
    });
    if (!crawl) {
      return NextResponse.json({ error: "Crawl not found", code: "NOT_FOUND" }, { status: 404 });
    }

    return csvStreamResponse<CrawlIssueRow>({
      columns: ISSUE_COLUMNS,
      filename: csvFilename("site-crawler-issues"),
      cursorOf: (row) => row.id,
      fetchPage: (cursor, take) =>
        prisma.crawlIssue.findMany({
          where: {
            crawlPage: { crawlJobId: crawl.id },
            ...(cursor ? { id: { gt: cursor } } : {}),
          },
          orderBy: { id: "asc" },
          take,
          select: {
            id: true,
            type: true,
            severity: true,
            detail: true,
            crawlPage: { select: { url: true, statusCode: true } },
          },
        }),
    });
  } catch (err) {
    return crawlRouteError(err);
  }
}
