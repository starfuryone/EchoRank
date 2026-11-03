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
 * Phase 4a views, same auth and streaming:
 *   ?view=broken-links — one row per (source URL, broken URL, anchor, status);
 *   ?view=redirects    — every redirecting URL with each hop and its status.
 * No view (or ?view=issues) is the issue export above.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { crawlRouteError } from "@/lib/site-crawler/http";
import { csvFilename } from "@/lib/csv-export";
import { csvStreamResponse } from "@/lib/csv-stream";
import {
  BROKEN_LINK_COLUMNS,
  ISSUE_COLUMNS,
  REDIRECT_CHAIN_COLUMNS,
  type BrokenLinkRow,
  type CrawlIssueRow,
  type RedirectChainRow,
} from "@/lib/site-crawler/csv-columns";
import { brokenLinksPage, redirectChainsPage } from "@/lib/site-crawler/link-graph";

const VIEWS = ["issues", "broken-links", "redirects"] as const;

export async function GET(
  request: Request,
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

    const view = new URL(request.url).searchParams.get("view") ?? "issues";
    if (!(VIEWS as readonly string[]).includes(view)) {
      return NextResponse.json({ error: "Unknown view", code: "INVALID_REQUEST" }, { status: 400 });
    }
    if (view === "broken-links") {
      return csvStreamResponse<BrokenLinkRow>({
        columns: BROKEN_LINK_COLUMNS,
        filename: csvFilename("site-crawler-broken-links"),
        cursorOf: (row) => row.id,
        fetchPage: (cursor, take) => brokenLinksPage(crawl.id, cursor, take),
      });
    }
    if (view === "redirects") {
      return csvStreamResponse<RedirectChainRow>({
        columns: REDIRECT_CHAIN_COLUMNS,
        filename: csvFilename("site-crawler-redirects"),
        cursorOf: (row) => row.id,
        fetchPage: (cursor, take) => redirectChainsPage(crawl.id, cursor, take),
      });
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
