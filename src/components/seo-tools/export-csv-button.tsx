"use client";

// src/components/seo-tools/export-csv-button.tsx
//
// The client-side export: serialize what the table is currently showing and
// hand it to the browser as a download. No server round trip.
//
// WHY CLIENT-SIDE IS THE DEFAULT. These tables already hold their full result
// set in React state — a SERP top-100, a keyword list, a rank-tracker board.
// Exporting from that state costs nothing, works offline of the API, and — the
// part that actually matters to the person clicking — exports what they are
// LOOKING AT: their filters, their sort, their column choices. A server export
// would have to be told all of that again, and would drift from the table the
// moment either side changed.
//
// The server path (?format=csv, src/lib/csv-stream.ts) is for the tables that
// genuinely cannot hold their data client-side — Site Crawler pages and issues
// run to tens of thousands of rows.
//
// SAME SERIALIZER AS THE SERVER. Both call toCsv(), so a table exported here
// and the same table exported from an API route are byte-identical apart from
// row order. The BOM and the formula guard come with it; see csv-export.ts for
// why both matter.

import { useState } from "react";
import { Download } from "lucide-react";
import { toCsv, csvFilename, type CsvColumn } from "@/lib/csv-export";

interface ExportCsvButtonProps<Row> {
  /** The rows as currently filtered and sorted — export what is on screen. */
  rows: readonly Row[];
  columns: readonly CsvColumn<Row>[];
  /** Tool slug for the filename: echorank-<tool>-<yyyy-mm-dd>.csv. */
  tool: string;
  /** Button text. Comes from the tool's own catalog, so it stays translated. */
  label: string;
  className?: string;
}

export function ExportCsvButton<Row>({
  rows,
  columns,
  tool,
  label,
  className,
}: ExportCsvButtonProps<Row>) {
  const [busy, setBusy] = useState(false);

  const download = () => {
    setBusy(true);
    try {
      // text/csv with an explicit UTF-8 charset. The BOM is inside the string
      // from toCsv(); the charset here is what stops a browser guessing when
      // the file is opened from the download bar rather than saved.
      const blob = new Blob([toCsv(rows, columns)], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = csvFilename(tool);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      // Revoking immediately can cancel the download in Safari, which reads the
      // object URL after the click handler returns.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={download}
      // Disabled on an empty table rather than hidden: a button that vanishes
      // when a filter matches nothing reads as a broken feature, while a
      // greyed-out one reads as "nothing to export", which is the truth.
      disabled={busy || rows.length === 0}
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 disabled:cursor-not-allowed disabled:opacity-50"
      }
    >
      <Download className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}
