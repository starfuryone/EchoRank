// src/lib/site-crawler/archive/constants.ts — the crawl archive's knobs and
// flags. Dependency-free. Flags are read at call time (a `pm2 restart
// --update-env` takes effect without a code change).

/** Completed crawls per site kept in Postgres, newest first (the "hot" set). */
export const HOT_PER_SITE = 2;
/** A restored crawl stays hot this long before it may be archived again. */
export const RESTORED_HOT_DAYS = 7;

/** Rows per keyset read while archiving (by primary key). */
export const ARCHIVE_READ_BATCH = 2_000;
/** Rows per DELETE statement once the archive is verified. */
export const ARCHIVE_DELETE_BATCH = 10_000;
/** Rows per INSERT while restoring. */
export const RESTORE_INSERT_BATCH = 1_000;

/** The daily sweep: 05:17 UTC, after the 04:00–04:35 backups. A cron pattern, never `every`. */
export const ARCHIVE_SWEEP_CRON = "17 5 * * *";
/** Crawls archived per sweep at most. */
export const ARCHIVE_SWEEP_MAX = 50;

/** Generated exports in Spaces older than this are deleted by the sweep. */
export const EXPORT_TTL_DAYS = 7;
/** Lifetime of a presigned download URL. */
export const EXPORT_URL_TTL_SECONDS = 15 * 60;

const on = (v: string | undefined) => v?.trim().toLowerCase() === "true";

/** CRAWL_ARCHIVE_ENABLED=true turns the archive sweep on. Default off. */
export function archiveEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return on(env.CRAWL_ARCHIVE_ENABLED);
}

/** CRAWL_ARCHIVE_DRY_RUN — anything but an explicit "false" is a dry run (log only, touch nothing). */
export function archiveDryRun(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.CRAWL_ARCHIVE_DRY_RUN?.trim().toLowerCase() !== "false";
}

/** EXPORTS_VIA_SPACES=true (and Spaces configured) sends downloads through the bucket. */
export function exportsViaSpacesFlag(env: NodeJS.ProcessEnv = process.env): boolean {
  return on(env.EXPORTS_VIA_SPACES);
}
