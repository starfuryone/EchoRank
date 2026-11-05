// src/lib/site-crawler/archive/format.ts
//
// The crawl archive's on-bucket format (CRAWL-ARCHIVE.md Phase 2). Pure: keys,
// table order, the manifest's shape and its parser. No I/O.
//
//   tenants/<t>/crawls/<c>/manifest.json
//   tenants/<t>/crawls/<c>/<table>.ndjson.gz     one per archived table
//
// Each data object is gzip(NDJSON): one `row_to_json(row)` per line, every
// column, exactly as Postgres renders it — so a bigint (crawl_pages.simhash)
// or a float keeps its precision, and the restore hands the text straight back
// to Postgres (json_populate_recordset) without a JavaScript round trip.
//
// Data objects are uploaded first and the manifest LAST: a crawl without a
// manifest is not archived. The manifest records, per table, the row count,
// the column list at export time (restore maps by name — column drift), the
// gzipped size and its sha256 (also on the object as x-amz-meta-sha256).

import { z } from "zod";

export const ARCHIVE_FORMAT_VERSION = 1;

/**
 * The per-crawl tables, in FK order: parents first. Restore inserts in this
 * order; deletes walk it backwards (children before parents).
 *
 * Not archived, by design: crawl_jobs (the row and its summary stay in
 * Postgres in every state), crawl_comparisons (small; a comparison detail
 * refuses while either crawl is not hot), free_crawls (the free crawler is
 * never archived), and the per-site tables (segments, schedules, defaults).
 */
export const ARCHIVED_TABLES = ["crawl_pages", "crawl_issues", "crawl_links", "crawl_extractions", "crawl_page_metrics"] as const;
export type ArchivedTable = (typeof ARCHIVED_TABLES)[number];

/** Children before parents — the delete order (retention's PURGED_TABLES, the same five). */
export const DELETE_ORDER: readonly ArchivedTable[] = ["crawl_issues", "crawl_extractions", "crawl_page_metrics", "crawl_links", "crawl_pages"];

export const MANIFEST_NAME = "manifest.json";

export function tableObjectKey(prefix: string, table: ArchivedTable): string {
  return `${prefix}${table}.ndjson.gz`;
}

export function manifestKey(prefix: string): string {
  return `${prefix}${MANIFEST_NAME}`;
}

const Sha256 = z.string().regex(/^[0-9a-f]{64}$/);

export const ManifestTableSchema = z.object({
  table: z.enum(ARCHIVED_TABLES),
  key: z.string().min(1),
  rows: z.number().int().nonnegative(),
  columns: z.array(z.string().min(1)).min(1),
  bytes: z.number().int().nonnegative(),
  sha256: Sha256,
});

export const ManifestSchema = z.object({
  format: z.literal(ARCHIVE_FORMAT_VERSION),
  crawlId: z.string().min(1),
  tenantId: z.string().min(1),
  createdAt: z.string().min(1),
  appCommit: z.string(),
  migration: z.string(),
  tables: z.array(ManifestTableSchema),
});

export type ManifestTable = z.infer<typeof ManifestTableSchema>;
export type Manifest = z.infer<typeof ManifestSchema>;

export class ManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManifestError";
  }
}

/** Parse and check a manifest against the crawl it is meant to describe. */
export function parseManifest(text: string, expect: { crawlId: string; tenantId: string; prefix: string }): Manifest {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ManifestError("manifest.json is not JSON");
  }
  const parsed = ManifestSchema.safeParse(raw);
  if (!parsed.success) throw new ManifestError(`manifest.json does not match format ${ARCHIVE_FORMAT_VERSION}`);
  const m = parsed.data;
  if (m.crawlId !== expect.crawlId || m.tenantId !== expect.tenantId) throw new ManifestError("manifest.json belongs to another crawl");
  const tables = m.tables.map((t) => t.table);
  if (tables.length !== ARCHIVED_TABLES.length || ARCHIVED_TABLES.some((t, i) => tables[i] !== t)) {
    throw new ManifestError("manifest.json does not list the archived tables in order");
  }
  for (const t of m.tables) {
    if (t.key !== tableObjectKey(expect.prefix, t.table)) throw new ManifestError(`manifest.json points ${t.table} outside the crawl's prefix`);
  }
  return m;
}

/** Total gzipped bytes the manifest describes (the manifest itself not included). */
export function manifestDataBytes(m: Manifest): number {
  return m.tables.reduce((n, t) => n + t.bytes, 0);
}

// ── Column drift (restore) ──────────────────────────────────────────────

export interface LiveColumn {
  name: string;
  nullable: boolean;
  hasDefault: boolean;
  generated: boolean;
}

export interface ColumnPlan {
  /** Columns written on insert: in the archive AND in the live table. */
  insert: string[];
  /** Archived columns the live table no longer has — ignored. */
  dropped: string[];
  /** Live columns the archive lacks that take their default / NULL. */
  defaulted: string[];
  /** Live columns the archive lacks that are NOT NULL with no default: the restore cannot proceed. */
  missingRequired: string[];
}

/** Map an archived table onto today's columns by name. */
export function planColumns(archived: readonly string[], live: readonly LiveColumn[]): ColumnPlan {
  const have = new Set(archived);
  const liveNames = new Set(live.map((c) => c.name));
  const insertable = live.filter((c) => !c.generated);
  return {
    insert: insertable.filter((c) => have.has(c.name)).map((c) => c.name),
    dropped: archived.filter((c) => !liveNames.has(c)),
    defaulted: insertable.filter((c) => !have.has(c.name) && (c.nullable || c.hasDefault)).map((c) => c.name),
    missingRequired: insertable.filter((c) => !have.has(c.name) && !c.nullable && !c.hasDefault).map((c) => c.name),
  };
}
