// src/lib/csv-stream.ts
//
// The server-side export path: a CSV response streamed from a keyset cursor.
//
// STREAMED, NOT BUFFERED. A 25,000-URL crawl carries six figures of issues, and
// building that string in memory before responding is exactly what this box
// cannot afford — it serves production from the working tree with pm2 capped at
// 1536 MB. Peak memory here is one page of rows however large the export is.
//
// KEYSET, NOT OFFSET. `id > cursor` stays flat as the export runs; an OFFSET
// scan re-reads everything it skipped on every page, so the last page of a
// hundred-thousand-row export costs a hundred thousand row reads.
//
// ORDERING IS BY CURSOR, NOT BY THE LIST ROUTE'S SORT. The JSON list routes
// order for display (severity, then type); a keyset walk needs a unique, stable
// column, so exports walk the primary key instead. The row SET is identical for
// the same filters — which is what the caller actually depends on — but the row
// ORDER is not, and a spreadsheet sorts itself anyway.

import {
  UTF8_BOM,
  contentDisposition,
  csvHeader,
  csvRow,
  truncationNotice,
  type CsvColumn,
} from "./csv-export";

/**
 * Hard ceiling on exported rows.
 *
 * Not a memory limit — the stream does not care — but a limit on how long one
 * request may hold a database connection on a shared box. Beyond this the file
 * carries a truncation notice rather than stopping silently.
 */
export const CSV_ROW_CAP = 50_000;

/** Rows per round trip. Peak memory is one of these. */
export const CSV_CHUNK_SIZE = 500;

export interface CsvStreamSource<Row> {
  columns: readonly CsvColumn<Row>[];
  filename: string;
  /** Page after `cursor`, ordered by the cursor column ascending. */
  fetchPage: (cursor: string | null, take: number) => Promise<Row[]>;
  /** The row's cursor value — must be unique and sortable. */
  cursorOf: (row: Row) => string;
  cap?: number;
  chunkSize?: number;
}

/**
 * Build the streamed CSV response.
 *
 * The BOM is written as the response's very first bytes, ahead of the header
 * line, so Excel sees it before anything else — see csv-export.ts for why that
 * matters. Rows are serialized with the same functions the client button uses,
 * so a table exported from the browser and the same table exported from the
 * server are byte-identical apart from row order.
 */
export function csvStreamResponse<Row>(source: CsvStreamSource<Row>): Response {
  const cap = source.cap ?? CSV_ROW_CAP;
  const chunkSize = source.chunkSize ?? CSV_CHUNK_SIZE;
  const encoder = new TextEncoder();

  let cursor: string | null = null;
  let written = 0;
  let done = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(UTF8_BOM + csvHeader(source.columns) + "\r\n"));
    },
    async pull(controller) {
      if (done) return;
      try {
        // Never fetch past the cap: asking for a full page when two rows of
        // headroom remain would read 498 rows only to discard them.
        const take = Math.min(chunkSize, cap - written);
        const rows = take > 0 ? await source.fetchPage(cursor, take) : [];

        if (rows.length === 0) {
          done = true;
          controller.close();
          return;
        }

        let chunk = "";
        for (const row of rows) {
          chunk += csvRow(row, source.columns) + "\r\n";
        }
        controller.enqueue(encoder.encode(chunk));

        written += rows.length;
        cursor = source.cursorOf(rows[rows.length - 1]!);

        // A short page means the query is exhausted. Hitting the cap exactly
        // is indistinguishable from "there is more", so the notice is written
        // whenever the cap stops us — erring toward telling the reader.
        if (rows.length < take) {
          done = true;
          controller.close();
        } else if (written >= cap) {
          controller.enqueue(
            encoder.encode(truncationNotice(source.columns, cap) + "\r\n"),
          );
          done = true;
          controller.close();
        }
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": contentDisposition(source.filename),
      // An export is a point-in-time snapshot of tenant data; it must not be
      // held by a shared cache.
      "cache-control": "no-store",
    },
  });
}

/** True when the request asked for CSV rather than JSON. */
export function wantsCsv(url: URL): boolean {
  return url.searchParams.get("format")?.toLowerCase() === "csv";
}
