// src/lib/site-crawler/data-state.ts
//
// THE one answer to "may this code read this crawl's child rows?" — used by
// every route, MCP tool, assistant tool and lib function that reads
// crawl_pages / crawl_issues / crawl_links / crawl_extractions /
// crawl_page_metrics for a crawl it was handed.
//
//   hot       the rows are in Postgres: read them.
//   purged    retention deleted them (dataPurgedAt). Gone for good; each
//             surface keeps the behaviour it had before the archive existed.
//   archived  storageState is not HOT: the rows are in the Spaces archive (or
//             on their way there / back). Restorable — the API answers 409
//             ARCHIVED (http.ts archivedResponse), the UI "Archived — Restore".
//
// Purged wins over archived: a crawl retention purged also lost its archive.
// Dependency-free (types only), so a Client Component may import it.

export type CrawlDataState = "hot" | "purged" | "archived";
export type StorageState = "HOT" | "ARCHIVING" | "ARCHIVED" | "RESTORING";

/** What a lookup must select for crawlDataState. Spread into a Prisma select. */
export const DATA_STATE_SELECT = { storageState: true, dataPurgedAt: true } as const;

export interface DataStateRow {
  storageState?: string | null;
  dataPurgedAt?: Date | string | null;
}

export function crawlDataState(row: DataStateRow): CrawlDataState {
  if (row.dataPurgedAt) return "purged";
  if (row.storageState && row.storageState !== "HOT") return "archived";
  return "hot";
}

/** True only when the child rows are in Postgres. */
export function rowsReadable(row: DataStateRow): boolean {
  return crawlDataState(row) === "hot";
}

/** The 409 body for a crawl whose rows are in the archive. */
export function archivedBody(row: DataStateRow) {
  const storageState = (row.storageState ?? "ARCHIVED") as StorageState;
  return {
    error:
      storageState === "RESTORING"
        ? "This crawl is being restored from the archive. Try again in a few minutes."
        : "This crawl is archived. Restore it to see its pages and findings.",
    code: "ARCHIVED" as const,
    storageState,
  };
}
