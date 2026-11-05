/**
 * GET /api/seo/v1/crawl/[id]/external — the External tab (Phase 4g,
 * crawl.externalLinks): one row per distinct outbound URL, most-linked
 * first, with its status (resolved once per crawl), how many pages link to
 * it and the first anchor text.
 *
 *   ?status=2xx|3xx|4xx|5xx|none  &host=example.org  &page=&pageSize=
 *   ?url=<external url>           → the pages linking to it (the expandable row)
 *   ?format=csv                   → every row, keyset-streamed
 *
 * Tenant-scoped on the parent crawl. AUTHENTICATED — do not add
 * /api/seo/v1/* to publicPaths in src/proxy.ts.
 */
import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { flag } from "@/lib/flags";
import { csvFilename } from "@/lib/csv-export";
import { csvStreamResponse, wantsCsv } from "@/lib/csv-stream";
import { externalColumns } from "@/lib/site-crawler/csv-columns";
import { EXTERNAL_STATUS_CLASSES, externalCount, externalRows, externalSources, type ExternalRow, type ExternalStatusClass } from "@/lib/site-crawler/external-links";
import { archivedGuard, crawlRouteError } from "@/lib/site-crawler/http";
import { DATA_STATE_SELECT } from "@/lib/site-crawler/data-state";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const SOURCES_SHOWN = 100;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!flag("crawl.externalLinks")) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
    const tenant = await requirePaidPlan();
    const { id } = await params;
    const crawl = await prisma.crawlJob.findFirst({ where: { id, tenantId: tenant.tenantId }, select: { id: true, ...DATA_STATE_SELECT } });
    if (!crawl) return NextResponse.json({ error: "Crawl not found", code: "NOT_FOUND" }, { status: 404 });
    // The rows are in the archive: 409 ARCHIVED, never a query (data-state.ts).
    const archived = archivedGuard(crawl);
    if (archived) return archived;

    const url = new URL(request.url);
    const target = url.searchParams.get("url");
    if (target !== null) {
      if (target.length > 2048) return NextResponse.json({ error: "URL too long", code: "INVALID_REQUEST" }, { status: 400 });
      return NextResponse.json({ url: target, sources: await externalSources(crawl.id, target, SOURCES_SHOWN), limit: SOURCES_SHOWN });
    }
    const statusRaw = url.searchParams.get("status");
    if (statusRaw !== null && !(EXTERNAL_STATUS_CLASSES as readonly string[]).includes(statusRaw)) {
      return NextResponse.json({ error: "status must be 2xx, 3xx, 4xx, 5xx or none", code: "INVALID_REQUEST" }, { status: 400 });
    }
    const hostRaw = url.searchParams.get("host")?.trim().toLowerCase() || null;
    if (hostRaw !== null && !/^[a-z0-9.-]{1,253}$/.test(hostRaw)) {
      return NextResponse.json({ error: "Invalid host", code: "INVALID_REQUEST" }, { status: 400 });
    }
    const filter = { statusClass: statusRaw as ExternalStatusClass | null, host: hostRaw };

    if (wantsCsv(url)) {
      return csvStreamResponse<ExternalRow>({
        columns: externalColumns(),
        filename: csvFilename("site-crawler-external-links"),
        cursorOf: (row) => row.url,
        fetchPage: (cursor, take) => externalRows(crawl.id, filter, { after: cursor, take }),
      });
    }
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(url.searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE));
    const [total, rows] = await Promise.all([externalCount(crawl.id, filter), externalRows(crawl.id, filter, { offset: (page - 1) * pageSize, take: pageSize })]);
    return NextResponse.json({ rows, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (err) {
    return crawlRouteError(err);
  }
}
