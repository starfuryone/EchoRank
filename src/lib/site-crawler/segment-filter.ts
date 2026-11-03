// src/lib/site-crawler/segment-filter.ts
//
// The ?segment=N filter every crawl tab, total and CSV takes (Phase 4b), and
// the per-segment tallies for Overview and the Issues tab. A segment is an
// index into the crawl's own config.segments (its snapshot of the host's
// segments when it ran); a page's membership is crawl_pages.segmentIds.

import "server-only";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { readStoredConfig } from "./crawl-config";
import type { SegmentDef } from "./segments";
import type { SeverityCounts } from "./types";
import { toTotals } from "./issue-totals";

export class InvalidSegmentError extends Error {
  readonly statusCode = 400;
  constructor() {
    super("Unknown segment");
    this.name = "InvalidSegmentError";
  }
}

export interface SegmentScope {
  /** The crawl's segments (empty for a crawl that ran without any). */
  defs: SegmentDef[];
  /** The selected segment, or null for the whole crawl. */
  index: number | null;
}

/** Read ?segment from a request against the crawl's config. Throws InvalidSegmentError for an index the crawl does not have. */
export function segmentScope(url: URL, rawConfig: unknown): SegmentScope {
  const defs = readStoredConfig(rawConfig)?.segments ?? [];
  const raw = url.searchParams.get("segment");
  if (raw === null || raw === "") return { defs, index: null };
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n >= defs.length) throw new InvalidSegmentError();
  return { defs, index: n };
}

/** crawl_pages where-fragment. */
export function pageInSegment(s: SegmentScope): Prisma.CrawlPageWhereInput {
  return s.index === null ? {} : { segmentIds: { has: s.index } };
}

/** crawl_issues where-fragment, combinable with any issue filter (an AND, so it never replaces a crawlPage clause). */
export function issueInSegment(s: SegmentScope): Prisma.CrawlIssueWhereInput {
  return s.index === null ? {} : { AND: [{ crawlPage: { segmentIds: { has: s.index } } }] };
}

/** Raw-SQL fragment on a crawl_pages alias: `AND <alias>."segmentIds" @> {N}`. */
export function sqlInSegment(s: SegmentScope, alias: string): Prisma.Sql {
  if (s.index === null) return Prisma.empty;
  // The alias is a literal at every call site, never input.
  return Prisma.sql`AND ${Prisma.raw(`${alias}."segmentIds"`)} @> ARRAY[${s.index}]::smallint[]`;
}

export interface SegmentOverviewRow {
  index: number;
  name: string;
  pages: number;
  totals: SeverityCounts;
}

/** Pages and issue totals per segment, two grouped queries over the crawl. */
export async function segmentOverview(jobId: string, defs: readonly SegmentDef[]): Promise<SegmentOverviewRow[]> {
  if (defs.length === 0) return [];
  const [pages, issues] = await Promise.all([
    prisma.$queryRaw<{ seg: number; n: number }[]>`
      SELECT s.seg::int AS seg, count(*)::int AS n
      FROM "crawl_pages" p, unnest(p."segmentIds") AS s(seg)
      WHERE p."crawlJobId" = ${jobId}
      GROUP BY 1`,
    prisma.$queryRaw<{ seg: number; severity: string; n: number }[]>`
      SELECT s.seg::int AS seg, i."severity", count(*)::int AS n
      FROM "crawl_issues" i
      JOIN "crawl_pages" p ON p."id" = i."crawlPageId", unnest(p."segmentIds") AS s(seg)
      WHERE i."crawlJobId" = ${jobId}
      GROUP BY 1, 2`,
  ]);
  return defs.map((d, index) => ({
    index,
    name: d.name,
    pages: pages.find((p) => p.seg === index)?.n ?? 0,
    totals: toTotals(Object.fromEntries(issues.filter((i) => i.seg === index).map((i) => [i.severity, i.n]))),
  }));
}

/** Findings per rule per segment: ruleId → counts by segment index. */
export async function ruleCountsBySegment(jobId: string, defs: readonly SegmentDef[]): Promise<Record<string, number[]>> {
  if (defs.length === 0) return {};
  const rows = await prisma.$queryRaw<{ ruleId: string; seg: number; n: number }[]>`
    SELECT i."ruleId", s.seg::int AS seg, count(*)::int AS n
    FROM "crawl_issues" i
    JOIN "crawl_pages" p ON p."id" = i."crawlPageId", unnest(p."segmentIds") AS s(seg)
    WHERE i."crawlJobId" = ${jobId} AND i."ruleId" IS NOT NULL
    GROUP BY 1, 2`;
  const out: Record<string, number[]> = {};
  for (const r of rows) {
    if (r.seg < 0 || r.seg >= defs.length) continue;
    (out[r.ruleId] ??= defs.map(() => 0))[r.seg] = r.n;
  }
  return out;
}

/** Severity totals for one segment. */
export async function segmentIssueTotals(jobId: string, s: SegmentScope): Promise<SeverityCounts> {
  const grouped = await prisma.crawlIssue.groupBy({
    by: ["severity"],
    where: { crawlJobId: jobId, ...issueInSegment(s) },
    _count: { _all: true },
  });
  return toTotals(Object.fromEntries(grouped.map((g) => [g.severity, g._count._all])));
}
