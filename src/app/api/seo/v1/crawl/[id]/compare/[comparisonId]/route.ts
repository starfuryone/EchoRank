/**
 * GET /api/seo/v1/crawl/[id]/compare/[comparisonId] — a stored comparison.
 *   ?bucket=added|removed|changed|issuesNew|issuesResolved&page=N — the full
 *   bucket, recomputed in SQL and paged (the stored result keeps 500 URLs);
 *   &format=csv streams the whole bucket as CSV.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { archivedGuard, crawlRouteError } from "@/lib/site-crawler/http";
import { DATA_STATE_SELECT } from "@/lib/site-crawler/data-state";

import { csvFilename } from "@/lib/csv-export";
import { csvStreamResponse, wantsCsv } from "@/lib/csv-stream";
import { COMPARE_BUCKETS, bucketCursor, comparisonBucket, storedCompareInput, type BucketRow, type CompareBucket } from "@/lib/site-crawler/compare";
import { compareColumns } from "@/lib/site-crawler/compare-csv";

const PAGE_SIZE = 100;

export async function GET(request: Request, { params }: { params: Promise<{ id: string; comparisonId: string }> }) {
  try {
    const tenant = await requirePaidPlan();
    const { id, comparisonId } = await params;
    const a = await prisma.crawlJob.findFirst({ where: { id, tenantId: tenant.tenantId }, select: { id: true, config: true, ...DATA_STATE_SELECT } });
    if (!a) return NextResponse.json({ error: "Crawl not found", code: "NOT_FOUND" }, { status: 404 });
    const row = await prisma.crawlComparison.findFirst({ where: { id: comparisonId, jobAId: a.id } });
    if (!row) return NextResponse.json({ error: "Comparison not found", code: "NOT_FOUND" }, { status: 404 });
    // Both crawls: the stored result needs neither, but the buckets read both sides' pages.
    const jobB = await prisma.crawlJob.findFirst({ where: { id: row.jobBId, tenantId: tenant.tenantId }, select: DATA_STATE_SELECT });
    const archived = archivedGuard(a) ?? (jobB ? archivedGuard(jobB) : null);
    if (archived) return archived;

    const url = new URL(request.url);
    const bucket = url.searchParams.get("bucket");
    if (bucket === null) return NextResponse.json(row);
    if (!(COMPARE_BUCKETS as readonly string[]).includes(bucket)) {
      return NextResponse.json({ error: "Unknown bucket", code: "INVALID_REQUEST" }, { status: 400 });
    }
    const b = bucket as CompareBucket;
    const input = await storedCompareInput(row, a.config);

    if (wantsCsv(url)) {
      return csvStreamResponse<BucketRow>({
        columns: compareColumns(b),
        filename: csvFilename(`site-crawler-compare-${b}`),
        cursorOf: bucketCursor,
        // Each chunk recomputes both sides; large chunks keep that to a handful.
        chunkSize: 5_000,
        fetchPage: (cursor, take) => comparisonBucket(input, b, cursor, take),
      });
    }

    // Paged by keyset: ?after=<cursor> from the previous page's `next`.
    const after = url.searchParams.get("after");
    const rows = await comparisonBucket(input, b, after, PAGE_SIZE + 1);
    const more = rows.length > PAGE_SIZE;
    const page = rows.slice(0, PAGE_SIZE);
    return NextResponse.json({ bucket: b, rows: page, next: more ? bucketCursor(page[page.length - 1]!) : null });
  } catch (err) {
    return crawlRouteError(err);
  }
}
