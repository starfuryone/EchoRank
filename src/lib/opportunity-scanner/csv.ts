// src/lib/opportunity-scanner/csv.ts
//
// The scan export's column set, for src/lib/csv-export.ts.
//
// PURE. No Prisma, no NextResponse — the route wires this to toCsv() and the
// tests assert the shape without either.
//
// ── Why the formula guard matters more here than anywhere else ──────────────
// csv-export.ts guards every non-numeric cell unconditionally, and this is the
// table that justifies the rule. Every string below originated on a website we
// do not control: the domain came off an agency's prospect list, and `topGaps`
// carries `status` and `recommendation` strings the sidecar assembled from a
// stranger's robots.txt and page titles. A crawled <title> containing
// `=HYPERLINK(...)` is a real path from "we scanned a site" to "code ran on an
// analyst's laptop", and this export is opened in Excel by definition — it
// exists to be handed to a salesperson.
//
// Nothing here calls guardFormula itself. That is the point: renderCell in
// csv-export.ts does it for every column, so a new column added below cannot
// forget.

import type { CsvColumn } from "@/lib/csv-export";
import type { ScanRowDto } from "./store";

/** Join the top gaps into one cell. */
function gapsCell(row: ScanRowDto): string {
  return row.topGaps.map((g) => g.category).join("; ");
}

/**
 * The export's columns, in the order a salesperson reads them.
 *
 * DOMAIN AND GRADE FIRST, because the file is sorted by grade and the two
 * questions a user has when it opens are "who" and "how bad". Score after the
 * grade rather than before it, for the reason the outreach PDF leads with the
 * letter: "D" is actionable and "41" invites an argument about the scale.
 *
 * `status` and `error` are last and are always present, including on a fully
 * successful batch. A column that appears only when something went wrong makes
 * two exports of the same tool disagree about their own shape, which breaks
 * every spreadsheet built on the first one.
 */
export const SCAN_CSV_COLUMNS: ReadonlyArray<CsvColumn<ScanRowDto>> = [
  { header: "Domain", value: (r) => r.domain },
  { header: "Grade", value: (r) => r.grade },
  { header: "Score", value: (r) => r.score },
  { header: "Top gaps", value: gapsCell },
  // The three gaps get their own columns as well as the joined one above. The
  // joined cell is what a human scans; these are what a mail-merge uses, and an
  // agency doing outreach at this volume is running a mail merge.
  { header: "Gap 1", value: (r) => r.topGaps[0]?.category ?? "" },
  { header: "Gap 1 detail", value: (r) => r.topGaps[0]?.status ?? "" },
  { header: "Gap 2", value: (r) => r.topGaps[1]?.category ?? "" },
  { header: "Gap 2 detail", value: (r) => r.topGaps[1]?.status ?? "" },
  { header: "Gap 3", value: (r) => r.topGaps[2]?.category ?? "" },
  { header: "Gap 3 detail", value: (r) => r.topGaps[2]?.status ?? "" },
  { header: "Google rating", value: (r) => r.place?.rating ?? null },
  { header: "Google reviews", value: (r) => r.place?.reviewCount ?? null },
  { header: "Status", value: (r) => r.status },
  { header: "Error", value: (r) => r.error },
];
