// Category 09 — analytics readout. Parsing and delta arithmetic in TypeScript;
// the pasted rows never reach the API.
//
// The optional AI step receives the computed summary — which metrics moved and
// by how much — and is explicitly told not to describe the numbers back. A
// model is not needed to subtract two columns, and shipping a tenant's revenue
// table to a third party to have it read aloud would be the worst of both.

export interface MetricRow {
  label: string;
  current: number;
  previous: number | null;
  delta: number | null;
  /** Percent change, null when the previous value is 0 or absent. */
  percentChange: number | null;
}

export interface AnalyticsSummary {
  rowCount: number;
  columns: string[];
  rows: MetricRow[];
  topMovers: MetricRow[];
  bottomMovers: MetricRow[];
  /** Rows whose previous value was absent or zero — growth is undefined. */
  unbaselined: MetricRow[];
}

/** Split a CSV/TSV line, honouring double-quoted fields containing the delimiter. */
export function splitRow(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // "" inside a quoted field is a literal quote.
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === delimiter && !quoted) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

/** Tab, comma or semicolon — whichever is most common in the header line. */
export function detectDelimiter(headerLine: string): string {
  const counts = ["\t", ",", ";"].map((d) => ({ d, n: headerLine.split(d).length - 1 }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0].n > 0 ? counts[0].d : ",";
}

/**
 * Numbers as analytics tools actually export them: "1,234", "45.6%", "$1.2k",
 * "(320)" for negatives. Returns null when there is no number to find, which is
 * how a label column is distinguished from a metric column.
 */
export function parseNumber(raw: string): number | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s || s === "-" || s === "—" || s.toLowerCase() === "n/a") return null;

  const negative = /^\(.*\)$/.test(s) || s.startsWith("-");
  let body = s.replace(/^\(|\)$/g, "").replace(/^-/, "");
  body = body.replace(/[$£€,\s]/g, "");

  const percent = body.endsWith("%");
  if (percent) body = body.slice(0, -1);

  let multiplier = 1;
  const suffix = body.slice(-1).toLowerCase();
  if (suffix === "k") { multiplier = 1_000; body = body.slice(0, -1); }
  else if (suffix === "m") { multiplier = 1_000_000; body = body.slice(0, -1); }
  else if (suffix === "b") { multiplier = 1_000_000_000; body = body.slice(0, -1); }

  if (!/^\d*\.?\d+$/.test(body)) return null;
  const n = parseFloat(body) * multiplier;
  return negative ? -n : n;
}

function round(n: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/**
 * Parse a pasted table into metric rows.
 *
 * Shape assumed: first column is the label, and the first two numeric columns
 * are current and previous IN THAT ORDER. Exports vary too much to infer more
 * than that, so the UI states the assumption rather than guessing at headers.
 */
export function parseAnalytics(raw: string): AnalyticsSummary {
  const text = raw.replace(/\r\n/g, "\n").trim();
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    return { rowCount: 0, columns: [], rows: [], topMovers: [], bottomMovers: [], unbaselined: [] };
  }

  const delimiter = detectDelimiter(lines[0]);
  const header = splitRow(lines[0], delimiter);
  // A header line is one whose non-first cells are not numbers.
  const headerIsLabels = header.slice(1).every((c) => parseNumber(c) === null);
  const bodyLines = headerIsLabels ? lines.slice(1) : lines;
  const columns = headerIsLabels ? header : header.map((_, i) => (i === 0 ? "metric" : `col${i}`));

  const rows: MetricRow[] = [];
  for (const line of bodyLines) {
    const cells = splitRow(line, delimiter);
    if (cells.length < 2) continue;
    const label = cells[0];
    if (!label) continue;

    const numbers = cells.slice(1).map(parseNumber).filter((n): n is number => n !== null);
    if (numbers.length === 0) continue;

    const current = numbers[0];
    const previous = numbers.length > 1 ? numbers[1] : null;
    const delta = previous === null ? null : round(current - previous);
    const percentChange =
      previous === null || previous === 0 ? null : round(((current - previous) / Math.abs(previous)) * 100, 1);

    rows.push({ label, current, previous, delta, percentChange });
  }

  const comparable = rows.filter((r) => r.percentChange !== null);
  const sorted = [...comparable].sort(
    (a, b) => (b.percentChange ?? 0) - (a.percentChange ?? 0) || a.label.localeCompare(b.label),
  );

  return {
    rowCount: rows.length,
    columns,
    rows,
    topMovers: sorted.slice(0, 3),
    bottomMovers: sorted.slice(-3).reverse(),
    // Called out rather than silently dropped: a metric that went 0 → 400 has
    // no percentage, and hiding it would bury the most interesting row.
    unbaselined: rows.filter((r) => r.percentChange === null),
  };
}

/**
 * The ONLY thing the optional AI step sees. Movements and labels — never the
 * full pasted table.
 */
export function summaryForAi(summary: AnalyticsSummary): string {
  const fmt = (r: MetricRow) =>
    `${r.label}: ${r.current}` +
    (r.previous !== null ? ` (was ${r.previous}, ${r.percentChange! >= 0 ? "+" : ""}${r.percentChange}%)` : " (no prior period)");

  const lines = [`${summary.rowCount} metrics.`, "", "Biggest increases:"];
  lines.push(...(summary.topMovers.length ? summary.topMovers.map((r) => `- ${fmt(r)}`) : ["- none"]));
  lines.push("", "Biggest decreases:");
  lines.push(...(summary.bottomMovers.length ? summary.bottomMovers.map((r) => `- ${fmt(r)}`) : ["- none"]));
  if (summary.unbaselined.length) {
    lines.push("", "No comparable prior period:");
    lines.push(...summary.unbaselined.slice(0, 5).map((r) => `- ${fmt(r)}`));
  }
  return lines.join("\n");
}
