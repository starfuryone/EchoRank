/**
 * GET /api/seo/v1/crawl/[id]/export — issues as CSV.
 *
 * STREAMED, NOT BUFFERED. A 25,000-URL crawl can carry six figures of issues,
 * and building that string in memory before responding is exactly the shape
 * this feature is meant to avoid on a shared box. The body is a
 * ReadableStream that pages through Postgres with a keyset cursor and emits
 * each chunk as it goes, so peak memory is one page of rows regardless of how
 * large the export is.
 *
 * Keyset (`id > cursor`) rather than OFFSET: at a hundred thousand rows an
 * offset scan re-reads everything it skipped on every page.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { crawlRouteError } from "@/lib/site-crawler/http";

/** Rows fetched per round trip. Peak memory is one of these. */
const CHUNK_SIZE = 500;

const HEADER = "severity,type,url,status_code,detail\n";

/** RFC 4180: quote every field, double any embedded quote. */
function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenant = await requirePaidPlan();
    const { id } = await params;

    const crawl = await prisma.crawlJob.findFirst({
      where: { id, tenantId: tenant.tenantId },
      select: { id: true, rootUrl: true },
    });
    if (!crawl) {
      return NextResponse.json({ error: "Crawl not found", code: "NOT_FOUND" }, { status: 404 });
    }

    const encoder = new TextEncoder();
    let cursor: string | null = null;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(HEADER));
      },
      async pull(controller) {
        try {
          const rows = await prisma.crawlIssue.findMany({
            where: {
              crawlPage: { crawlJobId: crawl.id },
              ...(cursor ? { id: { gt: cursor } } : {}),
            },
            orderBy: { id: "asc" },
            take: CHUNK_SIZE,
            select: {
              id: true,
              type: true,
              severity: true,
              detail: true,
              crawlPage: { select: { url: true, statusCode: true } },
            },
          });

          if (rows.length === 0) {
            controller.close();
            return;
          }

          let chunk = "";
          for (const row of rows) {
            chunk +=
              [
                csvCell(row.severity),
                csvCell(row.type),
                csvCell(row.crawlPage.url),
                csvCell(row.crawlPage.statusCode),
                csvCell(row.detail),
              ].join(",") + "\n";
          }
          controller.enqueue(encoder.encode(chunk));

          cursor = rows[rows.length - 1]!.id;
          if (rows.length < CHUNK_SIZE) controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    const filename = `crawl-${crawl.id}-issues.csv`;
    return new Response(stream, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    return crawlRouteError(err);
  }
}
