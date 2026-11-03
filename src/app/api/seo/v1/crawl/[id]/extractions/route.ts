/**
 * GET /api/seo/v1/crawl/[id]/extractions — the Extraction tab (Phase 4b).
 *
 * One row per fetched HTML page: URL + what each of the crawl's extractors
 * found (null = nothing). Filters: ?extractor=N&has=true|false (extractor N
 * has a value / is empty), ?segment=N. ?format=csv streams the same rows
 * with one column per extractor, named as configured.
 *
 * Tenant-scoped on the parent crawl. The extractor names come from the
 * crawl's own config, so the columns are what this crawl ran with.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { csvFilename } from "@/lib/csv-export";
import { csvStreamResponse, wantsCsv } from "@/lib/csv-stream";
import { readStoredConfig } from "@/lib/site-crawler/crawl-config";
import { extractionColumns, type ExtractionRow } from "@/lib/site-crawler/csv-columns";
import { extractionKeysetPage, extractionOffsetPage, extractionWhere } from "@/lib/site-crawler/extraction-rows";
import { crawlRouteError } from "@/lib/site-crawler/http";
import { parseSegmentParam } from "@/lib/site-crawler/segments";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const tenant = await requirePaidPlan();
    const { id } = await params;
    const crawl = await prisma.crawlJob.findFirst({
      where: { id, tenantId: tenant.tenantId },
      select: { id: true, config: true },
    });
    if (!crawl) return NextResponse.json({ error: "Crawl not found", code: "NOT_FOUND" }, { status: 404 });

    const config = readStoredConfig(crawl.config);
    const extractors = config?.extractors ?? [];
    const segments = config?.segments ?? [];
    const url = new URL(request.url);

    const extractorRaw = url.searchParams.get("extractor");
    const hasRaw = url.searchParams.get("has");
    const extractor = extractorRaw === null ? null : Number(extractorRaw);
    if (extractor !== null && !(Number.isInteger(extractor) && extractor >= 0 && extractor < extractors.length)) {
      return NextResponse.json({ error: "Unknown extractor", code: "INVALID_REQUEST" }, { status: 400 });
    }
    if (hasRaw !== null && hasRaw !== "true" && hasRaw !== "false") {
      return NextResponse.json({ error: "has must be true or false", code: "INVALID_REQUEST" }, { status: 400 });
    }
    const where = extractionWhere(crawl.id, {
      extractor,
      has: hasRaw === null ? null : hasRaw === "true",
      segment: parseSegmentParam(url.searchParams.get("segment"), segments),
    });

    if (wantsCsv(url)) {
      return csvStreamResponse<ExtractionRow>({
        columns: extractionColumns(extractors.map((e) => e.name)),
        filename: csvFilename("site-crawler-extraction"),
        cursorOf: (row) => row.id,
        fetchPage: (cursor, take) => extractionKeysetPage(where, cursor, take, extractors.length, segments),
      });
    }

    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(url.searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE));
    const { total, rows } = await extractionOffsetPage(where, page, pageSize, extractors.length, segments);
    return NextResponse.json({
      extractors: extractors.map((e) => ({ name: e.name, kind: e.kind })),
      rows,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (err) {
    return crawlRouteError(err);
  }
}
