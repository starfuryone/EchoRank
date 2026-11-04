// src/lib/site-crawler/extraction-rows.ts
//
// Reads for the Extraction tab and its CSV (Phase 4b): the crawl's HTML
// pages with what each column found, filtered by "column N has a value / is
// empty". Keyset-paged by page id for the CSV, offset-paged for the table.
//
// Phase 4e: the columns are the extractors (kind "extract"), then the custom
// JavaScript snippets ("js"), then the AI prompts ("ai"), in config order.

import "server-only";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import type { StoredCrawlConfig } from "./crawl-config";
import type { ExtractionRow } from "./csv-columns";
import { segmentCell, type SegmentDef } from "./segments";

export type ExtractionKind = "extract" | "js" | "ai";

/** One Extraction tab column: which rows feed it and its header. */
export interface ExtractionColumnRef {
  kind: ExtractionKind;
  index: number;
  name: string;
}

/** The crawl's columns, in display order. Names of js / ai columns carry a "JS: " / "AI: " prefix. */
export function extractionColumnRefs(config: StoredCrawlConfig | null): ExtractionColumnRef[] {
  return [
    ...(config?.extractors ?? []).map((e, index) => ({ kind: "extract" as const, index, name: e.name })),
    ...(config?.js ?? []).map((s, index) => ({ kind: "js" as const, index, name: `JS: ${s.name}` })),
  ];
}

export interface ExtractionFilter {
  /** The column the has/empty filter applies to. */
  extractor: ExtractionColumnRef | null;
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
      ? (() => {
          const one = { kind: f.extractor.kind, extractorIndex: f.extractor.index };
          return { extractions: f.has ? { some: one } : { none: one } };
        })()
      : {}),
    ...(f.segment !== null ? { segmentIds: { has: f.segment } } : {}),
  };
}

const SELECT = {
  id: true,
  url: true,
  segmentIds: true,
  extractions: { select: { kind: true, extractorIndex: true, values: true } },
} as const;

type Raw = { id: string; url: string; segmentIds: number[]; extractions: { kind: ExtractionKind; extractorIndex: number; values: string[] }[] };

export function toExtractionRow(r: Raw, refs: readonly ExtractionColumnRef[], segments: readonly SegmentDef[]): ExtractionRow {
  const values: (string[] | null)[] = refs.map((c) => r.extractions.find((e) => e.kind === c.kind && e.extractorIndex === c.index)?.values ?? null);
  return { id: r.id, url: r.url, values, segment: segmentCell(r.segmentIds, segments) };
}

export async function extractionKeysetPage(
  where: Prisma.CrawlPageWhereInput,
  cursor: string | null,
  take: number,
  refs: readonly ExtractionColumnRef[],
  segments: readonly SegmentDef[],
): Promise<ExtractionRow[]> {
  const rows = await prisma.crawlPage.findMany({
    where: { ...where, ...(cursor ? { id: { gt: cursor } } : {}) },
    orderBy: { id: "asc" },
    take,
    select: SELECT,
  });
  return rows.map((r) => toExtractionRow(r, refs, segments));
}

export async function extractionOffsetPage(
  where: Prisma.CrawlPageWhereInput,
  page: number,
  pageSize: number,
  refs: readonly ExtractionColumnRef[],
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
  return { total, rows: rows.map((r) => toExtractionRow(r, refs, segments)) };
}
