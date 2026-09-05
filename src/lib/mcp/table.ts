// Portions adapted from every-app/open-seo (MIT)
//
// src/lib/mcp/table.ts
//
// Shared renderer for MCP tool TEXT output.
//
// WHY BOTH A TABLE AND structuredContent. Every tool here returns its rows
// twice: once as `structuredContent` (typed data, what a modern client reads)
// and once as a text block. That is not redundancy — a large share of MCP
// clients still surface only the text content block, and a tool that renders
// its text as "12 rows" while the data hides in structuredContent is, to those
// clients, a tool that returns nothing. Rendering every row as a compact
// pipe-delimited table keeps the two in parity.
//
// PURE, AND DELIBERATELY DEPENDENCY-FREE. No zod, no prisma, no react — this
// module is imported by the protocol handler, which is itself imported by
// tests that run under `node --test` with no bundler.

export type McpTableColumn<T> = {
  header: string;
  value: (row: T) => unknown;
  /** Override the default cell formatting for this column. */
  format?: (value: unknown) => string;
};

/** Rendered for a null/undefined/empty cell. An em dash, not "null": the text
 *  block is read by humans as often as by models. */
export const EMPTY_CELL = "—";

/**
 * Format a single cell.
 *
 * Nullish/empty -> "—". Integers stay exact (a position of 3 must not render
 * as "3.00"). Other numbers get 2 decimals. Strings are collapsed to a single
 * line, because one stray newline in provider text — or in a search query typed
 * by a stranger — would otherwise split a row in half and silently corrupt
 * every row after it.
 */
export function formatMcpCell(value: unknown): string {
  if (value == null || value === "") return EMPTY_CELL;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return EMPTY_CELL;
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "string") return value.replace(/\s+/g, " ").trim();
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  // Arrays/objects would stringify to "[object Object]"; emit compact JSON so a
  // stray nested value still reads as something in the text table.
  try {
    return JSON.stringify(value) ?? EMPTY_CELL;
  } catch {
    return EMPTY_CELL;
  }
}

/**
 * Column `format` that truncates long text AFTER normal cell formatting, so
 * provider prose cannot dominate the table. The full text stays in
 * structuredContent — this only bounds the human-readable rendering.
 */
export function truncatedCell(maxLength: number) {
  return (value: unknown): string => {
    const cell = formatMcpCell(value);
    return cell.length > maxLength ? `${cell.slice(0, maxLength - 1)}…` : cell;
  };
}

/** Render rows as a `header | header` table with one line per row. */
export function formatMcpTable<T>(
  rows: readonly T[],
  columns: readonly McpTableColumn<T>[],
): string {
  const headerLine = columns.map((column) => column.header).join(" | ");
  const rowLines = rows.map((row) =>
    columns
      .map((column) => {
        const raw = column.value(row);
        return column.format ? column.format(raw) : formatMcpCell(raw);
      })
      .join(" | "),
  );
  return [headerLine, ...rowLines].join("\n");
}

/**
 * A table with a leading summary line, and the shape every list-returning tool
 * uses. An empty set renders as the summary plus `emptyNote` rather than a
 * bare header row over nothing — "0 rows" is an answer, and it deserves to
 * read like one.
 */
export function formatMcpSection<T>(opts: {
  title: string;
  rows: readonly T[];
  columns: readonly McpTableColumn<T>[];
  emptyNote: string;
  /** Extra lines between the title and the table (counts, windows, costs). */
  facts?: readonly string[];
}): string {
  const head = [opts.title, ...(opts.facts ?? [])];
  if (opts.rows.length === 0) return [...head, opts.emptyNote].join("\n");
  return [...head, "", formatMcpTable(opts.rows, opts.columns)].join("\n");
}

/** `key: value` lines, for the tools that return one object rather than rows. */
export function formatMcpFacts(
  facts: readonly (readonly [string, unknown])[],
): string {
  return facts.map(([key, value]) => `${key}: ${formatMcpCell(value)}`).join("\n");
}

/**
 * Walk a chain of keys through nested unknown records (provider rows, stored
 * JSON columns). Returns undefined if any hop is not an object, so a column
 * accessor cannot throw on a shape that drifted.
 */
export function readPath(source: unknown, ...path: string[]): unknown {
  let current: unknown = source;
  for (const key of path) {
    if (typeof current !== "object" || current === null) return undefined;
    current = Reflect.get(current, key);
  }
  return current;
}
