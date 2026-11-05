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
import { wantsCsv } from "@/lib/csv-stream";
import { crawlCsvResponse } from "@/lib/site-crawler/export-store";
import { readStoredConfig } from "@/lib/site-crawler/crawl-config";
import { extractionColumns, type ExtractionRow } from "@/lib/site-crawler/csv-columns";
import { extractionColumnRefs, extractionKeysetPage, extractionOffsetPage, extractionWhere } from "@/lib/site-crawler/extraction-rows";
import { archivedGuard, crawlRouteError } from "@/lib/site-crawler/http";
import { DATA_STATE_SELECT } from "@/lib/site-crawler/data-state";
import { segmentScope } from "@/lib/site-crawler/segment-filter";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const tenant = await requirePaidPlan();
    const { id } = await params;
    const crawl = await prisma.crawlJob.findFirst({
      where: { id, tenantId: tenant.tenantId },
      select: { id: true, config: true, ...DATA_STATE_SELECT },
    });
    if (!crawl) return NextResponse.json({ error: "Crawl not found", code: "NOT_FOUND" }, { status: 404 });
    // The rows are in the archive: 409 ARCHIVED, never a query (data-state.ts).
    const archived = archivedGuard(crawl);
    if (archived) return archived;

    const config = readStoredConfig(crawl.config);
    // Phase 4e: extractors, then custom JS snippets, then AI prompts.
    const refs = extractionColumnRefs(config);
    const url = new URL(request.url);
    const scope = segmentScope(url, crawl.config);
    const segments = scope.defs;

    const extractorRaw = url.searchParams.get("extractor");
    const hasRaw = url.searchParams.get("has");
    const extractor = extractorRaw === null ? null : Number(extractorRaw);
    if (extractor !== null && !(Number.isInteger(extractor) && extractor >= 0 && extractor < refs.length)) {
      return NextResponse.json({ error: "Unknown extractor", code: "INVALID_REQUEST" }, { status: 400 });
    }
    if (hasRaw !== null && hasRaw !== "true" && hasRaw !== "false") {
      return NextResponse.json({ error: "has must be true or false", code: "INVALID_REQUEST" }, { status: 400 });
    }
    const where = extractionWhere(crawl.id, {
      extractor: extractor === null ? null : refs[extractor]!,
      has: hasRaw === null ? null : hasRaw === "true",
      segment: scope.index,
    });

    if (wantsCsv(url)) {
      return await crawlCsvResponse<ExtractionRow>({
        columns: extractionColumns(
          refs.map((c) => c.name),
          segments.length > 0,
        ),
        filename: csvFilename("site-crawler-extraction"),
        cursorOf: (row) => row.id,
        fetchPage: (cursor, take) => extractionKeysetPage(where, cursor, take, refs, segments),
      }, { tenantId: tenant.tenantId, crawlId: crawl.id, type: "extractions", request });
    }

    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(url.searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE));
    const { total, rows } = await extractionOffsetPage(where, page, pageSize, refs, segments);
    return NextResponse.json({
      extractors: refs.map((c) => ({ name: c.name, kind: c.kind === "extract" ? (config?.extractors[c.index]?.kind ?? "css") : c.kind })),
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
