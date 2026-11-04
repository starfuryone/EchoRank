// src/lib/site-crawler/extraction-rows.ts
//
// Reads for the Extraction tab and its CSV (Phase 4b): the crawl's HTML
// pages with what each extractor found, filtered by "extractor N has a
// value / is empty". Keyset-paged by page id for the CSV, offset-paged for
// the table.

import "server-only";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import type { ExtractionRow } from "./csv-columns";
import { segmentCell, type SegmentDef } from "./segments";

export interface ExtractionFilter {
  /** Extractor index the has/empty filter applies to. */
  extractor: number | null;
  has: boolean | null;
  /** Segment index (crawl_pages.segmentIds). */
  segment: number | null;
}

/** The pages an extractor ran on: every fetched HTML page. */
export function extractionWhere(jobId: string, f: ExtractionFilter): Prisma.CrawlPageWhereInput {
  return {
    crawlJobId: jobId,
    statusCode: { not: null },
    contentType: { contains: "html", mode: "insensitive" },
    ...(f.extractor !== null && f.has !== null
      ? { extractions: f.has ? { some: { kind: "extract", extractorIndex: f.extractor } } : { none: { kind: "extract", extractorIndex: f.extractor } } }
      : {}),
    ...(f.segment !== null ? { segmentIds: { has: f.segment } } : {}),
  };
}

const SELECT = {
  id: true,
  url: true,
  segmentIds: true,
  // Phase 4e: js and ai rows share the table; this tab's extractor columns are kind "extract".
  extractions: { where: { kind: "extract" }, select: { extractorIndex: true, values: true } },
} as const;

type Raw = { id: string; url: string; segmentIds: number[]; extractions: { extractorIndex: number; values: string[] }[] };

export function toExtractionRow(r: Raw, extractorCount: number, segments: readonly SegmentDef[]): ExtractionRow {
  const values: (string[] | null)[] = Array.from({ length: extractorCount }, () => null);
  for (const e of r.extractions) if (e.extractorIndex < extractorCount) values[e.extractorIndex] = e.values;
  return { id: r.id, url: r.url, values, segment: segmentCell(r.segmentIds, segments) };
}

export async function extractionKeysetPage(
  where: Prisma.CrawlPageWhereInput,
  cursor: string | null,
  take: number,
  extractorCount: number,
  segments: readonly SegmentDef[],
): Promise<ExtractionRow[]> {
  const rows = await prisma.crawlPage.findMany({
    where: { ...where, ...(cursor ? { id: { gt: cursor } } : {}) },
    orderBy: { id: "asc" },
    take,
    select: SELECT,
  });
  return rows.map((r) => toExtractionRow(r, extractorCount, segments));
}

export async function extractionOffsetPage(
  where: Prisma.CrawlPageWhereInput,
  page: number,
  pageSize: number,
  extractorCount: number,
  segments: readonly SegmentDef[],
): Promise<{ total: number; rows: ExtractionRow[] }> {
  const [total, rows] = await Promise.all([
    prisma.crawlPage.count({ where }),
    prisma.crawlPage.findMany({
      where,
      orderBy: [{ depth: "asc" }, { url: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: SELECT,
    }),
  ]);
  return { total, rows: rows.map((r) => toExtractionRow(r, extractorCount, segments)) };
}
