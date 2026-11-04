// src/lib/site-crawler/compare.ts
//
// Crawl comparison (Phase 4c). Crawl A is "this" crawl, crawl B the baseline.
// Everything is SQL set operations — never a page list in Node:
//
//   pages   added    = A EXCEPT B           (by URL, B's URLs mapped first)
//           removed  = B EXCEPT A
//           changed  = A ⋈ B where status, title, canonical or indexability differ
//   issues  new      = (url, rule) in A EXCEPT in B
//           resolved = (url, rule) in B EXCEPT in A
//   summary          pages / indexable / redirects / errors / issues by severity, per side
//
// Each run materialises both sides once into ON COMMIT DROP temp tables
// inside one transaction (the mapping's regexp_replace runs once per B page,
// not once per query), under a statement timeout. The stored result holds
// counts and the first COMPARE_SAMPLE URLs per bucket, kept under 1 MB; the
// paged endpoint recomputes any bucket in full with a keyset cursor.

import "server-only";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { readStoredConfig } from "./crawl-config";
import { toPgReplacement, type MappingPair } from "./compare-mapping";

export const COMPARE_BUCKETS = ["added", "removed", "changed", "issuesNew", "issuesResolved"] as const;
export type CompareBucket = (typeof COMPARE_BUCKETS)[number];
export const COMPARE_SAMPLE = 500;
export const COMPARE_RESULT_MAX_BYTES = 1_000_000;
/** Per statement; a mapping regex that runs away is cut off, not left on the box. */
export const COMPARE_STATEMENT_TIMEOUT_MS = 20_000;

export class CompareError extends Error {
  constructor(
    readonly code: "not_comparable" | "segment_missing" | "invalid_mapping" | "timeout",
    readonly status = 400,
  ) {
    super(code);
    this.name = "CompareError";
  }
}

export interface SideStats {
  pages: number;
  indexable: number;
  redirects: number;
  errors: number;
  issues: { ERROR: number; WARNING: number; NOTICE: number };
}

export interface ChangedRow {
  url: string;
  fields: ("status" | "title" | "canonical" | "indexability")[];
  a: { status: number | null; title: string | null; canonical: string | null; indexable: boolean };
  b: { status: number | null; title: string | null; canonical: string | null; indexable: boolean };
}

export interface IssueDeltaRow {
  url: string;
  ruleId: string;
}

export interface ComparisonResult {
  version: 1;
  counts: Record<CompareBucket, number>;
  changedFields: Record<ChangedRow["fields"][number], number>;
  summary: { a: SideStats; b: SideStats };
  /** Per rule: issues new in A / resolved since B. Busiest first. */
  rules: { ruleId: string; new: number; resolved: number }[];
  samples: {
    added: string[];
    removed: string[];
    changed: ChangedRow[];
    issuesNew: IssueDeltaRow[];
    issuesResolved: IssueDeltaRow[];
  };
  /** Samples were cut below COMPARE_SAMPLE to keep the row under 1 MB. */
  truncated: boolean;
}

export interface CompareInput {
  jobAId: string;
  jobBId: string;
  mapping: readonly MappingPair[];
  /** Segment index in A; B's segment is the one with the same name. */
  segmentA: number | null;
  segmentB: number | null;
}

type Tx = Prisma.TransactionClient;

/** B's URL through each pair in order (first match per pair). */
function mappedUrl(mapping: readonly MappingPair[]): Prisma.Sql {
  return mapping.reduce<Prisma.Sql>((expr, m) => Prisma.sql`regexp_replace(${expr}, ${m.find}, ${toPgReplacement(m.replace)})`, Prisma.sql`p."url"`);
}

const inSegment = (segment: number | null) => (segment === null ? Prisma.empty : Prisma.sql`AND p."segmentIds" @> ARRAY[${segment}]::smallint[]`);

/** cmp_a / cmp_b: one row per URL; cmp_ia / cmp_ib: one row per (URL, rule). */
async function materialise(tx: Tx, input: CompareInput): Promise<void> {
  await tx.$queryRaw`SELECT set_config('statement_timeout', ${String(COMPARE_STATEMENT_TIMEOUT_MS)}, true)`;
  const side = (table: string, jobId: string, url: Prisma.Sql, segment: number | null) => Prisma.sql`
    CREATE TEMP TABLE ${Prisma.raw(table)} ON COMMIT DROP AS
    SELECT DISTINCT ON (u) u AS url, status, title, canonical, indexable FROM (
      SELECT ${url} AS u, p."id", p."statusCode" AS status, p."title", p."canonical",
             (p."statusCode" = 200 AND p."noindex" IS NOT TRUE) AS indexable
      FROM "crawl_pages" p WHERE p."crawlJobId" = ${jobId} ${inSegment(segment)}
    ) x ORDER BY u, "id"`;
  const issues = (table: string, jobId: string, url: Prisma.Sql, segment: number | null) => Prisma.sql`
    CREATE TEMP TABLE ${Prisma.raw(table)} ON COMMIT DROP AS
    SELECT DISTINCT ${url} AS url, COALESCE(i."ruleId", i."type") AS rule
    FROM "crawl_issues" i JOIN "crawl_pages" p ON p."id" = i."crawlPageId"
    WHERE p."crawlJobId" = ${jobId} ${inSegment(segment)}`;
  const mapped = mappedUrl(input.mapping);
  await tx.$executeRaw(side("cmp_a", input.jobAId, Prisma.sql`p."url"`, input.segmentA));
  await tx.$executeRaw(side("cmp_b", input.jobBId, mapped, input.segmentB));
  await tx.$executeRaw(issues("cmp_ia", input.jobAId, Prisma.sql`p."url"`, input.segmentA));
  await tx.$executeRaw(issues("cmp_ib", input.jobBId, mapped, input.segmentB));
}

/** A bucket as one SELECT over the temp tables, keyset-paged on (url[, rule]). */
function bucketSql(bucket: CompareBucket, after: string | null, take: number): Prisma.Sql {
  const lim = Prisma.sql`LIMIT ${take}`;
  if (bucket === "added" || bucket === "removed") {
    const [x, y] = bucket === "added" ? ["cmp_a", "cmp_b"] : ["cmp_b", "cmp_a"];
    const cur = after === null ? Prisma.empty : Prisma.sql`WHERE url > ${after}`;
    return Prisma.sql`SELECT url FROM (SELECT url FROM ${Prisma.raw(x)} EXCEPT SELECT url FROM ${Prisma.raw(y)}) s ${cur} ORDER BY url ${lim}`;
  }
  if (bucket === "changed") {
    const cur = after === null ? Prisma.empty : Prisma.sql`AND a.url > ${after}`;
    return Prisma.sql`
      SELECT a.url,
        array_remove(ARRAY[
          CASE WHEN a.status IS DISTINCT FROM b.status THEN 'status' END,
          CASE WHEN a.title IS DISTINCT FROM b.title THEN 'title' END,
          CASE WHEN a.canonical IS DISTINCT FROM b.canonical THEN 'canonical' END,
          CASE WHEN a.indexable IS DISTINCT FROM b.indexable THEN 'indexability' END
        ], NULL) AS fields,
        a.status AS a_status, a.title AS a_title, a.canonical AS a_canonical, a.indexable AS a_indexable,
        b.status AS b_status, b.title AS b_title, b.canonical AS b_canonical, b.indexable AS b_indexable
      FROM cmp_a a JOIN cmp_b b USING (url)
      WHERE (a.status, a.title, a.canonical, a.indexable) IS DISTINCT FROM (b.status, b.title, b.canonical, b.indexable) ${cur}
      ORDER BY a.url ${lim}`;
  }
  const [x, y] = bucket === "issuesNew" ? ["cmp_ia", "cmp_ib"] : ["cmp_ib", "cmp_ia"];
  let cur = Prisma.empty;
  if (after !== null) {
    const [u, r] = JSON.parse(after) as [string, string];
    cur = Prisma.sql`WHERE (url, rule) > (${u}, ${r})`;
  }
  return Prisma.sql`SELECT url, rule FROM (SELECT url, rule FROM ${Prisma.raw(x)} EXCEPT SELECT url, rule FROM ${Prisma.raw(y)}) s ${cur} ORDER BY url, rule ${lim}`;
}

type RawChanged = {
  url: string;
  fields: ChangedRow["fields"];
  a_status: number | null;
  a_title: string | null;
  a_canonical: string | null;
  a_indexable: boolean;
  b_status: number | null;
  b_title: string | null;
  b_canonical: string | null;
  b_indexable: boolean;
};

export type BucketRow = string | ChangedRow | IssueDeltaRow;

function toRow(bucket: CompareBucket, r: Record<string, unknown>): BucketRow {
  if (bucket === "added" || bucket === "removed") return r.url as string;
  if (bucket === "changed") {
    const c = r as unknown as RawChanged;
    return {
      url: c.url,
      fields: c.fields,
      a: { status: c.a_status, title: c.a_title, canonical: c.a_canonical, indexable: c.a_indexable },
      b: { status: c.b_status, title: c.b_title, canonical: c.b_canonical, indexable: c.b_indexable },
    };
  }
  return { url: r.url as string, ruleId: r.rule as string };
}

/** The keyset cursor of a bucket row. */
export function bucketCursor(row: BucketRow): string {
  if (typeof row === "string") return row;
  if ("ruleId" in row) return JSON.stringify([row.url, row.ruleId]);
  return row.url;
}

/** Map Postgres's complaints about the mapping to a 400 and a cancelled statement to a timeout. */
async function guarded<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/invalid regular expression|regular expression/i.test(msg)) throw new CompareError("invalid_mapping");
    if (/statement timeout|canceling statement/i.test(msg)) throw new CompareError("timeout", 422);
    throw err;
  }
}

const TX = { timeout: 120_000, maxWait: 10_000 };

/** One page of a bucket, recomputed in full from both crawls. */
export async function comparisonBucket(input: CompareInput, bucket: CompareBucket, after: string | null, take: number): Promise<BucketRow[]> {
  return guarded(() =>
    prisma.$transaction(async (tx) => {
      await materialise(tx, input);
      const rows = await tx.$queryRaw<Record<string, unknown>[]>(bucketSql(bucket, after, take));
      return rows.map((r) => toRow(bucket, r));
    }, TX),
  );
}

async function sideStats(tx: Tx, table: "cmp_a" | "cmp_b", jobId: string, segment: number | null): Promise<SideStats> {
  const [s] = await tx.$queryRaw<{ pages: bigint; indexable: bigint; redirects: bigint; errors: bigint }[]>(Prisma.sql`
    SELECT count(*) AS pages,
      count(*) FILTER (WHERE indexable) AS indexable,
      count(*) FILTER (WHERE status >= 300 AND status < 400) AS redirects,
      count(*) FILTER (WHERE status IS NULL OR status >= 400) AS errors
    FROM ${Prisma.raw(table)}`);
  const sev = await tx.$queryRaw<{ severity: string; n: bigint }[]>(Prisma.sql`
    SELECT i."severity", count(*) AS n FROM "crawl_issues" i JOIN "crawl_pages" p ON p."id" = i."crawlPageId"
    WHERE p."crawlJobId" = ${jobId} ${inSegment(segment)} GROUP BY i."severity"`);
  const by = Object.fromEntries(sev.map((r) => [r.severity, Number(r.n)]));
  return {
    pages: Number(s?.pages ?? 0),
    indexable: Number(s?.indexable ?? 0),
    redirects: Number(s?.redirects ?? 0),
    errors: Number(s?.errors ?? 0),
    issues: { ERROR: by.ERROR ?? 0, WARNING: by.WARNING ?? 0, NOTICE: by.NOTICE ?? 0 },
  };
}

/** Cut the samples (halving the longest) until the JSON fits; the counts never change. */
export function fitResult(result: ComparisonResult, maxBytes = COMPARE_RESULT_MAX_BYTES): ComparisonResult {
  let out = result;
  const size = () => Buffer.byteLength(JSON.stringify(out));
  while (size() > maxBytes) {
    const s = out.samples;
    const keys = Object.keys(s) as (keyof typeof s)[];
    const longest = keys.reduce((k, x) => (s[x].length > s[k].length ? x : k), keys[0]!);
    if (s[longest].length === 0) break;
    out = { ...out, truncated: true, samples: { ...s, [longest]: s[longest].slice(0, Math.floor(s[longest].length / 2)) } };
  }
  return out;
}

/** Compute a comparison. Nothing is stored here. */
export async function computeComparison(input: CompareInput): Promise<ComparisonResult> {
  return guarded(() =>
    prisma.$transaction(async (tx) => {
      await materialise(tx, input);
      const [c] = await tx.$queryRaw<Record<CompareBucket | "f_status" | "f_title" | "f_canonical" | "f_indexability", bigint>[]>(Prisma.sql`
        SELECT
          (SELECT count(*) FROM (SELECT url FROM cmp_a EXCEPT SELECT url FROM cmp_b) s) AS added,
          (SELECT count(*) FROM (SELECT url FROM cmp_b EXCEPT SELECT url FROM cmp_a) s) AS removed,
          count(*) FILTER (WHERE (a.status, a.title, a.canonical, a.indexable) IS DISTINCT FROM (b.status, b.title, b.canonical, b.indexable)) AS changed,
          count(*) FILTER (WHERE a.status IS DISTINCT FROM b.status) AS f_status,
          count(*) FILTER (WHERE a.title IS DISTINCT FROM b.title) AS f_title,
          count(*) FILTER (WHERE a.canonical IS DISTINCT FROM b.canonical) AS f_canonical,
          count(*) FILTER (WHERE a.indexable IS DISTINCT FROM b.indexable) AS f_indexability,
          (SELECT count(*) FROM (SELECT url, rule FROM cmp_ia EXCEPT SELECT url, rule FROM cmp_ib) s) AS "issuesNew",
          (SELECT count(*) FROM (SELECT url, rule FROM cmp_ib EXCEPT SELECT url, rule FROM cmp_ia) s) AS "issuesResolved"
        FROM cmp_a a JOIN cmp_b b USING (url)`);
      const rules = await tx.$queryRaw<{ rule: string; new: bigint; resolved: bigint }[]>(Prisma.sql`
        SELECT rule, count(*) FILTER (WHERE side = 'n') AS new, count(*) FILTER (WHERE side = 'r') AS resolved FROM (
          SELECT rule, 'n' AS side FROM (SELECT url, rule FROM cmp_ia EXCEPT SELECT url, rule FROM cmp_ib) x
          UNION ALL
          SELECT rule, 'r' AS side FROM (SELECT url, rule FROM cmp_ib EXCEPT SELECT url, rule FROM cmp_ia) y
        ) d GROUP BY rule ORDER BY count(*) DESC, rule LIMIT 500`);
      const sample = async <B extends CompareBucket>(b: B) =>
        (await tx.$queryRaw<Record<string, unknown>[]>(bucketSql(b, null, COMPARE_SAMPLE))).map((r) => toRow(b, r));
      const n = (k: keyof NonNullable<typeof c>) => Number(c?.[k] ?? 0);
      return fitResult({
        version: 1,
        counts: { added: n("added"), removed: n("removed"), changed: n("changed"), issuesNew: n("issuesNew"), issuesResolved: n("issuesResolved") },
        changedFields: { status: n("f_status"), title: n("f_title"), canonical: n("f_canonical"), indexability: n("f_indexability") },
        summary: {
          a: await sideStats(tx, "cmp_a", input.jobAId, input.segmentA),
          b: await sideStats(tx, "cmp_b", input.jobBId, input.segmentB),
        },
        rules: rules.map((r) => ({ ruleId: r.rule, new: Number(r.new), resolved: Number(r.resolved) })),
        samples: {
          added: (await sample("added")) as string[],
          removed: (await sample("removed")) as string[],
          changed: (await sample("changed")) as ChangedRow[],
          issuesNew: (await sample("issuesNew")) as IssueDeltaRow[],
          issuesResolved: (await sample("issuesResolved")) as IssueDeltaRow[],
        },
        truncated: false,
      });
    }, TX),
  );
}

// ── Which crawls may be compared ────────────────────────────────────────────

const COMPARABLE = { status: "COMPLETED" as const, dataPurgedAt: null };

export interface CompareCrawl {
  id: string;
  tenantId: string;
  rootUrl: string;
  mode: string;
  config: unknown;
  createdAt: Date;
}

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname;
  } catch {
    return "";
  }
};

/** Completed, kept crawls of the same tenant and mode, newest first (list mode compares only with list mode). */
export async function compareCandidates(a: CompareCrawl, take = 50) {
  return prisma.crawlJob.findMany({
    where: { tenantId: a.tenantId, mode: a.mode, id: { not: a.id }, ...COMPARABLE },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, rootUrl: true, createdAt: true, pagesCrawled: true },
  });
}

/** The default baseline: the newest candidate older than A on the same host (any host for list mode). */
export function defaultBaseline(a: CompareCrawl, candidates: { id: string; rootUrl: string; createdAt: Date }[]): string | null {
  const host = hostOf(a.rootUrl);
  const found = candidates.find((c) => c.createdAt < a.createdAt && (a.mode === "list" || hostOf(c.rootUrl) === host));
  return found?.id ?? null;
}

/**
 * Resolve B for A, refusing what cannot be compared: another tenant, a
 * different mode, an incomplete or purged crawl. B's segment is A's segment
 * by name, since each crawl snapshots its own list.
 */
export async function resolveCompare(a: CompareCrawl, jobBId: string, segmentA: number | null, mapping: readonly MappingPair[]): Promise<CompareInput> {
  const b = await prisma.crawlJob.findFirst({
    where: { id: jobBId, tenantId: a.tenantId, mode: a.mode, ...COMPARABLE },
    select: { id: true, config: true },
  });
  if (!b || b.id === a.id) throw new CompareError("not_comparable");
  let segmentB: number | null = null;
  if (segmentA !== null) {
    const name = readStoredConfig(a.config)?.segments?.[segmentA]?.name;
    const idx = (readStoredConfig(b.config)?.segments ?? []).findIndex((s) => s.name === name);
    if (!name || idx < 0) throw new CompareError("segment_missing");
    segmentB = idx;
  }
  return { jobAId: a.id, jobBId: b.id, mapping, segmentA, segmentB };
}

/** Compute and store, or return the stored row for the same pair, mapping and segment. */
export async function runComparison(input: CompareInput) {
  const existing = await prisma.crawlComparison.findFirst({
    where: { jobAId: input.jobAId, jobBId: input.jobBId, segmentId: input.segmentA, mapping: { equals: input.mapping as Prisma.InputJsonValue } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;
  const result = await computeComparison(input);
  return prisma.crawlComparison.create({
    data: { jobAId: input.jobAId, jobBId: input.jobBId, segmentId: input.segmentA, mapping: input.mapping as Prisma.InputJsonValue, result: result as unknown as Prisma.InputJsonValue },
  });
}

/** Rebuild the input of a stored comparison (for its paged buckets). */
export async function storedCompareInput(row: { jobAId: string; jobBId: string; segmentId: number | null; mapping: unknown }, aConfig: unknown): Promise<CompareInput> {
  const b = await prisma.crawlJob.findFirst({ where: { id: row.jobBId, ...COMPARABLE }, select: { config: true } });
  if (!b) throw new CompareError("not_comparable", 409);
  let segmentB: number | null = null;
  if (row.segmentId !== null) {
    const name = readStoredConfig(aConfig)?.segments?.[row.segmentId]?.name;
    segmentB = (readStoredConfig(b.config)?.segments ?? []).findIndex((s) => s.name === name);
    if (segmentB < 0) throw new CompareError("segment_missing", 409);
  }
  return { jobAId: row.jobAId, jobBId: row.jobBId, mapping: (row.mapping as MappingPair[]) ?? [], segmentA: row.segmentId, segmentB };
}
