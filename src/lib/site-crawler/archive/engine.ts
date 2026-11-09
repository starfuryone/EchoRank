// src/lib/site-crawler/archive/engine.ts
//
// Moving one crawl's child rows to the Spaces archive and back
// (CRAWL-ARCHIVE.md Phases 2–4). The policy — WHICH crawls — is policy.ts;
// the daily job is sweep.ts. Everything here acts on one crawl id.
//
// ── ARCHIVE (archiveCrawl) ─────────────────────────────────────────────────
//   0. Backfill what the summary-only views need (summary-backfill.ts), and
//      the crawlJobId of any pre-3a crawl_issues row, while the rows are here.
//   1. Claim: HOT → ARCHIVING (a conditional update; losing the race = skip).
//   2. Each table, keyset by primary key in ARCHIVE_READ_BATCH rows:
//      row_to_json → NDJSON → gzip → a temp file, hashing as it goes; then a
//      streaming upload with the sha256 as x-amz-meta-sha256. Temp file, not a
//      straight pipe, because the hash is object metadata and metadata is sent
//      when the upload starts. One table on disk at a time, never in memory.
//      The manifest goes up last.
//   3. Verify: every object's HEAD — ContentLength and sha256 as in the
//      manifest — and each table's row count in Postgres still equal to what
//      was written (a metrics job adding rows mid-archive fails this).
//   4. ARCHIVED, with prefix, bytes, timestamp.
//   5. Delete the child rows, ARCHIVE_DELETE_BATCH per statement, children
//      first. A crash here leaves an ARCHIVED crawl that still has rows; the
//      sweep resumes it (finishArchivedDeletes).
//   Any failure before 4 deletes what was uploaded and puts the crawl back to
//   HOT; the next sweep tries again.
//
//   A crawl restored earlier still has its objects (archiveKeyPrefix stays
//   set). If the manifest still describes the rows exactly — same counts,
//   objects verify — the re-archive reuses them and only deletes the rows.
//
// ── RESTORE (restoreCrawl) ─────────────────────────────────────────────────
//   ARCHIVED/RESTORING → RESTORING → manifest → column plan for every table
//   (map by name; dropped columns ignored; new nullable/defaulted ones take
//   their default; a new required column with no value fails the restore
//   before a row is written) → each table in FK order: download → sha256 →
//   gunzip → lines → INSERT … SELECT FROM json_populate_recordset, 1,000 rows
//   per statement, original ids → counts checked against the manifest → HOT,
//   restoredAt. Any failure deletes what was inserted and returns to ARCHIVED.
//   The JSON text goes from the bucket to Postgres untouched — no JavaScript
//   parse, so bigint and float columns round-trip exactly.

import "server-only";

import { createHash, type Hash } from "node:crypto";
import { createReadStream, createWriteStream, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { StringDecoder } from "node:string_decoder";
import { createGunzip, createGzip } from "node:zlib";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { logger } from "@/infrastructure/observability/logger";
import { crawlArchivePrefix, type ObjectStore } from "@/lib/spaces/client";
import { deleteCrawlRows } from "../retention";
import { backfillCachedTotals } from "../summary-backfill";
import { ARCHIVE_DELETE_BATCH, ARCHIVE_READ_BATCH, RESTORE_INSERT_BATCH } from "./constants";
import {
  ARCHIVED_TABLES,
  ARCHIVE_FORMAT_VERSION,
  manifestKey,
  parseManifest,
  planColumns,
  tableObjectKey,
  type ArchivedTable,
  type LiveColumn,
  type Manifest,
  type ManifestTable,
} from "./format";

export class ArchiveVerifyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArchiveVerifyError";
  }
}

export class RestoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RestoreError";
  }
}

/** Test seams: run between the named steps (a throw = a failure at that step). */
export interface EngineHooks {
  beforeVerify?: () => Promise<void> | void;
  beforeDelete?: () => Promise<void> | void;
  afterRestoreTable?: (table: ArchivedTable) => Promise<void> | void;
}

const tableSql = (t: ArchivedTable) => Prisma.raw(`"${t}"`);
const COLUMN = /^[A-Za-z_][A-Za-z0-9_]*$/;

// ── Provenance ────────────────────────────────────────────────────────────

/** The commit the running code came from: APP_COMMIT, else .git, else "unknown". */
export function appCommit(root = process.cwd()): string {
  const env = process.env.APP_COMMIT?.trim();
  if (env) return env.slice(0, 64);
  try {
    const head = readFileSync(join(root, ".git/HEAD"), "utf8").trim();
    if (/^[0-9a-f]{40}$/.test(head)) return head;
    const ref = head.replace(/^ref:\s*/, "");
    try {
      return readFileSync(join(root, ".git", ref), "utf8").trim();
    } catch {
      const line = readFileSync(join(root, ".git/packed-refs"), "utf8").split("\n").find((l) => l.endsWith(` ${ref}`));
      return line?.split(" ")[0] ?? "unknown";
    }
  } catch {
    return "unknown";
  }
}

/** The newest applied Prisma migration, or "unknown" (no _prisma_migrations table). */
export async function currentMigration(): Promise<string> {
  try {
    const rows = await prisma.$queryRaw<{ name: string }[]>`
      SELECT "migration_name" AS name FROM "_prisma_migrations"
      WHERE "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL
      ORDER BY "migration_name" DESC LIMIT 1`;
    return rows[0]?.name ?? "unknown";
  } catch {
    return "unknown";
  }
}

export async function liveColumns(table: ArchivedTable): Promise<LiveColumn[]> {
  const rows = await prisma.$queryRaw<{ name: string; nullable: string; def: string | null; generated: string; identity: string }[]>`
    SELECT column_name AS name, is_nullable AS nullable, column_default AS def, is_generated AS generated, is_identity AS identity
    FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = ${table}
    ORDER BY ordinal_position`;
  return rows.map((r) => ({
    name: r.name,
    nullable: r.nullable === "YES",
    hasDefault: r.def !== null || r.identity === "YES",
    generated: r.generated === "ALWAYS",
  }));
}

/** Rows per archived table for one crawl. */
export async function countCrawlRows(crawlId: string): Promise<Record<ArchivedTable, number>> {
  const out = {} as Record<ArchivedTable, number>;
  for (const t of ARCHIVED_TABLES) {
    const r = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM ${tableSql(t)} WHERE "crawlJobId" = ${crawlId}`;
    out[t] = Number(r[0]?.n ?? 0);
  }
  return out;
}

async function hasAnyRows(crawlId: string): Promise<boolean> {
  for (const t of ARCHIVED_TABLES) {
    const r = await prisma.$queryRaw<{ x: number }[]>`SELECT 1 AS x FROM ${tableSql(t)} WHERE "crawlJobId" = ${crawlId} LIMIT 1`;
    if (r.length) return true;
  }
  return false;
}

// ── Objects ───────────────────────────────────────────────────────────────

/** Every object under a crawl's prefix, deleted. Returns how many. */
export async function deleteArchiveObjects(store: ObjectStore, prefix: string): Promise<number> {
  const keys: string[] = [];
  for await (const o of store.list(prefix)) keys.push(o.key);
  return keys.length ? store.deleteKeys(keys) : 0;
}

async function readText(store: ObjectStore, key: string): Promise<string> {
  const body = await store.get(key);
  const chunks: Buffer[] = [];
  for await (const c of body) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  return Buffer.concat(chunks).toString("utf8");
}

export async function readManifest(store: ObjectStore, prefix: string, crawl: { id: string; tenantId: string }): Promise<Manifest> {
  return parseManifest(await readText(store, manifestKey(prefix)), { crawlId: crawl.id, tenantId: crawl.tenantId, prefix });
}

/** HEAD every object the manifest names (and the manifest): size and sha256 must match. */
export async function verifyObjects(store: ObjectStore, prefix: string, m: Manifest): Promise<void> {
  if (!(await store.head(manifestKey(prefix)))) throw new ArchiveVerifyError("manifest.json is missing");
  for (const t of m.tables) {
    const h = await store.head(t.key);
    if (!h) throw new ArchiveVerifyError(`${t.table}: object missing`);
    if (h.contentLength !== t.bytes) throw new ArchiveVerifyError(`${t.table}: ${h.contentLength} bytes in Spaces, ${t.bytes} in the manifest`);
    if (h.metadata.sha256 !== t.sha256) throw new ArchiveVerifyError(`${t.table}: sha256 differs from the manifest`);
  }
}

function sameCounts(m: Manifest, counts: Record<ArchivedTable, number>): string | null {
  for (const t of m.tables) if (counts[t.table] !== t.rows) return `${t.table}: ${counts[t.table]} rows in Postgres, ${t.rows} archived`;
  return null;
}

/** One table → gzip NDJSON in a temp file → the bucket. */
async function exportTable(store: ObjectStore, crawlId: string, table: ArchivedTable, key: string, dir: string): Promise<ManifestTable> {
  const columns = (await liveColumns(table)).map((c) => c.name);
  const file = join(dir, `${table}.ndjson.gz`);
  const gzip = createGzip({ level: 6 });
  const hash = createHash("sha256");
  let bytes = 0;
  const tap = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      hash.update(chunk);
      bytes += chunk.length;
      cb(null, chunk);
    },
  });
  const written = pipeline(gzip, tap, createWriteStream(file));
  let rows = 0;
  let cursor = "";
  try {
    for (;;) {
      const batch = await prisma.$queryRaw<{ id: string; j: string }[]>`
        SELECT t."id" AS id, row_to_json(t)::text AS j FROM ${tableSql(table)} t
        WHERE t."crawlJobId" = ${crawlId} AND t."id" > ${cursor}
        ORDER BY t."id" LIMIT ${ARCHIVE_READ_BATCH}`;
      if (!batch.length) break;
      const text = batch.map((r) => r.j).join("\n") + "\n";
      if (!gzip.write(text)) await new Promise<void>((resolve) => gzip.once("drain", resolve));
      rows += batch.length;
      cursor = batch[batch.length - 1]!.id;
      if (batch.length < ARCHIVE_READ_BATCH) break;
    }
  } finally {
    gzip.end();
    await written;
  }
  const sha256 = hash.digest("hex");
  await store.put(key, createReadStream(file), { contentType: "application/gzip", contentLength: bytes, metadata: { sha256 } });
  await rm(file, { force: true });
  return { table, key, rows, columns, bytes, sha256 };
}

// ── Archive ───────────────────────────────────────────────────────────────

export type ArchiveOutcome =
  | { status: "archived"; reused: boolean; bytes: number; rows: number }
  | { status: "skipped"; reason: string };

/** Pre-3a crawl_issues rows carry no crawlJobId; give them one so they are archived with their pages. */
export async function backfillIssueJobIds(crawlId: string): Promise<number> {
  return prisma.$executeRaw`
    UPDATE "crawl_issues" i SET "crawlJobId" = p."crawlJobId"
    FROM "crawl_pages" p
    WHERE p."id" = i."crawlPageId" AND p."crawlJobId" = ${crawlId} AND i."crawlJobId" IS NULL`;
}

/**
 * Every table of one crawl as NDJSON + manifest under `prefix` (anything there
 * before is deleted first). The archive's step 2, and the page archive's copy
 * of a crawl at completion (ECHORANK-DATA-ARCHIVE.md 1b: …/pages/crawl/<id>/tables/),
 * which leaves the rows where they are.
 */
export async function writeCrawlTables(store: ObjectStore, crawl: { id: string; tenantId: string }, prefix: string): Promise<Manifest> {
  return freshArchive(store, crawl, prefix);
}

async function freshArchive(store: ObjectStore, crawl: { id: string; tenantId: string }, prefix: string): Promise<Manifest> {
  // Leftovers of an older or interrupted archive are not trusted.
  await deleteArchiveObjects(store, prefix);
  const dir = await mkdtemp(join(process.env.CRAWL_ARCHIVE_TMP_DIR || tmpdir(), "crawl-archive-"));
  try {
    const tables: ManifestTable[] = [];
    for (const t of ARCHIVED_TABLES) tables.push(await exportTable(store, crawl.id, t, tableObjectKey(prefix, t), dir));
    const manifest: Manifest = {
      format: ARCHIVE_FORMAT_VERSION,
      crawlId: crawl.id,
      tenantId: crawl.tenantId,
      createdAt: new Date().toISOString(),
      appCommit: appCommit(),
      migration: await currentMigration(),
      tables,
    };
    await store.put(manifestKey(prefix), JSON.stringify(manifest, null, 2), { contentType: "application/json" });
    return manifest;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function archiveCrawl(crawlId: string, store: ObjectStore, hooks: EngineHooks = {}): Promise<ArchiveOutcome> {
  const crawl = await prisma.crawlJob.findUnique({
    where: { id: crawlId },
    select: { id: true, tenantId: true, status: true, storageState: true, dataPurgedAt: true, archiveKeyPrefix: true },
  });
  if (!crawl) return { status: "skipped", reason: "not_found" };
  if (crawl.status !== "COMPLETED" || crawl.dataPurgedAt || crawl.storageState !== "HOT") {
    return { status: "skipped", reason: "not_archivable" };
  }

  // Step 0, while the rows are still here.
  await backfillCachedTotals(crawl.id);
  await backfillIssueJobIds(crawl.id);

  // Step 1: claim.
  const claimed = await prisma.crawlJob.updateMany({
    where: { id: crawl.id, storageState: "HOT", dataPurgedAt: null, status: "COMPLETED" },
    data: { storageState: "ARCHIVING" },
  });
  if (claimed.count !== 1) return { status: "skipped", reason: "lost_claim" };

  const prefix = crawlArchivePrefix(crawl.tenantId, crawl.id);
  let manifest: Manifest | null = null;
  let reused = false;
  try {
    const before = await countCrawlRows(crawl.id);

    // Reuse a previous archive when it still describes these rows exactly.
    if (crawl.archiveKeyPrefix === prefix) {
      try {
        const m = await readManifest(store, prefix, crawl);
        await verifyObjects(store, prefix, m);
        if (!sameCounts(m, before)) {
          manifest = m;
          reused = true;
        }
      } catch {
        manifest = null;
      }
    }

    // Step 2.
    if (!manifest) manifest = await freshArchive(store, crawl, prefix);

    // Step 3.
    await hooks.beforeVerify?.();
    await verifyObjects(store, prefix, manifest);
    const drift = sameCounts(manifest, await countCrawlRows(crawl.id));
    if (drift) throw new ArchiveVerifyError(drift);
    const manifestHead = await store.head(manifestKey(prefix));
    const bytes = manifest.tables.reduce((n, t) => n + t.bytes, 0) + (manifestHead?.contentLength ?? 0);

    // Step 4.
    await prisma.crawlJob.update({
      where: { id: crawl.id },
      data: { storageState: "ARCHIVED", archiveKeyPrefix: prefix, archivedAt: new Date(), archiveBytes: bytes },
    });

    const rows = manifest.tables.reduce((n, t) => n + t.rows, 0);
    // Step 5 (resumable: finishArchivedDeletes).
    await hooks.beforeDelete?.();
    await deleteCrawlRows(crawl.id, ARCHIVE_DELETE_BATCH);
    return { status: "archived", reused, bytes, rows };
  } catch (err) {
    const state = await prisma.crawlJob.findUnique({ where: { id: crawl.id }, select: { storageState: true } });
    if (state?.storageState === "ARCHIVING") {
      // Failed before step 4: undo the upload, back to HOT.
      await deleteArchiveObjects(store, prefix).catch((e) => logger.error({ err: e, crawlId }, "crawl archive: could not delete objects after a failure"));
      await prisma.crawlJob.update({ where: { id: crawl.id }, data: { storageState: "HOT", archiveKeyPrefix: null, archiveBytes: null } });
    }
    throw err;
  }
}

/** An ARCHIVED crawl whose row delete was interrupted: finish it. */
export async function finishArchivedDeletes(crawlId: string): Promise<number> {
  const crawl = await prisma.crawlJob.findUnique({ where: { id: crawlId }, select: { storageState: true } });
  if (crawl?.storageState !== "ARCHIVED") return 0;
  return deleteCrawlRows(crawlId, ARCHIVE_DELETE_BATCH);
}

/** ARCHIVED crawls that still have child rows (a crash during step 5). */
export async function archivedWithRows(limit = 100): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT j."id" FROM "crawl_jobs" j
    WHERE j."storageState" = 'ARCHIVED' AND j."dataPurgedAt" IS NULL AND (
      EXISTS (SELECT 1 FROM "crawl_pages" x WHERE x."crawlJobId" = j."id")
      OR EXISTS (SELECT 1 FROM "crawl_issues" x WHERE x."crawlJobId" = j."id")
      OR EXISTS (SELECT 1 FROM "crawl_links" x WHERE x."crawlJobId" = j."id")
      OR EXISTS (SELECT 1 FROM "crawl_extractions" x WHERE x."crawlJobId" = j."id")
      OR EXISTS (SELECT 1 FROM "crawl_page_metrics" x WHERE x."crawlJobId" = j."id"))
    LIMIT ${limit}`;
  return rows.map((r) => r.id);
}

// ── Restore ───────────────────────────────────────────────────────────────

async function* ndjsonLines(body: Readable, hash: Hash): AsyncGenerator<string> {
  const tap = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      hash.update(chunk);
      cb(null, chunk);
    },
  });
  const gunzip = createGunzip();
  body.on("error", (e) => gunzip.destroy(e));
  tap.on("error", (e) => gunzip.destroy(e));
  body.pipe(tap).pipe(gunzip);
  const dec = new StringDecoder("utf8");
  let carry = "";
  for await (const chunk of gunzip) {
    carry += dec.write(chunk as Buffer);
    const parts = carry.split("\n");
    carry = parts.pop()!;
    for (const p of parts) if (p) yield p;
  }
  carry += dec.end();
  if (carry) yield carry;
}

async function insertBatch(table: ArchivedTable, columns: string[], crawlId: string, lines: string[]): Promise<number> {
  const cols = Prisma.raw(columns.map((c) => `"${c}"`).join(", "));
  const json = `[${lines.join(",")}]`;
  // Rows of another crawl (a tampered or misplaced object) are filtered out
  // here and then fail the count check, rather than landing in Postgres.
  return prisma.$executeRaw`
    INSERT INTO ${tableSql(table)} (${cols})
    SELECT ${cols} FROM json_populate_recordset(NULL::${tableSql(table)}, ${json}::json)
    WHERE "crawlJobId" = ${crawlId}`;
}

export type RestoreOutcome = { status: "restored"; rows: number } | { status: "skipped"; reason: string };

export async function restoreCrawl(crawlId: string, store: ObjectStore, hooks: EngineHooks = {}): Promise<RestoreOutcome> {
  const crawl = await prisma.crawlJob.findUnique({
    where: { id: crawlId },
    select: { id: true, tenantId: true, storageState: true, dataPurgedAt: true, archiveKeyPrefix: true },
  });
  if (!crawl) return { status: "skipped", reason: "not_found" };
  if (crawl.dataPurgedAt) return { status: "skipped", reason: "purged" };
  if (crawl.storageState !== "ARCHIVED" && crawl.storageState !== "RESTORING") return { status: "skipped", reason: "not_archived" };
  if (!crawl.archiveKeyPrefix) throw new RestoreError("The crawl has no archive location.");

  const claimed = await prisma.crawlJob.updateMany({
    where: { id: crawl.id, storageState: { in: ["ARCHIVED", "RESTORING"] }, dataPurgedAt: null },
    data: { storageState: "RESTORING" },
  });
  if (claimed.count !== 1) return { status: "skipped", reason: "lost_claim" };

  const prefix = crawl.archiveKeyPrefix;
  let inserted = false;
  try {
    const manifest = await readManifest(store, prefix, crawl);

    // Every table's column plan before a single row is written.
    const plans = new Map<ArchivedTable, string[]>();
    for (const t of manifest.tables) {
      const plan = planColumns(t.columns, await liveColumns(t.table));
      if (plan.missingRequired.length) {
        throw new RestoreError(
          `${t.table} now requires ${plan.missingRequired.join(", ")}, which this archive (format ${manifest.format}, migration ${manifest.migration}) does not have. ` +
            "Add a default for the column or a migration step that fills it, then restore again.",
        );
      }
      if (plan.insert.some((c) => !COLUMN.test(c))) throw new RestoreError(`${t.table}: unexpected column name`);
      if (plan.dropped.length || plan.defaulted.length) {
        logger.info({ crawlId, table: t.table, dropped: plan.dropped, defaulted: plan.defaulted }, "crawl restore: column drift");
      }
      plans.set(t.table, plan.insert);
    }

    // A previous attempt that died mid-way leaves rows behind; start clean.
    if (await hasAnyRows(crawl.id)) await deleteCrawlRows(crawl.id, ARCHIVE_DELETE_BATCH);

    let total = 0;
    for (const t of manifest.tables) {
      const hash = createHash("sha256");
      const columns = plans.get(t.table)!;
      let n = 0;
      let batch: string[] = [];
      for await (const line of ndjsonLines(await store.get(t.key), hash)) {
        batch.push(line);
        if (batch.length >= RESTORE_INSERT_BATCH) {
          inserted = true;
          n += await insertBatch(t.table, columns, crawl.id, batch);
          batch = [];
        }
      }
      if (batch.length) {
        inserted = true;
        n += await insertBatch(t.table, columns, crawl.id, batch);
      }
      if (hash.digest("hex") !== t.sha256) throw new RestoreError(`${t.table}: the downloaded object does not match its sha256`);
      if (n !== t.rows) throw new RestoreError(`${t.table}: restored ${n} rows, the manifest lists ${t.rows}`);
      total += n;
      await hooks.afterRestoreTable?.(t.table);
    }

    const counts = await countCrawlRows(crawl.id);
    const off = sameCounts(manifest, counts);
    if (off) throw new RestoreError(off);

    await prisma.crawlJob.update({ where: { id: crawl.id }, data: { storageState: "HOT", restoredAt: new Date() } });
    return { status: "restored", rows: total };
  } catch (err) {
    if (inserted || (await hasAnyRows(crawl.id))) {
      await deleteCrawlRows(crawl.id, ARCHIVE_DELETE_BATCH).catch((e) => logger.error({ err: e, crawlId }, "crawl restore: could not delete the partial rows"));
    }
    await prisma.crawlJob.update({ where: { id: crawl.id }, data: { storageState: "ARCHIVED" } });
    throw err;
  }
}
