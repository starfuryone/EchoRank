// src/lib/citations/read.ts
//
// Server-side read model for /visibility/tools/citation-finder.
//
// SORTING AND FILTERING ARE THE DATABASE'S JOB, not the client's. The table is
// unbounded — a brand tracked for a year cites thousands of domains — so a
// client-side sort would be a sort of whatever the first page happened to
// contain, which is a table that lies about what is at the top of it. Every
// sort key below maps to a real column for exactly that reason.
//
// The one derived cell, "top rival", is the exception that proves it: the NAME
// comes out of the citesCompetitors JSON in memory, but the ORDER comes from
// the competitorCitations column that JSON sums to. Sorting on a JSON key would
// have meant reading every row to order any of them.
//
// EVERY QUERY IS TENANT-SCOPED, including the ones a brandProfileId narrows —
// the id arrives from a query string.

import { prisma } from "@/lib/prisma";
import type { CitationKind, Prisma } from "@/generated/prisma";
import { asCountMap } from "./store";

/** Rows per page. */
export const CITATION_PAGE_SIZE = 50;

/** The columns the header can sort by. Anything else falls back to `seen`. */
export type CitationSortKey = "domain" | "kind" | "engines" | "seen" | "citesYou" | "rivals" | "lastSeen";

export type CitationSortDir = "asc" | "desc";

/**
 * Named filters the UI offers as one click.
 *
 * `opportunity` is the preset the whole tool is built around: a source that
 * cites your competitors and has never once cited you. "Trusted" is carried by
 * the citation itself — an engine chose to cite this domain, repeatedly — so
 * the filter does not need an authority score to mean something, which is
 * fortunate, because nothing populates authorityScore.
 */
export type CitationPreset = "all" | "opportunity";

export interface CitationRivalCount {
  brand: string;
  count: number;
}

export interface CitationSourceRow {
  id: string;
  domain: string;
  kind: CitationKind;
  /** Engine ids that have cited this domain, biggest first. */
  engines: string[];
  seenCount: number;
  /** brandCitations > 0. Derived, never stored — see the schema comment. */
  citesYou: boolean;
  brandCitations: number;
  competitorCitations: number;
  /** Biggest first, capped at MAX_RIVALS_SHOWN. */
  topRivals: CitationRivalCount[];
  lastSeen: string;
}

export interface CitationBrandOption {
  id: string;
  name: string;
}

export interface CitationPageQuery {
  brandProfileId?: string | null;
  preset?: string | null;
  kind?: string | null;
  sort?: string | null;
  dir?: string | null;
  page?: number | null;
}

export interface CitationPageData {
  /** False when this tenant has no source row at all — drives the empty state. */
  hasData: boolean;
  brands: CitationBrandOption[];
  selectedBrandProfileId: string | null;
  brandName: string | null;
  rows: CitationSourceRow[];
  /** Rows matching the current filter, across all pages. */
  total: number;
  page: number;
  pageSize: number;
  preset: CitationPreset;
  kind: CitationKind | null;
  sort: CitationSortKey;
  dir: CitationSortDir;
  /** Rows matching `opportunity`, so the preset chip can carry its own count. */
  opportunityCount: number;
}

/** How many rivals one cell names before it stops. */
export const MAX_RIVALS_SHOWN = 3;

const SORT_COLUMNS: Record<CitationSortKey, string> = {
  domain: "domain",
  kind: "kind",
  engines: "distinctEngines",
  seen: "citationCount",
  citesYou: "brandCitations",
  rivals: "competitorCitations",
  lastSeen: "lastSeenAt",
};

const KINDS = new Set<string>([
  "DIRECTORY",
  "REVIEW_SITE",
  "NEWS",
  "BLOG",
  "GOV",
  "SOCIAL",
  "OTHER",
]);

function parseSort(raw: string | null | undefined): CitationSortKey {
  return raw && raw in SORT_COLUMNS ? (raw as CitationSortKey) : "seen";
}

function parseDir(raw: string | null | undefined): CitationSortDir {
  return raw === "asc" ? "asc" : "desc";
}

function parseKind(raw: string | null | undefined): CitationKind | null {
  return raw && KINDS.has(raw) ? (raw as CitationKind) : null;
}

/**
 * The preset's WHERE clause.
 *
 * "Never mentions you" is `brandCitations: 0`, and "cites competitors" is
 * `competitorCitations > 0` rather than a test on the citesCompetitors JSON.
 * The two are written together by the aggregator and cannot disagree, and only
 * one of them is a column Postgres can filter without deserialising every row.
 */
function presetWhere(preset: CitationPreset): Prisma.SourceWhereInput {
  if (preset === "opportunity") {
    return { brandCitations: 0, competitorCitations: { gt: 0 } };
  }
  return {};
}

/** Biggest first, ties broken by name so the order is stable across reads. */
function topRivals(value: unknown): CitationRivalCount[] {
  return Object.entries(asCountMap(value))
    .map(([brand, count]) => ({ brand, count }))
    .sort((a, b) => b.count - a.count || a.brand.localeCompare(b.brand))
    .slice(0, MAX_RIVALS_SHOWN);
}

/** Engine ids, busiest first. */
function engineList(value: unknown): string[] {
  return Object.entries(asCountMap(value))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([engine]) => engine);
}

/**
 * Everything the page renders, for one tenant.
 *
 * Four queries: the brand list, the filtered page, its count, and the
 * opportunity count for the chip. The last one is separate on purpose — the
 * chip has to say how many rows the preset WOULD show while the preset is off,
 * which the filtered count cannot answer.
 */
export async function loadCitationPageData(
  tenantId: string,
  query: CitationPageQuery = {},
): Promise<CitationPageData> {
  const preset: CitationPreset = query.preset === "opportunity" ? "opportunity" : "all";
  const kind = parseKind(query.kind);
  const sort = parseSort(query.sort);
  const dir = parseDir(query.dir);
  const page = Math.max(1, Math.floor(query.page ?? 1));

  const empty: CitationPageData = {
    hasData: false,
    brands: [],
    selectedBrandProfileId: null,
    brandName: null,
    rows: [],
    total: 0,
    page: 1,
    pageSize: CITATION_PAGE_SIZE,
    preset,
    kind,
    sort,
    dir,
    opportunityCount: 0,
  };

  const profiles = await prisma.brandProfile.findMany({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (profiles.length === 0) return empty;

  const brands = profiles.map((p) => ({ id: p.id, name: p.name }));
  // An unknown or foreign id falls back to the first brand rather than
  // throwing: the value comes from a query string, and a stale bookmark should
  // render the page. The tenant scope above is what makes the fallback safe.
  const selected = brands.find((b) => b.id === query.brandProfileId) ?? brands[0];

  const scope: Prisma.SourceWhereInput = {
    tenantId,
    brandProfileId: selected.id,
  };
  const where: Prisma.SourceWhereInput = {
    ...scope,
    ...presetWhere(preset),
    ...(kind ? { kind } : {}),
  };

  const [rows, total, opportunityCount, anyRow] = await Promise.all([
    prisma.source.findMany({
      where,
      // Ties broken by domain so pagination is stable: two sources with the
      // same citation count must not be able to swap places between page 1 and
      // page 2 and hide one of themselves.
      orderBy: [{ [SORT_COLUMNS[sort]]: dir }, { domain: "asc" }],
      skip: (page - 1) * CITATION_PAGE_SIZE,
      take: CITATION_PAGE_SIZE,
      select: {
        id: true,
        domain: true,
        kind: true,
        enginesSeen: true,
        citationCount: true,
        brandCitations: true,
        competitorCitations: true,
        citesCompetitors: true,
        lastSeenAt: true,
      },
    }),
    prisma.source.count({ where }),
    prisma.source.count({ where: { ...scope, ...presetWhere("opportunity") } }),
    prisma.source.findFirst({ where: scope, select: { id: true } }),
  ]);

  return {
    hasData: anyRow !== null,
    brands,
    selectedBrandProfileId: selected.id,
    brandName: selected.name,
    rows: rows.map((row) => ({
      id: row.id,
      domain: row.domain,
      kind: row.kind,
      engines: engineList(row.enginesSeen),
      seenCount: row.citationCount,
      citesYou: row.brandCitations > 0,
      brandCitations: row.brandCitations,
      competitorCitations: row.competitorCitations,
      topRivals: topRivals(row.citesCompetitors),
      lastSeen: row.lastSeenAt.toISOString(),
    })),
    total,
    page,
    pageSize: CITATION_PAGE_SIZE,
    preset,
    kind,
    sort,
    dir,
    opportunityCount,
  };
}
