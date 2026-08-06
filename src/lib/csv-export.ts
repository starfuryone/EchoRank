// src/lib/csv-export.ts
//
// One CSV serializer for every table in the app. No per-tool copies.
//
// PURE, AND NO PRISMA. Both export paths use it — the client button
// (components/export-csv-button.tsx) and the server streaming routes — so it
// cannot reach for a database client or a browser API. The streaming routes
// feed it a page of rows at a time.
//
// THREE THINGS HERE ARE NOT COSMETIC:
//
//   1. The UTF-8 BOM. Excel does not sniff encoding from content; without the
//      BOM it falls back to the system codepage and every accented character
//      in a French keyword or a scraped page title arrives mangled. This is
//      the single most common "your export is broken" report, and the fix is
//      three bytes.
//
//   2. The formula-injection guard. These tables carry keywords, page titles
//      and anchor texts — strings that came from a search engine or from
//      someone else's website. A cell beginning `=` is a formula to Excel and
//      Sheets, and `=HYPERLINK(...)` or a DDE payload in a crawled <title> is
//      a real path from "we scraped a page" to "code ran on an analyst's
//      laptop". Untrusted by definition, so guarded unconditionally.
//
//   3. CRLF. RFC 4180 specifies it, and legacy Excel on Windows is the reader
//      most likely to be handed one of these files.

/** Byte-order mark. Excel needs this to read the file as UTF-8. */
export const UTF8_BOM = "\uFEFF";

/**
 * Leading characters a spreadsheet may treat as the start of a formula.
 *
 * Tab and CR are here because Excel strips them and then evaluates what is
 * left, so "\t=cmd" is as dangerous as "=cmd".
 */
export const FORMULA_TRIGGERS = ["=", "+", "-", "@", "\t", "\r"] as const;

export interface CsvColumn<Row> {
  /** Header text, written verbatim in the first line. */
  header: string;
  /** Pull the raw value out of the row. */
  value: (row: Row) => unknown;
  /**
   * Optional rendering. Skip it and the default formatter applies, which is
   * almost always what you want — see formatValue.
   */
  format?: (value: unknown, row: Row) => string;
}

/**
 * Default cell rendering.
 *
 * DATES ARE ISO 8601 AND NUMBERS ARE UNLOCALIZED, deliberately. A localized
 * number carries thousands separators, and in a comma-delimited file "1,234"
 * either needs quoting or silently becomes two columns; a localized date is
 * ambiguous between 03/04 and 04/03 depending on who opens it. Both choices
 * make the file re-importable rather than merely readable.
 */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") {
    // Prisma Decimal and similar wrappers stringify to their numeric value;
    // anything else lands as JSON rather than "[object Object]".
    const asString = String(value);
    return asString === "[object Object]" ? JSON.stringify(value) : asString;
  }
  return String(value);
}

/**
 * Neutralise a cell that a spreadsheet would read as a formula.
 *
 * NUMBERS ARE EXEMPT, and that exemption is the whole subtlety here. A guard
 * applied blindly to the formatted string would see the "-" in "-42" and write
 * "'-42", turning every negative number in the file — a rank delta, a traffic
 * change — into text that will not sum or sort. A value that arrived as a
 * JavaScript number cannot be a formula, so it passes through; a STRING "-42"
 * from an untrusted source still gets guarded, because we cannot tell it from
 * "-2+3".
 */
export function guardFormula(cell: string, wasNumber: boolean): string {
  if (wasNumber || cell === "") return cell;
  return (FORMULA_TRIGGERS as readonly string[]).includes(cell[0]) ? `'${cell}` : cell;
}

/** RFC 4180 quoting: only when the field needs it, embedded quotes doubled. */
export function quoteField(cell: string): string {
  return /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

function renderCell<Row>(column: CsvColumn<Row>, row: Row): string {
  const raw = column.value(row);
  const formatted = column.format ? column.format(raw, row) : formatValue(raw);
  return quoteField(guardFormula(formatted, typeof raw === "number"));
}

/** The header line, without a trailing newline. */
export function csvHeader<Row>(columns: readonly CsvColumn<Row>[]): string {
  return columns.map((c) => quoteField(c.header)).join(",");
}

/** One row, without a trailing newline. */
export function csvRow<Row>(row: Row, columns: readonly CsvColumn<Row>[]): string {
  return columns.map((c) => renderCell(c, row)).join(",");
}

export interface ToCsvOptions {
  /**
   * Prefix the BOM. Default true. The streaming routes set false because they
   * write the BOM themselves as the very first bytes of the response, ahead of
   * the header line.
   */
  bom?: boolean;
}

/** Serialize rows to a complete CSV document. */
export function toCsv<Row>(
  rows: readonly Row[],
  columns: readonly CsvColumn<Row>[],
  options: ToCsvOptions = {},
): string {
  const lines = [csvHeader(columns), ...rows.map((row) => csvRow(row, columns))];
  // Trailing CRLF: RFC 4180 allows it and some importers drop the final row
  // without one.
  const body = lines.join("\r\n") + "\r\n";
  return (options.bom ?? true) ? UTF8_BOM + body : body;
}

/**
 * `echorank-<tool>-<yyyy-mm-dd>.csv`.
 *
 * The date is UTC so two people in different timezones exporting the same data
 * get the same filename, and it is not localized so the files sort by name.
 */
export function csvFilename(tool: string, now: Date = new Date()): string {
  const slug = tool
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `echorank-${slug}-${now.toISOString().slice(0, 10)}.csv`;
}

/**
 * Content-Disposition value for a download.
 *
 * Quoted, with any quote or backslash in the name stripped rather than escaped
 * — a filename is built from a tool slug and a date here, so anything exotic
 * is a bug rather than a case to support, and header injection is not a risk
 * worth being clever about.
 */
export function contentDisposition(filename: string): string {
  return `attachment; filename="${filename.replace(/["\\]/g, "")}"`;
}

/**
 * The line appended when an export hits its row cap.
 *
 * A TRUNCATED EXPORT MUST SAY SO IN THE FILE. A silent cut looks exactly like
 * a complete export to whoever opens it, and the person most likely to hit the
 * cap is the one doing the analysis that a missing tail would quietly ruin.
 */
export function truncationNotice<Row>(columns: readonly CsvColumn<Row>[], cap: number): string {
  const message = `TRUNCATED: export limited to ${cap} rows. Narrow your filters to see the rest.`;
  const cells = columns.map((_, i) => (i === 0 ? quoteField(message) : ""));
  return cells.join(",");
}
