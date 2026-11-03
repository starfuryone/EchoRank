/**
 * GET /api/seo/v1/crawl/[id]/pages/[pageId]/inlinks — every crawled page that
 * links here, with the anchor text and rel=nofollow (Phase 4a, Inlinks panel).
 *
 * JSON: keyset-paged ({inlinks, next}); `?format=csv` streams them all.
 * Resolved once the crawl's link graph is joined (end of crawl): a running
 * crawl's page answers with what has been resolved so far, usually nothing.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { csvFilename } from "@/lib/csv-export";
import { csvStreamResponse, wantsCsv } from "@/lib/csv-stream";
import { crawlRouteError } from "@/lib/site-crawler/http";
import { INLINK_COLUMNS, type InlinkRow } from "@/lib/site-crawler/csv-columns";
import { inlinksPage } from "@/lib/site-crawler/link-graph";

const PAGE_SIZE = 100;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; pageId: string }> },
) {
  try {
    const tenant = await requirePaidPlan();
    const { id, pageId } = await params;
    const page = await prisma.crawlPage.findFirst({
      where: { id: pageId, crawlJobId: id, crawlJob: { tenantId: tenant.tenantId } },
      select: { id: true, crawlJobId: true, url: true, inlinkCount: true },
    });
    if (!page) {
      return NextResponse.json({ error: "Page not found", code: "NOT_FOUND" }, { status: 404 });
    }

    const url = new URL(request.url);
    if (wantsCsv(url)) {
      return csvStreamResponse<InlinkRow>({
        columns: INLINK_COLUMNS,
        filename: csvFilename("site-crawler-inlinks"),
        cursorOf: (row) => row.id,
        fetchPage: (cursor, take) => inlinksPage(page.crawlJobId, page.id, cursor, take),
      });
    }

    const cursor = url.searchParams.get("cursor");
    const rows = await inlinksPage(page.crawlJobId, page.id, cursor, PAGE_SIZE + 1);
    return NextResponse.json({
      url: page.url,
      inlinkCount: page.inlinkCount,
      inlinks: rows.slice(0, PAGE_SIZE),
      next: rows.length > PAGE_SIZE ? rows[PAGE_SIZE - 1]!.id : null,
    });
  } catch (err) {
    return crawlRouteError(err);
  }
}
